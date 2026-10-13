// node --test tests/builders.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('lib/builders.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(source, { exports: exportsObject });
const { builderProgress, builderError } = exportsObject;
test('Builder milestones advance at exactly 10, 30, 60, and 100 points', () => {
  for (const [points, tier, next] of [
    [0, undefined, 'Starter'], [9, undefined, 'Starter'], [10, 'Starter', 'Builder'],
    [29, 'Starter', 'Builder'], [30, 'Builder', 'Innovator'], [59, 'Builder', 'Innovator'],
    [60, 'Innovator', 'GEA Builder'], [99, 'Innovator', 'GEA Builder'],
    [100, 'GEA Builder', undefined], [150, 'GEA Builder', undefined],
  ]) {
    const progress = builderProgress(points);
    assert.equal(progress.tier?.name, tier);
    assert.equal(progress.next?.name, next);
    assert.ok(progress.percent >= 0 && progress.percent <= 100);
  }
});
test('Missing schema is explained without exposing database details', () => {
  for (const code of ['42P01','42883','PGRST202','PGRST205']) {
    assert.match(builderError({code, message:'private database detail'}), /not ready/);
  }
  assert.equal(builderError({code:'P0001',message:'This project has already been reviewed.'}), 'This project has already been reviewed.');
  assert.doesNotMatch(builderError({code:'XX000',message:'private database detail'}), /private database detail/);
});
