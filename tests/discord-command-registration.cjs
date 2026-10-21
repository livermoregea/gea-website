const { test } = require('node:test');
const assert = require('node:assert/strict');
const base = { applicationId: 'app', guildId: 'guild', botToken: 'fake', commands: [{ name: 'score' }, { name: 'assign-task' }] };
test('registration waits at the bucket boundary and retries the same command after 429', async () => {
  const { registerDiscordCommands } = await import('../scripts/discord-command-registration.mjs');
  const waits = [], requests = [], registered = [];
  const responses = [
    Response.json({}, { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '0.5' } }),
    Response.json({ retry_after: 0.75 }, { status: 429 }),
    Response.json({}),
  ];
  await registerDiscordCommands({ ...base, fetchImpl: async (url, request) => { requests.push({ url, method: request.method, command: JSON.parse(request.body).name }); return responses.shift(); }, sleep: async ms => waits.push(ms), onRegistered: name => registered.push(name) });
  assert.deepEqual(waits, [500, 750]);
  assert.deepEqual(requests.map(r => r.command), ['score', 'assign-task', 'assign-task']);
  assert.ok(requests.every(r => r.method === 'POST'));
  assert.deepEqual(registered, ['score', 'assign-task']);
});
test('registration uses Retry-After when no JSON is provided and preserves other commands', async () => {
  const { registerDiscordCommands } = await import('../scripts/discord-command-registration.mjs');
  const waits = [];let calls = 0;
  await registerDiscordCommands({ ...base, commands: [{ name: 'mark-attendance' }], fetchImpl: async (_url, request) => { assert.equal(request.method, 'POST'); return calls++ === 0 ? new Response('', { status: 429, headers: { 'retry-after': '1.2' } }) : Response.json({}); }, sleep: async ms => waits.push(ms) });
  assert.deepEqual(waits, [1200]);assert.equal(calls, 2);
});
test('registration reports persistent rate limits and other HTTP failures without logging credentials', async () => {
  const { registerDiscordCommands } = await import('../scripts/discord-command-registration.mjs');
  let calls = 0;
  await assert.rejects(registerDiscordCommands({ ...base, fetchImpl: async () => { calls++;return Response.json({ retry_after: 0.01 }, { status: 429 }); }, sleep: async () => {} }), /rate limit persisted/);
  assert.equal(calls, 6);
  await assert.rejects(registerDiscordCommands({ ...base, fetchImpl: async () => new Response('', { status: 403 }) }), /HTTP 403/);
});
