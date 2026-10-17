const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function harness({future=false,cancelled=false,busy=false,canMeetings=true,dirtyScope=null}={}){
 const roll=[{officer_id:'unmarked',name:'Unmarked',status:'unmarked'},{officer_id:'late',name:'Late',status:'late'},{officer_id:'absent',name:'Absent',status:'unexcused'},{officer_id:'excused',name:'Excused',status:'excused'},{officer_id:'draft',name:'Draft',status:'unmarked'}];
 const state=[roll,{draft:'late'},''];let cursor=0;const saved=[],dirty=[];
 const deps={react:{useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];},useEffect(){}},'react/jsx-runtime':require('react/jsx-runtime'),'@/lib/supabase/client':{createClient:()=>{throw new Error('Unexpected database call');}},'@/lib/meeting-documents':{googleDocLink:()=>null},'@/lib/officer-tracking':{schoolDate:v=>v,schoolToday:()=> '2026-10-16'},'./operations.module.css':{default:new Proxy({},{get:(_,key)=>String(key)})}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/operations/MeetingWorkspace.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:name=>{assert.ok(deps[name],name);return deps[name];},Date});
 const data={canMeetings,events:[{id:'meeting',kind:'meeting',title:'Weekly meeting',starts_at:new Date(Date.now()+(future?3600000:-3600000)).toISOString(),cancelled}],notes:[],agenda:[],people:[]};
 const render=()=>{cursor=0;return exports.default({data,eventId:'meeting',busy,dirtyScope,markDirty:scope=>dirty.push(scope),save:async(...args)=>{saved.push(args);return true;}});};
 function elements(node,out=[]){if(!node||typeof node!=='object')return out;if(Array.isArray(node)){node.forEach(n=>elements(n,out));return out;}out.push(node);elements(node.props?.children,out);return out;}
 const button=(tree,text)=>elements(tree).find(n=>n.type==='button'&&n.props.children===text);
 return {render,button,state,saved,dirty};
}
test('Mark all present preserves saved and drafted attendance decisions and waits for Save attendance',async()=>{
 const h=harness();let tree=h.render();const button=h.button(tree,'Mark all present');assert.equal(button.props.disabled,false);button.props.onClick();assert.equal(h.saved.length,0);assert.equal(h.state[1].unmarked,'present');assert.equal(h.state[1].draft,'late');assert.equal(h.state[1].absent,undefined);assert.equal(h.state[1].excused,undefined);assert.equal(h.state[1].late,undefined);assert.deepEqual(h.dirty,['attendance']);
 tree=h.render();assert.equal(h.button(tree,'Mark all present').props.disabled,true);await h.button(tree,'Save attendance').props.onClick();assert.equal(h.saved[0][0],'save_meeting_attendance');assert.deepEqual(JSON.parse(JSON.stringify(h.saved[0][1].p_rows)),[{officer_id:'unmarked',status:'present',original_status:'unmarked'},{officer_id:'draft',status:'late',original_status:'unmarked'}]);
});
test('Bulk present is unavailable for future/cancelled meetings, ordinary officers, and locked forms',()=>{
 for(const options of [{future:true},{busy:true},{dirtyScope:'minutes'}]){const h=harness(options);assert.equal(h.button(h.render(),'Mark all present').props.disabled,true);}
 for(const options of [{cancelled:true},{canMeetings:false}]){const h=harness(options);assert.equal(h.button(h.render(),'Mark all present'),undefined);}
});
