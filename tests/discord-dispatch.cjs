const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, dependencies, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { exports, require: name => dependencies[name] ?? require(name), Error, Request, Response, URL, Buffer, Date, BigInt, console, process: { env: {} }, ...globals });
  return exports;
}
function route(user = { id: 'officer' }, officer = true, reviewer = false) {
  const callbacks = [];
  let runs = 0;
  const api = load('app/api/discord/dispatch/route.ts', {
    'next/server': { after: callback => callbacks.push(callback), NextResponse: { json: Response.json } },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) }, rpc: async name => ({ data: name === 'has_officer_access' ? officer : reviewer }) }) },
    '@/lib/discord/worker': { runDiscordJobs: async () => { runs++; } },
  });
  return { api, callbacks, runs: () => runs };
}
const request = (origin = 'https://gea.test') => new Request('https://gea.test/api/discord/dispatch', { method: 'POST', headers: { origin } });
test('website saves start delivery after responding, for officers and reviewers', async () => {
  for (const [officer, reviewer] of [[true, false], [false, true]]) {
    const r = route({ id: 'actor' }, officer, reviewer);
    const result = await r.api.POST(request());
    assert.equal(result.status, 202);
    assert.equal(r.runs(), 0);
    assert.equal(r.callbacks.length, 1);
    await r.callbacks[0]();
    assert.equal(r.runs(), 1);
  }
});
test('anonymous, non-officer, and cross-origin requests cannot start delivery', async () => {
  for (const [r, req, status] of [[route(null), request(), 401], [route({ id: 'student' }, false), request(), 403], [route(), request('https://evil.test'), 403]]) {
    assert.equal((await r.api.POST(req)).status, status);
    assert.equal(r.callbacks.length, 0);
    assert.equal(r.runs(), 0);
  }
});
test('a Discord assignment sends the notification it creates without a second command', async () => {
  const protocol = load('lib/discord/protocol.ts', {});
  const id = ((BigInt(Date.now()) - 1420070400000n) << 22n).toString();
  const queue = [{ id, kind: 'interaction', attempts: 1, payload: { id, data: { name: 'assign-task' } } }];
  const sent = [], finished = [];
  const db = { rpc: async () => ({ data: queue.splice(0, 5) }), from: () => ({ update: values => ({ eq: async (_key, jobId) => { finished.push({ jobId, values }); return {}; } }) }) };
  class InputError extends Error {}
  const worker = load('lib/discord/worker.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => db }, '@/lib/discord': {}, './protocol': protocol,
    './failures': load('lib/discord/failures.ts', {}), './attendance-routing': {},
    './service': { DiscordInputError: InputError, handleInteraction: async () => queue.push({ id: 'notification', kind: 'notification', payload: { topic: 'tasks', title: 'Assigned task' } }) },
    './task-routing': { sendTaskNotification: async payload => sent.push(payload) },
  });
  const result = await worker.runDiscordJobs();
  assert.equal(result.claimed, 2);
  assert.equal(result.completed, 2);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].title, 'Assigned task');
  assert.equal(finished.length, 2);
  assert.equal(queue.length, 0);
});
test('website delivery requests survive navigation and do not undo a save on network failure', async () => {
  const requests = [], warnings = [];
  const helper = load('lib/discord-notifications.ts', {}, {
    fetch: async (url, init) => { requests.push({ url, init }); throw new Error('offline'); },
    console: { warn: message => warnings.push(message) },
  });
  assert.doesNotThrow(() => helper.dispatchDiscordNotifications());
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(requests[0].url, '/api/discord/dispatch');
  assert.equal(requests[0].init.keepalive, true);
  assert.equal(requests[0].init.credentials, 'same-origin');
  assert.equal(warnings.length, 1);
});

function rollCallWorker(batchDuration = 0) {
  const positions = ['Treasurer', '10th Grade Rep.', 'Publicist', 'President', 'Publicist', 'Vice President', 'Secretary', '10th Grade Rep.', 'Secretary', '9th Grade Rep', 'Vice President'];
  const queue = positions.flatMap((position, i) => [
    { id: `receipt-${i}`, kind: 'notification', payload: { topic: 'attendance_receipt', officer_name: `Officer ${i}`, officer_position: position, status: 'present' } },
    { id: `overview-${i}`, kind: 'notification', payload: { topic: 'attendance', title: `Officer ${i} attendance` } },
  ]);
  const receipts = [], overviews = [], finished = [];
  let clock = 0;
  class Clock extends Date { static now() { return clock; } }
  const db = { rpc: async () => { clock += batchDuration; return { data: queue.splice(0, 5) }; }, from: () => ({ update: values => ({ eq: async (_key, id) => { finished.push({ id, values }); return {}; } }) }) };
  class InputError extends Error {}
  const worker = load('lib/discord/worker.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => db }, '@/lib/discord': { sendDiscordEmbed: async (_topic, message) => overviews.push(message) },
    './protocol': load('lib/discord/protocol.ts', {}), './failures': load('lib/discord/failures.ts', {}), './task-routing': {},
    './service': { DiscordInputError: InputError }, './attendance-routing': { sendAttendanceNotification: async message => receipts.push(message) },
  }, { Date: Clock, process: { env: { DISCORD_ATTENDANCE_OVERVIEW: 'true' } } });
  return { worker, queue, receipts, overviews, finished };
}
test('a complete 11-officer attendance save delivers all 22 jobs, including both VPs and secretaries', async () => {
  const r = rollCallWorker();
  const result = await r.worker.runDiscordJobs();
  assert.equal(result.claimed, 22);
  assert.equal(result.completed, 22);
  assert.equal(r.queue.length, 0);
  assert.equal(r.receipts.length, 11);
  assert.equal(new Set(r.receipts.map(message => message.officer_name)).size, 11);
  assert.equal(r.receipts.filter(message => message.officer_position === 'Vice President').length, 2);
  assert.equal(r.receipts.filter(message => message.officer_position === 'Secretary').length, 2);
  assert.equal(r.overviews.length, 11);
});
test('draining a large attendance queue still stops starting batches when its time budget is reached', async () => {
  const r = rollCallWorker(15000);
  const result = await r.worker.runDiscordJobs();
  assert.equal(result.claimed, 10);
  assert.equal(result.completed, 10);
  assert.equal(r.queue.length, 12);
});
