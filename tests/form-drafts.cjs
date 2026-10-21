const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

class Field {
  constructor(name, value, readOnly = false) { Object.assign(this, { name, value, readOnly }); }
}
function mount(storage, fields, key) {
  const exports = {};
  const effects = [];
  const form = { elements: fields };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/use-form-draft.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, localStorage: storage, HTMLInputElement: Field, HTMLTextAreaElement: Field, HTMLSelectElement: Field,
    require: () => ({ useRef: () => ({ current: form }), useState: initial => [initial, () => {}], useEffect: effect => effects.push(effect) }),
  });
  const draft = exports.useFormDraft(key);
  effects.forEach(effect => effect());
  return draft;
}
function storage() {
  const rows = new Map();
  return { getItem: key => rows.get(key) || null, setItem: (key, value) => rows.set(key, value), removeItem: key => rows.delete(key) };
}
test('browser drafts restore extensive text and invalid links after remount, isolated by officer and task', () => {
  const store = storage();
  const explanation = 'Long explanation\n'.repeat(200);
  const key = 'gea:submission:officer-one:task-one';
  const draft = mount(store, [new Field('description', explanation), new Field('url', 'invalid link')], key);
  draft.persist();
  const restored = [new Field('description', ''), new Field('url', '')];
  mount(store, restored, key);
  assert.equal(restored[0].value, explanation);
  assert.equal(restored[1].value, 'invalid link');
  const other = [new Field('description', '')];
  mount(store, other, 'gea:submission:officer-two:task-one');
  assert.equal(other[0].value, '');
  assert.ok(store.getItem(key)); // Failed requests never call clear.
  draft.clear();
  assert.equal(store.getItem(key), null);
});
test('stored drafts do not replace a read-only shared link and storage failure retains on-screen text', () => {
  const store = storage();
  store.setItem('draft', JSON.stringify({ url: 'https://example.com/stale' }));
  const link = new Field('url', 'https://example.com/shared', true);
  mount(store, [link], 'draft');
  assert.equal(link.value, 'https://example.com/shared');
  const explanation = new Field('description', 'Still on screen');
  const broken = { getItem() { throw new Error('storage disabled'); }, setItem() { throw new Error('quota'); }, removeItem() {} };
  const draft = mount(broken, [explanation], 'draft');
  assert.doesNotThrow(() => draft.persist());
  assert.equal(explanation.value, 'Still on screen');
});
