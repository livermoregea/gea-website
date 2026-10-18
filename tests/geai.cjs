const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
function load(file,deps={},env={}) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
 {exports,require:name=>deps[name]??require(name),process:{env},URL,Date,Set,Map,Buffer,AbortSignal});
 return exports;
}
const geai=load('lib/geai.ts');
const fixture=()=>({userId:'officer',reviewer:false,workspaceHref:'/officerboard',attention:[],calendar:[],tasks:[],notes:[{minutes:'PRIVATE MINUTES'}],evaluations:[{justification:'PRIVATE EVALUATION'}]});
test('GEAI omits private contents and distinguishes shared tasks, completed work, and submitted work',()=>{
 const data=fixture();
 data.tasks=[{id:'active',title:'Posters',description:'Create print-ready workshop posters.',submission_description:'PRIVATE DELIVERABLE',assigned_to:'another',officer_task_members:[{officer_id:'officer'}],status:'submitted'},
 {id:'done',title:'Done',status:'completed'},{id:'cancelled',title:'Cancelled',status:'in_progress',cancelled_at:'2026-10-17'}];
 const sources=geai.geaiSources(data,'2026-10-18');
 assert.equal(sources.length,1);
 assert.match(sources[0].detail,/Your task.*awaiting review/);
 assert.equal(sources[0].taskInstructions,'Create print-ready workshop posters.');
 assert.ok(!JSON.stringify(sources).includes('PRIVATE'));
});
test('GEAI prioritizes overdue tasks and help, removes duplicate task notifications, and excludes past events',()=>{
 const data=fixture();
 data.attention=[{key:'new',category:'Administration',title:'New profile',detail:'Awaiting review',href:'/admin'},
 {key:'due',category:'Tasks',title:'Posters',detail:'Overdue task',href:'/officerboard?task=active',date:'2026-10-17'}];
 data.tasks=[{id:'active',title:'Posters',status:'in_progress',assigned_to:'officer',due_date:'2026-10-17'}];
 data.calendar=[{id:'old',title:'Old event',kind:'meeting',start:'2026-10-01',href:'/old'},
 {id:'new',title:'Next event',kind:'meeting',start:'2026-10-20',href:'/next'}];
 const sources=geai.geaiSources(data,'2026-10-18');
 assert.equal(sources[0].title,'Posters');
 assert.equal(sources.filter(s=>s.title==='Posters').length,1);
 assert.ok(!sources.some(s=>s.title==='Old event'));
 assert.ok(sources.some(s=>s.title==='Next event'));
});
test('AI output cannot supply external links, unknown source IDs, duplicate actions, or unlimited text',()=>{
 const sources=[{id:'s0',title:'Posters',detail:'Due today',href:'/officerboard?task=1',nextStep:'Submit the completed poster for review.'}];
 const valid={descriptions:[{sourceId:'s0',description:'Your poster is due today. Submit the finished file for review.'}]};
 assert.equal(geai.geaiRecommendation(valid,sources,'/officerboard').priorities[0].href,sources[0].href);
 assert.throws(()=>geai.geaiRecommendation({descriptions:[{sourceId:'evil',description:'Wrong'}]},sources,'/officerboard'));
 assert.throws(()=>geai.geaiRecommendation({descriptions:[valid.descriptions[0],valid.descriptions[0]]},sources,'/officerboard'));
 assert.equal(geai.geaiSchema.safeParse({...valid,url:'https://evil.test'}).success,false);
 assert.equal(geai.geaiSchema.safeParse({descriptions:[{sourceId:'s0',description:'x'.repeat(261)}]}).success,false);
});
const next={NextResponse:{json:(body,init={})=>({body,status:init.status||200,headers:init.headers})}};
function page({signedIn=true,access=true,cache=null,setup=true,configured=false,cacheError=null}={}) {
 let reads=0,queues=0;
 const api=load('app/api/operations/geai/route.ts',{
 'next/server':next,'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:signedIn?{id:'officer'}:null}})}})},
 '@/lib/supabase/admin':{createAdminClient:()=>({rpc:async()=>{queues++;return {data:cache,error:cacheError};}})},
 '@/lib/account-landing':{accountMemberships:async()=>({hasWorkspace:access})},
 '@/lib/gea-operations-data':{loadOperations:async()=>{reads++;return fixture();}},
 '@/lib/officer-tracking':{schoolToday:()=> '2026-10-18'},'@/lib/geai':geai,
 },setup?{SUPABASE_SERVICE_ROLE_KEY:'test-only',...(configured?{GROQ_API_KEY:'test',CRON_SECRET:'test'}:{})}:{});
 return {api,get reads(){return reads;},get queues(){return queues;}};
}
const request=(origin='https://gea.test')=>({url:'https://gea.test/api/operations/geai',headers:new Headers({origin})});
test('Dashboard visits read cache and queue facts without importing or invoking AI; repeated visits remain provider-free',async()=>{
 const cached={mode:'ai',summary:'Cached summary',priorities:[],generatedAt:'2026-10-18T15:00:00Z',workspaceHref:'/officerboard'};
 const h=page({cache:cached});
 for(let i=0;i<10;i++)assert.equal((await h.api.POST(request())).body.summary,cached.summary);
 assert.equal(h.queues,10);assert.equal(h.reads,10);
 const source=fs.readFileSync('app/api/operations/geai/route.ts','utf8');
 assert.ok(!/from ['"](?:ai|@ai-sdk\/openai)['"]/.test(source));
});
test('Cross-origin, anonymous, and non-workspace visits cannot read or queue summaries',async()=>{
 for(const options of [{},{signedIn:false},{access:false}]) {
  const h=page(options);
  const response=await h.api.POST(request(Object.keys(options).length?'https://gea.test':'https://evil.test'));
  assert.equal(response.status,options.signedIn===false?401:403);assert.equal(h.queues,0);assert.equal(h.reads,0);
 }
});
test('An empty cache or missing setup returns a clearly distinguished live snapshot',async()=>{
 for(const options of [{},{setup:false}]) {
  const h=page(options);const result=await h.api.POST(request());
  assert.equal(result.body.mode,'snapshot');assert.equal(result.status,200);
 }
});
test('Only a configured scheduler secret authorizes background generation',async()=>{
 let claimed=0;
 const api=load('app/api/operations/geai/refresh/route.ts',{'next/server':next,ai:{},'@ai-sdk/openai':{},
 '@/lib/supabase/admin':{createAdminClient:()=>({rpc:async()=>{claimed++;return {data:null,error:null};}})},'@/lib/geai':geai},
 {CRON_SECRET:'secret',GROQ_API_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:'test'});
 const req=token=>({headers:new Headers(token?{authorization:`Bearer ${token}`}:{})});
 assert.equal((await api.GET(req())).status,401);
 assert.equal((await api.GET(req('wrong'))).status,401);
 assert.equal(claimed,0);
 assert.equal((await api.GET(req('secret'))).body.attempted,0);assert.equal(claimed,1);
});

test('Every snapshot item explains its next step, including meeting preparation and service verification',()=>{
 const data=fixture();
 data.events=[{id:'meeting',kind:'meeting',mandatory:true},{id:'service',kind:'volunteer'}];
 data.logs=[{id:'hours',event_id:'service',status:'pending'}];
 data.attention=[{key:'service:hours',title:'Club Rush',detail:'Service hours awaiting verification',category:'Review',href:'/officerboard?view=volunteer&event=service'},
 {key:'event:meeting:date',title:'Leadership meeting',detail:'Room 303',category:'Calendar',href:'/officerboard?view=meetings&event=meeting'}];
 const sources=geai.geaiSources(data,'2026-10-18');
 const brief=geai.geaiSnapshot(sources,'/officerboard');
 assert.match(brief.priorities[0].nextStep,/check each pending officer.*verify.*return/);
 assert.match(brief.priorities[1].nextStep,/agenda, time, and location.*attend/);
 assert.ok(brief.priorities.every(item=>item.nextStep.length>20));
});
test('Event guidance distinguishes assigned, requested, optional, reviewer, and organizer participation',()=>{
 const data=fixture();data.events=[{id:'event',kind:'volunteer'}];data.signups=[];data.plans=[];
 const next=()=>geai.geaiNextStep(data,{href:'/officerboard?view=events&event=event'});
 assert.match(next(),/request to participate.*does not mean you are assigned/);
 data.signups=[{event_id:'event',officer_id:'officer',committed:true}];
 assert.match(next(),/participation is requested.*assignment status/);
 data.signups[0].assigned=true;
 assert.match(next(),/You are assigned.*actual service hours/);
 data.signups=[];data.reviewer=true;
 assert.match(next(),/staffing and officer assignments/);
 data.plans=[{event_id:'event',organizer_id:'officer'}];
 assert.match(next(),/planning document.*staffing/);
});
test('Submitted work needs no resubmission, while clarification and independent reviews get different next steps',()=>{
 const data=fixture();data.tasks=[{id:'task',title:'Workshop deliverable',assigned_to:'officer',status:'submitted'}];
 const next=()=>geai.geaiNextStep(data,{href:'/officerboard?task=task'});
 assert.match(next(),/No action is needed.*awaiting independent review/);
 data.clarificationTaskIds=['task'];assert.match(next(),/answer the follow-up questions/);
 data.clarificationTaskIds=[];data.tasks[0].assigned_to='another';data.reviewer=true;
 assert.match(next(),/inspect the work.*PEET review/);
 const sources=geai.geaiSources(data,'2026-10-18');
 const brief=geai.geaiRecommendation({descriptions:[{sourceId:'s0',description:'A submission is ready. Inspect the work and complete its PEET review.'}]},sources,'/officerboard');
 assert.equal(brief.priorities[0].nextStep,sources[0].nextStep);
});
test('Cancelled-event service instructions do not ask the reviewer to verify disabled records',()=>{
 const data=fixture();data.events=[{id:'cancelled',cancelled:true}];data.logs=[{id:'log',event_id:'cancelled'}];
 assert.match(geai.geaiNextStep(data,{key:'service:log',href:'/officerboard?view=volunteer&event=cancelled'}),/verification is unavailable/);
});

test('Rules fix item titles, order, links, and membership; AI can only describe those exact items',()=>{
 const sources=Array.from({length:4},(_,i)=>({id:`s${i}`,title:`Task ${i}`,detail:'In progress',href:`/officerboard?task=${i}`,nextStep:'Open the task and review its requirements.'}));
 const result={descriptions:[{sourceId:'s2',description:'Third note.'},{sourceId:'s0',description:'First note.'},{sourceId:'s1',description:'Second note.'}]};
 const baseline=geai.geaiSnapshot(sources,'/officerboard');
 const brief=geai.geaiRecommendation(result,sources,'/officerboard');
 assert.equal(brief.summary,baseline.summary);
 assert.equal(brief.priorities.length,3);
 for(let i=0;i<3;i++) {
  assert.equal(brief.priorities[i].title,baseline.priorities[i].title);
  assert.equal(brief.priorities[i].text,baseline.priorities[i].text);
  assert.equal(brief.priorities[i].href,baseline.priorities[i].href);
  assert.equal(brief.priorities[i].descriptionSource,'ai');
 }
 assert.equal(brief.priorities[0].description,'First note.');
 assert.throws(()=>geai.geaiRecommendation({descriptions:result.descriptions.slice(0,2)},sources,'/officerboard'));
 assert.throws(()=>geai.geaiRecommendation({descriptions:[...result.descriptions.slice(0,2),{sourceId:'s3',description:'Hidden item.'}]},sources,'/officerboard'));
 assert.equal(geai.geaiSchema.safeParse({...result,summary:'AI must not write the overview.'}).success,false);
 assert.equal(geai.geaiSchema.safeParse({priorities:[{sourceId:'s0',text:'Old AI-selected list.'}]}).success,false);
});
test('Live descriptions use workflow text until the cached AI descriptions are ready',()=>{
 const data=fixture();data.tasks=[{id:'task',title:'Prepare workshop',assigned_to:'officer',status:'in_progress'}];
 const sources=geai.geaiSources(data,'2026-10-18');
 const brief=geai.geaiSnapshot(sources,'/officerboard');
 assert.equal(brief.mode,'snapshot');assert.equal(brief.priorities[0].descriptionSource,'rule');
 assert.equal(brief.priorities[0].description,sources[0].nextStep);
});

test('Background generation makes one batched description call for only the three rule-selected items',async()=>{
 const sources=Array.from({length:6},(_,i)=>({id:`s${i}`,title:`Task ${i}`,detail:'In progress',href:`/officerboard?task=${i}`,nextStep:'Check the requirements and submit your completed work.'}));
 sources[0].taskInstructions='Create a print-ready poster and a square social-media version.';
 const job={user_id:'officer',lease_token:'test-lease',fingerprint:'test-fingerprint',snapshot:{version:2,today:'2026-10-18',reviewer:false,sources,workspaceHref:'/officerboard'}};
 let claims=0,calls=0,saved;
 const api=load('app/api/operations/geai/refresh/route.ts',{'next/server':next,
 'ai':{wrapLanguageModel:()=>({}),generateObject:async options=>{
  calls++;const facts=JSON.parse(options.prompt);assert.equal(facts.sources.length,3);
  assert.ok(facts.sources.every(source=>!('href' in source)));
  assert.equal(facts.sources[0].taskInstructions,sources[0].taskInstructions);
  assert.equal(options.maxRetries,0);
  return {object:{descriptions:[{sourceId:'s2',description:'Third description.'},{sourceId:'s0',description:'First description.'},{sourceId:'s1',description:'Second description.'}]}};
 }},'@ai-sdk/openai':{createOpenAI:()=>({chat:()=>({})})},
 '@/lib/supabase/admin':{createAdminClient:()=>({rpc:async(name,args)=>{
  if(name==='claim_gea_geai_brief')return {data:claims++===0?job:null,error:null};
  assert.equal(name,'finish_gea_geai_brief');saved=args.p_brief;return {data:true,error:null};
 }})},'@/lib/geai':geai},{CRON_SECRET:'secret',GROQ_API_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:'test'});
 const response=await api.GET({headers:new Headers({authorization:'Bearer secret'})});
 assert.equal(response.body.updated,1);assert.equal(calls,1);
 assert.equal(saved.priorities.length,3);
 assert.equal(saved.priorities[0].title,'Task 0');assert.equal(saved.priorities[0].description,'First description.');
 assert.equal(saved.priorities[2].href,'/officerboard?task=2');
});

test('Assignment instruction excerpts are bounded and attached to both due reminders and ordinary task items',()=>{
 for(const hasReminder of [false,true]) {
  const data=fixture();
  const instructions='Create a print-ready poster and a square social-media version. '+ 'A'.repeat(900);
  data.tasks=[{id:'poster',title:'Workshop posters',description:instructions,submission_description:'PRIVATE SUBMISSION',assigned_to:'officer',status:'in_progress'}];
  if(hasReminder)data.attention=[{key:'task-due:poster:2026-10-19',title:'Workshop posters',detail:'Due tomorrow',category:'Tasks',href:'/officerboard?task=poster'}];
  const source=geai.geaiSources(data,'2026-10-18')[0];
  assert.equal(source.taskInstructions,instructions.slice(0,geai.GEAI_TASK_INSTRUCTION_LIMIT));
  assert.equal(source.taskInstructions.length,600);
  assert.ok(!JSON.stringify(source).includes('PRIVATE SUBMISSION'));
 }
});
test('Editing written instructions changes queued facts without changing rule-selected titles or destinations',()=>{
 const data=fixture();data.tasks=[{id:'poster',title:'Workshop posters',description:'Create one print-ready poster.',assigned_to:'officer',status:'in_progress'}];
 const before=geai.geaiSources(data,'2026-10-18');
 data.tasks[0].description='Create a print-ready poster and a square social-media version.';
 const after=geai.geaiSources(data,'2026-10-18');
 assert.notEqual(JSON.stringify(before),JSON.stringify(after));
 assert.equal(before[0].title,after[0].title);assert.equal(before[0].href,after[0].href);
 data.tasks[0].description='   ';
 assert.ok(!('taskInstructions' in geai.geaiSources(data,'2026-10-18')[0]));
});

test('GEAI reads bounded direct meeting/event descriptions while excluding Google Docs and recorded minutes',()=>{
 const data=fixture();
 data.events=[{id:'meeting',kind:'meeting',notes:'Bring poster drafts and finalize outreach roles. '+ 'A'.repeat(900)},{id:'event',kind:'volunteer',notes:'Set up STEM demonstrations and welcome visiting families.'}];
 data.attention=[{key:'event:meeting:date',title:'Leadership meeting',detail:'Room 303',category:'Calendar',href:'/officerboard?view=meetings&event=meeting'}];
 data.calendar=[{id:'event',kind:'volunteer',title:'STEM night',start:'2026-11-01',href:'/officerboard?view=events&event=event'}];
 data.notes=[{event_id:'meeting',minutes:'PRIVATE MINUTES',agenda_doc_url:'https://docs.google.com/document/d/PRIVATE-DOC'}];
 const sources=geai.geaiSources(data,'2026-10-18');
 assert.equal(sources[0].eventDescription,data.events[0].notes.slice(0,geai.GEAI_EVENT_DESCRIPTION_LIMIT));
 assert.equal(sources[0].eventDescription.length,600);
 assert.equal(sources[1].eventDescription,data.events[1].notes);
 assert.ok(!JSON.stringify(sources).includes('PRIVATE'));
 const previous=JSON.stringify(sources);
 data.events[0].notes='Bring a laptop for the website review.';
 assert.notEqual(JSON.stringify(geai.geaiSources(data,'2026-10-18')),previous);
});

test('Pending snapshots immediately display the saved event text, replacing generic next-step advice',()=>{
 const data=fixture();data.events=[{id:'event',kind:'volunteer',notes:'Check your email for the Evite. Attend as conference-goers; no activity or promotional material is needed.'}];
 data.calendar=[{id:'event',kind:'volunteer',title:'Advisory Dinner',start:'2026-11-03',href:'/officerboard?view=events&event=event'}];
 const before=geai.geaiSnapshot(geai.geaiSources(data,'2026-10-18'),'/officerboard');
 assert.equal(before.priorities[0].descriptionSource,'saved');
 assert.equal(before.priorities[0].description,data.events[0].notes);
 data.events[0].notes='Bring the printed Evite to check in at the entrance.';
 const after=geai.geaiSnapshot(geai.geaiSources(data,'2026-10-18'),'/officerboard');
 assert.equal(after.priorities[0].description,data.events[0].notes);
 assert.notEqual(after.priorities[0].description,before.priorities[0].description);
});
test('Task instruction excerpts display immediately without being mislabeled as generated AI text',()=>{
 const data=fixture();data.tasks=[{id:'poster',title:'Poster',assigned_to:'officer',status:'in_progress',description:'Prepare a print-ready poster and a square social-media version.'}];
 const brief=geai.geaiSnapshot(geai.geaiSources(data,'2026-10-18'),'/officerboard');
 assert.equal(brief.mode,'snapshot');assert.equal(brief.priorities[0].descriptionSource,'saved');
 assert.equal(brief.priorities[0].description,data.tasks[0].description);
});
test('The cache API distinguishes missing configuration, missing migration, and a pending scheduled job',async()=>{
 assert.equal((await page().api.POST(request())).body.aiStatus,'not_configured');
 assert.equal((await page({configured:true}).api.POST(request())).body.aiStatus,'pending');
 assert.equal((await page({configured:true,cacheError:{code:'PGRST202'}}).api.POST(request())).body.aiStatus,'setup_required');
 assert.equal((await page({configured:true,cacheError:{code:'NETWORK'}}).api.POST(request())).body.aiStatus,'unavailable');
});
