// node --test tests/builders-drafts.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path, modules, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => {
    assert.ok(name in modules, `Unexpected import: ${name}`);
    return modules[name];
  }, ...globals });
  return exports;
}
const helpers = load('lib/builder-drafts.ts', {});
const builders = load('lib/builders.ts', {});
const styles = load('components/builders/styles.ts', {});

function harness(submissions = [], rpcError = null) {
  const state = [];
  let cursor = 0;
  let effects = [];
  let cleanups = [];
  const events = new Map();
  const rpcCalls = [];
  class Fields {
    constructor(form) { this.values = form.values; }
    get(key) { return this.values[key] ?? null; }
    has(key) { return key in this.values; }
  }
  const { default: Builders } = load('components/builders/Builders.tsx', {
    'react/jsx-runtime': require('react/jsx-runtime'),
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
      },
      useRef: () => ({ current: null }),
      useEffect: callback => { effects.push(callback); },
    },
    'next/link': { default: () => null },
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    '@/components/builders/styles': styles,
    '@/lib/builders': builders,
    '@/lib/builder-drafts': helpers,
    '@/lib/supabase/client': { createClient: () => ({ rpc: async (name, args) => {
      rpcCalls.push({ name, args }); return { error: rpcError };
    } }) },
  }, {
    FormData: Fields,
    window: { addEventListener: (name, fn) => events.set(name, fn), removeEventListener: (name, fn) => { if (events.get(name) === fn) events.delete(name); } },
    document: { addEventListener() {}, removeEventListener: (name, fn) => { if (events.get(name) === fn) events.delete(name); } },
  });
  const props = { stories: [], submissions, student: { id: 'student-a', name: 'Alex' }, signedIn: true, ready: true, initialView: 'submit' };
  return {
    render() { for (const cleanup of cleanups) cleanup(); cursor = 0; effects = []; const tree = Builders(props); cleanups = effects.map(effect => effect()).filter(cleanup => typeof cleanup === "function"); return tree; },
    events, rpcCalls,
  };
}
function elements(tree, predicate) {
  const result = [];
  function walk(node) {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object' || !node.props) return;
    if (predicate(node)) result.push(node);
    walk(node.props.children);
  }
  walk(tree); return result;
}
const form = tree => elements(tree, node => node.type === 'form')[0];
const button = (tree, text) => elements(tree, node => node.type === 'button' && node.props.children === text)[0];
const input = (tree, name) => elements(tree, node => node.props.name === name)[0];
const typed = { title: '  Drawer organizer  ', location: 'community', problem: 'Shared tools get lost.\nSecond line.', build: 'A divided reused box', skills: 'Measurement', team: 'Solo', evidence: 'https://drive.google.com/file/d/test/view', optOut: 'on' };
function checkRestored(tree, values) {
  for (const name of ['title','location','problem','build','skills','team','evidence']) assert.equal(input(tree, name).props.defaultValue, values[name]);
  assert.equal(input(tree, 'optOut').props.defaultChecked, 'optOut' in values);
}

test('Every submission field and sharing choice survive switching Builders sections', () => {
  const h = harness();
  let tree = h.render();
  form(tree).props.onChange({ currentTarget: { values: typed } });
  tree = h.render();
  button(tree, 'Find your next build').props.onClick();
  tree = h.render(); assert.equal(form(tree), undefined);
  button(tree, 'Submit a build').props.onClick();
  tree = h.render(); checkRestored(tree, typed);
  let prevented = false;
  h.events.get('beforeunload')({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true, 'Leaving a dirty draft warns before reload or close');
});

test('New-build and revision drafts remain separate, including after canceling a revision', () => {
  const revision = { id: 'revision-a', status: 'needs_changes', title: 'Original title', location: 'home', problem: 'p', build: 'b', skills: 's', team: 'Solo', evidence_url: typed.evidence, wall_opt_out: false, points: 0, officer_note: 'Test it.' };
  const h = harness([revision]);
  let tree = h.render(); form(tree).props.onChange({ currentTarget: { values: typed } });
  tree = h.render(); button(tree, 'My progress').props.onClick();
  tree = h.render(); button(tree, 'Revise and resubmit').props.onClick();
  tree = h.render(); assert.equal(input(tree, 'title').props.defaultValue, revision.title);
  const revised = { ...typed, title: 'Improved revision' }; delete revised.optOut;
  form(tree).props.onChange({ currentTarget: { values: revised } });
  tree = h.render(); button(tree, 'Cancel revision').props.onClick();
  tree = h.render(); checkRestored(tree, typed);
  button(tree, 'My progress').props.onClick();
  tree = h.render(); button(tree, 'Revise and resubmit').props.onClick();
  tree = h.render(); checkRestored(tree, revised);
});

test('Failed submission keeps the draft; successful submission clears the submitted draft', async () => {
  for (const failure of [{ code: 'P0001', message: 'Try again.' }, null]) {
    const h = harness([], failure);
    let tree = h.render(); form(tree).props.onChange({ currentTarget: { values: typed } });
    tree = h.render();
    await form(tree).props.onSubmit({ preventDefault() {}, currentTarget: { values: typed } });
    tree = h.render(); button(tree, 'Submit a build').props.onClick();
    tree = h.render();
    if (failure) checkRestored(tree, typed);
    else assert.equal(input(tree, 'title').props.defaultValue, '');
    assert.equal(h.events.has('beforeunload'), Boolean(failure), 'Unload warning clears only after successful submission');
    assert.equal(h.rpcCalls[0].args.p_title, typed.title.trim());
  }
});
