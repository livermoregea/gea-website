const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(file,deps={},extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:name=>{assert.ok(name in deps,name);return deps[name];},...extra});return exports;}
const tracking=load('lib/officer-tracking.ts');
function nodes(tree,predicate){const result=[];function walk(node){if(Array.isArray(node)){node.forEach(walk);return;}if(!node?.props)return;if(predicate(node))result.push(node);walk(node.props.children);}walk(tree);return result;}
function text(node){if(Array.isArray(node))return node.map(text).join('');return typeof node==='object'&&node?text(node.props?.children):String(node??'');}
function harness({fail=false,signup,canManage=true,isSelf=false,cancelled=false}={}){
 const state=[];let at=0,refreshes=0;const calls=[];
 const deps={react:{useState(initial){const i=at++;if(!(i in state))state[i]=initial;return[state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];},useTransition:()=>[false,fn=>fn()]},'react/jsx-runtime':require('react/jsx-runtime'),'@/components/WorkspaceActivity':{default:'workspace-activity'},'next/navigation':{useRouter:()=>({refresh(){refreshes++;}})},'@/lib/discord-notifications':{dispatchDiscordNotifications(){}},'@/lib/supabase/client':{createClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return{error:fail?{message:'Participation changed in another session.'}:null};}})},'@/lib/use-unsaved-changes':{useUnsavedChanges(){}},'@/lib/peet':{peetError:error=>error.message},'@/lib/officer-tracking':tracking,'./Modal':{default:'modal'},'./officerboard.module.css':{default:new Proxy({},{get:(_,key)=>String(key)})}};
 const Component=load('components/officerboard/EventParticipation.tsx',deps,{FormData:class{constructor(form){this.form=form;}get(key){return this.form[key]??null;}},window:{confirm:()=>true}}).default;
 const props={event:{id:'event',title:'Volunteer event',kind:'volunteer',cancelled},officerId:'officer',name:'Officer A',signup,canManage,isSelf};
 return{props,calls,get refreshes(){return refreshes;},render(){at=0;return Component(props);},button(tree,label){return nodes(tree,n=>n.type==='button'&&text(n).startsWith(label))[0];}};
}
test('Requests and withdrawals use self-only signup RPC while reviewer assignment remains independent',async()=>{
 const h=harness({canManage:false,isSelf:true,signup:{committed:false,assigned:true,version:3}});
 assert.ok(text(h.render()).includes('Assigned'));
 await h.button(h.render(),'Request to participate').props.onClick();
 assert.equal(h.calls[0].name,'set_officer_event_signup');assert.equal(h.calls[0].args.p_committed,true);assert.equal(h.calls[0].args.p_officer_id,undefined);
 h.props.signup={committed:true,assigned:true,version:4};
 await h.button(h.render(),'Withdraw request').props.onClick();
 assert.equal(h.calls[1].args.p_committed,false);assert.equal(h.calls[1].args.p_assigned,undefined);
 assert.equal(h.button(h.render(),'Unassign'),undefined);
});
test('Reviewer can assign without a signup, then unassign without changing the request',async()=>{
 const h=harness();await h.button(h.render(),'Assign').props.onClick();
 assert.equal(h.calls[0].name,'save_officer_event_assignment');assert.equal(h.calls[0].args.p_assigned,true);assert.equal(h.calls[0].args.p_version,0);
 h.props.signup={committed:true,assigned:true,participation_role:'Greeter',participation_notes:'Entrance',version:2};
 await h.button(h.render(),'Unassign').props.onClick();
 assert.equal(h.calls[1].args.p_assigned,false);assert.equal(h.calls[1].args.p_role,'Greeter');assert.equal(h.calls[1].args.p_committed,undefined);
});
test('Editing details retains the original version so a refresh cannot silently overwrite concurrent changes',async()=>{
 const h=harness({signup:{committed:true,assigned:true,version:3,participation_role:'Greeter'}});
 h.button(h.render(),'Edit details').props.onClick();
 h.props.signup={...h.props.signup,version:4,participation_role:'Updated elsewhere'};
 const form=nodes(h.render(),n=>n.type==='form')[0];
 await form.props.onSubmit({preventDefault(){},currentTarget:{role:'Setup lead',notes:'Bring signs'}});
 assert.equal(h.calls[0].args.p_version,3);assert.equal(h.calls[0].args.p_role,'Setup lead');assert.equal(h.calls[0].args.p_notes,'Bring signs');assert.equal(h.calls[0].args.p_assigned,true);
});
test('Failed details saves retain the editor and explain the failure',async()=>{
 const h=harness({fail:true});h.button(h.render(),'Edit details').props.onClick();
 await nodes(h.render(),n=>n.type==='form')[0].props.onSubmit({preventDefault(){},currentTarget:{role:'Greeter'}});
 assert.ok(nodes(h.render(),n=>n.type==='form').length);assert.ok(text(h.render()).includes('Participation changed'));assert.equal(h.refreshes,0);
});
test('Cancelled events lock all participation changes and request and assignment statuses remain distinct',()=>{
 const h=harness({cancelled:true,isSelf:true});assert.ok(nodes(h.render(),n=>n.type==='button').every(n=>n.props.disabled));
 assert.equal(tracking.eventParticipationLabel({assigned:true,committed:true}),'Assigned · Requested');
 assert.equal(tracking.eventParticipationLabel({committed:true}),'Requested');
 assert.equal(tracking.eventParticipationLabel({assigned:true}),'Assigned');
});
