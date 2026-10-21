const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const crypto = require('node:crypto');
function load(file, dependencies = {}, env = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText,
    { exports, require: name => dependencies[name] ?? require(name), process: { env }, Error, URL, Date, BigInt, Buffer, AbortSignal, Request, Response, TextDecoder, console });
  return exports;
}
const protocol = load('lib/discord/protocol.ts');
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const publicHex = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
const env = { DISCORD_PUBLIC_KEY: publicHex, DISCORD_APPLICATION_ID: 'app', DISCORD_GUILD_ID: 'guild' };
function route() {
  const calls = { after: [], queued: [], runs: 0 };
  const handler = load('app/api/discord/interactions/route.ts', {
    'next/server': { after: fn => calls.after.push(fn), NextResponse: { json: value => Response.json(value) } },
    '@/lib/discord/protocol': protocol,
    '@/lib/discord/worker': { enqueueInteraction: async i => calls.queued.push(i), runDiscordJobs: async () => calls.runs++ },
  }, env);
  return { handler, calls };
}
function signed(body, timestamp = String(Math.floor(Date.now() / 1000))) {
  const raw = JSON.stringify(body);
  const signature = crypto.sign(null, Buffer.from(timestamp + raw), privateKey).toString('hex');
  return new Request('https://gea.test/api/discord/interactions', { method: 'POST', headers: { 'x-signature-timestamp': timestamp, 'x-signature-ed25519': signature }, body: raw });
}
const interaction = { id: '123', application_id: 'app', token: 'secret-token', type: 2, guild_id: 'guild', member: { user: { id: 'officer' } }, data: { name: 'score' } };
test('valid Ed25519 PING succeeds; unsigned and replayed requests fail', async () => {
  const { handler, calls } = route();
  assert.deepEqual(await (await handler.POST(signed({ type: 1 }))).json(), { type: 1 });
  assert.equal((await handler.POST(new Request('https://gea.test', { method: 'POST', body: '{}' }))).status, 401);
  assert.equal((await handler.POST(signed(interaction, '1000'))).status, 401);
  const tampered = signed(interaction);
  assert.equal((await handler.POST(new Request(tampered.url, { method: 'POST', headers: tampered.headers, body: '{"type":1}' }))).status, 401);
  assert.equal(calls.after.length, 0);
});
test('ACK precedes all database and AI work; queued processing runs after response', async () => {
  const { handler, calls } = route();
  assert.deepEqual(await (await handler.POST(signed(interaction))).json(), { type: 5, data: { flags: 64 } });
  assert.equal(calls.queued.length, 0);
  assert.equal(calls.after.length, 1);
  await calls.after[0]();
  assert.equal(calls.queued.length, 1);
  assert.equal(calls.runs, 1);
});
test('modals open immediately; wrong guild/application never queues', async () => {
  const { handler, calls } = route();
  const result = await (await handler.POST(signed({ ...interaction, type: 3, data: { custom_id: 'submit:task' } }))).json();
  assert.equal(result.type, 9);
  assert.equal(result.data.components[1].components[0].label, 'Project / Doc Link (https://...)');
  for (const bad of [{ guild_id: 'other' }, { application_id: 'other' }]) {
    assert.equal((await (await handler.POST(signed({ ...interaction, ...bad }))).json()).type, 4);
  }
  assert.equal(calls.after.length, 0);
});
test('redirects reject cross-origin and backslash destinations', () => {
  for (const bad of ['//evil.test', '/\\evil.test', 'https://evil.test', '/\n/evil']) assert.equal(protocol.safeNext(bad), '/operations');
  assert.equal(protocol.safeNext('/operations?view=tasks'), '/operations?view=tasks');
});
test('cron secret is fail-closed and uses an exact bearer token', () => {
  const dependencies = { '@/lib/supabase/admin': {}, '@/lib/discord': {}, './service': {}, './protocol': {}, './task-routing': {}, './attendance-routing': {} };
  const worker = load('lib/discord/worker.ts', dependencies, { CRON_SECRET: 'expected' });
  for (const value of ['', 'Bearer wrong', 'expected']) assert.equal(worker.cronAuthorized(new Request('https://gea.test', { headers: { authorization: value } })), false);
  assert.equal(worker.cronAuthorized(new Request('https://gea.test', { headers: { authorization: 'Bearer expected' } })), true);
  assert.equal(load('lib/discord/worker.ts', dependencies).cronAuthorized(new Request('https://gea.test')), false);
});
test('native Groq transport uses JSON mode and validates the established rubric', async () => {
  const { createGroq } = require('@ai-sdk/groq');
  const { generateObject } = require('ai');
  const { z } = require('zod');
  let sent;
  const provider = createGroq({ apiKey: 'fake', fetch: async (_url, init) => {
    sent = JSON.parse(init.body);
    return Response.json({ id: 'test', created: 0, model: 'test', choices: [{ index: 0, message: { role: 'assistant', content: '{"efficiency":3}' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  } });
  const { object } = await generateObject({ model: provider('llama-3.3-70b-versatile'), schema: z.object({ efficiency: z.number().min(1).max(4) }), providerOptions: { groq: { structuredOutputs: false } }, prompt: 'Return JSON' });
  assert.equal(object.efficiency, 3);
  assert.equal(sent.response_format.type, 'json_object');
});
test('middleware skips session refresh for Discord ingress', () => {
  const source = fs.readFileSync('middleware.ts', 'utf8');
  assert.ok(source.indexOf("startsWith('/api/discord/')") < source.indexOf('supabase.auth.getUser()'));
});
const peet = load('lib/peet.ts');
const schemas = load('lib/peet-ai.ts', { './peet': peet });
const cage = load('lib/cage.ts');
function serviceFixture(rpc, generate = async () => { throw new Error('unexpected AI'); }) {
  const replies = [];
  const service = load('lib/discord/service.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => ({ rpc }) },
    '@/lib/discord': { discordReply: async (_token, message) => replies.push(message), discordDM: async () => {}, discordFetch: async () => {}, safeMessage: x => x },
    './protocol': protocol, '@/lib/peet-ai': schemas, '@/lib/peet': peet, '@/lib/cage': cage, '@/lib/officer-tracking': { CONTRACT_YEAR: '2026-2027' },
    ai: { generateObject: generate },
  }, { GROQ_API_KEY: 'fake' });
  return { service, replies };
}
test('/score uses canonical PEET conversion and current-year confirmed strikes', async () => {
  const { service, replies } = serviceFixture(async (_name, args) => ({ data: args.p_action === 'me' ? { id: 'officer' } : {
    tasks: [{ id: 'task', assigned_to: 'officer', status: 'completed' }],
    evaluations: [{ task_id: 'task', efficiency: 3, effectiveness: 3, time: 3 }],
    strikes: [{ academic_year: '2026-2027', category: 'attendance', status: 'confirmed' }, { academic_year: '2026-2027', category: 'conduct', status: 'notified' }, { academic_year: '2025-2026', category: 'conduct', status: 'confirmed' }],
  }, error: null }));
  await service.handleInteraction(interaction);
  assert.match(replies[0].content, /85\.0 \/100/);
  assert.match(replies[0].content, /74\.0 \/90/);
});
test('submission persists evidence before an AI outage and never awards scores', async () => {
  const calls = [];
  const source = { id: '11111111-1111-4111-8111-111111111111', participant_ids: ['officer'], status: 'in_progress' };
  const { service } = serviceFixture(async (name, args) => {
    calls.push(name === 'discord_action' ? args.p_action : name);
    const value = name === 'reserve_gea_peet_ai_request' ? true : args.p_action === 'me' ? { id: 'officer' } : args.p_action === 'source' ? source : null;
    return { data: value, error: null };
  }, async () => { calls.push('model'); throw new Error('provider unavailable'); });
  const submit = { ...interaction, type: 5, data: { custom_id: `submit:${source.id}`, components: [{ components: [{ custom_id: 'notes', value: 'Completed workshop slides on time' }] }, { components: [{ custom_id: 'link', value: 'https://example.com/slides' }] }] } };
  await assert.rejects(service.handleInteraction(submit), /provider unavailable/);
  assert.ok(calls.indexOf('save_discord_submission') < calls.indexOf('model'));
  assert.equal(calls.includes('approve'), false);
  assert.equal(calls.includes('save_gea_peet_assessment'), false);
});
function routingFixture(env = {}) {
  const deliveries = [];
  const routing = load('lib/discord/task-routing.ts', {
    '@/lib/discord': {
      discordFetch: async (path, message) => deliveries.push({ path, message }),
      safeMessage: message => ({ ...message, allowed_mentions: { parse: [] } }),
      sendDiscordEmbed: async (topic, embed) => deliveries.push({ topic, embed }),
    },
  }, env);
  return { ...routing, deliveries };
}
test('officer positions map to role channels and grade reps fall back to shared reps', () => {
  const routing = routingFixture({
    DISCORD_CHANNEL_VICE_PRESIDENT: '111111111111111111', DISCORD_CHANNEL_SECRETARY: '222222222222222222',
    DISCORD_CHANNEL_PUBLICIST: '333333333333333333', DISCORD_CHANNEL_TREASURER: '444444444444444444',
    DISCORD_CHANNEL_REPS: '555555555555555555', DISCORD_CHANNEL_REP_9: '666666666666666666',
  });
  for (const label of ['Vice President', 'vice-president', 'VP', 'Vice President of Operations']) assert.equal(routing.officerChannelId(label), '111111111111111111');
  assert.equal(routing.officerChannelId('Secretary'), '222222222222222222');
  assert.equal(routing.officerChannelId('Publicist'), '333333333333333333');
  assert.equal(routing.officerChannelId('Treasurer'), '444444444444444444');
  for (const label of ['9th Grade Representative', 'rep-9', 'Freshman Representative']) assert.equal(routing.officerChannelId(label), '666666666666666666');
  for (const label of ['10th Grade Representative', 'rep-10', 'Reps']) assert.equal(routing.officerChannelId(label), '555555555555555555');
  for (const label of [null, '', 'Unrecognized position', 'President']) assert.equal(routing.officerChannelId(label), undefined);
});
test('role delivery contains assignee and task details; explicit destination takes precedence', async () => {
  const routing = routingFixture({ DISCORD_CHANNEL_SECRETARY: '222222222222222222' });
  const notification = { title: 'Task: Prepare minutes · in_progress', description: 'Due: 2026-11-01', task_id: 'task-uuid', assignee_name: 'Officer One', assignee_position: 'Secretary' };
  await routing.sendTaskNotification(notification);
  assert.equal(routing.deliveries[0].path, 'channels/222222222222222222/messages');
  assert.equal(routing.deliveries[0].message.embeds[0].fields[0].value, 'Officer One');
  assert.equal(routing.deliveries[0].message.embeds[0].description, notification.description);
  assert.equal(routing.deliveries[0].message.allowed_mentions.parse.length, 0);
  await routing.sendTaskNotification({ ...notification, channel_id: '777777777777777777' });
  assert.equal(routing.deliveries[1].path, 'channels/777777777777777777/messages');
  assert.equal(routing.deliveries.length, 2);
});
test('unmapped and legacy jobs fall back to the tasks webhook; invalid channels fail closed', async () => {
  const routing = routingFixture();
  await routing.sendTaskNotification({ title: 'Legacy task update' });
  assert.equal(routing.deliveries[0].topic, 'tasks');
  assert.throws(() => routingFixture({ DISCORD_CHANNEL_SECRETARY: '../other' }).officerChannelId('Secretary'), /Invalid/);
  await assert.rejects(routing.sendTaskNotification({ title: 'Task', channel_id: 'https://evil.test' }), /Invalid/);
  assert.equal(routing.deliveries.length, 1);
});
test('a private officer channel delivery failure is retried without posting to the general webhook', async () => {
  let fallback = false;
  const routing = load('lib/discord/task-routing.ts', { '@/lib/discord': {
    discordFetch: async () => { throw new Error('Discord delivery failed (403).'); }, safeMessage: x => x,
    sendDiscordEmbed: async () => { fallback = true; },
  } }, { DISCORD_CHANNEL_TREASURER: '444444444444444444' });
  await assert.rejects(routing.sendTaskNotification({ title: 'Task: Budget', assignee_position: 'Treasurer' }), /403/);
  assert.equal(fallback, false);
});
function attendanceFixture(env = {}) {
  const deliveries = [];
  const transport = { discordFetch: async (path, message) => deliveries.push({ path, message }), safeMessage: message => ({ ...message, allowed_mentions: { parse: [] } }) };
  const routing = load('lib/discord/task-routing.ts', { '@/lib/discord': transport }, env);
  const attendance = load('lib/discord/attendance-routing.ts', { '@/lib/discord': transport, './task-routing': routing });
  return { deliveries, ...attendance, ...routing };
}
test('attendance posts to the officer channel and permits only the matching role ping', async () => {
  const f = attendanceFixture({ DISCORD_CHANNEL_VICE_PRESIDENT: '111111111111111111', DISCORD_ROLE_VICE_PRESIDENT: '222222222222222222' });
  for (const [status, label] of [['present', 'Present'], ['late', 'Tardy'], ['excused', 'Excused'], ['unexcused', 'Unexcused'], ['unmarked', 'Not recorded']]) {
    await f.sendAttendanceNotification({ officer_name: 'VP @everyone', officer_position: 'VP', event_title: 'Officer meeting', status });
    const { path, message } = f.deliveries.at(-1);
    assert.equal(path, 'channels/111111111111111111/messages');
    assert.equal(message.content, '<@&222222222222222222>');
    assert.equal(JSON.stringify(message.allowed_mentions), JSON.stringify({ parse: [], roles: ['222222222222222222'], users: [] }));
    assert.equal(message.embeds[0].fields[2].value, label);
    assert.match(message.embeds[0].title, status === 'unmarked' ? /cleared/ : /recorded/);
  }
  await assert.rejects(f.sendAttendanceNotification({ officer_position: 'Unknown', status: 'present' }), /Configure a channel/);
  await assert.rejects(f.sendAttendanceNotification({ officer_position: 'VP', status: 'toString' }), /Invalid/);
});
test('task notifications also restrict pings to the configured officer role', async () => {
  const f = attendanceFixture({ DISCORD_CHANNEL_SECRETARY: '111111111111111111', DISCORD_ROLE_SECRETARY: '333333333333333333' });
  await f.sendTaskNotification({ title: 'Prepare minutes', assignee_position: 'Secretary' });
  assert.equal(f.deliveries[0].message.content, '<@&333333333333333333>');
  assert.deepEqual([...f.deliveries[0].message.allowed_mentions.roles], ['333333333333333333']);
  assert.throws(() => attendanceFixture({ DISCORD_ROLE_SECRETARY: '@everyone' }).officerRoleId('Secretary'), /Invalid/);
  assert.equal(attendanceFixture({ DISCORD_ROLE_REPS: '444444444444444444' }).officerRoleId('10th Grade Representative'), '444444444444444444');
});
test('secretary overview is opt-in, role receipts are independent, and legacy DM jobs are retired', async () => {
  for (const enabled of [false, true]) {
    const sent = [], updates = [];
    const jobs = [
      { id: 'officer', kind: 'notification', attempts: 1, payload: { topic: 'attendance_receipt', officer_position: 'VP', status: 'present' } },
      { id: 'overview', kind: 'notification', attempts: 1, payload: { topic: 'attendance', title: 'Attendance saved' } },
      { id: 'legacy', kind: 'notification', attempts: 1, payload: { topic: 'attendance_receipt', discord_id: '273656451862495233', status: 'present' } },
    ];
    const db = { rpc: async () => ({ data: jobs, error: null }), from: () => ({ update: values => ({ eq: async (_key, id) => { updates.push({ id, values }); return { error: null }; } }) }) };
    class InputError extends Error {}
    const worker = load('lib/discord/worker.ts', {
      '@/lib/supabase/admin': { createAdminClient: () => db }, '@/lib/discord': { sendDiscordEmbed: async topic => sent.push(topic) },
      './service': { DiscordInputError: InputError }, './protocol': {}, './task-routing': {},
      './attendance-routing': { sendAttendanceNotification: async () => { sent.push('officer'); throw new Error('Role channel blocked'); } },
    }, { DISCORD_ATTENDANCE_OVERVIEW: String(enabled) });
    const result = await worker.runDiscordJobs();
    assert.equal(result.completed, 2);
    assert.deepEqual(sent.sort(), enabled ? ['attendance', 'officer'] : ['officer']);
    assert.equal(updates.find(update => update.id === 'officer').values.failed, false);
    assert.ok(updates.find(update => update.id === 'legacy').values.finished_at);
  }
});
