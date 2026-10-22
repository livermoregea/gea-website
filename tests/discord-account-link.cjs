const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText,
    { exports, require: name => dependencies[name] ?? require(name), URL, Response });
  return exports;
}
const helper = load('lib/discord/account-link.ts');
const protocol = load('lib/discord/protocol.ts');
const linkedUser = { identities: [{ provider: 'discord', identity_data: { sub: '273656451862495233' } }] };
function fixture(user = linkedUser, binding = { data: true, error: null }, access = { data: true, error: null }) {
  const calls = [];
  const db = {
    rpc: async name => { calls.push(name); return name === 'has_officer_access' ? access : binding; },
    auth: {
      getUser: async () => ({ data: { user } }),
      linkIdentity: async () => { calls.push('linkIdentity'); return { data: { url: 'https://discord.com/authorize' }, error: null }; },
      signInWithOAuth: async () => { calls.push('signInWithOAuth'); return { data: { url: 'https://discord.com/authorize' }, error: null }; },
      exchangeCodeForSession: async () => { calls.push('exchangeCodeForSession'); return { error: null }; },
    },
  };
  const dependencies = {
    '@/lib/supabase/server': { createClient: async () => db }, '@/lib/supabase/config': { hasSupabaseConfig: () => true },
    '@/lib/discord/account-link': helper, '@/lib/discord/protocol': protocol,
    'next/server': { NextResponse: { redirect: url => Response.redirect(url) } },
  };
  return { db, calls, dependencies };
}
test('repeat Connect syncs the verified identity and never starts OAuth again', async () => {
  const f = fixture();
  const route = load('app/auth/discord/route.ts', f.dependencies);
  const response = await route.GET({ url: 'https://gea.test/auth/discord?next=/operations' });
  assert.equal(response.headers.get('location'), 'https://gea.test/account?discord=already-linked');
  assert.deepEqual(f.calls, ['has_officer_access', 'bind_officer_discord']);
});
test('officer binding failure never reports that commands are ready', async () => {
  for (const [binding, status] of [[{ data: false, error: null }, 'link-required'], [{ data: null, error: { code: '42883' } }, 'sync-failed']]) {
    const f = fixture(linkedUser, binding);
    assert.equal(await helper.existingDiscordDestination(f.db, linkedUser), `/account?discord=${status}`);
  }
});
test('an already-linked OAuth error cannot claim a Discord identity for the wrong session', async () => {
  for (const [user, destination] of [[{ identities: [{ provider: 'email' }] }, '/account?discord=linked-elsewhere'], [null, '/login?discord=officer-sign-in']]) {
    const f = fixture(user);
    const callback = load('app/auth/callback/route.ts', f.dependencies);
    const response = await callback.GET({ url: 'https://gea.test/auth/callback?error_code=identity_already_exists' });
    assert.equal(response.headers.get('location'), `https://gea.test${destination}`);
    assert.deepEqual(f.calls, user ? ['has_officer_access'] : []);
  }
});
test('already-linked callback recovers the binding using the signed-in user', async () => {
  const f = fixture();
  const callback = load('app/auth/callback/route.ts', f.dependencies);
  const response = await callback.GET({ url: 'https://gea.test/auth/callback?error_code=identity_already_exists' });
  assert.equal(response.headers.get('location'), 'https://gea.test/account?discord=already-linked');
  assert.deepEqual(f.calls, ['has_officer_access', 'bind_officer_discord']);
});
test('only a signed-in active officer can start Discord identity linking', async () => {
  const f = fixture({ identities: [{ provider: 'email' }] });
  const route = load('app/auth/discord/route.ts', f.dependencies);
  const response = await route.GET({ url: 'https://gea.test/auth/discord' });
  assert.equal(response.headers.get('location'), 'https://discord.com/authorize');
  assert.deepEqual(f.calls, ['has_officer_access', 'linkIdentity']);
});
test('anonymous visitors must sign in with GEA One before connecting Discord', async () => {
  const f = fixture(null);
  const route = load('app/auth/discord/route.ts', f.dependencies);
  const response = await route.GET({ url: 'https://gea.test/auth/discord' });
  assert.equal(response.headers.get('location'), 'https://gea.test/login?discord=officer-sign-in');
  assert.deepEqual(f.calls, []);
});
test('direct connection links reject non-officers, disabled officers, and failed membership checks before OAuth', async () => {
  for (const access of [{ data: false, error: null }, { data: null, error: { code: '42883' } }, { data: true, error: { code: 'P0001' } }]) {
    for (const user of [linkedUser, { identities: [{ provider: 'email' }], user_metadata: { role: 'officer' } }]) {
      const f = fixture(user, undefined, access);
      const route = load('app/auth/discord/route.ts', f.dependencies);
      const response = await route.GET({ url: 'https://gea.test/auth/discord' });
      assert.equal(response.headers.get('location'), 'https://gea.test/account?discord=officer-only');
      assert.deepEqual(f.calls, ['has_officer_access']);
    }
  }
});
test('callback rechecks membership after OAuth and rejects lost officer access before binding', async () => {
  for (const access of [{ data: false, error: null }, { data: null, error: { code: '42883' } }]) {
    const f = fixture(linkedUser, undefined, access);
    const callback = load('app/auth/callback/route.ts', f.dependencies);
    const response = await callback.GET({ url: 'https://gea.test/auth/callback?code=valid-code' });
    assert.equal(response.headers.get('location'), 'https://gea.test/account?discord=officer-only');
    assert.deepEqual(f.calls, ['exchangeCodeForSession', 'has_officer_access']);
  }
});
test('active officer callback binds the verified Discord identity after checking access', async () => {
  const f = fixture();
  const callback = load('app/auth/callback/route.ts', f.dependencies);
  const response = await callback.GET({ url: 'https://gea.test/auth/callback?code=valid-code&next=/operations' });
  assert.equal(response.headers.get('location'), 'https://gea.test/operations');
  assert.deepEqual(f.calls, ['exchangeCodeForSession', 'has_officer_access', 'bind_officer_discord']);
});
test('Site URL OAuth error is forwarded for authenticated recovery, without reflecting descriptions', async () => {
  const f = fixture();
  const middleware = load('middleware.ts', { ...f.dependencies, '@supabase/ssr': {}, '@/lib/site-features': { BUILDERS_ENABLED: false } });
  const url = 'https://gea.test/?error_code=identity_already_exists&error_description=untrusted';
  const response = await middleware.middleware({ url, nextUrl: new URL(url) });
  assert.equal(response.headers.get('location'), 'https://gea.test/auth/callback?error_code=identity_already_exists');
});
test('account card displays the linked state and a connection check instead of repeated authorization', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Card = load('components/DiscordConnect.tsx', { 'next/link': ({ children, prefetch, ...props }) => React.createElement('a', props, children) }).default;
  const ready = renderToStaticMarkup(React.createElement(Card, { officer: true, signedIn: true, linked: true, commandsReady: true }));
  assert.match(ready, /Discord already linked/);
  assert.match(ready, /Check Discord connection/);
  assert.match(ready, /use \/score/);
  const pending = renderToStaticMarkup(React.createElement(Card, { officer: true, signedIn: true, linked: true, commandsReady: false }));
  assert.match(pending, /finish syncing/);
  assert.doesNotMatch(pending, /use \/score/);
});

test('Discord card requires explicit officer eligibility and a signed-in session', () => {
 const React = require('react'); const { renderToStaticMarkup } = require('react-dom/server');
 const Card = load('components/DiscordConnect.tsx', { 'next/link': ({ children, prefetch, ...props }) => React.createElement('a', props, children) }).default;
 for (const props of [{}, { signedIn: true }, { officer: true }, { officer: false, signedIn: true, linked: true }]) assert.equal(renderToStaticMarkup(React.createElement(Card, props)), '');
 assert.match(renderToStaticMarkup(React.createElement(Card, { officer: true, signedIn: true })), /Connect Discord/);
});
