const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, deps = {}, env = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { exports, require: name => deps[name] ?? (name === './task-routing' ? load('lib/discord/task-routing.ts', { '@/lib/discord': {} }, env) : require(name)), process: { env }, Error, Date, URL, Object, Set });
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

test('conduct records open a private response form and submit only the incident and explanation', async () => {
 const result = await officer.officerResponse(custom(`record:conduct:${uuid}:0`), async () => ({ status: 'notified', response_due_at: '2099-01-01', reason: 'Incident details' }));
 const control = allControls(result).find(c => c.label === 'Explain your circumstances');
 assert.ok(control);
 const modal = protocol.modalResponse({ ...base, type: 3, data: { custom_id: control.custom_id } });
 assert.equal(modal.type, 9); assert.equal(modal.data.components[0].components[0].required, true);
 assert.ok(modal.data.components[0].components[0].max_length <= 4000);
 let called;
 const receipt = await officer.officerResponse({ ...base, type: 5, data: { custom_id: control.custom_id, components: [{ components: [{ custom_id: 'response', value: 'There was a family emergency.' }] }] } }, async (...args) => { called = args; });
 assert.equal(called[0], 'strike_response'); assert.equal(called[1].id, uuid);
 assert.equal(called[1].response, 'There was a family emergency.');
 assert.equal(called[2], 'interaction:strike_response');
 assert.match(receipt.content, /authorized reviewers/);
 const resolved = await officer.officerResponse(custom(`record:conduct:${uuid}:0`), async () => ({ status: 'revoked' }));
 assert.equal(allControls(resolved).length, 0);
});
test('strike response notifications use the current private Discord link and skip completed or disabled recipients', async () => {
 let strike = { id: uuid, officer_id: 'officer', category: 'conduct', status: 'notified', response_due_at: '2099-01-01', incident_date: '2026-10-22' };
 let profile = { discord_id: '111111111111111111', access_enabled: true }; const sent = [];
 const db = { rpc: async () => ({}), from(table) { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: table === 'officer_strikes' ? strike : profile }; } }; } };
 const routing = load('lib/discord/strike-routing.ts', { '@/lib/supabase/admin': { createAdminClient: () => db }, '@/lib/discord': { discordDM: async (...args) => sent.push(args) }, './protocol': protocol });
 await routing.sendStrikeResponseRequest({ strike_id: uuid, officer_id: 'officer' });
 assert.equal(sent.length, 1); assert.equal(sent[0][0], profile.discord_id);
 assert.match(sent[0][1].content, /No response within 24 hours means an automatic strike/);
 assert.match(sent[0][1].content, /<t:/);
 assert.ok(allControls(sent[0][1]).some(c => c.custom_id === `officer:form:strike:${uuid}`));
 strike.responded_at = 'today'; await routing.sendStrikeResponseRequest({ strike_id: uuid, officer_id: 'officer' });
 delete strike.responded_at; profile.access_enabled = false; await routing.sendStrikeResponseRequest({ strike_id: uuid, officer_id: 'officer' });
 profile.access_enabled = true; strike.status = 'revoked'; await routing.sendStrikeResponseRequest({ strike_id: uuid, officer_id: 'officer' });
 assert.equal(sent.length, 1);
});

test('Discord closes expired response forms even before the timeout worker confirms the strike', async () => {
 const expired = await officer.officerResponse(custom(`record:conduct:${uuid}:0`), async () => ({ status: 'notified', response_due_at: '2000-01-01' }));
 assert.equal(allControls(expired).length, 0);
});

test('failed DMs fall back to a generic notices-channel alert that mentions only the officer', async () => {
 const strike = { id: uuid, officer_id: 'officer', category: 'conduct', status: 'notified', response_due_at: '2099-01-01', incident_date: '2026-10-22', reason: 'Private incident reason' };
 const profile = { discord_id: '111111111111111111', access_enabled: true };
 const db = { rpc: async () => ({}), from(table) { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: table === 'officer_strikes' ? strike : profile }; } }; } };
 const sent = [];
 const routing = load('lib/discord/strike-routing.ts', {
  '@/lib/supabase/admin': { createAdminClient: () => db }, './protocol': protocol,
  '@/lib/discord': { discordDM: async () => { throw new Error('DM blocked'); }, discordFetch: async (path, body) => sent.push({ path, body }) },
 }, { DISCORD_NOTICES_CHANNEL_ID: '222222222222222222', NEXT_PUBLIC_SITE_URL: 'https://gea.example' });
 await routing.sendStrikeResponseRequest({ strike_id: uuid, officer_id: 'officer' });
 assert.equal(sent.length, 1); assert.equal(sent[0].path, 'channels/222222222222222222/messages');
 assert.equal(sent[0].body.content, '<@111111111111111111>, please check the GEA website for a notice.');
 assert.deepEqual(Array.from(sent[0].body.allowed_mentions.users), [profile.discord_id]);
 assert.equal(sent[0].body.allowed_mentions.parse.length, 0); assert.equal(sent[0].body.allowed_mentions.roles.length, 0);
 const link = allControls(sent[0].body)[0];
 assert.equal(link.style, 5); assert.equal(link.url, 'https://gea.example/officerboard?topic=accountability');
 const message = JSON.stringify(sent[0].body);
 for (const privateText of [strike.reason, strike.id, strike.category, strike.incident_date, strike.response_due_at]) assert.equal(message.includes(privateText), false);
});
test('missing notices configuration or failed fallback delivery leaves the request retryable', async () => {
 const strike = { id: uuid, officer_id: 'officer', status: 'notified', response_due_at: '2099-01-01' };
 const db = { rpc: async () => ({}), from(table) { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: table === 'officer_strikes' ? strike : { discord_id: '111111111111111111', access_enabled: true } }; } }; } };
 for (const env of [{}, { DISCORD_NOTICES_CHANNEL_ID: 'bad' }, { DISCORD_NOTICES_CHANNEL_ID: '222222222222222222' }]) {
  const routing = load('lib/discord/strike-routing.ts', {
   '@/lib/supabase/admin': { createAdminClient: () => db }, './protocol': protocol,
   '@/lib/discord': { discordDM: async () => { throw new Error('DM blocked'); }, discordFetch: async () => { throw new Error('Channel delivery failed'); } },
  }, env);
  await assert.rejects(routing.sendStrikeResponseRequest({ strike_id: uuid, officer_id: 'officer' }));
 }
});

test('reissued existing strikes explain the renewed response opportunity in the new DM', async () => {
 const strike = { id: uuid, officer_id: 'officer', category: 'attendance', status: 'notified', response_due_at: '2099-01-01', incident_date: '2026-10-22' };
 const db = { rpc: async () => ({}), from(table) { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: table === 'officer_strikes' ? strike : { discord_id: '111111111111111111', access_enabled: true } }; } }; } };
 const sent = [];
 const routing = load('lib/discord/strike-routing.ts', { '@/lib/supabase/admin': { createAdminClient: () => db }, './protocol': protocol, '@/lib/discord': { discordDM: async (...args) => sent.push(args) } });
 await routing.sendStrikeResponseRequest({ strike_id: uuid, officer_id: 'officer', reissued: true });
 assert.equal(sent.length, 1);
 assert.match(sent[0][1].content, /existing incident has been reopened/);
 assert.match(sent[0][1].content, /submit or confirm your explanation again/);
 assert.match(sent[0][1].content, /24 hours/);
 assert.ok(allControls(sent[0][1]).some(c => c.custom_id === `officer:form:strike:${uuid}`));
});

test('DM and fallback outcomes queue independent president updates without mistaking receipt failures for blocked DMs', async () => {
 for (const outcome of ['dm_sent', 'notices_sent', 'delivery_failed', 'receipt_failed']) {
  const calls = [], fallback = [];
  const strike = { id: uuid, officer_id: 'officer', status: 'notified', response_due_at: '2099-01-01', notified_at: '2026-10-22T12:00:00Z' };
  const db = { rpc: async (name, args) => { calls.push({ name, args }); return { error: outcome === 'receipt_failed' ? {} : null }; }, from(table) { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: table === 'officer_strikes' ? strike : { discord_id: '111111111111111111', access_enabled: true } }; } }; } };
  const routing = load('lib/discord/strike-routing.ts', {
   '@/lib/supabase/admin': { createAdminClient: () => db }, './protocol': protocol,
   '@/lib/discord': { discordDM: async () => { if (['notices_sent','delivery_failed'].includes(outcome)) throw new Error('DM blocked'); }, discordFetch: async () => { fallback.push(true); if (outcome === 'delivery_failed') throw new Error('Fallback blocked'); } },
  }, { DISCORD_NOTICES_CHANNEL_ID: '222222222222222222' });
  const send = routing.sendStrikeResponseRequest({ strike_id: uuid, officer_id: 'officer' });
  if (['delivery_failed','receipt_failed'].includes(outcome)) await assert.rejects(send); else await send;
  assert.equal(calls.length, 1); assert.equal(calls[0].name, 'record_discord_notice_delivery');
  assert.equal(calls[0].args.p_status, outcome === 'receipt_failed' ? 'dm_sent' : outcome);
  assert.equal(calls[0].args.p_notice_at, strike.notified_at);
  assert.equal(fallback.length, ['notices_sent','delivery_failed'].includes(outcome) ? 1 : 0);
 }
});
test('president updates include officer and delivery status with a private reviewer link and no explanation text', async () => {
 const sent = [];
 const db = { from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { name: 'Taylor', position: 'Vice President', officer_response: 'Private explanation' } }; } }; } };
 const routing = load('lib/discord/president-notices.ts', {
  '@/lib/supabase/admin': { createAdminClient: () => db }, './protocol': protocol,
  '@/lib/discord': { discordFetch: async (path, body) => sent.push({ path, body }), safeMessage: message => ({ ...message, allowed_mentions: { parse: [] } }) },
 }, { DISCORD_CHANNEL_PRESIDENT: '333333333333333333', NEXT_PUBLIC_SITE_URL: 'https://gea.example' });
 for (const status of ['dm_sent','notices_sent','delivery_failed','responded','not_linked']) await routing.sendPresidentNoticeUpdate({ status, officer_id: uuid, strike_id: uuid, occurred_at: '2026-10-22T12:00:00Z', response_due_at: '2026-10-23T12:00:00Z' });
 assert.equal(sent.length, 5);
 assert.match(sent[0].body.embeds[0].description, /delivered by DM/);
 assert.match(sent[1].body.embeds[0].description, /blocked or unavailable/);
 assert.match(sent[2].body.embeds[0].description, /delivery failed/);
 assert.match(sent[3].body.embeds[0].description, /submitted an explanation/);
 assert.match(sent[4].body.embeds[0].description, /has not linked Discord/);
 for (const item of sent) {
  assert.equal(item.path, 'channels/333333333333333333/messages');
  assert.match(JSON.stringify(item.body), /Taylor/); assert.match(JSON.stringify(item.body), /Vice President/);
  assert.equal(JSON.stringify(item.body).includes('Private explanation'), false);
  assert.equal(item.body.allowed_mentions.parse.length, 0);
  const link = new URL(allControls(item.body)[0].url);
  assert.equal(link.pathname, '/admin-portal-x7k9/officers'); assert.equal(link.searchParams.get('officer'), uuid);
 }
});

test('unlinked officers receive generic channel alerts with only their matching role ping', async () => {
 for (const destination of ['notices', 'position', 'notices-failed']) {
  const sent = [], receipts = []; let dmCalls = 0;
  const strike = { id: uuid, officer_id: 'officer', status: 'notified', response_due_at: '2099-01-01', notified_at: '2026-10-22T12:00:00Z', reason: 'Private incident details' };
  const profile = { access_enabled: true, discord_id: null, name: 'Taylor', position: 'Vice President' };
  const db = { rpc: async (_name, args) => { receipts.push(args.p_status); return {}; }, from(table) { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: table === 'officer_strikes' ? strike : profile }; } }; } };
  const routing = load('lib/discord/strike-routing.ts', {
   '@/lib/supabase/admin': { createAdminClient: () => db }, './protocol': protocol,
   '@/lib/discord': { discordDM: async () => { dmCalls++; }, discordFetch: async (path, body) => {
    if (destination === 'notices-failed' && path.includes('222222222222222222')) throw new Error('Notices inaccessible');
    sent.push({ path, body });
   } },
  }, { ...(destination !== 'position' ? { DISCORD_NOTICES_CHANNEL_ID: '222222222222222222' } : {}), DISCORD_CHANNEL_VICE_PRESIDENT: '333333333333333333', DISCORD_ROLE_VICE_PRESIDENT: '444444444444444444', NEXT_PUBLIC_SITE_URL: 'https://gea.example' });
  await routing.sendStrikeResponseRequest({ strike_id: uuid, officer_id: 'officer' });
  assert.equal(dmCalls, 0); assert.equal(sent.length, 1);
  assert.match(sent[0].body.content, /Connect Discord to link your accounts/);
  const linkAccount = allControls(sent[0].body).find(control => control.label === 'Link Discord account');
  assert.equal(linkAccount.url, 'https://gea.example/account');
  assert.equal(sent[0].path, `channels/${destination === 'notices' ? '222222222222222222' : '333333333333333333'}/messages`);
  assert.match(sent[0].body.content, /<@&444444444444444444> \(Taylor\), please check the GEA website/);
  assert.deepEqual(Array.from(sent[0].body.allowed_mentions.roles), ['444444444444444444']);
  assert.equal(sent[0].body.allowed_mentions.users.length, 0); assert.equal(sent[0].body.allowed_mentions.parse.length, 0);
  assert.equal(JSON.stringify(sent[0].body).includes(strike.reason), false);
  assert.deepEqual(receipts, ['notices_sent']);
 }
});
test('unlinked officers without a mapped role are addressed by name and undeliverable alerts remain retryable', async () => {
 const sent = [], receipts = [];
 const db = { rpc: async (_name, args) => { receipts.push(args.p_status); return {}; }, from(table) { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: table === 'officer_strikes' ? { id: uuid, status: 'notified', response_due_at: '2099-01-01' } : { name: 'Casey', position: 'Unmapped position', access_enabled: true } }; } }; } };
 const deps = { '@/lib/supabase/admin': { createAdminClient: () => db }, './protocol': protocol, '@/lib/discord': { discordFetch: async (path, body) => sent.push({ path, body }) } };
 await load('lib/discord/strike-routing.ts', deps, { DISCORD_NOTICES_CHANNEL_ID: '222222222222222222' }).sendStrikeResponseRequest({ strike_id: uuid, officer_id: 'officer' });
 assert.match(sent[0].body.content, /^Casey, please check the GEA website for a notice\./);
 assert.match(sent[0].body.content, /finish signup/);
 assert.match(sent[0].body.content, /Account Home → Connect Discord to link your accounts/);
 assert.equal(sent[0].body.allowed_mentions.roles.length, 0);
 await assert.rejects(load('lib/discord/strike-routing.ts', deps).sendStrikeResponseRequest({ strike_id: uuid, officer_id: 'officer' }));
 assert.deepEqual(receipts, ['notices_sent', 'delivery_failed']);
});
