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
  const dependencies = { '@/lib/supabase/admin': {}, '@/lib/discord': {}, './service': {}, './protocol': {} };
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
