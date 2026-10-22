const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const ts=require('typescript');
function harness({builders=false,missing='builder_submissions',concerns=[]}={}){
 const requested=[];
 const query=(source,rpc=false)=>{const q={select(){return this;},order(){return this;},range(){return this;},eq(){return this;},in(){return this;},is(){return this;},maybeSingle(){return this;},then(resolve){const error=source===missing?{code:'PGRST205',message:`Missing ${source}`} : null;const data=rpc&&['is_peet_admin','can_manage_meetings'].includes(source)?true:source==='gea_digest_preferences'?null:source==='officer_strikes'?concerns:[];resolve({data,error});}};requested.push(source);return q;};
 const exports={};
 const deps={'./officer-workspace-navigation':{officerWorkspaceHref:staff=>staff?'/admin-portal-x7k9/officers':'/officerboard',legacyPlanningHref:()=>'/officerboard?view=overview'},'./account-landing':{accountMemberships:async()=>({isAdmin:true,isTeacher:false,isOfficer:true})},'./site-features':{BUILDERS_ENABLED:builders},'./gea-operations':{taskAttention:()=>[]},'./officer-tracking':{schoolToday:()=> '2026-10-16'}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/gea-operations-data.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:name=>deps[name]??{},Date,Intl,Set,URLSearchParams});
 return {requested,load:seed=>exports.loadOperations({from:name=>query(name),rpc:name=>query(name,true)},'me',seed)};
}
test('Planning loads when Builders is disabled and its optional table was never installed',async()=>{const h=harness();const data=await h.load();assert.equal(data.reviewer,true);assert.ok(!h.requested.includes('builder_submissions'));assert.ok(h.requested.includes('gea_meeting_notes'));assert.ok(h.requested.includes('applications'));});
test('An enabled feature still reports a missing table rather than silently dropping its work',async()=>{const h=harness({builders:true});await assert.rejects(h.load(),error=>error.code==='PGRST205'&&error.message==='Missing builder_submissions');});
test('Required planning failures preserve the original database code for diagnostics',async()=>{const h=harness({missing:'gea_meeting_notes'});await assert.rejects(h.load(),error=>error.code==='PGRST205'&&error.message==='Missing gea_meeting_notes');});


test('The integrated workspace reuses already-authorized officer records instead of reading them twice',async()=>{
 const h=harness();const seed={tasks:[],events:[],attendance:[],logs:[],signups:[],people:[]};const result=await h.load(seed);
 for(const source of ['tasks','officer_events','officer_attendance','officer_volunteer_logs','officer_event_signups','officer_task_teammates'])assert.equal(h.requested.includes(source),false,source);
 assert.equal(result.tasks,seed.tasks);assert.equal(result.events,seed.events);
 assert.ok(h.requested.includes('gea_meeting_notes'));
});

test('Pending service updates link to Volunteer service with the matching event instead of reloading the overview',async()=>{
 const h=harness();
 const seed={tasks:[],events:[{id:'club-rush',title:'Club Rush 2026',kind:'volunteer',starts_at:'2020-01-01T12:00:00Z',ends_at:'2020-01-01T13:00:00Z',cancelled:false}],attendance:[],signups:[],people:[],clarificationTaskIds:[],
 logs:[{id:'pending-log',event_id:'club-rush',officer_id:'student',status:'pending'},{id:'verified-log',event_id:'club-rush',officer_id:'another',status:'approved'}]};
 const result=await h.load(seed);
 const updates=result.attention.filter(item=>item.key.startsWith('service:'));
 assert.equal(updates.length,1);
 const target=new URL(updates[0].href,'https://gea.test');
 assert.equal(target.pathname,'/admin-portal-x7k9/officers');
 assert.equal(target.searchParams.get('view'),'volunteer');
 assert.equal(target.searchParams.get('event'),'club-rush');
});

test('Unanswered strike requests link to the explanation workspace with the response deadline',async()=>{
 const h=harness({concerns:[{id:'incident',officer_id:'me',response_due_at:'2000-01-01'}]});
 const data=await h.load();const item=data.attention.find(item=>item.key==='concern:incident');
 assert.equal(item.category,'Response');assert.match(item.detail,/within 24 hours/);
 assert.equal(item.date,'2000-01-01');assert.match(item.href,/topic=accountability/);
});
