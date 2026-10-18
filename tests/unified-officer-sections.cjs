const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const jsx=require('react/jsx-runtime');
function load(file,deps,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{assert.ok(name in deps,name);return deps[name];},URLSearchParams,Date,...globals});return exports;}
function nodes(tree,predicate){const result=[];function walk(n){if(Array.isArray(n)){n.forEach(walk);return;}if(!n?.props)return;if(predicate(n))result.push(n);walk(n.props.children);}walk(tree);return result;}
function harness(section='tasks',reviewer=true){
 const values=[],effects=[];let at=0;const window={location:{href:'https://gea.test/officerboard',get search(){return new URL(this.href).search;}},history:{state:{},replaceState(_state,_title,url){window.location.href=String(url);}},addEventListener(){},removeEventListener(){}};const workspace={view:section,eventId:'chosen-event',navigate(view){workspace.view=view;}};
 const peet=load('lib/peet.ts',{}),tracking=load('lib/officer-tracking.ts',{});
 const deps={react:{useState(initial){const i=at++;if(!(i in values))values[i]=initial;return[values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next;}];},useRef:()=>({current:null}),useEffect(fn){effects.push(fn);},useContext:()=>workspace,useTransition:()=>[false,fn=>fn()]},'react/jsx-runtime':jsx,'next/link':{default:'link'},'next/navigation':{useRouter:()=>({refresh(){}})},'@/components/WorkspaceActivity':{default:'activity'},'@/components/ActionError':{default:'error'},'@/components/GEAOneBadge':{default:'badge'},'@/lib/supabase/client':{createClient:()=>({})},'@/lib/peet':peet,'@/lib/officer-dashboard':load('lib/officer-dashboard.ts',{'./peet':peet,'./officer-tracking':tracking}),'@/lib/officer-tracking':tracking,'@/lib/officer-workspace-navigation':{officerRecordTarget:()=>null},'@/lib/workspace-navigation-context':{WorkspaceNavigationContext:{}},'@/components/admin/AdminTabs':{default:'admin-tabs'},'./officerboard.module.css':{default:new Proxy({},{get:(_,key)=>String(key)})}};
 for(const name of ['OfficerTaskPeet','Modal','PeetExplainer','TrackingPanel','OfficerRoster','OfficerTaskSubmission','OfficerTaskHistory','TaskSection','TaskPeoplePicker','OfficerTopicNavigation','AccountsPanel'])deps['./'+name]={default:name};
 const Component=load('components/officerboard/OfficerBoard.tsx',deps,{window,URL}).default;
 const profiles=[{id:'a',name:'A',role:reviewer?'admin':'officer',reviewer_kind:reviewer?'president':null},{id:'b',name:'B',role:'officer'}];
 const props={unified:true,embedded:true,profile:profiles[0],profiles,tasks:profiles.map(p=>({id:'task-'+p.id,title:'Task '+p.name,assigned_to:p.id,created_by:p.id,status:'in_progress',cancelled_at:null,due_date:null})),evaluations:[],tracking:{events:[],attendance:[],signups:[],volunteerLogs:[],strikes:[],reviews:[],generalNotes:[]}};
 return{workspace,props,window,openLinkedTask(){effects.find(fn=>fn.toString().includes("openWorkspaceTarget"))();},render(){at=0;effects.length=0;return Component(props);}};
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
