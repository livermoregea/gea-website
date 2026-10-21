const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, deps = {}, env = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { exports, require: name => deps[name] ?? require(name), process: { env }, Error, Date, URL, Object, Set });
  return exports;
}
const protocol = load('lib/discord/protocol.ts');
const officer = load('lib/discord/officer.ts', { './protocol': protocol, '@/lib/officer-tracking': { CONTRACT_YEAR: '2026-2027', schoolDate: text => text } });
const uuid = '11111111-1111-4111-8111-111111111111';
const base = { id: 'interaction', type: 2, data: {} };
const custom = (id, data = {}) => ({ ...base, type: 3, data: { custom_id: `officer:${id}`, ...data } });
const allControls = message => message.components.flatMap(row => row.components);
test('create task selects roster profiles, including unlinked officers, without encoding team IDs into custom IDs', async () => {
  const state = { id: uuid, version: 1, state: { people: ['profile-1'], page: 0 }, rows: [{ id: 'profile-1', name: 'First officer', position: 'Secretary' }, { id: 'profile-2', name: 'Unlinked officer', position: 'VP' }] };
  const calls = [];
  const result = await officer.officerResponse({ ...base, data: { name: 'create-task' } }, async (...args) => { calls.push(args); return state; });
  assert.equal(calls[0][0], 'team_start');
  const select = allControls(result).find(c => c.type === 3);
  assert.equal(select.max_values, 2);
  assert.equal(select.options[1].value, 'profile-2');
  assert.equal(select.options[0].default, true);
  assert.ok(select.custom_id.length <= 100);
  assert.match(result.content, /individual reflections and evaluations/);
});
test('service hours keep verified and pending totals separate and never award hours from attendance', async () => {
  const result = await officer.officerResponse({ ...base, data: { name: 'service-hours' } }, async (action, args) => {
    assert.equal(action, 'hours'); assert.equal(args.year, '2026-2027');
    return { verified_minutes: 120, pending_minutes: 60, verified_events: 1 };
  });
  assert.match(result.content, /Verified: 2\.00 hours/);
  assert.match(result.content, /Awaiting verification: 1\.00 hours/);
  assert.match(result.content, /Attendance alone does not award/);
});
test('event details offer participation, actual-hour logging, planning, and separate attendance notices', async () => {
  const result = await officer.officerResponse(custom('event:' + uuid), async action => {
    assert.equal(action, 'event');
    return { id: uuid, title: 'Community demonstration', kind: 'volunteer', starts_at: 'start', ends_at: 'end', can_plan: true, plan: { version: 3 }, signup: { committed: false, assigned: true }, log: { status: 'pending', minutes: 90 } };
  });
  const labels = allControls(result).map(c => c.label);
  for (const label of ['Request to participate', 'Log service hours', 'Absence / tardiness notice', 'Edit planning document', 'Add checklist item']) assert.ok(labels.includes(label), label);
  assert.match(result.content, /Assigned to this event/);
  assert.match(result.content, /pending/);
});
test('form submission forwards actual timestamps and the event ID without allowing another officer identity', async () => {
  let called;
  const result = await officer.officerResponse({ ...base, type: 5, data: { custom_id: 'officer:form:hours:' + uuid, components: [{ components: [
    { custom_id: 'check_in', value: ' 2026-10-20T17:00:00-07:00 ' }, { custom_id: 'check_out', value: '2026-10-20T19:00:00-07:00' }, { custom_id: 'notes', value: 'My actual service' },
  ] }] } }, async (...args) => { called = args; return {}; });
  assert.equal(called[0], 'log_hours'); assert.equal(called[1].id, uuid);
  assert.equal(called[1].check_in, '2026-10-20T17:00:00-07:00');
  assert.equal(called[1].officer_id, undefined);
  assert.match(result.content, /do not count as verified hours yet/);
});
test('review controls carry the reviewed snapshot; officer participation is a separate assignment decision', async () => {
  const version = 'a'.repeat(32);
  const reviewed = await officer.officerResponse(custom('reviewlog:' + uuid), async () => ({ id: uuid, officer: 'Officer', event: 'Event', check_in: 'in', check_out: 'out', minutes: 120, notes: 'Work performed', version }));
  const approve = allControls(reviewed).find(c => c.label === 'Verify hours');
  assert.ok(approve.custom_id.length <= 100);
  let called;
  await officer.officerResponse({ ...base, type: 3, data: { custom_id: approve.custom_id } }, async (...args) => { called = args; return {}; });
  assert.equal(called[0], 'verify_hours'); assert.equal(called[1].version, version);
  const request = await officer.officerResponse(custom('request:' + uuid), async () => ({ id: uuid, officer: 'Officer', event: 'Event', version: 2 }));
  assert.match(request.content, /separate reviewer decision/);
  assert.match(allControls(request)[0].custom_id, /assignrequest/);
});
test('long private records remain available through pagination', async () => {
  const result = await officer.officerResponse(custom(`record:service:${uuid}:0`), async () => ({ notes: 'x'.repeat(5000), status: 'pending' }));
  assert.ok(result.content.length < 2000);
  assert.ok(allControls(result).some(c => c.label === 'More text'));
  const next = await officer.officerResponse(custom(`record:service:${uuid}:1`), async () => ({ notes: 'x'.repeat(5000) }));
  assert.ok(allControls(next).some(c => c.label === 'Previous text'));
});
test('all officer forms respect Discord modal field and ID limits and reopen saved values', () => {
  for (const suffix of [`team:${uuid}`, `hours:${uuid}`, `help:${uuid}`, `cancel:${uuid}`, `documents:${uuid}:1`, `returnhours:${uuid}:${'a'.repeat(32)}`, `cancelapprove:${uuid}:${'a'.repeat(32)}`, `cancelreject:${uuid}:${'a'.repeat(32)}`, `agenda:${uuid}`, `plan:${uuid}:1`, `checklist:${uuid}`]) {
    const response = protocol.modalResponse(custom('form:' + suffix), { title: 'Saved task title', notes: 'Saved notes' });
    assert.equal(response.type, 9);
    assert.ok(response.data.custom_id.length <= 100);
    assert.ok(response.data.components.length <= 5);
    for (const row of response.data.components) { const field = row.components[0]; assert.ok(field.label.length <= 45); assert.ok(field.max_length <= 4000); }
  }
  const submission = protocol.modalResponse({ ...base, type: 3, data: { custom_id: 'submit:' + uuid } });
  assert.equal(submission.data.components.length, 5);
  assert.equal(submission.data.components.find(row => row.components[0].custom_id === 'link').components[0].required, false);
});
test('reviewer cancellation controls preserve the reviewed version and do not bypass the decision form', async () => {
  const version = 'a'.repeat(32);
  const result = await officer.officerResponse(custom(`taskrequest:cancellation:${uuid}`), async action => {
    assert.equal(action, 'task_request'); return { id: uuid, task_id: uuid, title: 'Task', reason: 'Activity replaced', status: 'pending', version };
  });
  const approval = allControls(result).find(c => c.label === 'Approve cancellation');
  assert.ok(approval.custom_id.endsWith(version));
  assert.equal(protocol.modalResponse({ ...base, type: 3, data: { custom_id: approval.custom_id } }).type, 9);
  let called;
  await officer.officerResponse({ ...base, type: 5, data: { custom_id: approval.custom_id, components: [{ components: [{ custom_id: 'notes', value: 'Approved replacement activity.' }] }] } }, async (...args) => { called = args; return {}; });
  assert.equal(called[0], 'review_cancellation');
  assert.equal(called[1].version, version);
  assert.equal(called[1].status, 'approved');
});
test('verified-hour receipts use the officer role channel, exact verified duration, and limited mentions', async () => {
  const sent = [];
  const transport = { discordFetch: async (path, body) => sent.push({ path, body }), safeMessage: body => body };
  const routing = load('lib/discord/task-routing.ts', { '@/lib/discord': transport }, { DISCORD_CHANNEL_SECRETARY: '111111111111111111', DISCORD_ROLE_SECRETARY: '222222222222222222' });
  const service = load('lib/discord/service-routing.ts', { '@/lib/discord': transport, './task-routing': routing, './protocol': protocol }, { DISCORD_REVIEW_CHANNEL_ID: '333333333333333333' });
  await service.sendServiceNotification({ topic: 'service_receipt', officer_name: 'Secretary', officer_position: 'Secretary', event_title: 'Community demo', minutes: 90, status: 'approved' });
  assert.equal(sent[0].path, 'channels/111111111111111111/messages');
  assert.match(sent[0].body.embeds[0].fields[2].value, /1\.50 hours \(90 minutes\)/);
  assert.deepEqual(Array.from(sent[0].body.allowed_mentions.roles), ['222222222222222222']);
  await service.sendServiceNotification({ topic: 'service_receipt', officer_name: 'Secretary', officer_position: 'Secretary', event_title: 'Community demo', minutes: 90, status: 'rejected' });
  assert.equal(sent[1].body.embeds[0].fields[2].value, '0 hours for this log');
  await service.sendServiceNotification({ topic: 'service_review', log_id: uuid, title: 'Hours awaiting review', description: 'Work completed' });
  assert.equal(sent[2].path, 'channels/333333333333333333/messages');
  assert.match(sent[2].body.components[0].components[0].custom_id, /reviewlog/);
});
