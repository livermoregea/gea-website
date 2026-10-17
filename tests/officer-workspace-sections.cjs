const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const React=require('react');
function harness(){
 const state=[];let cursor=0,allowDiscard=false;const prompts=[];
 const window={location:{href:'https://gea.test/officerboard'},history:{state:{},replaceState(_state,_title,url){window.location.href=String(url);}},dispatchEvent:()=>true,confirm:message=>{prompts.push(message);return allowDiscard;}};
 const Meeting=()=>null;const Other=()=>null;
 const deps={react:{useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];},useEffect(){},useTransition:()=>[false,fn=>fn()]},'react/jsx-runtime':require('react/jsx-runtime'),'next/link':{default:Other},'next/navigation':{useRouter:()=>({refresh(){}})},'@/lib/supabase/client':{createClient:()=>({})},'@/lib/use-unsaved-changes':{useUnsavedChanges(){}},'@/lib/gea-operations':{},'@/lib/officer-tracking':{schoolToday:()=> '2026-10-16',schoolDate:v=>v},'@/lib/peet':{isOfficerTaskParticipant:()=>false},'@/lib/officer-workspace-navigation':{workspaceView:v=>v},'./MeetingSchedule':{default:Other},'./WorkspaceUpdates':{default:Other},'./MeetingWorkspace':{default:Meeting},'./EventPlanning':{default:Other},'./AccomplishmentsReport':{default:Other},'./operations.module.css':{default:new Proxy({},{get:(_,key)=>String(key)})}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/operations/OperationsHub.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:name=>{assert.ok(deps[name],name);return deps[name];},window,URL,Event});
 const tools=React.createElement('div',null,'Officer records');const data={membership:{isOfficer:true},attention:[],readKeys:[],calendar:[],events:[{id:'meeting',kind:'meeting',starts_at:'2026-10-16',title:'Meeting'}],tasks:[],blockers:[]};
 const render=()=>{cursor=0;return exports.default({data,officerTools:tools,initialView:'overview',initialEvent:'meeting'});};
 function elements(node,out=[]){if(!node||typeof node!=='object')return out;if(Array.isArray(node)){node.forEach(item=>elements(item,out));return out;}out.push(node);elements(node.props?.children,out);return out;}
 const button=(tree,label)=>elements(tree).find(node=>node.type==='button'&&node.props.children?.[0]===label);
 return {render,elements,button,tools,Meeting,prompts,window,allow:()=>{allowDiscard=true;}};
}
test('Officer records stay mounted when switching workspace sections, preserving their local roster drafts',()=>{
 const h=harness();let tree=h.render();assert.equal(h.elements(tree).some(n=>n.props?.['aria-label']==='Tasks and officer progress'),false);
 h.button(tree,'My work').props.onClick();tree=h.render();let section=h.elements(tree).find(n=>n.props?.['aria-label']==='Tasks and officer progress');assert.equal(section.props.hidden,false);assert.equal(section.props.children,h.tools);
 h.button(tree,'Meetings').props.onClick();tree=h.render();section=h.elements(tree).find(n=>n.props?.['aria-label']==='Tasks and officer progress');assert.equal(section.props.hidden,true);assert.equal(section.props.children,h.tools);
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
