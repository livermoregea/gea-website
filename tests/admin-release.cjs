const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function harness(name, client) {
  const state = [], effects = [];
  let cursor = 0, first = true;
  const exports = {};
  const modules = {
    react: {
      useState(value) { const i = cursor++; if (!(i in state)) state[i] = value; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
      useRef(value) { const i = cursor++; return state[i] ||= { current: value }; },
      useId: () => `id-${cursor++}`,
      useEffect(fn) { if (first) effects.push(fn); },
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    '@/components/workspace-controls.module.css': { default: {} },
    '@/lib/supabase/client': { createClient: () => client },
    '@/lib/supabase/config': { hasSupabaseConfig: () => true },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`components/admin/${name}.tsx`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: key => { assert.ok(key in modules, key); return modules[key]; }, Date, Number, Error, crypto: { randomUUID: () => 'token' }, window: { location: { origin: 'https://gea.test' }, confirm: () => true } });
  return {
    render() { cursor = 0; const tree = exports.default(); first = false; return tree; },
    async mount() { this.render(); effects.forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve)); },
  };
}
function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  if (!tree?.props) return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props.children, predicate)];
}
const text = tree => JSON.stringify(tree);
function clientWithLoad(result, insert) {
  return { from() { return { select() { return this; }, order: async () => result, insert }; } };
}
for (const name of ['AdminSlots', 'AdminTeacherInvites']) {
  test(`${name}: database failure is visible rather than silently clearing the queue`, async () => {
    const h = harness(name, clientWithLoad({ data: null, error: { message: 'offline' } }));
    await h.mount();
    assert.match(text(h.render()), /Couldn’t load/);
    assert.doesNotMatch(text(h.render()), /Loading (slots|invites)/);
  });
}
test('Interview slot creation blocks duplicate requests and unlocks after failure without losing input', async () => {
  let reject, writes = 0;
  const h = harness('AdminSlots', clientWithLoad({ data: [], error: null }, () => { writes++; return new Promise((_, fail) => { reject = fail; }); }));
  await h.mount();
  for (const input of nodes(h.render(), n => n.type === 'input')) input.props.onChange({ target: { value: input.props.type === 'datetime-local' ? '2026-11-01T12:00' : 'Lunch interview' } });
  const submit = nodes(h.render(), n => n.type === 'form')[0].props.onSubmit;
  const pending = submit({ preventDefault() {} });
  await submit({ preventDefault() {} });
  assert.equal(writes, 1);
  assert.equal(nodes(h.render(), n => n.type === 'button' && n.props.type === 'submit')[0].props.disabled, true);
  reject(new Error('offline'));
  await pending;
  assert.match(text(h.render()), /Couldn’t add/);
  assert.equal(nodes(h.render(), n => n.type === 'button' && n.props.type === 'submit')[0].props.disabled, false);
  assert.equal(nodes(h.render(), n => n.type === 'input')[0].props.value, 'Lunch interview');
});
