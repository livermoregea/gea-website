const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function harness(event,kind='meeting'){
 let cursor=0;const state=[],saved=[],dirty=[];
 const deps={'@/components/officerboard/VolunteerAudienceFields':{default:'audience-fields'},react:{useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],value=>{state[i]=value;}];}},'react/jsx-runtime':require('react/jsx-runtime'),'@/lib/officer-tracking':{CONTRACT_YEAR:'2026-2027',localDateInput:v=>v},'./operations.module.css':{default:new Proxy({},{get:(_,key)=>String(key)})}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/operations/MeetingSchedule.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:name=>deps[name],Date,Intl,Number,FormData:class{constructor(values){this.values=values;}get(name){return this.values[name]??null;}has(name){return name in this.values;}}});
 function elements(node,out=[]){if(!node||typeof node!=='object')return out;if(Array.isArray(node)){node.forEach(n=>elements(n,out));return out;}out.push(node);elements(node.props?.children,out);return out;}
 const render=()=>{cursor=0;return exports.default({event,kind,busy:false,dirtyScope:null,markDirty:scope=>dirty.push(scope),save:async(...args)=>{saved.push(args);return true;}});};
 const submit=async(values)=>{const form=elements(render()).find(n=>n.type==='form');await form.props.onSubmit({preventDefault(){},currentTarget:{...values,reset(){}}});};
 return{render,elements,submit,saved,dirty};
}
test('Inline scheduling uses the existing event RPC and preserves unrelated event details',async()=>{
 const original={id:'meeting',title:'Old',academic_year:'2026-2027',notes:'Existing details',gea_approved:true,cancelled:false};const h=harness(original);
 const values={title:'Weekly meeting',year:'2026-2027',starts_at:'2026-10-16T15:00',ends_at:'2026-10-16T16:00',location:'Lab',mandatory:'on'};
 await h.submit(values);assert.equal(h.saved.length,1);const [rpc,args]=h.saved[0];assert.equal(rpc,'save_officer_event');assert.equal(args.p_event_id,'meeting');assert.equal(args.p_kind,'meeting');assert.equal(args.p_notes,'Existing details');assert.equal(args.p_approved,true);assert.equal(args.p_mandatory,true);assert.ok(new Date(args.p_ends_at)>new Date(args.p_starts_at));
});
test('An invalid schedule keeps the form open and makes no database call',async()=>{const h=harness();await h.submit({title:'Meeting',year:'2026-2027',starts_at:'2026-10-16T16:00',ends_at:'2026-10-16T15:00'});assert.equal(h.saved.length,0);assert.ok(h.elements(h.render()).some(n=>n.props?.role==='alert'));});

test('Volunteer scheduling saves the public-and-leadership checkbox and public settings in the same event RPC',async()=>{
 const h=harness(undefined,'volunteer');
 const values={title:'Shared cleanup',kind:'volunteer',year:'2026-2027',starts_at:'2026-11-16T15:00',ends_at:'2026-11-16T16:00',location:'Park',approved:'on',public_volunteering:'on',public_description:'Everyone welcome',public_signup_open:'on',public_capacity:'12'};
 await h.submit(values);const [rpc,args]=h.saved[0];assert.equal(rpc,'save_officer_event');
 assert.equal(args.p_public_volunteering,true);assert.equal(args.p_public_description,'Everyone welcome');
 assert.equal(args.p_public_signup_open,true);assert.equal(args.p_public_capacity,12);
 const fields=h.elements(h.render()).find(n=>n.type==='audience-fields');assert.ok(fields);
});
test('Unchecked volunteer audience saves leadership-only and meetings do not offer public signup',async()=>{
 const h=harness(undefined,'volunteer');await h.submit({title:'Leadership cleanup',kind:'volunteer',year:'2026-2027',starts_at:'2026-11-16T15:00',ends_at:'2026-11-16T16:00'});
 assert.equal(h.saved[0][1].p_public_volunteering,false);
 const meeting=harness();assert.equal(meeting.elements(meeting.render()).filter(n=>n.type==='audience-fields').length,0);
});

test('Meeting and event descriptions are editable, saved through the existing notes field, and can be cleared',async()=>{
 for(const kind of ['meeting','volunteer']) {
  const event={id:'event',title:'Existing',academic_year:'2026-2027',notes:'Previous description'};
  const h=harness(event,kind);
  const textarea=h.elements(h.render()).find(node=>node.type==='textarea'&&node.props.name==='notes');
  assert.equal(textarea.props.defaultValue,'Previous description');assert.equal(textarea.props.maxLength,10000);
  const values={title:'Updated',kind,year:'2026-2027',starts_at:'2026-10-16T15:00',ends_at:'2026-10-16T16:00',notes:'Bring outreach display materials. Help visitors with the hands-on demo.'};
  await h.submit(values);assert.equal(h.saved[0][1].p_notes,values.notes);
  await h.submit({...values,notes:''});assert.equal(h.saved[1][1].p_notes,'');
 }
});
