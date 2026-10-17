const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const ts=require('typescript');
const api={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/officer-workspace-navigation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:api,URLSearchParams});
test('Old inbox and task links land in the matching section of the unified workspace',()=>{
 for(const staff of [false,true]){
  const base=staff?'/admin-portal-x7k9/officers':'/officerboard';
  assert.equal(api.legacyPlanningHref(staff,{view:'inbox'}),base+'?view=overview');
  assert.equal(api.legacyPlanningHref(staff,{view:'blockers',task:'task-123'}),base+'?view=tasks&task=task-123');
  assert.equal(api.legacyPlanningHref(staff,{view:'meetings',event:'meeting-123'}),base+'?view=meetings&event=meeting-123');
 }
});
test('Task and private-response deep links open officer records; unknown views return to Overview',()=>{
 assert.equal(api.workspaceView(undefined,'task-123'),'tasks');
 assert.equal(api.workspaceView(undefined,undefined,'accountability'),'people');
 assert.equal(api.workspaceView('unknown'),'overview');
 assert.equal(api.workspaceView('reports'),'reports');
 assert.equal(api.workspaceView('today'),'overview');
});

test('Dashboard record links choose the requested officer and section only for reviewers',()=>{
 const params=new URLSearchParams('view=tasks&officer=other&topic=attendance');
 assert.equal(api.officerRecordTarget(params,'me',true,['me','other']).officerId,'other');
 assert.equal(api.officerRecordTarget(params,'me',true,['me','other']).topic,'attendance');
 assert.equal(api.officerRecordTarget(params,'me',false,['me','other']).officerId,'me');
 assert.equal(api.officerRecordTarget(params,'me',true,['me']),null);
 assert.equal(api.officerRecordTarget(new URLSearchParams('topic=unknown'),'me',true,['me']),null);
 assert.equal(api.officerRecordTarget(new URLSearchParams('topic=volunteer'),'me',true,['me']).officerId,'all');
 assert.equal(api.officerRecordTarget(new URLSearchParams('topic=accountability'),'me',true,['me']).officerId,'me');
 assert.equal(api.workspaceView(undefined,undefined,'attendance'),'attendance');
 assert.equal(api.legacyPlanningHref(true,{view:'tasks',officer:'other',topic:'attendance'}),'/admin-portal-x7k9/officers?view=people&topic=attendance&officer=other');
});

test('Direct workspace destinations and old per-officer links preserve their intended scope',()=>{
 for(const view of ['tasks','people','attendance','volunteer','accounts'])assert.equal(api.workspaceView(view),view);
 assert.equal(api.workspaceView('tasks',undefined,'attendance'),'attendance');
 assert.equal(api.workspaceView('tasks',undefined,'attendance','officer-a'),'people');
 assert.equal(api.workspaceView(undefined,undefined,'volunteer'),'volunteer');
 assert.equal(api.workspaceView(undefined,undefined,'overview','officer-a'),'people');
});
