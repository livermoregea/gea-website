const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const actor='11111111-1111-1111-1111-111111111111',target='22222222-2222-2222-2222-222222222222',created='33333333-3333-3333-3333-333333333333';
function compile(path){return ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;}
const accountExports={};vm.runInNewContext(compile('lib/account-management.ts'),{exports:accountExports});
function setup(options={}){
 const calls=[];const session={auth:{getUser:async()=>({data:{user:options.anonymous?null:{id:options.actorId??actor,user_metadata:{role:'super_admin'}}},error:null})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:options.denied?null:{auth_user_id:options.actorId??actor},error:options.roleError?{code:'42P01'}:null})})})})};
 const admin={
 from:table=>{const query={select(){return query;},eq(){return query;},order(){return query;},range:async()=>({data:[],error:null}),maybeSingle:async()=>({data:options.noProfile?null:{id:'existing'},error:null})};return query;},
 rpc:async(name,args)=>{calls.push({name,args});if(options.rpcThrow)throw new Error('network failure');return {error:options.rpcError?{code:'P0001',message:'Profile rejected.'}:null};},
 auth:{admin:{
 listUsers:async({page})=>{calls.push({name:'listUsers',page});if(options.listError)return {error:{},data:null};if(options.paginated&&page===1)return {data:{users:Array.from({length:1000},(_,i)=>({id:'other-'+i,email:'other-'+i+'@lvjusd.org'}))},error:null};return {data:{users:options.existing||options.paginated?[{id:target,email:'person@lvjusd.org'}]:[]},error:null};},
 createUser:async args=>{calls.push({name:'createUser',args});return {data:{user:{id:created,email:args.email}},error:options.createError?{}:null};},
 updateUserById:async(id,args)=>{calls.push({name:'updateUserById',id,args});return {error:null};},
 deleteUser:async id=>{calls.push({name:'deleteUser',id});return {error:options.cleanupError?{}:null};},
 }},
 };
 const exports={};const modules={
 'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},
 '@/lib/supabase/server':{createClient:async()=>session},'@/lib/supabase/admin':{createAdminClient:()=>{calls.push({name:'serviceClient'});return admin;}},
 '@/lib/supabase/config':{hasSupabaseConfig:()=>!options.unconfigured},'@/lib/account-management':accountExports,
 };
 vm.runInNewContext(compile('app/api/officerboard/accounts/route.ts'),{exports,require:name=>{assert.ok(modules[name],name);return modules[name];},Response,URL,process:{env:{SUPABASE_SERVICE_ROLE_KEY:'test-only'}}});
 return {...exports,calls};
}
const payload={action:'save',kind:'teacher',email:'person@lvjusd.org',name:'Person Name',password:'A-test-password-123'};
function request(extra={},origin='https://gea.example'){return new Request('https://gea.example/api/officerboard/accounts',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({...payload,...extra})});}
for(const [name,options,status] of [['anonymous',{anonymous:true},401],['non-teacher ordinary admin with forged metadata',{denied:true},403],['missing migration',{roleError:true},503],['missing config',{unconfigured:true},503]])test('Account endpoint rejects '+name,async()=>{
 const api=setup(options);assert.equal((await api.POST(request({isSuperAdmin:true,actorId:actor}))).status,status);assert.equal((await api.GET()).status,status);assert.ok(!api.calls.some(call=>call.name==='serviceClient'));
});
test('Automatically enrolled teachers can manage accounts using their verified super-admin membership',async()=>{
 const api=setup({actorId:target});assert.equal((await api.POST(request())).status,200);
 assert.equal(api.calls.find(call=>call.name==='superadmin_save_account').args.p_actor,target);
});
test('Cross-origin and malformed requests do not mutate accounts',async()=>{
 const api=setup();assert.equal((await api.POST(request({},'https://evil.example'))).status,403);assert.equal(api.calls.length,0);
 assert.equal((await api.POST(new Request('https://gea.example/api/officerboard/accounts',{method:'POST',headers:{origin:'https://gea.example'},body:'{' }))).status,400);
 assert.ok(!api.calls.some(call=>call.name==='createUser'||call.name==='superadmin_save_account'));
});
test('Creates a teacher login then grants profile access using the authenticated actor',async()=>{
 const api=setup();const response=await api.POST(request({actorId:target}));assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);
 const rpc=api.calls.find(call=>call.name==='superadmin_save_account');assert.equal(rpc.args.p_actor,actor);assert.equal(rpc.args.p_target,created);assert.equal(rpc.args.p_kind,'teacher');assert.ok(!JSON.stringify(rpc.args).includes(payload.password));
});
test('Attaching teacher access to an existing login never resets its password',async()=>{
 const api=setup({existing:true});assert.equal((await api.POST(request())).status,200);assert.ok(!api.calls.some(call=>['createUser','updateUserById'].includes(call.name)));assert.equal(api.calls.find(call=>call.name==='superadmin_save_account').args.p_target,target);
});
test('Existing accounts beyond the first Auth page are reused',async()=>{
 const api=setup({paginated:true});assert.equal((await api.POST(request())).status,200);assert.deepEqual(api.calls.filter(call=>call.name==='listUsers').map(call=>call.page),[1,2]);assert.ok(!api.calls.some(call=>call.name==='createUser'));
});
test('Failed profile write cleans up a newly created login, including thrown network errors',async()=>{
 for(const option of ['rpcError','rpcThrow']){const api=setup({[option]:true});assert.equal((await api.POST(request())).status,400);assert.ok(api.calls.some(call=>call.name==='deleteUser'&&call.id===created));}
});
test('Cleanup failure is reported instead of claiming a rollback succeeded',async()=>{
 const api=setup({rpcError:true,cleanupError:true});const response=await api.POST(request());assert.equal(response.status,400);assert.match((await response.json()).error,/could not be rolled back/);
});
test('Failed email/profile edit restores the previous Auth email',async()=>{
 const api=setup({existing:true,rpcError:true});assert.equal((await api.POST(request({userId:target,email:'changed@lvjusd.org'}))).status,400);
 assert.deepEqual(api.calls.filter(call=>call.name==='updateUserById').map(call=>call.args.email),['changed@lvjusd.org','person@lvjusd.org']);
});
test('Student creation requires profile details and an initial password for a new login',async()=>{
 for(const extra of [{kind:'student'},{password:'short'},{email:'person@example.org'}]){const api=setup();assert.equal((await api.POST(request(extra))).status,400);assert.ok(!api.calls.some(call=>call.name==='createUser'));}
 const api=setup();assert.equal((await api.POST(request({kind:'student',username:'student-user',classYear:2028,studentId:'1001'}))).status,200);const args=api.calls.find(call=>call.name==='superadmin_save_account').args;assert.equal(args.p_student_id,'1001');assert.equal(args.p_class_year,2028);
});
test('Removal requires confirmation, a valid target, a reason, and cannot remove self',async()=>{
 for(const extra of [{confirmed:false},{reason:'tiny'},{userId:actor},{userId:'invalid'},{kind:'officer'}]){const api=setup();assert.equal((await api.POST(request({action:'remove',userId:target,kind:'teacher',confirmed:true,reason:'Teacher no longer needs access.',...extra}))).status,400);assert.ok(!api.calls.some(call=>call.name==='superadmin_remove_account'));}
 const api=setup();assert.equal((await api.POST(request({action:'remove',userId:target,kind:'teacher',confirmed:true,reason:'Teacher no longer needs access.'}))).status,200);assert.equal(api.calls.find(call=>call.name==='superadmin_remove_account').args.p_actor,actor);assert.ok(!api.calls.some(call=>call.name==='deleteUser'));
});
test('Directory responses are never cached and contain no passwords or student ID numbers',async()=>{
 const api=setup({existing:true});const response=await api.GET();assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.doesNotMatch(JSON.stringify(await response.json()),/password|student_id_number/);
});
