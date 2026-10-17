const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const cache={};
function load(file){if(cache[file])return cache[file];const exports={};const requireFile=name=>name==='./officer-tracking'?load('lib/officer-tracking.ts'):require(name);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:requireFile,Intl,Date,TextEncoder,URL,Set});return cache[file]=exports;}
const {taskAttention,calendarIcs}=load('lib/gea-operations.ts');
test('Attention includes overdue and seven-day deadlines without flagging cancelled, completed, undated, or distant work',()=>{
 const task=(id,status,due_date,extra={})=>({id,title:id,status,due_date,...extra});
 const items=taskAttention([task('overdue','in_progress','2026-10-01'),task('next-week','in_progress','2026-10-23'),task('distant','in_progress','2026-10-24'),task('closed','completed','2026-10-01'),task('cancelled','in_progress','2026-10-01',{cancelled_at:'2026-10-01'}),task('no-date','in_progress',null),task('submitted','submitted','2026-10-01')],false,'/officerboard','2026-10-16');
 assert.deepEqual(Array.from(items,i=>i.title),['overdue','next-week']);
 assert.equal(items[0].detail,'Overdue task');assert.equal(items[0].href,'/officerboard?task=overdue');
});
test('Review reminders change identity on resubmission and link to the specific task',()=>{
 const tasks=[{id:'one',title:'One',status:'submitted',submitted_at:'2026-10-16T12:00:00Z'},{id:'two',title:'Two',status:'submitted',submitted_at:'2026-10-17T12:00:00Z',cancelled_at:'2026-10-17'}];
 const result=taskAttention(tasks,true,'/admin-portal-x7k9/officers','2026-10-16');
 assert.equal(result.length,1);assert.match(result[0].key,/2026-10-16T12:00:00Z/);assert.equal(result[0].href,'/admin-portal-x7k9/officers?task=one');
});
test('Calendar export retains absolute event times across DST and uses exclusive next-day ends for all-day deadlines',()=>{
 const ics=calendarIcs([{id:'meeting',title:'Meeting',start:'2026-11-01T01:30:00-07:00',end:'2026-11-01T01:30:00-08:00',kind:'meeting'},{id:'deadline',title:'Deadline',start:'2026-12-31',allDay:true,kind:'task'}],new Date('2026-10-16T00:00:00Z'));
 assert.match(ics,/DTSTART:20261101T083000Z/);assert.match(ics,/DTEND:20261101T093000Z/);assert.match(ics,/DTSTART;VALUE=DATE:20261231/);assert.match(ics,/DTEND;VALUE=DATE:20270101/);
});
test('Calendar export escapes injected properties and folds UTF-8 at 75 octets without losing text',()=>{
 const title='Science, service; 🌿'.repeat(15)+'\nBEGIN:VEVENT';
 const ics=calendarIcs([{id:'one',title,start:'2026-10-16',allDay:true,kind:'task',location:'Room, 1; west'}]);
 for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line,'utf8')<=75);
 const unfolded=ics.replace(/\r\n /g,'');assert.ok(unfolded.includes('\\nBEGIN:VEVENT'));assert.equal((unfolded.match(/^BEGIN:VEVENT$/gm)||[]).length,1);
 assert.equal(ics.split('\r\n').filter(line=>line==='BEGIN:VEVENT').length,1);assert.ok(unfolded.includes('Room\\, 1\\; west'));assert.ok(!unfolded.includes('�'));
});
