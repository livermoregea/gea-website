const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(file,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:name=>deps[name]??require(name),Set,Date});return exports;}
const protocol=load('lib/discord/protocol.ts');
const ui=load('lib/discord/roll-call.ts',{'./protocol':protocol,'@/lib/officer-tracking':{schoolDate:date=>date}});
const roster=(count=3)=>({id:'session',version:1,page:0,event_title:'Weekly meeting',starts_at:'2026-10-20',started:true,selected:[],rows:Array.from({length:count},(_,n)=>({officer_id:`officer-${n}`,name:`Officer ${n}`,position:'Officer',status:n===1?'excused':'unmarked',original_status:n===1?'excused':'unmarked'}))});
test('roll call displays an officer multiselect, bulk present, and explicit Save with no typed IDs',()=>{
 const message=ui.rollCallMessage(roster());
 assert.match(message.content,/Weekly meeting/);
 assert.equal(message.components[0].components[0].type,3);
 assert.equal(message.components[0].components[0].max_values,3);
 const buttons=message.components.flatMap(row=>row.components).filter(c=>c.type===2);
 assert.equal(buttons.find(b=>b.label==='Save attendance').disabled,true);
 assert.equal(buttons.find(b=>b.label==='Mark all present').disabled,false);
 assert.ok(buttons.filter(b=>['Present','Tardy','Excused','Unexcused','Not recorded'].includes(b.label)).every(b=>b.disabled));
});
test('selected officers enable statuses, drafts enable Save, and future events restrict actual attendance',()=>{
 const state=roster();state.selected=['officer-0'];state.rows[0].status='present';
 let message=ui.rollCallMessage(state);
 let buttons=message.components.flatMap(r=>r.components).filter(c=>c.type===2);
 assert.equal(buttons.find(b=>b.label==='Present').disabled,false);
 assert.equal(buttons.find(b=>b.label==='Save attendance').disabled,false);
 assert.match(message.content,/1 unsaved changes/);
 state.started=false;message=ui.rollCallMessage(state);buttons=message.components.flatMap(r=>r.components).filter(c=>c.type===2);
 assert.equal(buttons.find(b=>b.label==='Present').disabled,true);
 assert.equal(buttons.find(b=>b.label==='Mark all present').disabled,true);
 assert.equal(buttons.find(b=>b.label==='Excused').disabled,false);
});
test('large rosters page at 25 choices and stay within Discord component limits',()=>{
 const state=roster(60);state.page=2;
 const message=ui.rollCallMessage(state);
 assert.equal(message.components[0].components[0].options.length,10);
 assert.ok(message.content.length<=2000);
 assert.ok(message.components.length<=5);
 assert.ok(message.components.every(row=>row.components.length<=5));
 const page=message.components.at(-1).components;
 assert.equal(page[0].disabled,false);assert.equal(page[1].disabled,true);
 assert.ok(message.components.flatMap(r=>r.components).every(c=>!c.custom_id||c.custom_id.length<=100));
});
test('event dropdown uses event names/dates and selections send batched officer IDs to the session',async()=>{
 const calls=[];const perform=async(action,args,key)=>{calls.push({action,args,key});return action==='events'?{page:0,has_more:false,events:[{id:'meeting-id',title:'Weekly meeting',starts_at:'2026-10-20'}]}:roster();};
 const first=await ui.rollCallResponse({type:2,data:{name:'mark-attendance'}},perform);
 assert.equal(first.components[0].components[0].options[0].label,'Weekly meeting');
 await ui.rollCallResponse({id:'click',type:3,data:{custom_id:'roll:select:session:1',values:['officer-0','officer-2']}},perform);
 assert.equal(calls[1].action,'select');assert.deepEqual([...calls[1].args.officers],['officer-0','officer-2']);
 assert.equal(calls[1].key,'click');
});
test('saved and discarded rosters remove controls, making the result clear',()=>{
 const state=roster();state.saved=true;
 assert.match(ui.rollCallMessage(state).content,/Attendance saved/);assert.equal(ui.rollCallMessage(state).components.length,0);
 state.saved=false;state.discarded=true;assert.match(ui.rollCallMessage(state).content,/No attendance was saved/);
});
