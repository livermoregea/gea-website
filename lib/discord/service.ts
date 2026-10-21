import { createAdminClient } from '@/lib/supabase/admin';
import { discordDM, discordFetch, discordReply, safeMessage } from '@/lib/discord';
import { actorId, button, row, type Interaction } from './protocol';
import { generateObject } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { assessmentSchema, clarificationPrompt, recommendationSchema, reviewerAssessmentSchema, reviewerClarificationPrompt, scoringPrompt, type PeetTask } from '@/lib/peet-ai';
import { productLink, peetSummary } from '@/lib/peet';
import { calculateCageScore, CAGE_MAX_SCORE } from '@/lib/cage';
import { CONTRACT_YEAR } from '@/lib/officer-tracking';
import { z } from 'zod';

export class DiscordInputError extends Error {}
export async function action(discordId: string, name: string, args = {}, key?: string): Promise<any> {
  const { data, error } = await createAdminClient().rpc('discord_action', { p_discord_id: discordId, p_action: name, p_args: args, p_key: key || null });
  if (error) {
    if (error.code === 'P0001') throw new DiscordInputError(error.message);
    throw new Error('Discord database operation failed.');
  }
  return data;
}
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await createAdminClient().rpc(name, args);
  if (error) throw new Error('Could not save the assessment.');
  return data;
}
async function ai<T>(userId: string, schema: z.ZodType<T>, system: string, evidence: unknown): Promise<T> {
  if (!process.env.GROQ_API_KEY) throw new Error('Groq is not configured.');
  const allowed = await rpc('reserve_gea_peet_ai_request', { p_user_id: userId });
  if (!allowed) throw new DiscordInputError('AI rate limit reached. Please try again in ten minutes.');
  const model = createGroq({ apiKey: process.env.GROQ_API_KEY })(process.env.GROQ_PEET_MODEL || 'llama-3.3-70b-versatile');
  const { object } = await generateObject({ model, schema, providerOptions: { groq: { structuredOutputs: false } }, system: `${system}\nComplexity, impact, and autonomy are context for the existing PEET rubric, never additional scoring dimensions. You cannot open document links.\nJSON schema: ${JSON.stringify(z.toJSONSchema(schema))}`, prompt: JSON.stringify(evidence), temperature: 0, maxRetries: 0, maxOutputTokens: 2000, abortSignal: AbortSignal.timeout(25000) });
  return schema.parse(object);
}
function questionsMessage(task: PeetTask, reviewer = false) {
  const questions = reviewer ? task.reviewer_assessment!.reviewerQuestions : task.assessment.studentQuestions;
  return { content: `${task.title}\n${questions.map((q, n) => `${n + 1}. ${q}`).join('\n')}`.slice(0, 1950), components: [row(button('Answer questions', `${reviewer ? 'reviewanswers' : 'clarify'}:${task.id}:${task.version}:${questions.length}`))] };
}
async function privateQuestions(i: Interaction, task: PeetTask, reviewer = false) {
  const message = questionsMessage(task, reviewer);
  try { await discordDM(actorId(i), message); await discordReply(i.token, { content: 'Questions sent to your DMs.', components: [] }); }
  catch { await discordReply(i.token, message); }
}
async function notifyReviewers(task: PeetTask) {
  // Review authorization is checked again when each reviewer opens the UI.
  const channel = process.env.DISCORD_REVIEW_CHANNEL_ID;
  if (channel) await discordFetch(`channels/${channel}/messages`, safeMessage({ content: `A contribution is ready for independent review: ${task.title}`, components: [row(button('Start review', `review:${task.id}`))] }));
}
export async function handleInteraction(i: Interaction) {
  const discordId = actorId(i);
  const me = await action(discordId, 'me');
  const options = Object.fromEntries((i.data?.options || []).map(o => [o.name, o.value]));
  const fields = Object.fromEntries((i.data?.components || []).flatMap(r => r.components || []).map(c => [c.custom_id, c.value.trim()]));
  const command = i.data?.name;
  let custom = i.data?.custom_id || '';
  if (custom.startsWith('pick:')) custom = `${custom.slice(5)}:${i.data?.values?.[0] || ''}`;
  const [verb, id, versionText] = custom.split(':');
  const version = Number(versionText);
  const key = (suffix: string) => `${i.id}:${suffix}`;
  const reply = (content: string, components: unknown[] = []) => discordReply(i.token, { content: content.slice(0, 2000), components });
  const menu = async (name: string, rows: { id: string; title: string }[], label: string) => {
    if (!rows.length) return reply('No available records.');
    await reply(label, [row({ type: 3, custom_id: `pick:${name}`, options: rows.map(t => ({ label: t.title.slice(0, 100), value: t.id })) })]);
  };
  if (command === 'score') {
    const data = await action(discordId, 'score');
    const peet = peetSummary(data.tasks, data.evaluations, me.id);
    const strikes = data.strikes.filter((s: any) => s.academic_year === CONTRACT_YEAR && s.status === 'confirmed');
    const attendance = strikes.filter((s: any) => s.category === 'attendance').length;
    const conduct = strikes.filter((s: any) => s.category === 'conduct').length;
    const cage = calculateCageScore(peet.score, attendance, conduct);
    return reply(`Your PEET: ${peet.score === null ? 'N/A' : peet.score.toFixed(1) + ' /100'} (${peet.evaluated} evaluations)\nYour CAGE: ${cage === null ? 'N/A' : cage.toFixed(1) + ' /' + CAGE_MAX_SCORE}\n${CONTRACT_YEAR}: ${attendance} attendance strikes · ${conduct} conduct strikes`);
  }
  if (command === 'submit-task' || command === 'tasks') return menu('task', await action(discordId, 'tasks'), 'Choose your task:');
  if (verb === 'task') return reply('Submit your personal contribution and supporting document.', [row(button('Submit task', `submit:${id}`))]);
  if (command === 'absence-notice' || command === 'events') return menu('event', await action(discordId, 'events'), 'Choose a meeting or event:');
  if (verb === 'event') return reply(`Event ID: ${id}\nRecord advance notice:`, [row(button('Absence / tardiness notice', `absence:${id}`))]);
  if (command === 'assign-task') {
    if (me.role !== 'admin') throw new DiscordInputError('Reviewer access required.');
    return reply('Describe the work and due date.', [row(button('Create assignment', `assign:${options.officer}:${options.channel || ''}`))]);
  }
  if (command === 'mark-attendance') {
    await action(discordId, 'attendance', { event: z.uuid().parse(options.event), officer: options.officer, status: options.status, notes: options.notes || '' }, key('attendance'));
    return reply('Attendance saved.');
  }
  if (command === 'review-task') return menu('review', await action(discordId, 'reviews'), 'Choose a pending contribution:');
  if (verb === 'assign' && i.type === 5) {
    const taskId = await action(discordId, 'assign', { officer: id, title: fields.title, description: fields.description, due: fields.due, channel: versionText || '' }, key('assign'));
    return reply(`Task assigned. ID: ${taskId}`);
  }
  if (verb === 'absence' && i.type === 5) {
    if (!fields.notice || fields.notice.length > 2000) throw new DiscordInputError('Enter a notice within 2000 characters.');
    await action(discordId, 'absence', { event: z.uuid().parse(id), notice: fields.notice }, key('absence'));
    return reply('Advance notice saved. A reviewer determines whether the absence is excused.');
  }
  if (verb === 'submit' && i.type === 5) {
    if (!productLink(fields.link) || !fields.notes) throw new DiscordInputError('Provide work notes and a valid HTTP(S) project or document link.');
    const source = await action(discordId, 'source', { id: z.uuid().parse(id) });
    if (!source.participant_ids?.includes(me.id)) throw new DiscordInputError('Choose one of your own tasks.');
    let task = await action(discordId, 'existing', { id }) as PeetTask | null;
    if (!task) {
      // Save evidence before the external model call so a provider outage loses no work.
      await rpc('save_discord_submission', { p_discord_id: discordId, p_task_id: id, p_notes: fields.notes, p_url: fields.link });
      const fresh = await action(discordId, 'source', { id });
      const assessment = await ai(me.id, assessmentSchema, clarificationPrompt, { originalTask: fresh, contribution: fields.notes, submissionUrl: fields.link });
      task = await rpc(source.individual_peet ? 'save_gea_peet_contribution_assessment' : 'save_gea_peet_assessment', {
        p_task_id: id, p_student_id: me.id, p_description: fields.notes, p_category: 'Event Support', p_source_context: fresh,
        p_assessment: assessment, p_model: process.env.GROQ_PEET_MODEL || 'llama-3.3-70b-versatile', p_submission_url: fields.link,
        ...(source.individual_peet ? { p_deliverable_description: fresh.submission_description } : {}),
      });
    }
    if (task!.status !== 'clarification') return reply('Your contribution is already submitted for review.');
    return privateQuestions(i, task!);
  }
  if (verb === 'clarify' && i.type === 5) {
    const task = await action(discordId, 'assessment', { id }) as PeetTask;
    if (task.student_id !== me.id) throw new DiscordInputError('Answer your own clarification questions.');
    const answers = task.assessment.studentQuestions.map((_, n) => fields[`answer${n}`]);
    const saved = await action(discordId, 'finalize', { id, version, answers }, key('finalize'));
    await notifyReviewers(saved);
    return reply('Clarification saved. Your contribution is ready for reviewer evaluation.');
  }
  if (verb === 'review') {
    let task = await action(discordId, 'assessment', { id }) as PeetTask;
    if (task.status !== 'pending') throw new DiscordInputError('This submission is no longer pending.');
    const source = await action(discordId, 'source', { id: task.task_id });
    // The database save rechecks independent reviewer permissions.
    if (task.questions_by !== me.id || !task.reviewer_assessment) {
      const assessment = await ai(me.id, reviewerAssessmentSchema, reviewerClarificationPrompt, { task, source });
      task = await rpc('save_gea_peet_review', { p_task_id: task.id, p_version: task.version, p_actor: me.id, p_source_context: source, p_stage: 'questions', p_result: assessment, p_notes: '', p_answers: [], p_model: process.env.GROQ_PEET_MODEL || 'llama-3.3-70b-versatile' });
    }
    return reply(`${task.title}\n${task.reviewer_assessment!.reviewerQuestions.map((q, n) => `${n + 1}. ${q}`).join('\n')}`, [row(button('Answer reviewer questions', `reviewanswers:${task.id}:${task.version}:${task.reviewer_assessment!.reviewerQuestions.length}`)), row(button('Request revision', `revision:${task.id}:${task.version}`, 2), button('Reject', `reject:${task.id}:${task.version}`, 4))]);
  }
  if (verb === 'reviewanswers' && i.type === 5) {
    const task = await action(discordId, 'assessment', { id }) as PeetTask;
    if (task.questions_by !== me.id || task.version !== version || !task.reviewer_assessment) throw new DiscordInputError('Review changed. Open it again.');
    const answers = task.reviewer_assessment.reviewerQuestions.map((_, n) => z.string().trim().min(1).max(2000).parse(fields[`answer${n}`]));
    const source = await action(discordId, 'source', { id: task.task_id });
    const recommendation = await ai(me.id, recommendationSchema, scoringPrompt, { originalTask: source, submission: task.description, studentQuestions: task.assessment.studentQuestions, studentAnswers: task.answers, reviewerQuestions: task.reviewer_assessment.reviewerQuestions, reviewerAnswers: answers });
    const saved = await rpc('save_gea_peet_review', { p_task_id: id, p_version: version, p_actor: me.id, p_source_context: source, p_stage: 'score', p_result: recommendation, p_notes: '', p_answers: answers, p_model: process.env.GROQ_PEET_MODEL || 'llama-3.3-70b-versatile' });
    return reply(`${task.title}\nEfficiency ${recommendation.efficiency} · Effectiveness ${recommendation.effectiveness} · Time ${recommendation.time}\n${recommendation.justification}`, [row(button('Approve recommendation', `approve:${id}:${saved.version}`, 3), button('Adjust scores', `manual:${id}:${saved.version}`, 2)), row(button('Request revision', `revision:${id}:${saved.version}`, 2), button('Reject', `reject:${id}:${saved.version}`, 4))]);
  }
  if (verb === 'approve' || (verb === 'manual' && i.type === 5)) {
    const task = await action(discordId, 'assessment', { id }) as PeetTask;
    const scores = verb === 'manual' ? { efficiency: Number(fields.efficiency), effectiveness: Number(fields.effectiveness), time: Number(fields.time) } : task.recommendation;
    const saved = await action(discordId, 'approve', { id, version, scores: scores && { efficiency: scores.efficiency, effectiveness: scores.effectiveness, time: scores.time }, reason: fields.reason || '' }, key('approve'));
    return reply(`Approved: ${saved.title}. PEET and CAGE now reflect this evaluation.`);
  }
  if ((verb === 'revision' || verb === 'reject') && i.type === 5) {
    const task = await action(discordId, verb, { id, version, feedback: fields.feedback }, key('decision')) as PeetTask;
    const { data: officer, error } = await createAdminClient().from('officer_profiles').select('discord_id').eq('id', task.student_id).single();
    if (error) throw new Error('Could not find the submitter.');
    if (officer?.discord_id) {
      try { await discordDM(officer.discord_id, questionsMessage(task)); }
      catch { return reply('Decision saved. DM delivery failed; the officer can reopen /submit-task or view the website.'); }
    }
    return reply(verb === 'reject' ? 'Submission rejected without awarding a score. Feedback saved; the officer may revise.' : 'Revision requested.');
  }
  throw new DiscordInputError('Use /tasks, /submit-task, /absence-notice, /score, /assign-task, /review-task, or /mark-attendance.');
}
