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
    '@/lib/officer-preregistration': { reservedOfficerId: async () => undefined },
    '@/lib/student-email': email,
  }, { Response, process: { env: { SUPABASE_SERVICE_ROLE_KEY: 'test-only' } } });
  for (const schoolEmail of ['student@gmail.com','student@example.org','student@gmail.com@lvjusd.org','student@lvjusd.org.evil.test']) {
    const response = await POST(new Request('http://localhost/api/student-accounts/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fullName: 'Test Student', displayUsername: 'test', schoolEmail, graduatingClassYear: 2028, studentIdNumber: '123456' }) }));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /GEA and LVJUSD students only/);
  }
  assert.equal(accountCalls, 0);
});
test('Public student signup cannot replace the password of an existing teacher or staff account', async () => {
  let changes=0;
  const admin={
    from:()=>({select:()=>({eq(){return this;},maybeSingle:async()=>({data:null,error:null})})}),
    auth:{admin:{listUsers:async()=>({data:{users:[{id:'teacher',email:'teacher@lvjusd.org'}]},error:null}),updateUserById:async()=>{changes++;return {error:null};},createUser:async()=>{changes++;return {error:null};}}},
  };
  const {POST}=load('app/api/student-accounts/signup/route.ts',{
    'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},
    '@/lib/supabase/admin':{createAdminClient:()=>admin},
    '@/lib/supabase/config':{hasSupabaseConfig:()=>true},
    '@/lib/officer-preregistration': { reservedOfficerId: async () => undefined },
    '@/lib/student-email':email,
  },{Response,process:{env:{SUPABASE_SERVICE_ROLE_KEY:'test-only'}}});
  const response=await POST(new Request('http://localhost/api/student-accounts/signup',{method:'POST',body:JSON.stringify({fullName:'Impersonator',displayUsername:'fake',schoolEmail:'teacher@lvjusd.org',graduatingClassYear:2028,studentIdNumber:'123456'})}));
  assert.equal(response.status,409);assert.equal(changes,0);
});

test('Regular signup creates the login with the reserved officer identity and uses it for the student profile', async () => {
  const reservedId='55555555-5555-5555-5555-555555555555';
  let created, saved;
  const admin={
    from:table=>({
      select(){return this;},eq(){return this;},is(){return this;},
      maybeSingle:async()=>({data:table==='officer_profiles'?{id:reservedId}:null,error:null}),
      upsert:async data=>{saved=data;return {error:null};},
    }),
    auth:{admin:{listUsers:async()=>({data:{users:[]},error:null}),createUser:async data=>{created=data;return {data:{user:{id:data.id}},error:null};}}},
  };
  const {POST}=load('app/api/student-accounts/signup/route.ts',{
    'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},
    '@/lib/supabase/admin':{createAdminClient:()=>admin},
    '@/lib/supabase/config':{hasSupabaseConfig:()=>true},
    '@/lib/student-email':email,
    '@/lib/officer-preregistration':load('lib/officer-preregistration.ts'),
  },{Response,process:{env:{SUPABASE_SERVICE_ROLE_KEY:'test-only'}}});
  const response=await POST(new Request('http://localhost/api/student-accounts/signup',{method:'POST',body:JSON.stringify({fullName:'Future Officer',displayUsername:'future',schoolEmail:' Future.Officer@LVJUSD.ORG ',graduatingClassYear:2028,studentIdNumber:'123456'})}));
  assert.equal(response.status,200);assert.equal(created.id,reservedId);
  assert.equal(created.email,'future.officer@lvjusd.org');assert.equal(created.password,'123456');
  assert.equal(saved.auth_user_id,reservedId);
});
