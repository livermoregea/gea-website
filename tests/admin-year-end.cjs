const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, ...globals });
  return exports;
}
const exporter = load('lib/application-export.ts');
const archive = { id: 'archive', created_at: '2026-10-13', application_count: 1, applications: [{ id: 'app', name: '<script>alert(1)</script>', why_apply: 'Hello, "team"\nNext line', school_email: '=HYPERLINK("evil")', booked_slot_id: 'slot' }], interview_slots: [{ id: 'slot', label: 'Lunch', slot_time: '2026-10-14' }] };
test('CSV preserves quoted multiline answers, slots, and neutralizes spreadsheet formulas', () => {
  const csv = exporter.applicationsCsv(exporter.archiveRows(archive));
  assert.ok(csv.includes('"Hello, ""team""\nNext line"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""evil"")"'));
  assert.ok(csv.includes('"Lunch"'));
});
test('PDF print document escapes applicant HTML and includes full answers and slots', () => {
  const html = exporter.archivePrintHtml(archive);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('Next line'));
  assert.ok(html.includes('Lunch'));
});
function notifications() {
  const items = new Map();
  let events = 0;
  const window = { localStorage: { getItem: key => items.get(key), setItem: (key, value) => items.set(key, value) }, dispatchEvent: () => { events++; } };
  return { api: load('lib/admin-notifications.ts', { window, Event: class {} }), events: () => events };
}
test('Bulk clear preserves seen items, clears every kind, and leaves future notifications unread', () => {
  const { api, events } = notifications();
  api.markAdminNotificationSeen('students', 'old');
  const ids = { applications: ['a'], students: ['s'], 'profile-changes': ['p'], builders: ['b'], 'forum-questions': ['q'], 'forum-answers': ['r'] };
  api.markAllAdminNotificationsSeen(ids);
  for (const [kind, values] of Object.entries(ids)) assert.equal(api.getUnreadAdminNotificationCount(kind, values), 0);
  assert.equal(api.isAdminNotificationSeen('students', 'old'), true);
  assert.equal(api.getUnreadAdminNotificationCount('applications', ['a', 'new']), 1);
  assert.equal(events(), 2);
});
test('Notification loading fetches more than 1000 IDs and fails before clearing on query errors', async () => {
  const { api } = notifications();
  function client(fail = false) { return { from: table => {
    let start;
    const query = { select() { return this; }, order() { return this; }, range(offset) { start = offset; return this; }, eq() { return this; }, then(resolve) {
      const length = table === 'applications' ? (start === 0 ? 1000 : 3) : 0;
      resolve({ data: Array.from({ length }, (_, i) => ({ id: `${start + i}` })), error: fail ? { message: 'failed' } : null });
    } }; return query;
  } }; }
  const result = await api.loadAdminNotificationIds(client());
  assert.equal(result.applications.length, 1003);
  await assert.rejects(api.loadAdminNotificationIds(client(true)), /Could not load all notifications/);
});
