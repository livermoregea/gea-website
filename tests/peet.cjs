const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const exported = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/peet.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: exported, URL });
const { peetSummary, taskAverage, productLink, peetError } = exported;
const task = (id, status = 'completed') => ({ id, status });
const evaluation = (task_id, efficiency, effectiveness, time) => ({ task_id, efficiency, effectiveness, time });

test('A 3.0 task average is exactly 85; decimal scores retain precision until presentation', () => {
  assert.equal(peetSummary([task('a')], [evaluation('a', 3, 3, 3)]).score, 85);
  assert.equal(taskAverage(evaluation('a', '2.5', '3.5', '3')), 3);
  assert.equal(peetSummary([task('a')], [evaluation('a', 1, 1, 1)]).score, 45);
  assert.equal(peetSummary([task('a')], [evaluation('a', 4, 4, 4)]).score, 100);
});
test('Tasks carry equal weight; unreviewed and other officers’ tasks do not affect totals', () => {
  const tasks = [task('a'), task('b'), task('c', 'submitted'), task('d', 'in_progress')];
  const result = peetSummary(tasks, [evaluation('a', 4, 4, 4), evaluation('b', 2, 2, 2), evaluation('other', 1, 1, 1)]);
  assert.equal(result.score, 85);
  assert.equal(result.active, 2);
  assert.equal(result.completed, 2);
  assert.equal(result.evaluated, 2);
});
test('Empty and awaiting-review boards have no score, rather than a misleading zero', () => {
  assert.equal(peetSummary([], []).score, null);
  assert.equal(peetSummary([task('a', 'submitted')], []).score, null);
});
test('Final products accept web links and reject script, data, credentials, and malformed URLs', () => {
  assert.equal(productLink('https://docs.google.com/document/d/demo'), 'https://docs.google.com/document/d/demo');
  assert.equal(productLink(' https://example.com/work '), 'https://example.com/work');
  for (const url of [null, '', 'javascript:alert(1)', 'data:text/html,test', 'ftp://example.com', '//example.com', 'https://user:pass@example.com', 'https://example.com/has space', 'https://']) {
    assert.equal(productLink(url), null, String(url));
  }
});
test('Setup and connection errors are actionable without exposing database details', () => {
  assert.match(peetError({ code: 'PGRST205', message: 'private detail' }), /setup/);
  assert.doesNotMatch(peetError({ code: '42501', message: 'private detail' }), /private detail/);
  assert.equal(peetError({ code: 'P0001', message: 'Task not available.' }), 'Task not available.');
});
test('Cancelled tasks preserve history without counting toward active work or PEET', () => {
  const tasks = [task('keep'), {...task('cancelled'),cancelled_at:'2026-10-13'}, {...task('open','in_progress'),cancelled_at:'2026-10-13'}];
  const result = peetSummary(tasks, [evaluation('keep',3,3,3),evaluation('cancelled',1,1,1)]);
  assert.equal(result.score,85); assert.equal(result.active,0); assert.equal(result.completed,1);
});
test('Task eligibility excludes teacher accounts even when their profile says officer', () => {
  const people = [{id:'officer',role:'officer'},{id:'teacher',role:'officer',is_teacher:true},{id:'advisor',reviewer_kind:'advisor'},{id:'disabled',access_enabled:false},{id:'president',reviewer_kind:'president'}];
  assert.deepEqual(Array.from(exported.taskOfficers(people),p=>p.id),['officer','president']);
});

test('Task editing belongs to the assigner; self-created tasks lock after submission', () => {
  const { canEditOfficerTask } = exported;
  const assigned = { created_by: 'assigner', assigned_to: 'officer', status: 'in_progress' };
  assert.equal(canEditOfficerTask(assigned, 'officer'), false);
  assert.equal(canEditOfficerTask(assigned, 'assigner'), true);
  assert.equal(canEditOfficerTask(assigned, 'unrelated-admin'), false);
  assert.equal(canEditOfficerTask({ ...assigned, assigned_to: 'assigner' }, 'assigner'), true);
  assert.equal(canEditOfficerTask({ ...assigned, assigned_to: 'assigner', status: 'submitted' }, 'assigner'), false);
  assert.equal(canEditOfficerTask({ ...assigned, status: 'submitted' }, 'assigner'), true);
  assert.equal(canEditOfficerTask({ ...assigned, status: 'completed' }, 'assigner'), false);
  assert.equal(canEditOfficerTask({ ...assigned, cancelled_at: '2026-10-14' }, 'assigner'), false);
});
test('Self-created deadlines stay within three calendar days across months and leap years', () => {
  const { selfTaskDeadlineBounds } = exported;
  assert.equal(selfTaskDeadlineBounds(null), null);
  const march = selfTaskDeadlineBounds('2028-03-01');
  assert.equal(march.min, '2028-02-27');
  assert.equal(march.max, '2028-03-04');
  const year = selfTaskDeadlineBounds('2026-01-01');
  assert.equal(year.min, '2025-12-29');
  assert.equal(year.max, '2026-01-04');
});

test('Reviewers edit other officers’ active and submitted tasks without creator ownership', () => {
  const { canEditOfficerTask } = exported;
  const selfTask = {created_by:'officer',assigned_to:'officer',status:'in_progress'};
  assert.equal(canEditOfficerTask(selfTask,'reviewer',true),true);
  assert.equal(canEditOfficerTask({...selfTask,status:'submitted'},'reviewer',true),true);
  assert.equal(canEditOfficerTask(selfTask,'reviewer',false),false);
  assert.equal(canEditOfficerTask({...selfTask,status:'completed'},'reviewer',true),false);
  assert.equal(canEditOfficerTask({...selfTask,cancelled_at:'2026-10-14'},'reviewer',true),false);
  assert.equal(canEditOfficerTask({...selfTask,status:'submitted'},'officer',true),false);
});
test('Reviewer-ended tasks count as completed without changing the PEET average', () => {
  const result=peetSummary([task('scored'),{...task('ended'),ended_by:'reviewer'}],[evaluation('scored',3,3,3)]);
  assert.equal(result.completed,2);
  assert.equal(result.active,0);
  assert.equal(result.evaluated,1);
  assert.equal(result.score,85);
});

test('Shared tasks belong to all participants, with one evaluation counting in each officer’s totals', () => {
  const {officerTaskPeople,isOfficerTaskParticipant,canEditOfficerTask}=exported;
  const shared={...task('shared'),assigned_to:'creator',created_by:'creator',officer_task_members:[{officer_id:'teammate'},{officer_id:'teammate'}]};
  assert.deepEqual(Array.from(officerTaskPeople(shared)),['creator','teammate']);
  assert.equal(isOfficerTaskParticipant(shared,'teammate'),true);
  assert.equal(isOfficerTaskParticipant(shared,'outsider'),false);
  for(const officer of ['creator','teammate']){
    const result=peetSummary([shared].filter(row=>isOfficerTaskParticipant(row,officer)),[evaluation('shared',3,3,3)]);
    assert.equal(result.completed,1);assert.equal(result.evaluated,1);assert.equal(result.score,85);
  }
  assert.equal(canEditOfficerTask({...shared,status:'in_progress'},'teammate',true),false);
  assert.equal(canEditOfficerTask({...shared,status:'in_progress'},'reviewer',true),true);
  assert.equal(canEditOfficerTask({...shared,status:'in_progress'},'creator'),true);
});

test('Shared contributions have independent completion, scores, and reflection requirements',()=>{
 const shared={...task('collaboration','submitted'),individual_peet:true,assigned_to:'a',officer_task_members:[{officer_id:'b'}],contributions:[{student_id:'a',status:'approved'}]};
 const scores=[{...evaluation('collaboration',4,4,4),officer_id:'a'}];
 assert.equal(peetSummary([shared],scores,'a').score,100);
 assert.equal(peetSummary([shared],scores,'a').completed,1);
 assert.equal(peetSummary([shared],scores,'a').active,0);
 assert.equal(peetSummary([shared],scores,'b').score,null);
 assert.equal(peetSummary([shared],scores,'b').active,1);
 assert.equal(exported.needsTaskContribution(shared,'b'),true);
 assert.equal(exported.needsTaskContribution(shared,'a'),false);
 shared.contributions.push({student_id:'b',status:'pending'});
 assert.equal(exported.needsTaskContribution(shared,'b'),false);
 scores.push({...evaluation('collaboration',2,2,2),officer_id:'b'});
 assert.equal(peetSummary([shared],scores,'b').score,65);
 assert.equal(peetSummary([shared],scores,'a').score,100);
 assert.equal(exported.evaluationForOfficer(scores,'collaboration','b').officer_id,'b');
 assert.equal(exported.evaluationForOfficer(scores,'collaboration'),undefined);
});

test('PEET averages raw ratings before conversion across the breakpoint and retains decimals', () => {
 const { peetPercentage } = exported;
 for (const [rating, percent] of [[1,45],[2,65],[2.5,75],[3,85],[3.2,88],[3.5,92.5],[3.7,95.5],[4,100]]) {
  assert.equal(peetPercentage(rating), percent);
 }
 // Averaging converted scores would produce 82.5; converting the raw average gives 85.
 assert.equal(peetSummary([task('a'),task('b')],[evaluation('a',2,2,2),evaluation('b',4,4,4)]).score,85);
 assert.ok(Math.abs(peetSummary([task('a')],[evaluation('a',3.1,3.2,3.3)]).score-88)<1e-10);
});
