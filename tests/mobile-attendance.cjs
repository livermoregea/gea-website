const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(file,modules={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{assert.ok(name in modules,name);return modules[name];},FormData:class{constructor(values){this.values=values;}get(name){return this.values[name]??null;}}});return exports;}
const styles={default:new Proxy({},{get:(_,name)=>String(name)})};
const jsx=require('react/jsx-runtime');
function nodes(tree,predicate){const result=[];function walk(node){if(Array.isArray(node)){node.forEach(walk);return;}if(!node?.props)return;if(predicate(node))result.push(node);walk(node.props.children);}walk(tree);return result;}
const Cards=load('components/officerboard/OfficerAttendanceCards.tsx',{'react/jsx-runtime':jsx,'./officerboard.module.css':styles}).default;
const people=[{id:'a',name:'Officer A',email:'a@lvjusd.org',role:'officer'},{id:'b',name:'Officer B',email:'b@lvjusd.org',role:'officer'}];
function cardProps(extra={}){return {rows:[{person:people[0],status:'unmarked',changed:false,hasNotes:false,hasAbsenceNotice:false}],busy:false,cancelled:false,hasUnsavedChanges:false,onStatusChange(){},onOpenOfficer(){},onNotes(){},...extra};}
test('Phone cards expose all attendance states without a horizontal table and identify each officer',()=>{
 const tree=Cards(cardProps());assert.equal(nodes(tree,n=>n.type==='table').length,0);
 const select=nodes(tree,n=>n.type==='select')[0];assert.match(select.props['aria-label'],/Officer A.*a@lvjusd.org/);
 assert.equal(select.props.value,'unmarked');assert.deepEqual(nodes(select,n=>n.type==='option').map(n=>n.props.value),['unmarked','present','late','excused','unexcused']);
});
test('A phone status change and notes action target the correct officer; locked records stay disabled',()=>{
 let changed,notes;
 const tree=Cards(cardProps({onStatusChange:(...args)=>changed=args,onNotes:person=>notes=person}));
 nodes(tree,n=>n.type==='select')[0].props.onChange({target:{value:'excused'}});assert.equal(changed[0],'a');assert.equal(changed[1],'excused');
 nodes(tree,n=>n.type==='button')[1].props.onClick();assert.equal(notes.id,'a');
 const locked=Cards(cardProps({cancelled:true,hasUnsavedChanges:true}));assert.equal(nodes(locked,n=>n.type==='select')[0].props.disabled,true);assert.ok(nodes(locked,n=>n.type==='button').every(n=>n.props.disabled));
});
function rosterHarness(fail=false){
 const values=[];let at=0;const calls=[];let refreshes=0;
 const Board=load('components/officerboard/OfficerRoster.tsx',{
  react:{useState(initial){const index=at++;if(!(index in values))values[index]=initial;return[values[index],next=>{values[index]=typeof next==='function'?next(values[index]):next;}];},useEffect(){},useTransition:()=>[false,fn=>fn()]},
  'react/jsx-runtime':jsx,'@/components/WorkspaceActivity':{default:'workspace-activity'},'next/navigation':{useRouter:()=>({refresh(){refreshes++;}})},
  '@/lib/use-unsaved-changes':{useUnsavedChanges(){}},'@/components/ActionError':{default:'action-error'},
  '@/lib/supabase/client':{createClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return{error:fail?{message:'Offline'}:null};}})},
  '@/lib/peet':load('lib/peet.ts'),'@/lib/officer-tracking':load('lib/officer-tracking.ts'),
  './VolunteerServiceRoster':{default:'volunteer-service-roster'},'./EventParticipation':{default:'event-participation'},'./OfficerAttendanceCards':{default:Cards},'./OfficerEventFields':{default:'event-fields'},'./Modal':{default:'modal'},'./officerboard.module.css':styles,
 }).default;
 const data={events:[{id:'meeting',title:'Meeting',kind:'meeting',academic_year:'2026-2027',starts_at:'2026-11-01T18:00:00Z',ends_at:'2026-11-01T19:00:00Z',location:'Room 303',cancelled:false},{id:'service',title:'Service event',kind:'volunteer',academic_year:'2026-2027',starts_at:'2026-01-01T18:00:00Z',ends_at:'2026-01-01T19:00:00Z',cancelled:false}],attendance:[{event_id:'meeting',officer_id:'b',status:'late',reviewer_notes:'Existing note'}],signups:[],volunteerLogs:[],strikes:[],reviews:[],generalNotes:[]};
 const props={profiles:people,data,year:'2026-2027',years:['2026-2027'],onYearChange(){},onOpenOfficer(){},onDirtyChange(){}};
 return{render(){at=0;return Board(props);},calls,get refreshes(){return refreshes;}};
}
test('Phone and desktop use the same attendance drafts; bulk marking preserves recorded statuses and notes',async()=>{
 const h=rosterHarness();let tree=h.render();
 nodes(tree,n=>n.type==='button'&&n.props.children==='Mark unrecorded present')[0].props.onClick();
 tree=h.render();let cards=nodes(tree,n=>n.type===Cards)[0];assert.equal(cards.props.rows[0].status,'present');assert.equal(cards.props.rows[1].status,'late');
 cards.props.onNotes(people[0]);tree=h.render();
 const form=nodes(tree,n=>n.type==='form')[0];await form.props.onSubmit({preventDefault(){},currentTarget:{notes:'New meeting details'}});
 tree=h.render();cards=nodes(tree,n=>n.type===Cards)[0];assert.equal(cards.props.rows[0].hasNotes,true);assert.equal(h.calls.length,0,'Changes do not auto-save');
 const bar=nodes(tree,n=>n.props['aria-label']==='Save meeting attendance')[0];await nodes(bar,n=>n.type==='button'&&n.props.children==='Save attendance')[0].props.onClick();
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'record_officer_attendance');assert.equal(h.calls[0].args.p_officer_id,'a');assert.equal(h.calls[0].args.p_status,'present');assert.equal(h.calls[0].args.p_notes,'New meeting details');assert.equal(h.refreshes,1);
});
test('A failed phone save retains the attendance selection and allows retry',async()=>{
 const h=rosterHarness(true);let tree=h.render();nodes(tree,n=>n.type===Cards)[0].props.onStatusChange('a','unexcused');
 tree=h.render();const bar=nodes(tree,n=>n.props['aria-label']==='Save meeting attendance')[0];await nodes(bar,n=>n.type==='button'&&n.props.children==='Save attendance')[0].props.onClick();
 tree=h.render();assert.equal(nodes(tree,n=>n.type===Cards)[0].props.rows[0].status,'unexcused');assert.match(nodes(tree,n=>n.type==='action-error')[0].props.message,/Unsaved choices are retained/);
 const retry=nodes(nodes(tree,n=>n.props['aria-label']==='Save meeting attendance')[0],n=>n.type==='button'&&n.props.children==='Save attendance')[0];assert.equal(retry.props.disabled,false);
});

test('Volunteer events share bulk attendance and per-officer notes without opening profiles',async()=>{
 const h=rosterHarness();let tree=h.render();nodes(tree,n=>n.type==='button'&&n.props.children==='Volunteer')[0].props.onClick();tree=h.render();
 const mark=nodes(tree,n=>n.type==='button'&&n.props.children==='Mark unrecorded present')[0];assert.equal(mark.props.disabled,false);mark.props.onClick();tree=h.render();
 const cards=nodes(tree,n=>n.type===Cards)[0];assert.ok(cards.props.rows.every(row=>row.status==='present'));cards.props.onStatusChange('b','excused');tree=h.render();
 const bar=nodes(tree,n=>n.props['aria-label']==='Save event attendance')[0];await nodes(bar,n=>n.type==='button'&&n.props.children==='Save attendance')[0].props.onClick();
 assert.equal(h.calls.length,2);assert.equal(h.calls[0].args.p_event_id,'service');assert.equal(h.calls[0].args.p_status,'present');assert.equal(h.calls[1].args.p_status,'excused');
 assert.equal(nodes(tree,n=>n.type==='volunteer-service-roster').length,1);
});
test('Bulk attendance can apply an absence status while preserving per-officer exceptions',()=>{
 const h=rosterHarness();let tree=h.render();nodes(tree,n=>n.props['aria-label']==='Bulk attendance status')[0].props.onChange({target:{value:'excused'}});tree=h.render();const bulk=nodes(tree,n=>n.type==='button'&&n.props.children==='Mark unrecorded excused')[0];assert.equal(bulk.props.disabled,false);bulk.props.onClick();tree=h.render();const cards=nodes(tree,n=>n.type===Cards)[0];assert.equal(cards.props.rows[0].status,'excused');assert.equal(cards.props.rows[1].status,'late');
});
