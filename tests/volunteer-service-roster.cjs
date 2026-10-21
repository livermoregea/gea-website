const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function nodes(tree,predicate){const result=[];function walk(n){if(Array.isArray(n)){n.forEach(walk);return;}if(!n?.props)return;if(predicate(n))result.push(n);walk(n.props.children);}walk(tree);return result;}
function label(node){const value=node?.props?.children;return Array.isArray(value)?value.filter(v=>typeof v==='string'||typeof v==='number').join(''):value;}
function harness({cancelled=false,fail=false,locked=false}={}){
 const state=[];let at=0;const calls=[];let refreshes=0;
 const logs=[{id:'pending',event_id:'event',officer_id:'a',check_in:'2026-01-01T18:00:00Z',check_out:'2026-01-01T19:00:00Z',minutes:60,notes:'Existing notes',status:'pending',review_notes:'Keep this feedback',reviewed_at:null},{id:'approved',event_id:'event',officer_id:'b',check_in:'2026-01-01T18:00:00Z',check_out:'2026-01-01T19:00:00Z',minutes:60,notes:'Verified notes',status:'approved',review_notes:'',reviewed_at:null},{id:'returned',event_id:'event',officer_id:'c',check_in:'2026-01-01T18:00:00Z',check_out:'2026-01-01T19:00:00Z',minutes:60,notes:'Returned notes',status:'rejected',review_notes:'Correct the times',reviewed_at:null}];
 const deps={react:{useState(v){const i=at++;if(!(i in state))state[i]=v;return[state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];},useEffect(){},useTransition:()=>[false,fn=>fn()]},'react/jsx-runtime':require('react/jsx-runtime'),'@/components/WorkspaceActivity':{default:'workspace-activity'},'next/navigation':{useRouter:()=>({refresh(){refreshes++;}})},'@/lib/discord-notifications':{dispatchDiscordNotifications(){}},'@/lib/supabase/client':{createClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return{error:fail?{message:'Offline'}:null};}})},'@/lib/use-unsaved-changes':{useUnsavedChanges(){}},'@/lib/peet':{peetError:e=>e.message},'@/lib/officer-tracking':{durationLabel:m=>`${m}m`,localDateInput:value=>new Date(value).toISOString().slice(0,16)},'./Modal':{default:'modal'},'./EventParticipation':{default:'participation'},'./officerboard.module.css':{default:new Proxy({},{get:(_,k)=>k})}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/officerboard/VolunteerServiceRoster.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:n=>{assert.ok(deps[n],n);return deps[n];},Date,Intl,Error});
 const props={event:{id:'event',starts_at:'2026-01-01T18:00:00Z',ends_at:'2026-01-01T19:00:00Z',cancelled},people:['a','b','c','d'].map(id=>({id,name:id.toUpperCase()})),logs,signups:[],locked,onDirtyChange(){},onReview(){}};
 return {props,state,calls,get refreshes(){return refreshes;},render(){at=0;return exports.default(props);},button(tree,text){return nodes(tree,n=>n.type==='button'&&String(label(n)).startsWith(text))[0];}};
}
test('Bulk verify includes displayed pending logs only and preserves their snapshot',async()=>{
 const h=harness();let tree=h.render();const verify=h.button(tree,'Verify all selected');assert.equal(verify.props.disabled,false);await verify.props.onClick();assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'verify_officer_event_service');assert.equal(h.calls[0].args.p_logs.length,1);assert.equal(h.calls[0].args.p_logs[0].notes,'Existing notes');assert.equal(h.calls[0].args.p_logs[0].review_notes,'Keep this feedback');
 const filtered=harness();filtered.props.people=filtered.props.people.filter(p=>p.id==='b');assert.equal(filtered.button(filtered.render(),'Verify all selected').props.disabled,true);
});
test('Exceptions can be excluded and service edits must be saved before bulk verification',()=>{
 const h=harness();let tree=h.render();nodes(tree,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:false}});assert.equal(h.button(h.render(),'Verify all selected').props.disabled,true);
 tree=h.render();nodes(tree,n=>n.type==='button'&&n.props['aria-label']==='Edit service details for A')[0].props.onClick();tree=h.render();nodes(tree,n=>n.type==='textarea')[0].props.onChange({target:{value:'Corrected service notes'}});tree=h.render();assert.equal(h.button(tree,'Verify all selected').props.disabled,true);assert.equal(h.state[0].a.notes,'Corrected service notes');
});
test('Fill missing times preserves existing and returned logs; saves only new drafts',async()=>{
 const h=harness();let tree=h.render();h.button(tree,'Fill missing service times').props.onClick();assert.deepEqual(Object.keys(h.state[0]),['d']);assert.equal(h.state[0].d.check_in,'2026-01-01T18:00');tree=h.render();await h.button(tree,'Save service logs').props.onClick();assert.equal(h.calls[0].name,'submit_officer_volunteer');assert.equal(h.calls[0].args.p_officer_id,'d');assert.equal(Object.keys(h.state[0]).length,0);assert.equal(h.refreshes,1);
});
test('Failed saves retain service edits and failed verification reports an error',async()=>{
 const h=harness({fail:true});let tree=h.render();h.button(tree,'Fill missing service times').props.onClick();await h.button(h.render(),'Save service logs').props.onClick();assert.ok(h.state[0].d);assert.match(nodes(h.render(),n=>n.props.role==='alert')[0].props.children,/Unsaved details are retained/);
 const v=harness({fail:true});await v.button(v.render(),'Verify all selected').props.onClick();assert.match(nodes(v.render(),n=>n.props.role==='alert')[0].props.children,/Offline/);assert.equal(v.refreshes,0);
});
test('Cancelled events, locked rosters, and verified logs cannot be edited',()=>{
 for(const options of [{cancelled:true},{locked:true}]){const h=harness(options),tree=h.render();assert.equal(h.button(tree,'Verify all selected').props.disabled,true);assert.equal(h.button(tree,'Fill missing service times').props.disabled,true);}
 const h=harness();let tree=h.render();nodes(tree,n=>n.type==='button'&&n.props['aria-label']==='Edit service details for B')[0].props.onClick();tree=h.render();assert.equal(nodes(tree,n=>n.type==='fieldset')[0].props.disabled,true);
});

test('Compact rows open one editor without creating drafts and next/previous retain individual edits',()=>{
 const h=harness();let tree=h.render();assert.equal(nodes(tree,n=>n.type==='textarea').length,0);assert.equal(nodes(tree,n=>n.type==='li').length,4);assert.equal(nodes(tree,n=>n.type==='modal').length,0);
 nodes(tree,n=>n.type==='button'&&n.props['aria-label']==='Edit service details for A')[0].props.onClick();tree=h.render();assert.equal(Object.keys(h.state[0]).length,0,'Opening details does not dirty a saved record');
 nodes(tree,n=>n.type==='textarea')[0].props.onChange({target:{value:'Adjusted A notes'}});tree=h.render();h.button(tree,'Next').props.onClick();tree=h.render();assert.match(nodes(tree,n=>n.type==='modal')[0].props.title,/B/);assert.equal(nodes(tree,n=>n.type==='fieldset')[0].props.disabled,true);
 h.button(tree,'Previous').props.onClick();tree=h.render();assert.equal(nodes(tree,n=>n.type==='textarea')[0].props.value,'Adjusted A notes');h.button(tree,'Done').props.onClick();tree=h.render();assert.equal(nodes(tree,n=>n.type==='modal').length,0);assert.equal(h.state[0].a.notes,'Adjusted A notes');assert.equal(h.calls.length,0,'Details are staged until Save service logs');
});
test('New service can be drafted from the editor and exceptions stay independently selectable',()=>{
 const h=harness();let tree=h.render();nodes(tree,n=>n.type==='button'&&n.props['aria-label']==='Edit service details for D')[0].props.onClick();tree=h.render();h.button(tree,'Add service draft').props.onClick();tree=h.render();assert.equal(h.state[0].d.check_in,'2026-01-01T18:00');assert.equal(nodes(tree,n=>n.type==='modal').length,0);
 const checks=nodes(tree,n=>n.type==='input'&&n.props.type==='checkbox');assert.equal(checks.length,4);assert.equal(checks[0].props.disabled,false);assert.ok(checks.slice(1).every(n=>n.props.disabled));
});
