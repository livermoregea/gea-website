const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/officer-tracking.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exportsObject,Intl,Date});
const {trackingSummary,durationLabel,schoolDate}=exportsObject;
const empty=()=>({events:[],attendance:[],signups:[],volunteerLogs:[],strikes:[],reviews:[],generalNotes:[]});
const event=(id,kind='volunteer',extra={})=>({id,kind,academic_year:'2026-2027',gea_approved:true,cancelled:false,...extra});
test('Only verified participation at distinct GEA-approved events counts toward the two-event minimum',()=>{
 const data=empty();data.events=[event('a'),event('b','outreach'),event('c'),event('d','volunteer',{gea_approved:false}),event('e','volunteer',{cancelled:true}),event('old','volunteer',{academic_year:'2025-2026'})];
 data.signups=[{event_id:'c',officer_id:'me',committed:true}];
 data.volunteerLogs=[['a','approved',370],['b','approved',300],['c','pending',120],['d','approved',60],['e','approved',60],['old','approved',60]].map(([event_id,status,minutes])=>({event_id,status,minutes,officer_id:'me'}));
 data.volunteerLogs.push({event_id:'c',status:'approved',minutes:120,officer_id:'other'});
 const summary=trackingSummary(data,'me','2026-2027');
 assert.equal(summary.volunteerEvents,2);assert.equal(summary.volunteerMinutes,670);assert.equal(durationLabel(summary.volunteerMinutes),'11h 10m');
});
test('Attendance keeps late arrivals, excused absences, and unexcused absences distinct',()=>{
 const data=empty();data.events=['a','b','c','d'].map(id=>event(id,'meeting'));
 data.attendance=['present','late','excused','unexcused'].map((status,i)=>({officer_id:'me',event_id:['a','b','c','d'][i],status}));
 const result=trackingSummary(data,'me','2026-2027');assert.equal(result.present,2);assert.equal(result.excused,1);assert.equal(result.unexcused,1);assert.equal(result.attendanceStrikes,0);
});
test('Strike categories are independent; pending, dismissed, revoked, prior-year and other officers’ records do not count',()=>{
 const data=empty();data.strikes=[['attendance','confirmed'],['attendance','confirmed'],['conduct','confirmed'],['conduct','confirmed'],['attendance','notified'],['attendance','revoked'],['conduct','dismissed']].map(([category,status])=>({officer_id:'me',academic_year:'2026-2027',category,status}));
 data.strikes.push({officer_id:'other',academic_year:'2026-2027',category:'attendance',status:'confirmed'},{officer_id:'me',academic_year:'2025-2026',category:'attendance',status:'confirmed'});
 const result=trackingSummary(data,'me','2026-2027');assert.equal(result.attendanceStrikes,2);assert.equal(result.conductStrikes,2);
});
test('Service durations preserve minutes; event display uses school time across daylight saving',()=>{
 assert.equal(durationLabel(370),'6h 10m');assert.equal(durationLabel(300),'5h 0m');
 assert.match(schoolDate('2026-10-03T15:10:00Z'),/8:10 AM PDT/);
 assert.match(schoolDate('2026-12-03T16:10:00Z'),/8:10 AM PST/);
});

test('Due-date minimum uses the Pacific calendar day at UTC midnight and across DST',()=>{
 const {schoolToday}=exportsObject;
 assert.equal(schoolToday(new Date('2026-10-15T02:00:00Z')),'2026-10-14');
 assert.equal(schoolToday(new Date('2026-10-15T07:00:00Z')),'2026-10-15');
 assert.equal(schoolToday(new Date('2026-12-15T07:59:00Z')),'2026-12-14');
 assert.equal(schoolToday(new Date('2026-12-15T08:00:00Z')),'2026-12-15');
 assert.equal(schoolToday(new Date('2026-03-08T10:00:00Z')),'2026-03-08');
});
