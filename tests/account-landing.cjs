const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(file,modules={}){
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{assert.ok(modules[name],name);return modules[name];}});return exports;
}
const {accountLanding}=load('lib/account-landing.ts');
function client(roles={},signedIn=true){return {
 auth:{getUser:async()=>({data:{user:signedIn?{id:'current-user'}:null}})},
 from:table=>({select:()=>({eq:(column,id)=>{assert.equal(id,'current-user');assert.equal(column,table==='officer_profiles'?'id':'auth_user_id');return {maybeSingle:async()=>({data:roles[table]?(typeof roles[table]==='object'?roles[table]:{id:'membership'}):null,error:roles.missing===table?{code:'42P01'}:null})};}})}),
};}
for(const [name,roles,path] of [
 ['admin who is also an officer',{admins:true,officer_profiles:true,student_profiles:true},'/account'],
 ['super admin with officer membership',{super_admins:true,officer_profiles:true},'/account'],
 ['teacher automatically enrolled as super admin',{admins:true,super_admins:true,teacher_profiles:true,officer_profiles:true},'/account'],
 ['student officer',{student_profiles:true,officer_profiles:true},'/account'],
 ['officer without a student profile',{officer_profiles:true},'/account'],
 ['teacher with designated officer access',{teacher_profiles:true,officer_profiles:true},'/account'],
 ['ordinary teacher',{teacher_profiles:true},'/account'],
 ['ordinary student',{student_profiles:true},'/dashboard#qa'],
 ['teacher before officer migration',{teacher_profiles:true,missing:'officer_profiles'},'/account'],
 ['disabled officer with a student profile',{officer_profiles:{id:'membership',access_enabled:false},student_profiles:true},'/dashboard#qa'],
 ['disabled officer without other membership',{officer_profiles:{id:'membership',access_enabled:false}},'/account'],
 ['account with no assigned profile',{},'/account'],
])test('Landing route: '+name,async()=>assert.equal(await accountLanding(client(roles),'current-user'),path));
test('Post-sign-in resolver rejects anonymous sessions and routes authenticated officers using server membership',async()=>{
 let supabase=client({},false);
 const page=load('app/account/redirect/page.tsx',{
 'next/navigation':{redirect:path=>{throw new Error('redirect:'+path);}},
 '@/lib/supabase/server':{createClient:async()=>supabase},
 '@/lib/supabase/config':{hasSupabaseConfig:()=>true},
 '@/lib/account-landing':{accountLanding},
 }).default;
 await assert.rejects(page(),/redirect:\/login/);
 supabase=client({officer_profiles:true,student_profiles:true});await assert.rejects(page(),/redirect:\/account$/);
 supabase=client({officer_profiles:true,admins:true});await assert.rejects(page(),/redirect:\/account$/);
});

const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {accountMemberships}=load('lib/account-landing.ts');
function accountHome(supabase){return load('app/account/page.tsx',{
 'react/jsx-runtime':require('react/jsx-runtime'),
 './home.module.css':{default:new Proxy({},{get:(_,key)=>String(key)})},
 'next/link':{default:({children,...props})=>React.createElement('a',props,children)},
 'next/navigation':{redirect:path=>{throw new Error('redirect:'+path);}},
 '@/components/DiscordConnect':{default:()=>null},'@/components/GEAOneBadge':{default:()=>React.createElement('span',null,'GEA One')},
 '@/components/WorkspaceGreeting':{default:({name})=>React.createElement('h1',null,`Good morning, ${name}.`)},
 '@/lib/discord/account-link':load('lib/discord/account-link.ts'),'@/lib/account-landing':{accountMemberships},
 '@/lib/supabase/server':{createClient:async()=>supabase},
 '@/lib/supabase/config':{hasSupabaseConfig:()=>true},
 }).default({searchParams:Promise.resolve({})});}
for(const [name,roles,expected,hidden] of [
 ['officer',{officer_profiles:true},['/dashboard#qa','/officerboard','/profile'],['/admin-portal-x7k9','/teacher']],
 ['teacher',{teacher_profiles:true},['/dashboard#qa','/admin-portal-x7k9','/profile'],['/officerboard','/teacher']],
 ['teacher with admin and officer access',{teacher_profiles:true,admins:true,officer_profiles:true},['/dashboard#qa','/admin-portal-x7k9','/profile'],['/teacher','/officerboard']],
 ['disabled officer',{officer_profiles:{id:'membership',access_enabled:false}},['/dashboard#qa','/profile'],['/officerboard','/admin-portal-x7k9','/teacher']],
])test('GEA One home shows only authorized workspace shortcuts: '+name,async()=>{
 const html=renderToStaticMarkup(await accountHome(client(roles)));
 assert.match(html,/Good morning/);
 for(const href of expected)assert.ok(html.includes(`href="${href}"`),href);
 for(const href of hidden)assert.ok(!html.includes(`href="${href}"`),href);
});
test('GEA One home sends regular students directly to the forum and anonymous visitors to sign-in',async()=>{
 await assert.rejects(accountHome(client({student_profiles:true})),/redirect:\/dashboard#qa/);
 await assert.rejects(accountHome(client({},false)),/redirect:\/login/);
});

function mergedOfficers(supabase){return load('app/admin-portal-x7k9/officers/page.tsx',{
 'react/jsx-runtime':require('react/jsx-runtime'),
 'next/navigation':{redirect:path=>{throw new Error('redirect:'+path);}},
 '@/components/StaffPortal':{default:({children})=>React.createElement('section',null,children)},
 '@/components/officerboard/OfficerWorkspace':{default:({embedded})=>React.createElement('div',null,embedded?'Embedded officer accountability':'Standalone officers')},
 '@/components/PageNotice':{default:({title})=>React.createElement('h1',null,title)},
 '@/lib/discord/account-link':load('lib/discord/account-link.ts'),'@/lib/account-landing':{accountMemberships},
 '@/lib/supabase/server':{createClient:async()=>supabase},
 '@/lib/supabase/config':{hasSupabaseConfig:()=>true},
 }).default({searchParams:Promise.resolve({})});}
test('Merged officer workspace requires both staff and active officer membership',async()=>{
 await assert.rejects(mergedOfficers(client({},false)),/redirect:\/login/);
 await assert.rejects(mergedOfficers(client({student_profiles:true})),/redirect:\/account$/);
 await assert.rejects(mergedOfficers(client({officer_profiles:true})),/redirect:\/officerboard/);
 const denied=renderToStaticMarkup(await mergedOfficers(client({admins:true,officer_profiles:{id:'membership',access_enabled:false}})));
 assert.match(denied,/Officer access required/);
 for(const roles of [{admins:true,officer_profiles:true},{teacher_profiles:true,officer_profiles:true},{super_admins:true,officer_profiles:true}]){
  const html=renderToStaticMarkup(await mergedOfficers(client(roles)));
  assert.match(html,/Embedded officer accountability/);
 }
});
test('Legacy officer route takes staff into the merged workspace and leaves ordinary officers in their dashboard',async()=>{
 let supabase=client({admins:true,officer_profiles:true});
 const page=load('app/officerboard/page.tsx',{
  'react/jsx-runtime':require('react/jsx-runtime'),
  'next/navigation':{redirect:path=>{throw new Error('redirect:'+path);}},
  '@/components/officerboard/OfficerWorkspace':{default:()=>React.createElement('div',null,'Officer dashboard')},
  '@/lib/discord/account-link':load('lib/discord/account-link.ts'),'@/lib/account-landing':{accountMemberships},
  '@/lib/supabase/server':{createClient:async()=>supabase},
  '@/lib/supabase/config':{hasSupabaseConfig:()=>true},
 }).default;
 await assert.rejects(page(),/redirect:\/admin-portal-x7k9\/officers/);
 supabase=client({teacher_profiles:true,officer_profiles:true});
 await assert.rejects(page(),/redirect:\/admin-portal-x7k9\/officers/);
 supabase=client({officer_profiles:true,student_profiles:true});
 assert.match(renderToStaticMarkup(await page()),/Officer dashboard/);
});


test('GEA One home exposes one workspace entry instead of separate officer and planning cards',async()=>{
 for(const roles of [{officer_profiles:true},{admins:true,officer_profiles:true},{teacher_profiles:true,officer_profiles:true}]){
  const html=renderToStaticMarkup(await accountHome(client(roles)));
  assert.ok(!html.includes('href="/operations"'));
  assert.ok(!html.includes('Planning &amp; inbox'));
  const paths=[...html.matchAll(/href="(\/officerboard|\/admin-portal-x7k9)"/g)];
  assert.equal(paths.length,1);
 }
});
