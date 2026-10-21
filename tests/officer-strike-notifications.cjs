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
function harness(admin = false) {
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
 const props = { mode: 'accountability', profile, profiles: [profile], officerId: profile.id, data: { events: [], attendance: [], signups: [], volunteerLogs: [], generalNotes: [], reviews: [], strikes: [{ id: 'legacy', officer_id: profile.id, academic_year: '2026-2027', category: 'attendance', status: 'notified', incident_date: '2026-10-01', reason: 'Unexcused absence', notified_at: '2026-10-01', response_due_at: '2099-01-01' }] } };
 return { render() { cursor = 0; return exports.default(props); } };
}
test('Officers see strike notifications without response controls, including legacy pending records', () => {
 const tree = harness().render();
 assert.equal(nodes(tree, n => n.type === 'button').length, 0);
 assert.ok(nodes(tree, n => n.type === 'p' && n.props.children === 'Strikes take effect when recorded. This history serves as your notification.').length);
 assert.equal(JSON.stringify(tree).includes('Response opportunity until'), false);
});
test('Recording a strike has no response deadline and explains immediate effect', () => {
 const h = harness(true); let tree = h.render();
 nodes(tree, n => n.type === 'button' && n.props.children === 'Log conduct strike')[0].props.onClick();
 tree = h.render();
 assert.equal(nodes(tree, n => n.type === 'input' && n.props.name === 'deadline').length, 0);
 assert.ok(nodes(tree, n => n.type === 'p' && n.props.children === 'The strike appears in the officer’s portal as a notification. No response is required or accepted.').length);
});
