const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, modules = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => {
    assert.ok(name in modules, `Unexpected module ${name}`);
    return modules[name];
  }});
  return exports;
}
const management = load('lib/account-management.ts');
const accounts = [
  { userId: 'student', name: 'Student Leader', email: 'student@lvjusd.org', kind: 'student', classYear: 2028 },
  { userId: 'teacher', name: 'Teacher Advisor', email: 'teacher@lvjusd.org', kind: 'teacher' },
  { userId: 'student', name: 'Student Leader', email: 'student@lvjusd.org', kind: 'officer', position: 'Treasurer' },
  { userId: 'teacher', name: 'Teacher Advisor', email: 'teacher@lvjusd.org', kind: 'officer', reviewerKind: 'advisor', position: 'Academy Advisor' },
  { userId: 'other', name: 'Student Leader', email: 'other@lvjusd.org', kind: 'student' },
];
function render(query = '', actorId = 'teacher', filter = 'all') {
  let index = 0;
  const Panel = load('components/officerboard/AccountsPanel.tsx', {
    react: { useState(initial) { const at = index++; return [at === 0 ? { accounts, authAccounts: [] } : at === 1 ? false : at === 5 ? query : at === 10 ? filter : initial, () => {}]; }, useEffect() {}, useCallback: fn => fn },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    '@/components/ActionError': { default: () => null },
    '@/lib/account-management': management,
    './Modal': { default: () => null },
    './officerboard.module.css': { default: {} },
  }).default;
  return renderToStaticMarkup(React.createElement(Panel, { actorId }));
}
test('Every account has one card, with all memberships and profile controls retained', () => {
  const html = render();
  const cards = html.match(/<article\b[^>]*>[\s\S]*?<\/article>/g);
  assert.equal(cards.length, 3);
  assert.match(cards[0], /Student<\/span>.*Officer<\/span>/);
  assert.match(cards[0], /Class of 2028 · Treasurer/);
  assert.match(cards[0], /Edit student profile/);
  assert.match(cards[0], /Edit officer access/);
  assert.match(cards[0], /Remove student access/);
  assert.match(cards[1], /Teacher<\/span>.*Academy Advisor<\/span>/);
  assert.match(cards[1], /Edit teacher profile/);
  assert.doesNotMatch(cards[1], /Remove teacher access/);
});
test('Searching any role or position retains the entire person card', () => {
  for (const query of ['treasurer', 'OFFICER', ' student@lvjusd.org ']) {
    const html = render(query);
    assert.equal((html.match(/<article\b/g) || []).length, query === 'OFFICER' ? 2 : 1);
    assert.match(html, /Class of 2028 · Treasurer/);
    assert.match(html, /Edit student profile/);
    assert.match(html, /Edit officer access/);
  }
  assert.match(render('academy advisor'), /Edit teacher profile/);
});
test('Role filters separate leadership from regular students and work with search', () => {
  const leadership = render('', 'teacher', 'leadership');
  assert.equal((leadership.match(/<article\b/g) || []).length, 2);
  assert.match(leadership, /Class of 2028 · Treasurer/);
  assert.match(leadership, /Teacher Advisor/);
  assert.doesNotMatch(leadership, /other@lvjusd.org/);
  assert.match(leadership, /aria-pressed="true">Officers &amp; advisors \(2\)/);
  const students = render('', 'teacher', 'students');
  assert.equal((students.match(/<article\b/g) || []).length, 1);
  assert.match(students, /other@lvjusd.org/);
  assert.doesNotMatch(students, /Treasurer|Teacher Advisor/);
  assert.match(students, /aria-pressed="true">Regular students \(1\)/);
  assert.match(render('treasurer', 'teacher', 'students'), /No matching GEA One accounts/);
  assert.equal((render('treasurer', 'teacher', 'leadership').match(/<article\b/g) || []).length, 1);
});
