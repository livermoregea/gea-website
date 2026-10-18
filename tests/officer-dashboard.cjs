const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const cache = {};
function load(file) {
  if (cache[file]) return cache[file];
  const exports = {}; cache[file] = exports;
  function resolve(name) {
    if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (name.startsWith('.') || name.startsWith('@/')) {
      let target = name.startsWith('@/') ? name.slice(2) : path.join(path.dirname(file), name);
      target += fs.existsSync(target + '.tsx') ? '.tsx' : '.ts';
      return load(target);
    }
    return require(name);
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, require: resolve, Date, Intl, URLSearchParams });
  return exports;
}
const { officerDashboard } = load('lib/officer-dashboard.ts');
const Dashboard = load('components/operations/OfficerDashboard.tsx').default;
const profiles = [{ id: 'a', name: 'Alice', role: 'officer' }, { id: 'b', name: 'Bob', role: 'officer' }, { id: 'advisor', name: 'Advisor', role: 'admin', reviewer_kind: 'advisor' }, { id: 'inactive', name: 'Inactive', role: 'officer', access_enabled: false }];
const tasks = [{ id: 'shared', assigned_to: 'a', officer_task_members: [{ officer_id: 'b' }], status: 'completed' }, { id: 'active', assigned_to: 'b', status: 'submitted' }, { id: 'cancelled', assigned_to: 'a', status: 'completed', cancelled_at: '2026-10-01' }];
const evaluations = [{ task_id: 'shared', efficiency: 3, effectiveness: 3, time: 3 }, { task_id: 'cancelled', efficiency: 4, effectiveness: 4, time: 4 }];
const events = [{ id: 'meeting', kind: 'meeting', academic_year: '2026-2027', cancelled: false }, { id: 'service', kind: 'volunteer', academic_year: '2026-2027', gea_approved: true }, { id: 'cancelled', kind: 'meeting', academic_year: '2026-2027', cancelled: true }, { id: 'old', kind: 'meeting', academic_year: '2025-2026', cancelled: false }];
const tracking = { events, attendance: [{ officer_id: 'a', event_id: 'meeting', status: 'present' }, { officer_id: 'b', event_id: 'meeting', status: 'late' }, { officer_id: 'a', event_id: 'old', status: 'present' }, { officer_id: 'a', event_id: 'cancelled', status: 'present' }], volunteerLogs: [{ officer_id: 'a', event_id: 'service', status: 'approved', minutes: 90 }, { officer_id: 'b', event_id: 'service', status: 'pending', minutes: 60 }], signups: [], strikes: [], reviews: [], generalNotes: [] };
function summary(reviewer) { return officerDashboard(profiles[0], profiles, tasks, evaluations, tracking, reviewer, '2026-2027'); }
test('Reviewer dashboard uses existing scores, counts shared work once, and scopes participation to the school year', () => {
  const result = summary(true);
  assert.equal(result.officers.length, 2);
  assert.equal(result.score, 75);
  assert.equal(result.scoredOfficers, 2);
  assert.equal(result.work.completed, 1);
  assert.equal(result.work.active, 1);
  assert.equal(result.submitted, 1);
  assert.equal(result.attended, 2);
  assert.equal(result.serviceMinutes, 90);
});
test('Ordinary dashboard only summarizes the signed-in officer even if broader data is passed', () => {
  const result = summary(false);
  assert.equal(result.officers.length, 1);
  assert.equal(result.officers[0].person.name, 'Alice');
  assert.equal(result.work.active, 0);
  assert.equal(result.attended, 1);
  assert.equal(result.serviceMinutes, 90);
});
test('Officers without evaluations have an empty score rather than a zero', () => {
  const result = officerDashboard(profiles[0], profiles, [], [], tracking, true, '2026-2027');
  assert.equal(result.score, null);
  assert.equal(result.scoredOfficers, 0);
});
function render(reviewer) {
  return renderToStaticMarkup(React.createElement(Dashboard, { profile: profiles[0], profiles, tasks, evaluations, tracking, data: { reviewer, workspaceHref: '/officerboard', calendar: [{ id: 'old', title: 'Past deadline', start: '2020-01-01', kind: 'task', allDay: true, href: '/past' }, { id: 'future', title: 'Future meeting', start: '2099-01-01T20:00:00Z', kind: 'meeting', href: '/meeting' }] } }));
}
test('Reviewer overview links each snapshot to a detailed record without exposing private notes', () => {
  const html = render(true);
  assert.ok(html.includes('Team PEET average'));
  assert.ok(html.includes('75.0'));
  assert.ok(html.includes('Meetings attended'));
  assert.ok(html.includes('1h 30m'));
  assert.ok(html.includes('topic=overview&amp;officer=a'));
  assert.ok(!html.includes('Advisor'));
  assert.ok(!html.includes('Inactive'));
  assert.ok(html.includes('Future meeting'));
  assert.ok(!html.includes('Past deadline'));
});
test('Ordinary overview provides personal score and participation with no team records', () => {
  const html = render(false);
  assert.ok(html.includes('My progress'));
  assert.ok(html.includes('PEET score'));
  assert.ok(html.includes('topic=attendance'));
  assert.ok(!html.includes('Officer progress'));
  assert.ok(!html.includes('Bob'));
  assert.ok(!html.includes('Team PEET'));
});
test('Personal work queue prioritizes deadlines, shared assignments and clarification without mixing in submitted or closed work',()=>{
 const {officerWorkQueue}=load('lib/officer-dashboard.ts');
 const rows=[
  {id:'undated',assigned_to:'a',status:'in_progress',due_date:null},
  {id:'later',assigned_to:'a',status:'in_progress',due_date:'2026-11-01'},
  {id:'overdue',assigned_to:'a',status:'in_progress',due_date:'2026-10-01'},
  {id:'shared',assigned_to:'b',officer_task_members:[{officer_id:'a'}],status:'in_progress',due_date:'2026-10-18'},
  {id:'waiting',assigned_to:'a',status:'submitted',due_date:'2026-10-02'},
  {id:'answers',assigned_to:'a',status:'submitted',due_date:'2026-10-03'},
  {id:'cancelled',assigned_to:'a',status:'in_progress',due_date:'2026-09-01',cancelled_at:'2026-10-01'},
  {id:'done',assigned_to:'a',status:'completed',due_date:'2026-09-01'},
  {id:'other',assigned_to:'b',status:'in_progress',due_date:'2026-09-01'},
 ];
 const result=officerWorkQueue(rows,'a',['answers']);
 assert.deepEqual(Array.from(result.toComplete,row=>row.id),['overdue','answers','shared','later','undated']);
 assert.deepEqual(Array.from(result.awaitingReview,row=>row.id),['waiting']);
 assert.equal(rows[0].id,'undated');
});
test('Officer overview puts assignments before progress and opens the existing task submission dialog directly',()=>{
 const assigned=[{id:'due',title:'Prepare workshop slides',assigned_to:'a',status:'in_progress',due_date:'2026-10-18'},
  {id:'clarify',title:'Confirm completed outreach',assigned_to:'a',status:'submitted',due_date:'2026-10-17'},
  {id:'other',title:'Other officer private task',assigned_to:'b',status:'in_progress'}];
 const html=renderToStaticMarkup(React.createElement(Dashboard,{profile:profiles[0],profiles,tasks:assigned,evaluations:[],tracking,clarificationTaskIds:['clarify'],data:{reviewer:false,workspaceHref:'/officerboard',calendar:[]}}));
 assert.ok(html.includes('Prepare workshop slides'));assert.ok(html.includes('Your clarification answers are needed'));
 assert.ok(html.includes('task=due&amp;action=submit'));assert.ok(html.includes('Answer questions'));
 assert.ok(html.indexOf('Your assigned tasks')<html.indexOf('My progress'));
 assert.ok(!html.includes('Other officer private task'));assert.ok(!html.includes('<details class="progressDetails" open'));
});
