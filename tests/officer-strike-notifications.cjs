const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');
function nodes(tree, predicate) {
 const result = [];
 function walk(node) { if (Array.isArray(node)) return node.forEach(walk); if (!node?.props) return; if (predicate(node)) result.push(node); walk(node.props.children); }
 walk(tree); return result;
}
function harness(admin = false, status = 'notified', responded = false, deadline = '2099-01-01') {
 let cursor = 0; const state = [];
 const deps = {
  'react/jsx-runtime': jsx,
  react: { useState(initial) { const key = cursor++; if (!(key in state)) state[key] = initial; return [state[key], value => state[key] = value]; }, useTransition: () => [false, fn => fn()] },
  'next/navigation': { useRouter: () => ({ refresh() {} }) },
  '@/lib/discord-notifications':{dispatchDiscordNotifications(){}},'@/lib/supabase/client': { createClient: () => ({}) },
  '@/lib/peet': { peetError: String },
  '@/lib/officer-tracking': { CONTRACT_YEAR: '2026-2027', trackingSummary: () => ({ attendanceStrikes: 1, conductStrikes: 0 }), schoolDate: String },
  './officerboard.module.css': { default: {} },
 };
 for (const name of ['@/components/WorkspaceActivity', '@/components/ActionError', './Modal', './OfficerEventFields', './EventParticipation']) deps[name] = { default: name };
 const exports = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/officerboard/TrackingPanel.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => { assert.ok(name in deps, name); return deps[name]; }, Intl, Date });
 const profile = { id: 'officer', name: 'Officer', role: admin ? 'admin' : 'officer' };
 const props = { mode: 'accountability', profile, profiles: [profile], officerId: profile.id, data: { events: [], attendance: [], signups: [], volunteerLogs: [], generalNotes: [], reviews: [], strikes: [{ id: 'legacy', officer_id: profile.id, academic_year: '2026-2027', category: 'attendance', status, responded_at: responded ? '2026-10-02' : null, officer_response: responded ? 'An emergency came up.' : '', incident_date: '2026-10-01', reason: 'Unexcused absence', notified_at: '2026-10-01', response_due_at: deadline }] } };
 return { render() { cursor = 0; return exports.default(props); } };
}
test('Unanswered active incidents offer an explanation form with context', () => {
 for (const status of ['notified']) {
  const h = harness(false, status); let tree = h.render();
  const button = nodes(tree, n => n.type === 'button' && JSON.stringify(n.props.children).includes('Explain your circumstances'))[0];
  assert.ok(button); button.props.onClick(); tree = h.render();
  const field = nodes(tree, n => n.type === 'textarea' && n.props.name === 'response')[0];
  assert.equal(field.props.required, true); assert.equal(field.props.minLength, 10);
  assert.equal(field.props.maxLength, 10000);
 }
});
test('Responses remain editable while an incident is active and resolved records close the form', () => {
 assert.ok(nodes(harness(false, 'notified', true).render(), n => n.type === 'button' && JSON.stringify(n.props.children).includes('Update explanation')).length);
 for (const status of ['revoked', 'dismissed', 'confirmed']) assert.equal(nodes(harness(false, status).render(), n => n.type === 'button').length, 0);
});
test('Reviewers see response status and the officer explanation alongside their review control', () => {
 const tree = harness(true, 'confirmed', true).render();
 assert.match(JSON.stringify(tree), /Explanation submitted/);
 assert.match(JSON.stringify(tree), /An emergency came up/);
});
test('Recording a strike explains the website and Discord response request', () => {
 const h = harness(true); let tree = h.render();
 nodes(tree, n => n.type === 'button' && n.props.children === 'Log conduct strike')[0].props.onClick(); tree = h.render();
 assert.match(JSON.stringify(tree), /private Discord form/);
 assert.equal(JSON.stringify(tree).includes('No response is required or accepted'), false);
});

test('The website shows the deadline and closes expired response controls before the scheduler runs', () => {
 const tree = harness(false, 'notified', false, '2000-01-01').render();
 assert.match(JSON.stringify(tree), /Respond by:/); assert.match(JSON.stringify(tree), /Response window ended/);
 assert.equal(nodes(tree, n => n.type === 'button').length, 0);
});
