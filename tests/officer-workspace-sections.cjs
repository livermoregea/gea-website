const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const React=require('react');
function harness(){
 const state=[];let cursor=0,transitionCursor=0,allowDiscard=false,refreshes=0;const prompts=[],effects=[],pending=[false,false];const listeners={};
 const document={hidden:false,blocked:false,querySelector(selector){return this.blocked || (this.rosterDirty && selector.includes("data-workspace-dirty")) ? {} : null;}};
 const window={addEventListener:(name,fn)=>{listeners[name]=fn;},removeEventListener:(name)=>{delete listeners[name];},location:{href:'https://gea.test/officerboard'},history:{state:{},replaceState(_state,_title,url){window.location.href=String(url);}},dispatchEvent:()=>true,confirm:message=>{prompts.push(message);return allowDiscard;}};
 const Meeting=()=>null;const Other=()=>null;
 const deps={react:{useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];},useEffect(fn){effects.push(fn);},useTransition(){const i=transitionCursor++;return[pending[i],fn=>{pending[i]=true;fn();}];}},'react/jsx-runtime':require('react/jsx-runtime'),'next/link':{default:Other},'@/components/WorkspaceActivity':{default:'workspace-activity'},'next/navigation':{useRouter:()=>({refresh(){refreshes++;}})},'@/lib/supabase/client':{createClient:()=>({})},'@/lib/use-unsaved-changes':{useUnsavedChanges(){}},'@/lib/gea-operations':{},'@/lib/officer-tracking':{schoolToday:()=> '2026-10-16',schoolDate:v=>v},'@/lib/peet':{isOfficerTaskParticipant:()=>false},'@/lib/workspace-navigation-context':{WorkspaceNavigationContext:{Provider:'workspace-provider'}},'@/lib/officer-workspace-navigation':{workspaceView:v=>v},'./MeetingSchedule':{default:Other},'./WorkspaceUpdates':{default:Other},'./MeetingWorkspace':{default:Meeting},'./EventPlanning':{default:Other},'./AccomplishmentsReport':{default:Other},'./operations.module.css':{default:new Proxy({},{get:(_,key)=>String(key)})}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/operations/OperationsHub.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:name=>{assert.ok(deps[name],name);return deps[name];},window,document,URL,Event});
 const tools=React.createElement('div',null,'Officer records');const data={membership:{isOfficer:true},attention:[],readKeys:[],calendar:[],events:[{id:'meeting',kind:'meeting',starts_at:'2026-10-16',title:'Meeting'}],tasks:[],blockers:[]};
 const render=()=>{cursor=0;transitionCursor=0;effects.length=0;return exports.default({data,officerTools:tools,initialView:'overview',initialEvent:'meeting'});};
 function elements(node,out=[]){if(!node||typeof node!=='object')return out;if(Array.isArray(node)){node.forEach(item=>elements(item,out));return out;}out.push(node);elements(node.props?.children,out);return out;}
 const button=(tree,label)=>elements(tree).find(node=>node.type==='button'&&(typeof node.props.children==='string'?node.props.children:node.props.children?.[0])===label);
 return {render,elements,button,tools,Meeting,prompts,window,document,pending,get refreshes(){return refreshes;},installFocus(){effects.find(fn=>fn.toString().includes("addEventListener"))();},focus(){listeners.focus();},allow:()=>{allowDiscard=true;}};
}
test('Officer records stay mounted when switching workspace sections, preserving their local roster drafts',()=>{
 const h=harness();let tree=h.render();assert.equal(h.elements(tree).some(n=>n.props?.['aria-label']==='Tasks and officer progress'),false);
 h.button(tree,'My tasks').props.onClick();tree=h.render();let section=h.elements(tree).find(n=>n.props?.['aria-label']==='Tasks and officer progress');assert.equal(section.props.hidden,false);assert.equal(section.props.children.props.children,h.tools);
 h.button(tree,'Meetings').props.onClick();tree=h.render();section=h.elements(tree).find(n=>n.props?.['aria-label']==='Tasks and officer progress');assert.equal(section.props.hidden,true);assert.equal(section.props.children.props.children,h.tools);
});
test('Unsaved meeting notes can cancel a section change, and explicit discard permits it',()=>{
 const h=harness();let tree=h.render();h.button(tree,'Meetings').props.onClick();tree=h.render();h.elements(tree).find(n=>n.type===h.Meeting).props.markDirty('documents');tree=h.render();h.button(tree,'Calendar').props.onClick();tree=h.render();assert.equal(h.button(tree,'Meetings').props['aria-pressed'],true);assert.equal(h.prompts.length,1);
 h.allow();h.button(tree,'Calendar').props.onClick();tree=h.render();assert.equal(h.button(tree,'Calendar').props['aria-pressed'],true);
});


test('Workspace links open the matching section in place while external and modified clicks keep normal navigation',()=>{
 const h=harness();let tree=h.render();let prevented=false;
 const anchor={href:'https://gea.test/operations?view=meetings&event=meeting',target:'',hasAttribute:()=>false};
 tree.props.onClick({defaultPrevented:false,button:0,target:{closest:()=>anchor},preventDefault(){prevented=true;}});
 tree=h.render();assert.equal(prevented,true);assert.equal(h.button(tree,'Meetings').props['aria-pressed'],true);assert.match(h.window.location.href,/officerboard\?view=meetings&event=meeting/);
 for(const options of [{ctrlKey:true},{defaultPrevented:true}]){prevented=false;tree.props.onClick({...options,button:0,target:{closest:()=>anchor},preventDefault(){prevented=true;}});assert.equal(prevented,false);}
 prevented=false;anchor.href='https://docs.google.com/document/d/doc123/edit';tree.props.onClick({button:0,target:{closest:()=>anchor},preventDefault(){prevented=true;}});assert.equal(prevented,false);
});

test('Returning to a tab refreshes in the background while workspace controls remain available',()=>{
 const h=harness();h.render();h.installFocus();h.focus();assert.equal(h.refreshes,1);assert.equal(h.pending[0],false);assert.equal(h.pending[1],true);
 const tree=h.render();assert.equal(h.button(tree,'Meetings').props.disabled,false);
 const status=h.elements(tree).find(n=>n.type==='workspace-activity');assert.equal(status.props.refreshing,true);assert.equal(status.props.background,true);assert.equal(status.props.saving,false);
 h.installFocus();h.focus();assert.equal(h.refreshes,1,'A pending refresh cannot start another request');
});
test('Focus refresh skips hidden tabs, open dialogs, and unsaved officer or meeting details',()=>{
 for(const reason of ['hidden','blocked']){const h=harness();h.document[reason]=true;h.render();h.installFocus();h.focus();assert.equal(h.refreshes,0);}
 const h=harness();let tree=h.render();h.button(tree,'Meetings').props.onClick();tree=h.render();h.elements(tree).find(n=>n.type===h.Meeting).props.markDirty('documents');h.render();h.installFocus();h.focus();assert.equal(h.refreshes,0);
});
test('Post-save refresh still locks its controls and shows a visible updating state',()=>{
 const h=harness();h.pending[0]=true;const tree=h.render();assert.equal(h.button(tree,'Meetings').props.disabled,true);const status=h.elements(tree).find(n=>n.type==='workspace-activity');assert.equal(status.props.refreshing,true);assert.equal(status.props.background,false);
});

test('The compact navigation keeps roster destinations in More through the shared context',()=>{
 const h=harness();let tree=h.render();const more=h.elements(tree).find(n=>n.props?.['aria-label']==='More workspace sections');assert.ok(more);
 h.button(tree,'Volunteer').props.onClick();tree=h.render();const section=h.elements(tree).find(n=>n.props?.['aria-label']==='Tasks and officer progress');assert.equal(section.props.hidden,false);assert.equal(section.props.children.props.value.view,'volunteer');assert.equal(h.button(tree,'Volunteer').props['aria-pressed'],true);assert.match(h.window.location.href,/view=volunteer/);
 h.button(tree,'Attendance').props.onClick();tree=h.render();assert.equal(h.elements(tree).find(n=>n.props?.['aria-label']==='Tasks and officer progress').props.children.props.value.view,'attendance');
});
test('Unsaved nested roster edits block section changes until they are saved or discarded',()=>{
 const h=harness();let tree=h.render();h.button(tree,'Volunteer').props.onClick();h.document.rosterDirty=true;tree=h.render();h.button(tree,'Meetings').props.onClick();tree=h.render();assert.equal(h.button(tree,'Volunteer').props['aria-pressed'],true);assert.match(h.elements(tree).find(n=>n.props?.role==='alert').props.children,/Save or discard your roster changes/);
 h.document.rosterDirty=false;h.button(tree,'Meetings').props.onClick();tree=h.render();assert.equal(h.button(tree,'Meetings').props['aria-pressed'],true);
});
