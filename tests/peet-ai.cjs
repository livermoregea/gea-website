const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const { createOpenAI } = require('@ai-sdk/openai');
const { generateObject } = require('ai');
const { z } = require('zod');
function load(file, dependencies = {}, env = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports, require: name => dependencies[name] ?? require(name), process: { env }, Error, URL, AbortSignal, Request, Response, TextDecoder });
  return exports;
}
const schemas = load('lib/peet-ai.ts', { './peet': load('lib/peet.ts') });
const next = { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } };
const baseDeps = { 'next/server': next, '@/lib/supabase/server': { createClient: async () => ({}) }, '@/lib/supabase/admin': { createAdminClient: () => ({}) } };
const server = load('lib/peet-ai-server.ts', baseDeps);
const uuid = '11111111-1111-4111-8111-111111111111';
const score = { efficiency: 3, effectiveness: 3.5, time: 3, justification: 'Efficient progress; deliverables exceeded expected quality; met the agreed deadline.' };
const assessment = { needsMoreInfo: true, studentQuestions: ['When did you finish and what did you deliver?'], initialAssessmentSummary: 'Confirm the result and completion date.' };
const reviewerAssessment = { reviewerQuestions: ['What goals and quality standards were agreed, and how did the deliverables compare?', 'Was the agreed deadline met, and what help or rework was needed?'], reviewContextSummary: 'Confirm goals, quality, efficiency, and timing.' };
const source = { id: uuid, title: 'Workshop', description: 'Deliver a useful workshop for 30 people', status: 'submitted', due_date: '2026-10-16', original_due_date: '2026-10-16', final_product_url: 'https://example.com/slides', submission_description: 'Delivered workshop', submitted_at: '2026-10-16T18:00:00Z', cancelled_at: null };
const task = { id: uuid, task_id: uuid, student_id: 'student', student_name: 'Student One', title: source.title, description: 'Delivered workshop', category: 'Outreach', source_context: source, assessment, answers: ['Workshop and slides completed by the deadline.'], status: 'pending', version: 2, reviewer_notes: '', reviewer_assessment: reviewerAssessment, reviewer_answers: ['Met agreed goals and excellent quality.', 'Finished on time with appropriate guidance.'], questions_by: 'reviewer', reviewed_by: 'reviewer', recommendation: score };
const actor = { reviewer: true, student: false, user: { id: 'reviewer' } };
const req = body => new Request('https://gea.test/api/peet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
function route(file, overrides = {}, generate = async () => ({ object: score })) {
  return load(`app/api/peet/${file}/route.ts`, { 'next/server': next, '@/lib/peet-ai': schemas, '@/lib/peet': load('lib/peet.ts'),
    '@/lib/peet-ai-server': { ...server, peetActor: async () => actor, peetModel: () => ({ model: {}, modelId: 'test-model' }), limitPeetAI: async () => {}, ...overrides }, ai: { generateObject: generate } });
}
test('PEET uses the existing 1–4 Efficiency, Effectiveness, Time scale and average /100', () => {
  assert.equal(schemas.peetScorePercent({ efficiency: 3, effectiveness: 3, time: 3 }), 85);
  assert.equal(schemas.recommendationSchema.safeParse(score).success, true);
  for (const invalid of [{ ...score, time: 5 }, { ...score, efficiency: 0 }, { ...score, effectiveness: 3.55 }, { complexityScore: 3, impactScore: 3, autonomyScore: 3, recommendedPeetPoints: 9, justification: 'Wrong rubric' }]) assert.equal(schemas.recommendationSchema.safeParse(invalid).success, false);
});
test('both submitter and reviewer must have targeted questions before scoring', () => {
  assert.equal(schemas.assessmentSchema.safeParse(assessment).success, true);
  assert.equal(schemas.assessmentSchema.safeParse({ ...assessment, needsMoreInfo: false, studentQuestions: [] }).success, false);
  assert.equal(schemas.reviewerAssessmentSchema.safeParse(reviewerAssessment).success, true);
  assert.equal(schemas.reviewerAssessmentSchema.safeParse({ ...reviewerAssessment, reviewerQuestions: [] }).success, false);
});
test('Groq transport uses JSON object chat completions while generateObject strictly validates PEET dimensions', async () => {
  let sent, output = score;
  const mocked = load('lib/peet-ai-server.ts', { ...baseDeps, '@ai-sdk/openai': { createOpenAI: options => createOpenAI({ ...options, fetch: async (url, init) => {
    sent = { url: String(url), body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ id: 'test', created: 0, model: 'llama-3.3-70b-versatile', choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(output) }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } }), { headers: { 'content-type': 'application/json' } });
  } }) } }, { GROQ_API_KEY: 'test-key' });
  const { model } = mocked.peetModel();
  const result = await generateObject({ model, schema: schemas.recommendationSchema, system: `Return JSON: ${JSON.stringify(z.toJSONSchema(schemas.recommendationSchema))}`, prompt: 'Assess this work.' });
  assert.equal(result.object.effectiveness, 3.5);
  assert.equal(sent.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.deepEqual(sent.body.response_format, { type: 'json_object' });
  assert.equal(sent.body.model, 'llama-3.3-70b-versatile');
  output = { ...score, time: 5 };
  await assert.rejects(generateObject({ model, schema: schemas.recommendationSchema, prompt: 'Return JSON.' }), /schema|object|validation/i);
});
test('body reader rejects foreign origins, oversized requests, malformed JSON and forged scores', async () => {
  await assert.rejects(server.peetBody(new Request('https://gea.test/api/peet', { method: 'POST', headers: { origin: 'https://evil.test' }, body: '{}' }), schemas.submissionSchema), /GEA One/);
  await assert.rejects(server.peetBody(req({ description: 'a'.repeat(25000) }), schemas.submissionSchema), /too large/);
  await assert.rejects(server.peetBody(new Request('https://gea.test/api/peet', { method: 'POST', body: '{' }), schemas.submissionSchema), /required fields/);
  assert.equal(schemas.reviewSchema.safeParse({ taskId: uuid, version: 2, answers: ['a','b'], scores: score }).success, false);
});
test('submitter clarification reads stored task goals and saves a draft against that original task', async () => {
  let saved, evidence;
  const submitter = { student: true, user: { id: 'student' }, supabase: {
    rpc: async name => ({ data: name === 'is_officer_task_participant' ? true : source }),
    from: () => ({ select: () => ({ eq() { return this; }, maybeSingle: async () => ({ data: null }) }) }),
  } };
  const api = route('evaluate-submission', { peetActor: async () => submitter,
    peetAdmin: () => ({ rpc: async (name, body) => { saved = { name, body }; return { data: { ...task, status: 'clarification' } }; } }),
  }, async options => { evidence = JSON.parse(options.prompt); return { object: assessment }; });
  const result = await api.POST(req({ officerTaskId: uuid, description: 'Completed the deliverables', category: 'Media' }));
  assert.equal(result.status, 201);
  assert.equal(saved.name, 'save_gea_peet_assessment');
  assert.equal(saved.body.p_task_id, uuid);
  assert.equal(saved.body.p_student_id, 'student');
  assert.equal(evidence.originalTask.description, source.description);
  assert.equal(saved.body.p_assessment.studentQuestions.length, 1);
});
test('review authorization rejects nonreviewers, task participants and stale versions before using AI', async () => {
  let reviewer = false, permitted = false;
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'reviewer' } } }) },
    rpc: async name => ({ data: name === 'gea_peet_access' ? { reviewer, student: true } : name === 'gea_peet_can_review' ? permitted : source }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: task }) }) }) }),
  };
  const guards = load('lib/peet-ai-server.ts', { ...baseDeps, '@/lib/supabase/server': { createClient: async () => client } });
  await assert.rejects(guards.loadPeetReview(uuid, 2), /reviewer access/);
  reviewer = true;
  await assert.rejects(guards.loadPeetReview(uuid, 2), /independent reviewer/);
  permitted = true;
  await assert.rejects(guards.loadPeetReview(uuid, 1), /review changed/);
  assert.equal((await guards.loadPeetReview(uuid, 2)).source.description, source.description);
});
test('reviewer question generation asks about goals and observations using saved submitter evidence', async () => {
  let evidence, saved;
  const api = route('clarify-review', { loadPeetReview: async () => ({ actor, task, source }), savePeetReview: async (...args) => { saved = args; return task; } }, async options => { evidence = JSON.parse(options.prompt); return { object: reviewerAssessment }; });
  assert.equal((await api.POST(req({ taskId: uuid, version: 2, reviewerNotes: 'Expected a complete workshop and reusable slides' }))).status, 200);
  assert.equal(evidence.originalTask.due_date, source.due_date);
  assert.equal(evidence.studentQuestionsAndAnswers[0].answer, task.answers[0]);
  assert.match(evidence.reviewerNotes, /Expected/);
  assert.equal(saved[3], 'questions');
  assert.equal(saved[4].reviewerQuestions.length, 2);
  assert.equal(saved[6].length, 0);
});
test('AI scoring requires the current reviewer to answer every saved reviewer question and refresh changed goals', async () => {
  let current = { ...task, reviewer_assessment: null }, calls = 0;
  const api = route('evaluate-review', { loadPeetReview: async () => ({ actor, task: current, source }) }, async () => { calls++; return { object: score }; });
  const body = { taskId: uuid, version: 2, answers: ['Answer one', 'Answer two'] };
  assert.equal((await api.POST(req(body))).status, 409);
  current = { ...task, questions_by: 'another-reviewer' };
  assert.equal((await api.POST(req(body))).status, 409);
  current = { ...task, reviewer_assessment: { ...reviewerAssessment, reviewerQuestions: ['a','b','c'] } };
  assert.equal((await api.POST(req(body))).status, 400);
  current = { ...task, source_context: { ...source, description: 'Outdated goals' } };
  assert.equal((await api.POST(req(body))).status, 409);
  assert.equal(calls, 0);
});
test('AI scoring receives both sides’ Q&A and saves only the validated PEET recommendation', async () => {
  let evidence, saved;
  const api = route('evaluate-review', { loadPeetReview: async () => ({ actor, task, source }), savePeetReview: async (...args) => { saved = args; return task; } }, async options => { evidence = JSON.parse(options.prompt); return { object: score }; });
  const result = await api.POST(req({ taskId: uuid, version: 2, answers: task.reviewer_answers }));
  assert.equal(result.status, 200);
  assert.equal(evidence.studentQuestionsAndAnswers[0].answer, task.answers[0]);
  assert.equal(evidence.reviewerQuestionsAndAnswers[0].answer, task.reviewer_answers[0]);
  assert.equal(saved[3], 'score');
  assert.equal(saved[4].efficiency, 3);
  assert.equal(saved[4].effectiveness, 3.5);
});
test('approval forwards three editable PEET scores to the existing evaluation integration, never point awards', async () => {
  let saved;
  const approvingActor = { ...actor, supabase: { rpc: async (name, body) => { saved = { name, body }; return { data: task }; } } };
  const api = route('approve', { peetActor: async () => approvingActor });
  assert.equal((await api.POST(req({ taskId: uuid, version: 2, overridePoints: 20 }))).status, 400);
  assert.equal(saved, undefined);
  const result = await api.POST(req({ taskId: uuid, version: 2, scores: { efficiency: 3, effectiveness: 4, time: 3 }, overrideReason: 'Verified higher quality' }));
  assert.equal(result.status, 200);
  assert.equal(saved.name, 'approve_gea_peet_task');
  assert.equal(saved.body.p_scores.effectiveness, 4);
  assert.equal(saved.body.p_override_reason, 'Verified higher quality');
  assert.equal(saved.body.p_override_points, undefined);
});
test('provider failure leaves the assessment unsaved and hides private provider details', async () => {
  let writes = 0;
  const submitter = { student: true, user: { id: 'student' }, supabase: { rpc: async name => ({ data: name === 'is_officer_task_participant' ? true : source }), from: () => ({ select: () => ({ eq() { return this; }, maybeSingle: async () => ({ data: null }) }) }) } };
  const api = route('evaluate-submission', { peetActor: async () => submitter, peetAdmin: () => { writes++; } }, async () => { throw new Error('private provider secret'); });
  const result = await api.POST(req({ officerTaskId: uuid, description: 'Work', category: 'Media' }));
  assert.equal(result.status, 502); assert.equal(writes, 0); assert.doesNotMatch(result.body.error, /private provider/);
});
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ui = load('components/officerboard/OfficerTaskPeet.tsx', { '@/lib/peet-ai': schemas, '@/lib/peet': load('lib/peet.ts'), '@/lib/supabase/client': { createClient: () => ({}) }, './peet.module.css': { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) } });
test('student clarification renders saved questions and original goals without scoring controls', () => {
  const html = renderToStaticMarkup(React.createElement(ui.PeetTaskCard, { task: { ...task, status: 'clarification', recommendation: null, reviewer_assessment: null }, actorId: 'student', own: true, canReview: false, onSaved() {} }));
  assert.match(html, /Original task goals/); assert.match(html, /name="answer-0"/);
  assert.match(html, /Send for reviewer clarification/); assert.doesNotMatch(html, /Calculate AI PEET Score|Approve PEET Evaluation/);
});
test('review UI renders targeted reviewer Q&A and editable Efficiency, Effectiveness, Time scores', () => {
  const html = renderToStaticMarkup(React.createElement(ui.PeetTaskCard, { task, actorId: 'reviewer', own: false, canReview: true, onSaved() {} }));
  for (const value of ['reviewer-answer-0', 'What goals and quality standards', 'Calculate AI PEET Score', 'Efficiency', 'Effectiveness', 'Time', 'name="efficiency"', 'max="4"', 'Approve PEET Evaluation']) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /Complexity|Autonomy|Award Points|\/ 5/);
});
test('Reviewers can request clarification for older submissions, using the actual submitter and saved deliverables', async () => {
  let saved, evidence;
  const original={...source,assigned_to:'actual-student',final_product_url:'https://example.com/original'};
  const reviewer={...actor,supabase:{rpc:async name=>({data:name==='gea_peet_can_review'?true:original}),from:()=>({select:()=>({eq(){return this;},maybeSingle:async()=>({data:null})})})}};
  const api=route('evaluate-submission',{peetActor:async()=>reviewer,peetAdmin:()=>({rpc:async(name,body)=>{saved=body;return{data:task};}})},async options=>{evidence=JSON.parse(options.prompt);return{object:assessment};});
  const result=await api.POST(req({officerTaskId:uuid,description:'Forged replacement evidence',category:'Outreach',submissionUrl:'https://example.com/forged',requestForSubmitter:true}));
  assert.equal(result.status,201);assert.equal(saved.p_student_id,'actual-student');assert.equal(saved.p_submission_url,original.final_product_url);
  assert.equal(evidence.submission.description,original.submission_description);assert.doesNotMatch(JSON.stringify(evidence),/Forged replacement evidence/);
});
test('Officers cannot request clarification on another person’s behalf or attach invalid supporting links',async()=>{
  let calls=0;
  const submitter={student:true,reviewer:false,user:{id:'student'},supabase:{rpc:async name=>({data:name==='is_officer_task_participant'?true:{...source,status:'in_progress'}}),from:()=>({select:()=>({eq(){return this;},maybeSingle:async()=>({data:null})})})}};
  const api=route('evaluate-submission',{peetActor:async()=>submitter},async()=>{calls++;return{object:assessment};});
  assert.equal((await api.POST(req({officerTaskId:uuid,description:'Work',category:'Media',requestForSubmitter:true}))).status,403);
  assert.equal((await api.POST(req({officerTaskId:uuid,description:'Work',category:'Media',submissionUrl:'javascript:alert(1)'}))).status,400);
  assert.equal(calls,0);
});
test('The integrated submission form keeps the supporting link beside work description',()=>{
  const html=renderToStaticMarkup(React.createElement(ui.PeetSubmissionForm,{sourceTask:source,onSaved(){}}));
  assert.match(html,/name="description"/);assert.match(html,/type="url" name="url"/);assert.match(html,/https:\/\/example.com\/slides/);
  assert.doesNotMatch(html,/href="\/peet/);
});

test('PEET bounds chunked bodies by bytes and cancels before reading the full upload', async () => {
  let pulls = 0, cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { pulls++; controller.enqueue(new TextEncoder().encode('😀'.repeat(4000))); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const request = new Request('https://gea.test/api/peet', { method: 'POST', body: stream, duplex: 'half' });
  await assert.rejects(server.peetBody(request, schemas.submissionSchema), error => error.status === 413);
  assert.equal(pulls, 2);
  assert.equal(cancelled, true);
});
test('Reviewer UI discloses remote processing and AI limitations before generating questions', () => {
  const html = renderToStaticMarkup(React.createElement(ui.PeetReviewForm, { task, actorId: 'reviewer', onSaved() {} }));
  assert.match(html, /sent to Groq/);
  assert.match(html, /AI can make mistakes and cannot open supporting links/);
});

test('Shared clarification saves a personal reflection without replacing the already shared deliverable',async()=>{
 let saved,evidence;
 const personalSource={...source,individual_peet:true,participant_ids:['student','teammate']};
 const client={rpc:async name=>({data:name==='is_officer_task_participant'?true:personalSource}),from:()=>({select:()=>({eq(){return this;},maybeSingle:async()=>({data:null})})})};
 const api=route('evaluate-submission',{peetActor:async()=>({student:true,user:{id:'student'},supabase:client}),peetAdmin:()=>({rpc:async(name,body)=>{saved={name,body};return{data:task}}})},async options=>{evidence=JSON.parse(options.prompt);return{object:assessment}});
 const result=await api.POST(req({officerTaskId:uuid,description:'I built the slide deck and rehearsed',category:'Media',submissionUrl:'https://example.com/replacement',deliverableDescription:'Replace the team deliverable'}));
 assert.equal(result.status,201);assert.equal(saved.name,'save_gea_peet_contribution_assessment');assert.equal(saved.body.p_student_id,'student');
 assert.equal(saved.body.p_submission_url,source.final_product_url);assert.equal(saved.body.p_deliverable_description,source.submission_description);
 assert.equal(evidence.submission.description,'I built the slide deck and rehearsed');
});
