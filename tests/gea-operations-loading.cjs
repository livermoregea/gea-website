const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const ts=require('typescript');
function harness({builders=false,missing='builder_submissions'}={}){
 const requested=[];
 const query=(source,rpc=false)=>{const q={select(){return this;},order(){return this;},range(){return this;},eq(){return this;},maybeSingle(){return this;},then(resolve){const error=source===missing?{code:'PGRST205',message:`Missing ${source}`} : null;const data=rpc&&['is_peet_admin','can_manage_meetings'].includes(source)?true:source==='gea_digest_preferences'?null:[];resolve({data,error});}};requested.push(source);return q;};
 const exports={};
 const deps={'./officer-workspace-navigation':{officerWorkspaceHref:staff=>staff?'/admin-portal-x7k9/officers':'/officerboard',legacyPlanningHref:()=>'/officerboard?view=overview'},'./account-landing':{accountMemberships:async()=>({isAdmin:true,isTeacher:false,isOfficer:true})},'./site-features':{BUILDERS_ENABLED:builders},'./gea-operations':{taskAttention:()=>[]},'./officer-tracking':{schoolToday:()=> '2026-10-16'}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/gea-operations-data.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:name=>deps[name]??{},Date,Intl,Set});
 return {requested,load:seed=>exports.loadOperations({from:name=>query(name),rpc:name=>query(name,true)},'me',seed)};
}
test('Planning loads when Builders is disabled and its optional table was never installed',async()=>{const h=harness();const data=await h.load();assert.equal(data.reviewer,true);assert.ok(!h.requested.includes('builder_submissions'));assert.ok(h.requested.includes('gea_meeting_notes'));assert.ok(h.requested.includes('applications'));});
test('An enabled feature still reports a missing table rather than silently dropping its work',async()=>{const h=harness({builders:true});await assert.rejects(h.load(),error=>error.code==='PGRST205'&&error.message==='Missing builder_submissions');});
test('Required planning failures preserve the original database code for diagnostics',async()=>{const h=harness({missing:'gea_meeting_notes'});await assert.rejects(h.load(),error=>error.code==='PGRST205'&&error.message==='Missing gea_meeting_notes');});


test('The integrated workspace reuses already-authorized officer records instead of reading them twice',async()=>{
 const h=harness();const seed={tasks:[],events:[],attendance:[],logs:[],people:[]};const result=await h.load(seed);
 for(const source of ['tasks','officer_events','officer_attendance','officer_volunteer_logs','officer_task_teammates'])assert.equal(h.requested.includes(source),false,source);
 assert.equal(result.tasks,seed.tasks);assert.equal(result.events,seed.events);
 assert.ok(h.requested.includes('gea_meeting_notes'));
});
