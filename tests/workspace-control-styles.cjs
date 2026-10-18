const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const postcss = require('postcss');
const selectors = require('postcss-selector-parser');

// Evaluate the selectors and cascade that affect workspace controls. This catches
// the reported regression where a later generic button rule won over navigation.
const stylesheet = postcss.parse(fs.readFileSync('components/operations/operations.module.css', 'utf8'));
const element = (tag, classes, parent, attrs = {}) => ({ tag, classes: new Set(classes), parent, attrs });
function matches(selector, element) {
  const groups = [[]], combinators = [];
  for (const node of selector.nodes) {
    if (node.type === 'combinator') { combinators.push(node.value.trim() || ' '); groups.push([]); }
    else groups.at(-1).push(node);
  }
  function compound(nodes, el) {
    return el && nodes.every(node => {
      if (node.type === 'universal') return true;
      if (node.type === 'tag') return node.value === el.tag;
      if (node.type === 'class') return el.classes.has(node.value);
      if (node.type === 'attribute') return node.operator ? el.attrs[node.attribute] === node.value : node.attribute in el.attrs;
      if (node.type === 'pseudo') {
        if ([':is', ':where', ':not'].includes(node.value)) {
          const any = node.nodes.some(inner => matches(inner, el));
          return node.value === ':not' ? !any : any;
        }
        if (node.value === ':disabled') return 'disabled' in el.attrs;
        return false; // No pointer/focus/structural state in these fixtures.
      }
      throw new Error(`Unhandled selector ${node.type}: ${node}`);
    });
  }
  function at(index, el) {
    if (!compound(groups[index], el)) return false;
    if (!index) return true;
    if (combinators[index - 1] === '>') return at(index - 1, el.parent);
    assert.equal(combinators[index - 1], ' ');
    for (let parent = el.parent; parent; parent = parent.parent) if (at(index - 1, parent)) return true;
    return false;
  }
  return Boolean(at(groups.length - 1, element));
}
function specificity(selector) {
  const total = [0, 0, 0], add = value => value.forEach((n, i) => total[i] += n);
  for (const node of selector.nodes) {
    if (node.type === 'id') total[0]++;
    if (node.type === 'class' || node.type === 'attribute') total[1]++;
    if (node.type === 'tag') total[2]++;
    if (node.type === 'pseudo' && node.value !== ':where') {
      if ([':is', ':not', ':has'].includes(node.value)) add(node.nodes.map(specificity).sort(compare).at(-1));
      else total[node.value.startsWith('::') ? 2 : 1]++;
    }
  }
  return total;
}
function compare(a, b) { return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; }
function styles(element, width, root = stylesheet) {
  const winners = new Map();
  root.walkRules(rule => {
    for (let parent = rule.parent; parent && parent !== root; parent = parent.parent) {
      if (parent.type !== 'atrule') continue;
      if (parent.name !== 'media') return;
      if (/print|forced-colors|prefers-/.test(parent.params)) return;
      const constraints = [...parent.params.matchAll(/(min|max)-width:\s*(\d+)px/g)];
      if (constraints.some(([, side, n]) => side === 'min' ? width < Number(n) : width > Number(n))) return;
    }
    selectors().astSync(rule.selector).each(selector => {
      if (!matches(selector, element)) return;
      const weight = specificity(selector);
      rule.walkDecls(decl => {
        const old = winners.get(decl.prop);
        if (!old || Number(decl.important) > Number(old.important) || Boolean(decl.important) === Boolean(old.important) && compare(weight, old.weight) >= 0)
          winners.set(decl.prop, { weight, important: decl.important, value: decl.value });
      });
    });
  });
  return Object.fromEntries([...winners].map(([name, entry]) => [name, entry.value]));
}
for (const width of [320, 390, 768, 1440]) {
  test(`Section navigation stays unboxed and touch sized at ${width}px`, () => {
    const hub = element('div', ['hub']);
    const nav = element('nav', ['nav'], hub);
    for (const active of [false, true]) for (const disabled of [false, true]) {
      const button = element('button', [], nav, { 'aria-pressed': String(active), ...(disabled ? { disabled: '' } : {}) });
      const computed = styles(button, width);
      assert.equal(computed.border, '0');
      assert.equal(computed['border-radius'], '0');
      assert.equal(computed.background, 'transparent');
      assert.ok(parseInt(computed['min-height']) >= 44);
      if (active) assert.equal(computed['border-bottom-color'], 'var(--workspace-accent)');
    }
  });
}
test('Save buttons retain prominence and planning styles do not leak into officer records', () => {
  const hub = element('div', ['hub']);
  const action = element('button', ['primary'], element('form', [], hub));
  const computed = styles(action, 390);
  assert.equal(computed.background, 'var(--workspace-accent)');
  assert.equal(computed.color, '#fff');
  assert.ok(parseInt(computed['min-height']) >= 44);
  const recordAction = element('button', ['secondary'], element('div', ['officerTools'], hub));
  const recordStyles = styles(recordAction, 1440);
  assert.equal(recordStyles.background, undefined);
  assert.equal(recordStyles.border, undefined);
});
for (const width of [320, 390, 760]) {
  test(`Phone workspace uses three destinations, a contained More menu, and stacked task actions at ${width}px`, () => {
    const hub = element('div', ['hub']);
    const nav = element('nav', ['nav'], hub);
    const more = element('details', ['moreSections'], nav);
    const menu = element('div', [], more);
    assert.equal(styles(nav, width).display, 'grid');
    assert.equal(styles(nav, width)['grid-template-columns'], 'repeat(3,minmax(0,1fr))');
    assert.equal(styles(element('button', ['desktopDestination'], nav), width).display, 'none');
    assert.equal(styles(element('button', ['mobileDestination'], menu), width).display, 'block');
    assert.equal(styles(menu, width).left, '0');
    assert.equal(styles(menu, width).right, '0');
    assert.equal(styles(element('summary', [], more), width)['min-height'], '48px');
    const row = element('div', ['workRow'], hub);
    assert.equal(styles(row, width).display, 'grid');
    const action = styles(element('a', ['workAction'], row), width);
    assert.equal(action.width, '100%');assert.equal(action['min-height'], '48px');
  });
}
test('Desktop keeps meeting and event tabs visible and hides their mobile duplicates', () => {
  const hub = element('div', ['hub']);const nav = element('nav', ['nav'], hub);
  assert.notEqual(styles(element('button', ['desktopDestination'], nav), 1440).display, 'none');
  const more = element('details', ['moreSections'], nav);
  assert.equal(styles(element('button', ['mobileDestination'], element('div', [], more)), 1440).display, 'none');
});
