// node --test tests/forum-override-route.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('app/api/forum/override/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const id = '11111111-1111-1111-1111-111111111111';

function setup(options = {}) {
  const calls = [];
  const user = options.anonymous ? null : { id, email: 'admin@example.com' };
  const session = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: options.nonAdmin ? null : { auth_user_id: id } }) }) }) }),
  };
  const admin = { rpc: async (name, args) => {
    calls.push({ name, args });
    if (name === 'claim_forum_override_attempt') return { data: !options.limited, error: options.unavailable ? {} : null };
    return { error: options.publishError ? {} : null };
  } };
  const modules = {
    'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
    '@/lib/supabase/server': { createClient: async () => session },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/forumBoards': { isForumBoard: board => board === 'general' },
    '@supabase/supabase-js': { createClient: () => ({ auth: {
      signInWithPassword: async args => {
        calls.push({ name: 'verify', args });
        return { data: { user: { id: options.wrongIdentity ? 'another-user' : id } }, error: options.wrongPassword ? {} : null };
      },
      signOut: async () => { calls.push({ name: 'signOut' }); },
    } }) },
  };
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => {
    assert.ok(modules[name], `Unexpected import: ${name}`); return modules[name];
  }, Response, URL, process: { env: { SUPABASE_SERVICE_ROLE_KEY: 'test-only', NEXT_PUBLIC_SUPABASE_URL: 'https://example.com', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-only' } } });
  return { ...exports, calls };
}
const payload = { kind: 'question', board: 'general', text: 'Visit www.example.com', password: 'test-password', reason: 'Approved school announcement', confirmed: true };
function request(overrides = {}, origin = 'https://gea.example') {
  return new Request('https://gea.example/api/forum/override', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, ...overrides }) });
}
for (const [name, options, overrides, status] of [
  ['anonymous', { anonymous: true }, {}, 403],
  ['non-admin', { nonAdmin: true }, {}, 403],
  ['missing confirmation', {}, { confirmed: false }, 400],
  ['short reason', {}, { reason: 'ok' }, 400],
  ['invalid board', {}, { board: 'invalid' }, 400],
  ['invalid reply target', {}, { kind: 'answer', questionId: 'bad' }, 400],
  ['missing database migration', { unavailable: true }, {}, 503],
  ['rate limit', { limited: true }, {}, 429],
  ['wrong password', { wrongPassword: true }, {}, 403],
  ['wrong verified identity', { wrongIdentity: true }, {}, 403],
]) test(`Rejects ${name} without publishing`, async () => {
  const api = setup(options);
  assert.equal((await api.POST(request(overrides))).status, status);
  assert.ok(!api.calls.some(c => c.name === 'publish_verified_forum_override'));
});
test('Rejects cross-origin requests before password verification', async () => {
  const api = setup();
  assert.equal((await api.POST(request({}, 'https://untrusted.example'))).status, 403);
  assert.equal(api.calls.length, 0);
});
test('Publishes only after password verification, using the session identity', async () => {
  const api = setup();
  assert.equal((await api.POST(request({ adminId: 'forged', name: 'Forged Author' }))).status, 200);
  assert.deepEqual(api.calls.map(c => c.name), ['claim_forum_override_attempt', 'verify', 'signOut', 'publish_verified_forum_override']);
  const args = api.calls.at(-1).args;
  assert.equal(args.p_admin_id, id);
  assert.equal(args.p_text, payload.text);
  assert.equal(args.p_reason, payload.reason);
  assert.ok(!JSON.stringify(args).includes(payload.password));
});
test('Database failure does not report success', async () => {
  assert.equal((await setup({ publishError: true }).POST(request())).status, 400);
});
test('Eligibility requires admin membership and cannot be cached', async () => {
  const denied = await setup({ nonAdmin: true }).GET();
  assert.equal((await denied.json()).eligible, false);
  const allowed = await setup().GET();
  assert.equal((await allowed.json()).eligible, true);
  assert.equal(allowed.headers.get('Cache-Control'), 'no-store');
});
test('School-year ranges pass while common phone numbers and database-filtered links are detected', () => {
  const filterExports = {};
  const compiled = ts.transpileModule(fs.readFileSync('lib/forumSafety.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(compiled, { exports: filterExports });
  for (const value of ['Meet your 2026-2027 GEA Leadership Team!', '2026–2027', '2026 - 2027', '10th Grade Representative', '2026\n2027\n2028']) {
    assert.equal(filterExports.getForumSafetyMessage(value), null, value);
  }
  for (const value of ['9255550123', '(925) 555-0123', '+1 (925) 555-0123', '+44 20 7946 0958', '555-0123']) {
    assert.match(filterExports.getForumSafetyMessage(value), /Phone/, value);
  }
  assert.match(filterExports.getForumSafetyMessage('www.livermoregea.org/leadership'), /Links/);
  assert.match(filterExports.getForumSafetyMessage('https://example.com'), /Links/);
  assert.match(filterExports.getForumSafetyMessage('person@example.com'), /Email/);
  assert.match(filterExports.getForumSafetyMessage('BUY NOW'), /spam/);
});
