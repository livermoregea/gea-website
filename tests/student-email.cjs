const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, modules = {}, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => {
    assert.ok(name in modules, `Unexpected import: ${name}`); return modules[name];
  }, ...globals });
  return exports;
}
const email = load('lib/student-email.ts');
test('Only well-formed addresses at the exact district signup domain are accepted', () => {
  for (const value of ['student@lvjusd.org', 'Student@LVJUSD.ORG', ' student@lvjusd.org ']) assert.equal(email.isLvjusdStudentEmail(value), true);
  for (const value of ['student@gmail.com', 'student@example.org', 'student@evil.lvjusd.org', 'student@lvjusd.org.evil.test', 'student@gmail.com@lvjusd.org', '@lvjusd.org', 'student name@lvjusd.org', 'student\n@lvjusd.org']) assert.equal(email.isLvjusdStudentEmail(value), false, value);
});
test('The signup API rejects outside and malformed emails before accessing account administration', async () => {
  let accountCalls = 0;
  const { POST } = load('app/api/student-accounts/signup/route.ts', {
    'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
    '@/lib/supabase/admin': { createAdminClient: () => { accountCalls++; throw new Error('Account administration must not be reached'); } },
    '@/lib/supabase/config': { hasSupabaseConfig: () => true },
    '@/lib/student-email': email,
  }, { Response, process: { env: { SUPABASE_SERVICE_ROLE_KEY: 'test-only' } } });
  for (const schoolEmail of ['student@gmail.com','student@example.org','student@gmail.com@lvjusd.org','student@lvjusd.org.evil.test']) {
    const response = await POST(new Request('http://localhost/api/student-accounts/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fullName: 'Test Student', displayUsername: 'test', schoolEmail, graduatingClassYear: 2028, studentIdNumber: '123456' }) }));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /GEA and LVJUSD students only/);
  }
  assert.equal(accountCalls, 0);
});
