import type { DiscordMessage } from '@/lib/discord';
import { button, row, type Interaction } from './protocol';
import { CONTRACT_YEAR, schoolDate } from '@/lib/officer-tracking';

type Perform = (name: string, args?: Record<string, unknown>, key?: string) => Promise<any>;
const commands = new Set(['officer', 'tasks', 'events', 'absence-notice', 'create-task', 'service-hours', 'log-hours', 'request-event', 'my-attendance', 'my-records', 'task-help', 'cancel-task', 'verify-hours', 'event-requests', 'task-requests']);
const b = (label: string, id: string, style = 2) => button(label, `officer:${id}`, style);
const hours = (minutes: number) => `${(Number(minutes) / 60).toFixed(2)} hours (${Number(minutes)} minutes)`;
const message = (content: string, components: unknown[] = []): DiscordMessage => ({ content: content.slice(0, 1950), components });
function home(): DiscordMessage {
  return message('**Your GEA One officer workspace**\nUse /score for PEET and CAGE. Shared tasks have one team deliverable and a separate reflection and score for each person. Everything here is private to you.', [row({ type: 3, custom_id: 'officer:home', options: [
    ['tasks', 'My tasks'], ['new', 'Create a personal or shared task'], ['drafts', 'Resume a task draft'], ['events', 'Meetings and events'], ['hours', 'My service hours'],
    ['attendance', 'My attendance'], ['service', 'My service records'], ['conduct', 'My conduct records'], ['digest', 'Weekly digest settings'],
  ].map(([value, label]) => ({ value, label })) })]);
}
function list(data: any, type: string, title: string, context = '', size = 25): DiscordMessage {
  const rows = data.rows.slice(0, size);
  const components: unknown[] = [];
  if (rows.length) components.push(row({ type: 3, custom_id: `officer:pick:${type}:${context}`, placeholder: 'Choose a record', options: rows.map((item: any) => ({ value: item.id, label: `${item.title || item.name}${item.status ? ' · ' + item.status : ''}`.slice(0, 100) })) }));
  const controls: unknown[] = [];
  if (data.page > 0) controls.push(b('Previous', `list:${type}:${context}:${data.page - 1}`));
  if (data.rows.length > size) controls.push(b('Next', `list:${type}:${context}:${data.page + 1}`));
  if (type === 'tasks') controls.push(b('Create task', 'new'));
  if (controls.length) components.push(row(...controls));
  return message(rows.length ? `${title}\nPage ${data.page + 1}` : `${title}\nNo records found.`, components);
}
function team(state: any): DiscordMessage {
  const selected: string[] = state.state.people;
  const page = state.state.page;
  const choices = state.rows.slice(0, 25);
  const components: unknown[] = [];
  if (choices.length) components.push(row({ type: 3, custom_id: `officer:teamselect:${state.id}:${state.version}`, placeholder: 'Choose task participants', min_values: 0, max_values: state.state.agenda ? 1 : choices.length,
    options: choices.map((p: any) => ({ label: p.name.slice(0, 100), description: (p.position || 'Officer').slice(0, 100), value: p.id, default: selected.includes(p.id) })) }));
  const controls = [b('Write task details', `form:team:${state.id}`, 1)];
  if (page) controls.push(b('Previous officers', `teampage:${state.id}:${state.version}:${page - 1}`));
  if (state.rows.length > 25) controls.push(b('More officers', `teampage:${state.id}:${state.version}:${page + 1}`));
  components.push(row(...controls));
  return message(state.state.agenda ? `**Assign agenda action**\nChoose one officer, then set the due date. The original agenda item supplies the task title and details.` : `**${state.state.task ? 'Edit task' : 'Create task'}**\n${selected.length} participants selected. Select everyone doing the work, then write the task details. Ordinary officers must keep themselves selected. Multiple participants share the deliverable and receive individual reflections and evaluations.`, components);
}
function eventCard(e: any): DiscordMessage {
  const details = [`**${e.title}**`, `${schoolDate(e.starts_at)} → ${schoolDate(e.ends_at)}`, e.location || 'Location not set',
    `Your attendance: ${e.attendance?.status || 'Not recorded'}`, e.signup?.assigned ? 'Assigned to this event.' : e.signup?.committed ? 'Participation requested.' : '',
    e.log ? `Service: ${e.log.status === 'approved' ? 'Verified' : e.log.status} · ${hours(e.log.minutes)}` : '',
    e.documents?.agenda_doc_url ? `Agenda: ${e.documents.agenda_doc_url}` : '', e.documents?.notes_doc_url ? `Meeting notes: ${e.documents.notes_doc_url}` : '',
    e.plan?.planning_doc_url ? `Event planning document: ${e.plan.planning_doc_url}` : '',
    ...(e.agenda || []).slice(0, 10).map((a: any) => `Agenda item: ${a.title}`),
  ].filter(Boolean).join('\n');
  if (e.cancelled) return message(`${details}\nThis event is cancelled.`);
  const actions: unknown[] = [];
  if (e.kind !== 'meeting') actions.push(b(e.signup?.committed ? 'Withdraw participation request' : 'Request to participate', `signup:${e.id}:${e.signup?.committed ? 'false' : 'true'}`, 1), b('Log service hours', `preparehours:${e.id}`));
  actions.push(button('Absence / tardiness notice', `absence:${e.id}`, 2));
  const components = [row(...actions)];
  if (e.kind === 'meeting') {
    const meeting = [b('Add agenda item', `form:agenda:${e.id}`), b('View agenda', `agenda:${e.id}:0`)];
    if (e.documents) meeting.push(b('Read meeting notes', `record:meeting:${e.id}:0`));
    if (e.can_meetings) meeting.push(b('Edit document links', `form:documents:${e.id}:${e.documents?.version || 0}`));
    components.push(row(...meeting));
  } else {
    const planning = [b('Event checklist', `checklist:${e.id}:0`)];
    if (e.can_plan) planning.push(b('Edit planning document', `form:plan:${e.id}:${e.plan?.version || 0}`), b('Add checklist item', `form:checklist:${e.id}`));
    components.push(row(...planning));
  }
  return message(details, components);
}
function taskCard(t: any): DiscordMessage {
  const components: unknown[] = [];
  components.push(row(b('Full task details', `record:task:${t.id}:0`)));
  if (t.contribution) components.push(row(b('My reflection / evaluation', `record:contribution:${t.contribution.id}:0`)));
  if (!t.cancelled_at && t.status !== 'completed' && t.participant !== false) {
    components.push(row(button('Submit / reopen your reflection', `resume:${t.id}`, 1), button('Enter / edit your work', `submit:${t.id}`, 2)));
    const actions = [b('Request cancellation', `form:cancel:${t.id}`)];
    if (t.status === 'in_progress') {
      actions.push(b('Request help', `form:help:${t.id}`));
      actions.push(b('Choose a helper', `helpers:${t.id}:0`));
      if (t.can_edit) actions.push(b('Edit task / participants', `edit:${t.id}`));
      if (t.blocker && !t.blocker.resolved_at) actions.push(b('Mark unblocked', `unblock:${t.id}`));
    }
    components.push(row(...actions));
  }
  return message(`**${t.title}** · ${t.cancelled_at ? 'Cancelled' : t.status}\n${t.description || 'No written goals.'}\nDue: ${t.due_date || 'Not set'}\nParticipants: ${(t.people || []).map((p: any) => p.name).join(', ')}\n${t.individual_peet ? 'Shared deliverable; submit only your personal contribution for your own PEET score.' : 'Personal task.'}\n${t.submission_description ? 'Team / submitted deliverable: ' + t.submission_description : ''}`, components);
}
function recordCard(record: any, kind: string, id: string, page: number): DiscordMessage {
  const fields = ['title', 'details', 'status', 'due_date', 'academic_year', 'incident_date', 'check_in', 'check_out', 'minutes', 'decisions', 'absence_notice', 'reviewer_notes', 'notes', 'review_notes', 'reason', 'officer_response', 'decision_notes', 'advisor_notes', 'description', 'submission_description', 'final_product_url', 'submission_url', 'assessment', 'answers', 'reviewer_assessment', 'reviewer_answers', 'recommendation', 'approved_scores', 'override_reason'];
  const text = fields.filter(key => record[key] !== undefined && record[key] !== null && record[key] !== '').map(key => `${key.replaceAll('_', ' ')}: ${typeof record[key] === 'object' ? JSON.stringify(record[key], null, 2) : record[key]}`).join('\n');
  const controls: unknown[] = [];
  if (page) controls.push(b('Previous text', `record:${kind}:${id}:${page - 1}`));
  if ((page + 1) * 1500 < text.length) controls.push(b('More text', `record:${kind}:${id}:${page + 1}`));
  if (kind === 'agenda' && record.can_assign && !record.task_id) controls.push(b('Assign agenda action', `assignagenda:${id}`, 1));
  return message(`**Your ${kind} record**\n${text.slice(page * 1500, (page + 1) * 1500)}`, controls.length ? [row(...controls)] : []);
}

export async function officerResponse(i: Interaction, perform: Perform): Promise<DiscordMessage | null> {
  if (!commands.has(i.data?.name || '') && !i.data?.custom_id?.startsWith('officer:')) return null;
  const parts = (i.data?.custom_id || '').split(':');
  let [, verb, id = '', extra = '', pageText = '0'] = parts;
  const fields = Object.fromEntries((i.data?.components || []).flatMap(r => r.components || []).map(c => [c.custom_id, c.value]));
  const write = (action: string, args: Record<string, unknown>) => perform(action, args, `${i.id}:${action}`);
  const records = async (kind: string, page = 0) => {
    const data = await perform('records', { kind, page });
    const result = list(data, 'records', `Your ${kind} records`, kind, 10);
    if (kind === 'conduct') {
      const options = [...(data.notes || []).slice(0, 5).map((n: any) => ({ label: `General notes · ${n.academic_year}`, value: `note|${n.academic_year}` })),
        ...(data.reviews || []).slice(0, 5).map((r: any) => ({ label: `${r.category} review · ${r.academic_year}`, value: `review|${r.id}` }))];
      if (options.length) result.components!.push(row({ type: 3, custom_id: 'officer:additional', options }));
    }
    return result;
  };
  const events = async (kind = 'all', page = 0) => list(await perform('events', { kind, page }), 'events', 'Meetings and events', kind);
  const tasks = async (context = '', page = 0) => list(await perform('tasks', { page }), 'tasks', 'Your tasks', context);
  const summary = async () => {
    const year = i.data?.options?.find(option => option.name === 'year')?.value?.trim() || CONTRACT_YEAR;
    const total = await perform('hours', { year });
    return message(`**Your service hours · ${year}**\nVerified: ${hours(total.verified_minutes)} across ${total.verified_events} events\nAwaiting verification: ${hours(total.pending_minutes)}\nAttendance alone does not award service hours.`, [row(b('Log hours', 'serviceevents'), b('My service records', 'service'))]);
  };
  if (i.data?.name) {
    switch (i.data.name) {
      case 'officer': case 'my-records': return home();
      case 'events': case 'absence-notice': return events();
      case 'request-event': case 'log-hours': return events('service');
      case 'tasks': case 'task-help': case 'cancel-task': return tasks();
      case 'create-task': return team(await write('team_start', {}));
      case 'service-hours': return summary();
      case 'my-attendance': return records('attendance');
      case 'verify-hours': return list(await perform('review_logs', { page: 0 }), 'logs', 'Service logs awaiting verification');
      case 'event-requests': return list(await perform('event_requests', { page: 0 }), 'requests', 'Participation requests awaiting assignment');
      case 'task-requests': return list(await perform('task_requests', { page: 0 }), 'taskrequests', 'Task help and cancellation requests');
    }
  }
  if (verb === 'home') { verb = i.data?.values?.[0] || ''; }
  if (verb === 'pick') {
    const picked = i.data?.values?.[0] || '';
    if (id === 'events') return eventCard(await perform('event', { id: picked }));
    if (id === 'tasks') return taskCard(await perform('task', { id: picked }));
    if (id === 'records') return recordCard(await perform('record', { kind: extra, id: picked }), extra, picked, 0);
    if (id === 'logs') { verb = 'reviewlog'; id = picked; }
    if (id === 'requests') { verb = 'request'; id = picked; }
    if (id === 'agenda') return recordCard(await perform('record', { kind: 'agenda', id: picked }), 'agenda', picked, 0);
    if (id === 'checklist') { const item = await perform('checklist_item', { id: picked }); return message(`${item.title}\n${item.done ? 'Complete' : 'Not complete'}`, [row(b(item.done ? 'Mark incomplete' : 'Mark complete', `togglecheck:${item.id}:${!item.done}`))]); }
    if (id === 'helpers') return message('Describe the help you need. Your chosen helper will be recorded on the task.', [row(b('Write help request', `form:help:${extra}:${picked}`, 1))]);
    if (id === 'drafts') return team(await write('team_open', { session: picked }));
    if (id === 'taskrequests') { const [kind, request] = picked.split('|'); return officerResponse(customInteraction(i, `officer:taskrequest:${kind}:${request}`), perform); }
  }
  if (verb === 'list') {
    const page = Math.max(0, Number(pageText) || 0);
    if (id === 'events') return events(extra, page);
    if (id === 'tasks') return tasks(extra, page);
    if (id === 'records') return records(extra, page);
    if (id === 'logs') return list(await perform('review_logs', { page }), 'logs', 'Service logs awaiting verification');
    if (id === 'requests') return list(await perform('event_requests', { page }), 'requests', 'Participation requests awaiting assignment');
    if (id === 'agenda') return list(await perform('agenda_items', { id: extra, page }), 'agenda', 'Meeting agenda', extra);
    if (id === 'checklist') return list(await perform('checklist', { id: extra, page }), 'checklist', 'Event checklist', extra);
    if (id === 'helpers') return list(await perform('helpers', { page }), 'helpers', 'Choose a helper', extra);
    if (id === 'drafts') return list(await perform('team_drafts', { page }), 'drafts', 'Your unfinished task drafts');
    if (id === 'taskrequests') return list(await perform('task_requests', { page }), 'taskrequests', 'Task help and cancellation requests');
  }
  if (verb === 'tasks') return tasks();
  if (verb === 'drafts') return list(await perform('team_drafts', { page: 0 }), 'drafts', 'Your unfinished task drafts');
  if (verb === 'events' || verb === 'serviceevents') return events(verb === 'serviceevents' ? 'service' : 'all');
  if (verb === 'event') return eventCard(await perform('event', { id }));
  if (verb === 'agenda') return list(await perform('agenda_items', { id, page: Number(extra) || 0 }), 'agenda', 'Meeting agenda', id);
  if (verb === 'checklist') return list(await perform('checklist', { id, page: Number(extra) || 0 }), 'checklist', 'Event checklist', id);
  if (verb === 'togglecheck') { await write('checklist_toggle', { id, done: extra === 'true' }); return message('Event checklist updated.'); }
  if (verb === 'assignagenda') return team(await write('team_start', { agenda: id }));
  if (verb === 'helpers') return list(await perform('helpers', { page: Number(extra) || 0 }), 'helpers', 'Choose a helper', id);
  if (verb === 'hours') return summary();
  if (['attendance', 'service', 'conduct'].includes(verb)) return records(verb);
  if (verb === 'additional') {
    const [kind, record] = (i.data?.values?.[0] || '').split('|');
    return recordCard(await perform('record', { kind, id: record }), kind, record, 0);
  }
  if (verb === 'record') return recordCard(await perform('record', { kind: id, id: extra }), id, extra, Math.max(0, Number(pageText) || 0));
  if (verb === 'signup') { await write('signup', { id, committed: extra === 'true' }); return eventCard(await perform('event', { id })); }
  if (verb === 'preparehours') { const prepared = await write('prepare_hours', { id }); return message(`${prepared.title}\nEnter your actual times, keeping the timezone suffix. The scheduled times are prefilled as a draft; hours require reviewer verification.`, [row(button('Enter service details', prepared.custom_id, 1))]); }
  if (verb === 'new' || verb === 'edit') return team(await write('team_start', { ...(verb === 'edit' ? { task: id } : {}) }));
  if (verb === 'teamselect') return team(await write('team_select', { session: id, version: Number(extra), selected: i.data?.values || [] }));
  if (verb === 'teampage') return team(await write('team_page', { session: id, version: Number(extra), page: Number(pageText) }));
  if (verb === 'unblock') { const t = await perform('task', { id }); await write('task_help', { id, reason: t.blocker?.reason || 'Resolved', resolved: true }); return message('Task marked unblocked.'); }
  if (verb === 'digest') return message('Weekly digest preferences for your website workspace:', [row(b('Enable weekly digest', 'setdigest:true'), b('Disable weekly digest', 'setdigest:false'))]);
  if (verb === 'setdigest') { await write('digest', { enabled: id === 'true' }); return message(`Weekly workspace digest ${id === 'true' ? 'enabled' : 'disabled'}.`); }
  if (verb === 'reviewlog') {
    const l = await perform('review_log', { id });
    return message(`**${l.officer} · ${l.event}**\n${schoolDate(l.check_in)} → ${schoolDate(l.check_out)}\n${hours(l.minutes)}\n${l.notes || 'No work notes.'}`, [row(b('Verify hours', `verify:${l.id}:${l.version}`, 3), b('Return for correction', `form:returnhours:${l.id}:${l.version}`, 4))]);
  }
  if (verb === 'verify') { await write('verify_hours', { id, version: extra }); return message('Service hours verified. The officer’s receipt is queued for their role channel.'); }
  if (verb === 'request') { const r = await perform('event_request', { id }); return message(`**${r.officer} · ${r.event}**\nParticipation requested. Assigning is a separate reviewer decision.`, [row(b('Assign officer to event', `assignrequest:${r.id}:${r.version}`, 3))]); }
  if (verb === 'assignrequest') { await write('assign_request', { id, version: Number(extra) }); return message('Officer assigned to the event.'); }
  if (verb === 'taskrequest') {
    const r = await perform('task_request', { kind: id, id: extra });
    const controls = [b('Read full request', `record:${id}:${r.id}:0`), b('View task', `task:${r.task_id}`)];
    if (id === 'cancellation' && r.status === 'pending') controls.push(b('Approve cancellation', `form:cancelapprove:${r.id}:${r.version}`, 3), b('Keep task active', `form:cancelreject:${r.id}:${r.version}`, 4));
    return message(`**${r.title}**\n${id} request\n${r.reason}`, [row(...controls)]);
  }
  if (verb === 'form' && i.type === 5) {
    const form = id; id = extra; const version = pageText;
    switch (form) {
      case 'team': { const saved = await write('team_save', { session: id, ...fields }); return message('Task saved. Each participant gets their own reflection and evaluation.', [row(b('View task', `task:${saved.id}`))]); }
      case 'hours': await write('log_hours', { id, ...fields, check_in: fields.check_in?.trim(), check_out: fields.check_out?.trim() }); return message('Actual service times submitted for reviewer verification. They do not count as verified hours yet.');
      case 'help': await write('task_help', { id, reason: fields.reason, helper: version === '0' ? null : version, resolved: false }); return message('Task help request saved.');
      case 'cancel': await write('task_cancel', { id, reason: fields.reason }); return message('Cancellation requested. The task remains active until a reviewer decides.');
      case 'agenda': await write('agenda', { id, ...fields }); return message('Meeting agenda item added.');
      case 'documents': await write('documents', { id, version: Number(version), ...fields }); return message('Meeting document links saved.');
      case 'plan': await write('plan', { id, version: Number(version), ...fields }); return message('Event planning document saved.');
      case 'checklist': await write('checklist_add', { id, ...fields }); return message('Event checklist item added.');
      case 'returnhours': await write('return_hours', { id, version, notes: fields.notes }); return message('Service log returned for correction. No hours were verified.');
      case 'cancelapprove': case 'cancelreject': await write('review_cancellation', { id, version, status: form === 'cancelapprove' ? 'approved' : 'rejected', notes: fields.notes }); return message('Cancellation decision saved. The task history is preserved.');
    }
  }
  if (verb === 'task') return taskCard(await perform('task', { id }));
  return home();
}

function customInteraction(i: Interaction, custom_id: string): Interaction {
  return { ...i, data: { custom_id }, type: 3 };
}
