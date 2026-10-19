const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const jsx=require('react/jsx-runtime');
function load(file,deps,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{assert.ok(name in deps,name);return deps[name];},URLSearchParams,Date,...globals});return exports;}
function nodes(tree,predicate){const result=[];function walk(n){if(Array.isArray(n)){n.forEach(walk);return;}if(!n?.props)return;if(predicate(n))result.push(n);walk(n.props.children);}walk(tree);return result;}
function harness(section='tasks',reviewer=true,storage=new Map()){
 const sessionStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
 const values=[],effects=[];let at=0;const window={sessionStorage,location:{href:'https://gea.test/officerboard',get search(){return new URL(this.href).search;}},history:{state:{},replaceState(_state,_title,url){window.location.href=String(url);}},addEventListener(){},removeEventListener(){}};const workspace={view:section,eventId:'chosen-event',navigate(view){workspace.view=view;}};
 const peet=load('lib/peet.ts',{}),tracking=load('lib/officer-tracking.ts',{});
 const deps={react:{useState(initial){const i=at++;if(!(i in values))values[i]=initial;return[values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next;}];},useRef:()=>({current:null}),useEffect(fn){effects.push(fn);},useContext:()=>workspace,useTransition:()=>[false,fn=>fn()]},'react/jsx-runtime':jsx,'next/link':{default:'link'},'next/navigation':{useRouter:()=>({refresh(){}})},'@/components/WorkspaceActivity':{default:'activity'},'@/components/ActionError':{default:'error'},'@/components/GEAOneBadge':{default:'badge'},'@/lib/supabase/client':{createClient:()=>({})},'@/lib/peet':peet,'@/lib/officer-task-draft':load('lib/officer-task-draft.ts',{}),'@/lib/officer-dashboard':load('lib/officer-dashboard.ts',{'./peet':peet,'./officer-tracking':tracking}),'@/lib/officer-tracking':tracking,'@/lib/officer-workspace-navigation':{officerRecordTarget:()=>null},'@/lib/workspace-navigation-context':{WorkspaceNavigationContext:{}},'@/components/admin/AdminTabs':{default:'admin-tabs'},'./officerboard.module.css':{default:new Proxy({},{get:(_,key)=>String(key)})}};
 for(const name of ['OfficerTaskPeet','Modal','PeetExplainer','TrackingPanel','OfficerRoster','OfficerTaskSubmission','OfficerTaskHistory','TaskSection','TaskPeoplePicker','OfficerTopicNavigation','AccountsPanel'])deps['./'+name]={default:name};
 const Component=load('components/officerboard/OfficerBoard.tsx',deps,{window,URL,FormData:class {constructor(fields){this.fields=fields;}get(key){return this.fields[key]??null;}}}).default;
 const profiles=[{id:'a',name:'A',role:reviewer?'admin':'officer',reviewer_kind:reviewer?'president':null},{id:'b',name:'B',role:'officer'}];
 const props={unified:true,embedded:true,profile:profiles[0],profiles,tasks:profiles.map(p=>({id:'task-'+p.id,title:'Task '+p.name,assigned_to:p.id,created_by:p.id,status:'in_progress',cancelled_at:null,due_date:null})),evaluations:[],tracking:{events:[],attendance:[],signups:[],volunteerLogs:[],strikes:[],reviews:[],generalNotes:[]}};
 return{workspace,props,window,storage,restoreDraft(){effects.find(fn=>fn.toString().includes("readTaskDraft"))();},persistDraft(){effects.find(fn=>fn.toString().includes("writeTaskDraft"))();},openLinkedTask(){effects.find(fn=>fn.toString().includes("openWorkspaceTarget"))();},render(){at=0;effects.length=0;return Component(props);}};
}
test('Tasks opens a team task list directly with one officer filter and no nested workspace navigation',()=>{
 const h=harness(),tree=h.render();assert.equal(nodes(tree,n=>n.props['aria-label']==='Workspace navigation').length,0);assert.equal(nodes(tree,n=>n.type==='aside').length,0);assert.equal(nodes(tree,n=>n.type==='OfficerRoster').length,0);assert.equal(nodes(tree,n=>n.type==='OfficerTopicNavigation').length,0);
 assert.equal(nodes(tree,n=>n.type==='select'&&n.props['aria-label']==='Filter tasks by officer').length,1);assert.equal(nodes(tree,n=>n.type==='span'&&['Task A','Task B'].includes(n.props.children)).length,2);
 nodes(tree,n=>n.type==='select'&&n.props['aria-label']==='Filter tasks by officer')[0].props.onChange({target:{value:'b'}});const filtered=h.render();assert.equal(nodes(filtered,n=>n.type==='span'&&n.props.children==='Task A').length,0);assert.equal(nodes(filtered,n=>n.type==='span'&&n.props.children==='Task B').length,1);
});
test('Attendance and Volunteer open the correct roster directly and officer details return to the shared record section',()=>{
 for(const section of ['attendance','volunteer']){const h=harness(section);let tree=h.render();const roster=nodes(tree,n=>n.type==='OfficerRoster')[0];assert.equal(roster.props.rosterMode,section);assert.equal(roster.props.initialEventId,'chosen-event');assert.equal(nodes(tree,n=>n.props['aria-label']==='Workspace navigation').length,0);roster.props.onOpenOfficer('b');tree=h.render();assert.equal(h.workspace.view,'people');assert.equal(nodes(tree,n=>n.type==='OfficerRoster').length,0);assert.equal(nodes(tree,n=>n.props['aria-label']==='Officer record details')[0].props.value,'overview');}
});
test('Ordinary officers open their own attendance and service without reviewer roster controls',()=>{
 for(const section of ['attendance','volunteer']){const h=harness(section,false),tree=h.render();assert.equal(nodes(tree,n=>n.type==='OfficerRoster').length,0);const panel=nodes(tree,n=>n.type==='TrackingPanel')[0];assert.equal(panel.props.officerId,'a');assert.equal(panel.props.mode,section);}
});
test('Submit work and Evaluate embed PEET clarification inside the same task modal',()=>{
 const submit=harness('tasks',false);let tree=submit.render();
 nodes(tree,n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children[0]==='Submit work')[0].props.onClick();
 tree=submit.render();let flow=nodes(tree,n=>n.type==='OfficerTaskPeet')[0];
 assert.equal(flow.props.mode,'submit');assert.equal(flow.props.officerTask.id,'task-a');
 assert.equal(nodes(tree,n=>typeof n.props.href==='string'&&n.props.href.startsWith('/peet')).length,0);
 flow.props.onBusyChange(true);tree=submit.render();assert.equal(nodes(tree,n=>n.type==='Modal')[0].props.busy,true);
 flow.props.onBusyChange(false);flow.props.onComplete('Work and answers submitted.');tree=submit.render();
 assert.equal(nodes(tree,n=>n.type==='Modal').length,0);
 assert.equal(nodes(tree,n=>n.props.role==='status'&&n.props.children==='Work and answers submitted.').length,1);
 const review=harness();review.props.tasks[1].status='submitted';tree=review.render();
 nodes(tree,n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children[0]==='Evaluate')[0].props.onClick();
 tree=review.render();flow=nodes(tree,n=>n.type==='OfficerTaskPeet')[0];
 assert.equal(flow.props.mode,'review');assert.equal(flow.props.officerTask.id,'task-b');
 assert.equal(nodes(tree,n=>typeof n.props.href==='string'&&n.props.href.startsWith('/peet')).length,0);
});
test('Submitted work can reopen clarification directly from its task row',()=>{
 const h=harness('tasks',false);h.props.tasks[0].status='submitted';let tree=h.render();
 const button=nodes(tree,n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children[0]==='View submission')[0];
 assert.ok(button);button.props.onClick();tree=h.render();assert.equal(nodes(tree,n=>n.type==='OfficerTaskPeet')[0].props.mode,'submit');
});
test('Task submission is visible beside the row without expanding its details',()=>{
 const h=harness('tasks',false),tree=h.render();
 const row=nodes(tree,n=>n.props.className==='taskWorkRow')[0];
 assert.ok(row.props.children.some(n=>n?.type==='button'&&n.props.children[0]==='Submit work'));
 const details=row.props.children.find(n=>n?.type==='details');
 assert.equal(nodes(details,n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children[0]==='Submit work').length,0);
});
test('Overview task actions open the existing modal and consume the action once',()=>{
 const h=harness('tasks',false);h.window.location.href='https://gea.test/officerboard?view=tasks&task=task-a&action=submit';
 h.render();h.openLinkedTask();const tree=h.render();
 assert.equal(nodes(tree,n=>n.type==='OfficerTaskPeet')[0].props.mode,'submit');assert.ok(!h.window.location.href.includes('action='));
 const denied=harness('tasks',false);denied.window.location.href='https://gea.test/officerboard?task=task-b&action=submit';denied.render();denied.openLinkedTask();assert.equal(nodes(denied.render(),n=>n.type==='Modal').length,0);
});

test('Linked service verification selects the event school year before showing the roster',()=>{
 const h=harness('volunteer');
 h.window.location.href='https://gea.test/officerboard?view=volunteer&event=prior-event';
 h.workspace.eventId='prior-event';
 h.props.tracking.events=[{id:'prior-event',title:'Previous service event',academic_year:'2024-2025',kind:'volunteer',starts_at:'2024-10-01T12:00:00Z',ends_at:'2024-10-01T13:00:00Z'}];
 h.render();h.openLinkedTask();
 const roster=nodes(h.render(),n=>n.type==='OfficerRoster')[0];
 assert.equal(roster.props.rosterMode,'volunteer');assert.equal(roster.props.initialEventId,'prior-event');assert.equal(roster.props.year,'2024-2025');
});


test('Personal records have no duplicate topic selector or task actions and stay scoped to the officer',()=>{
 for(const section of ['attendance','volunteer','people','accountability']){
  const h=harness(section,false),tree=h.render();
  assert.equal(nodes(tree,n=>n.type==='select'&&n.props['aria-label']==='Officer record details').length,0);
  assert.equal(nodes(tree,n=>n.type==='OfficerTopicNavigation').length,0);
  assert.equal(nodes(tree,n=>n.type==='button'&&['Add task','What is PEET?','Assign task'].includes(n.props.children)).length,0);
  assert.equal(nodes(tree,n=>n.props.className==='studentIdentity').length,0);
  assert.equal(nodes(tree,n=>n.type==='select'&&n.props['aria-label']==='Academic year').length,1);
  if(section!=='people'){
   const panel=nodes(tree,n=>n.type==='TrackingPanel')[0];
   assert.equal(panel.props.officerId,'a');assert.equal(panel.props.mode,section);
  }
 }
 const tasks=harness('tasks',false).render();
 assert.equal(nodes(tasks,n=>n.type==='button'&&n.props.children==='Add task').length,1);
});

test('A direct reviewer concern link opens their own record rather than a blank team summary',()=>{
 const h=harness('accountability',true),tree=h.render();
 const panel=nodes(tree,n=>n.type==='TrackingPanel')[0];
 assert.equal(panel.props.mode,'accountability');assert.equal(panel.props.officerId,'a');
});

test('Conduct logger opens an officer picker and stays in that section after selecting an officer',()=>{
 const h=harness('conduct',true);let tree=h.render();
 assert.equal(nodes(tree,n=>n.type==='TrackingPanel').length,0);
 const officer=nodes(tree,n=>n.type==='button'&&n.props.className==='personCard'&&n.key==='b')[0];
 assert.ok(officer);officer.props.onClick();tree=h.render();
 assert.equal(h.workspace.view,'conduct');
 const panel=nodes(tree,n=>n.type==='TrackingPanel')[0];
 assert.equal(panel.props.mode,'accountability');assert.equal(panel.props.officerId,'b');
 assert.equal(nodes(tree,n=>n.props['aria-label']==='Officer record details').length,0);
 assert.equal(nodes(tree,n=>n.type==='button'&&n.props.children==='Assign task').length,0);
});


test('A partly written task survives remounting and explicit cancellation clears it',()=>{
 const storage=new Map();const h=harness('tasks',true,storage);let tree=h.render();
 nodes(tree,n=>n.type==='button'&&n.props.children==='Assign task')[0].props.onClick();tree=h.render();
 nodes(tree,n=>n.type==='input'&&n.props.name==='officer-choice')[1].props.onChange({target:{checked:true}});tree=h.render();
 const form=nodes(tree,n=>n.type==='form'&&n.props.onChange)[0];
 form.props.onChange({currentTarget:{title:'Prepare outreach',description:'Bring the demo materials',due_date:'2026-11-01'}});
 tree=h.render();h.persistDraft();
 assert.equal(tree.props['data-workspace-dirty'],'true');
 const remount=harness('tasks',true,storage);remount.render();remount.restoreDraft();tree=remount.render();
 assert.equal(nodes(tree,n=>n.type==='Modal').length,1);
 assert.equal(nodes(tree,n=>n.type==='input'&&n.props.name==='officer-choice')[1].props.checked,true);
 assert.equal(nodes(tree,n=>n.type==='input'&&n.props.name==='title')[0].props.defaultValue,'Prepare outreach');
 assert.equal(nodes(tree,n=>n.type==='textarea'&&n.props.name==='description')[0].props.defaultValue,'Bring the demo materials');
 assert.equal(nodes(tree,n=>n.type==='input'&&n.props.name==='due_date')[0].props.defaultValue,'2026-11-01');
 nodes(tree,n=>n.type==='Modal')[0].props.onClose();tree=remount.render();
 assert.equal(storage.size,0);assert.equal(nodes(tree,n=>n.type==='Modal').length,0);
});

test('A stored creation draft does not interrupt a linked task submission',()=>{
 const h=harness('tasks',false);
 h.window.sessionStorage.setItem('gea:task-draft:v1:a',JSON.stringify({version:1,title:'Draft',description:'Work',dueDate:'',assignees:[],people:['a'],shared:false}));
 h.window.location.href='https://gea.test/officerboard?view=tasks&task=task-a&action=submit';
 h.render();h.restoreDraft();h.openLinkedTask();const tree=h.render();
 assert.equal(nodes(tree,n=>n.type==='OfficerTaskPeet')[0].props.officerTask.id,'task-a');
 assert.equal(h.storage.size,1);
});


test('Draft storage isolates accounts, preserves shared participants, and tolerates invalid or blocked storage',()=>{
 const api=load('lib/officer-task-draft.ts',{}),values=new Map();
 const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const draft={...api.emptyTaskDraft(),title:'Shared outreach',description:'Prepare table',people:['a','b'],assignees:[],shared:true};
 api.writeTaskDraft(storage,'a',draft);
 assert.deepEqual(JSON.parse(JSON.stringify(api.readTaskDraft(storage,'a'))),JSON.parse(JSON.stringify(draft)));
 assert.equal(api.readTaskDraft(storage,'b'),null);
 storage.setItem(api.taskDraftKey('a'),'broken json');assert.equal(api.readTaskDraft(storage,'a'),null);
 storage.setItem(api.taskDraftKey('a'),JSON.stringify({...draft,people:[{}]}));assert.equal(api.readTaskDraft(storage,'a'),null);
 const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};
 assert.equal(api.readTaskDraft(blocked,'a'),null);assert.doesNotThrow(()=>api.writeTaskDraft(blocked,'a',draft));assert.doesNotThrow(()=>api.clearTaskDraft(blocked,'a'));
});
