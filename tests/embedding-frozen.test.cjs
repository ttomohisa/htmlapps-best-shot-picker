const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../experiments/embedding/evaluate.js');

function fixture(scenes = ['one', 'one', 'two', 'two']) {
  const samples = scenes.map((scene, i) => ({id:String.fromCharCode(97 + i), scene, split:'external-holdout'}));
  const pairs = [];
  for (let a = 0; a < samples.length; a++) for (let b = a + 1; b < samples.length; b++) {
    pairs.push({a:samples[a].id, b:samples[b].id, baseline:{match:false},
      cosine:samples[a].scene === samples[b].scene ? 0.9 : 0.1, visualGuard:true});
  }
  return {samples, pairs};
}
const evaluate = f => E.evaluateFrozen(f.samples, f.pairs);
const strategyMetrics = (result, name) => result.strategies[name].externalHoldout;
const allMetrics = result => [result.baseline.externalHoldout,
  ...Object.values(result.strategies).map(strategy => strategy.externalHoldout)];

test('frozen protocol pins the prior-pilot threshold and unchanged grouping/guard', () => {
  assert(Object.isFrozen(E.FROZEN_PROTOCOL));
  assert.deepEqual(E.FROZEN_PROTOCOL, {
    id:'tfjs-external-holdout-v1',
    thresholdSource:'experiments/embedding/tfjs-results-2026-10-16.json',
    cosineThreshold:0.85,
    visualGuard:'aspect relative difference <= 0.025; dHash <= 12; mean RGB distance <= 48; both luma deviation >= 12',
    grouping:'complete-link',
    ordering:'lexicographic-id'
  });
  const report = evaluate(fixture());
  assert.deepEqual(report.protocol, E.FROZEN_PROTOCOL);
  assert.equal(report.thresholdSelection, 'none; frozen prior-pilot threshold');
  assert.equal(report.thresholdGrid, undefined);
  for (const strategy of Object.values(report.strategies)) {
    assert.equal(strategy.fixedThreshold, 0.85);
    assert.equal(strategy.developmentCandidates, undefined);
    assert.equal(strategy.selectedThreshold, undefined);
  }
});

test('frozen evaluation reports complete positive/negative pair evidence and both group denominators', () => {
  const report = evaluate(fixture());
  const baseline = report.baseline.externalHoldout;
  assert.equal(baseline.photos, 4);
  assert.equal(baseline.expectedScenes, 2);
  assert.equal(baseline.groups, 4);
  assert.equal(baseline.nonSingletonGroups, 0);
  assert.equal(baseline.singletonGroups, 4);
  assert.equal(baseline.falseGroups, 0);
  assert.equal(baseline.falseGroupRate, 0);
  assert.equal(baseline.falseNonSingletonGroups, 0);
  assert.equal(baseline.falseNonSingletonGroupRate, null);
  assert.equal(baseline.positivePairs, 2);
  assert.equal(baseline.negativePairs, 4);
  assert.equal(baseline.recoveredPairs, 0);
  assert.equal(baseline.recall, 0);
  for (const name of ['cosine-only', 'guarded-hybrid']) {
    const m = strategyMetrics(report, name);
    assert.deepEqual(m.partitions, [['a', 'b'], ['c', 'd']]);
    assert.equal(m.groups, 2);
    assert.equal(m.nonSingletonGroups, 2);
    assert.equal(m.singletonGroups, 0);
    assert.equal(m.falseGroups, 0);
    assert.equal(m.falseNonSingletonGroups, 0);
    assert.equal(m.falseNonSingletonGroupRate, 0);
    assert.equal(m.positivePairs, 2);
    assert.equal(m.negativePairs, 4);
    assert.equal(m.recoveredPairs, 2);
    assert.equal(m.falseJoinedPairs, 0);
    assert.equal(m.recall, 1);
    assert.match(m.uncertaintyNote, /Not a population confidence bound or release-gate proof/);
    assert(m.descriptiveWilson95[1] > 0.01);
  }
});

test('mixed-scene rates retain the non-singleton denominator instead of dilution by singletons', () => {
  const f = fixture(['one', 'two', 'three', 'four']);
  f.pairs[0].cosine = 0.99;
  const report = evaluate(f);
  for (const name of ['cosine-only', 'guarded-hybrid']) {
    const m = strategyMetrics(report, name);
    assert.deepEqual(m.partitions, [['a', 'b'], ['c'], ['d']]);
    assert.equal(m.falseGroups, 1);
    assert.equal(m.groups, 3);
    assert.equal(m.falseGroupRate, 1 / 3);
    assert.equal(m.falseNonSingletonGroups, 1);
    assert.equal(m.nonSingletonGroups, 1);
    assert.equal(m.falseNonSingletonGroupRate, 1);
    assert.equal(m.positivePairs, 0);
    assert.equal(m.negativePairs, 6);
    assert.equal(m.recall, null);
    assert.equal(m.falseJoinedPairs, 1);
  }
});

test('complete-link prevents transitive bridges for every frozen strategy and the baseline', () => {
  const f = fixture(['one', 'one', 'two']);
  for (const pair of f.pairs) {
    const match = E.pairKey(pair.a, pair.b) !== 'a|c';
    pair.baseline.match = match;
    pair.cosine = match ? 0.99 : 0.1;
    pair.visualGuard = true;
  }
  const report = evaluate(f);
  for (const m of allMetrics(report)) {
    assert.deepEqual(m.partitions, [['a', 'b'], ['c']]);
    assert.equal(m.falseGroups, 0);
    assert.equal(m.falseJoinedPairs, 0);
  }
  f.samples.reverse();
  f.pairs.reverse();
  for (const pair of f.pairs) [pair.a, pair.b] = [pair.b, pair.a];
  assert.deepEqual(evaluate(f), report);
});

test('semantically similar distinct scenes remain negative labels and the guard can reject their join', () => {
  const f = fixture(['dog-burst-one', 'dog-burst-one', 'dog-burst-two']);
  for (const pair of f.pairs) {
    pair.cosine = 0.99;
    pair.visualGuard = E.pairKey(pair.a, pair.b) === 'a|b';
  }
  const report = evaluate(f);
  const cosine = strategyMetrics(report, 'cosine-only');
  assert.deepEqual(cosine.partitions, [['a', 'b', 'c']]);
  assert.equal(cosine.positivePairs, 1);
  assert.equal(cosine.negativePairs, 2);
  assert.equal(cosine.falseGroups, 1);
  assert.equal(cosine.falseJoinedPairs, 2);
  const hybrid = strategyMetrics(report, 'guarded-hybrid');
  assert.deepEqual(hybrid.partitions, [['a', 'b'], ['c']]);
  assert.equal(hybrid.recoveredPairs, 1);
  assert.equal(hybrid.falseGroups, 0);
});

test('guarded hybrid preserves baseline OR (frozen cosine AND visual guard) semantics', () => {
  for (const baseline of [false, true]) for (const visualGuard of [false, true]) {
    for (const cosine of [-1, 0.849999, 0.85, 1, 1.000001]) {
      const f = fixture(['one', 'one']);
      Object.assign(f.pairs[0], {baseline:{match:baseline}, visualGuard, cosine});
      const report = evaluate(f);
      assert.equal(report.baseline.externalHoldout.groups, baseline ? 1 : 2);
      assert.equal(strategyMetrics(report, 'cosine-only').groups, cosine >= 0.85 ? 1 : 2);
      assert.equal(strategyMetrics(report, 'guarded-hybrid').groups,
        baseline || (cosine >= 0.85 && visualGuard) ? 1 : 2);
    }
  }
});

test('all-singleton output has no misleading zero non-singleton false-group rate', () => {
  const f = fixture();
  for (const pair of f.pairs) pair.cosine = 0.84;
  const report = evaluate(f);
  for (const m of allMetrics(report)) {
    assert.deepEqual(m.partitions, [['a'], ['b'], ['c'], ['d']]);
    assert.equal(m.groups, 4);
    assert.equal(m.nonSingletonGroups, 0);
    assert.equal(m.falseNonSingletonGroups, 0);
    assert.equal(m.falseNonSingletonGroupRate, null);
    assert.equal(m.positivePairs, 2);
    assert.equal(m.recoveredPairs, 0);
    assert.equal(m.recall, 0);
    assert.equal(m.falseJoinedPairs, 0);
  }
});

test('one sample is valid complete evidence with zero pairs and undefined pair recall', () => {
  const report = evaluate(fixture(['one']));
  for (const m of allMetrics(report)) {
    assert.equal(m.photos, 1);
    assert.equal(m.groups, 1);
    assert.equal(m.positivePairs, 0);
    assert.equal(m.negativePairs, 0);
    assert.equal(m.recall, null);
    assert.equal(m.falseNonSingletonGroupRate, null);
  }
});

test('external labels never tune the frozen threshold or change predictions', () => {
  const f = fixture();
  for (const pair of f.pairs) pair.cosine = 0.86;
  const before = evaluate(f);
  f.samples.forEach((sample, i) => sample.scene = 'distinct-' + i);
  const allNegative = evaluate(f);
  f.samples.forEach(sample => sample.scene = 'one-scene');
  const allPositive = evaluate(f);
  for (const name of ['cosine-only', 'guarded-hybrid']) {
    for (const report of [before, allNegative, allPositive]) {
      assert.equal(report.strategies[name].fixedThreshold, 0.85);
      assert.deepEqual(strategyMetrics(report, name).partitions, [['a', 'b', 'c', 'd']]);
    }
    assert.equal(strategyMetrics(allNegative, name).falseGroups, 1);
    assert.equal(strategyMetrics(allPositive, name).falseGroups, 0);
  }
  for (const pair of f.pairs) pair.cosine = 0.84;
  for (const strategy of Object.values(evaluate(f).strategies)) {
    assert.equal(strategy.fixedThreshold, 0.85);
    assert.equal(strategy.externalHoldout.groups, 4);
  }
});

test('frozen evaluation does not mutate inputs, protocol, or the historical pilot result', () => {
  const f = fixture();
  const snapshot = structuredClone(f);
  f.samples.forEach(Object.freeze);
  f.pairs.forEach(pair => {Object.freeze(pair.baseline); Object.freeze(pair);});
  Object.freeze(f.samples); Object.freeze(f.pairs);
  const protocol = {...E.FROZEN_PROTOCOL};
  const report = E.evaluateFrozen(f.samples, f.pairs, Object.freeze(protocol));
  assert.deepEqual(f, snapshot);
  assert.deepEqual(report.protocol, protocol);
  assert.notEqual(report.protocol, protocol);
  report.protocol.cosineThreshold = 0.1;
  assert.equal(E.FROZEN_PROTOCOL.cosineThreshold, 0.85);
  assert.equal(evaluate(f).strategies['cosine-only'].fixedThreshold, 0.85);
  const prior = require('../experiments/embedding/tfjs-results-2026-10-16.json');
  const samples = require('../experiments/embedding/photo-pilot.json').images;
  assert.deepEqual(E.evaluate(samples, prior.photoPilotPairs), prior.evaluation);
});

test('regression-only replay of prior holdout evidence preserves the original frozen decisions', () => {
  // Relabeling this existing evidence is only a unit regression test, never a
  // newly collected or independent corpus measurement.
  const prior = require('../experiments/embedding/tfjs-results-2026-10-16.json');
  const samples = require('../experiments/embedding/photo-pilot.json').images
    .filter(sample => sample.split === 'holdout').map(sample => ({...sample, split:'external-holdout'}));
  const ids = new Set(samples.map(sample => sample.id));
  const pairs = prior.photoPilotPairs.filter(pair => ids.has(pair.a) && ids.has(pair.b));
  const report = E.evaluateFrozen(samples, pairs);
  const stripNewDenominators = m => {
    const {nonSingletonGroups, singletonGroups, falseNonSingletonGroups, falseNonSingletonGroupRate, ...original} = m;
    return original;
  };
  assert.deepEqual(stripNewDenominators(report.baseline.externalHoldout), prior.evaluation.baseline.holdout);
  for (const name of ['cosine-only', 'guarded-hybrid']) {
    assert.deepEqual(stripNewDenominators(strategyMetrics(report, name)), prior.evaluation.strategies[name].holdout);
  }
});

test('frozen evaluator is exported to the offline browser API without requiring Node', () => {
  const context = vm.createContext({window:{}});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../experiments/embedding/evaluate.js'), 'utf8'), context);
  assert.equal(typeof context.window.EmbeddingPilotEvaluation.evaluateFrozen, 'function');
  assert.equal(context.window.EmbeddingPilotEvaluation.FROZEN_PROTOCOL.cosineThreshold, 0.85);
  const f = fixture();
  const report = context.window.EmbeddingPilotEvaluation.evaluateFrozen(f.samples, f.pairs);
  assert.equal(report.strategies['cosine-only'].externalHoldout.recoveredPairs, 2);
});

const malformedSamples = [
  ['empty samples', f => f.samples = []],
  ['non-array samples', f => f.samples = {}],
  ['null samples', f => f.samples = null],
  ['sparse samples', f => delete f.samples[0]],
  ['null sample', f => f.samples[0] = null],
  ['array sample', f => f.samples[0] = []],
  ['duplicate ID', f => f.samples[0].id = f.samples[1].id],
  ['missing ID', f => delete f.samples[0].id],
  ['numeric ID', f => f.samples[0].id = 1],
  ['empty ID', f => f.samples[0].id = ''],
  ['whitespace ID', f => f.samples[0].id = ' '],
  ['delimiter ID', f => f.samples[0].id = 'a|b'],
  ['empty scene', f => f.samples[0].scene = ''],
  ['whitespace scene', f => f.samples[0].scene = '\t'],
  ['numeric scene', f => f.samples[0].scene = 1],
  ['missing scene', f => delete f.samples[0].scene],
  ['development split', f => f.samples[0].split = 'development'],
  ['old holdout split', f => f.samples[0].split = 'holdout'],
  ['missing split', f => delete f.samples[0].split]
];
for (const [label, modify] of malformedSamples) test('frozen evaluation rejects ' + label, () => {
  const f = fixture(); modify(f);
  assert.throws(() => evaluate(f), TypeError);
});

const malformedPairs = [
  ['non-array pairs', f => f.pairs = {}],
  ['null pairs', f => f.pairs = null],
  ['missing pair', f => f.pairs.pop()],
  ['extra pair', f => f.pairs.push({...f.pairs[0]})],
  ['duplicate pair', f => f.pairs[0] = {...f.pairs[1]}],
  ['reversed duplicate pair', f => f.pairs[0] = {...f.pairs[1], a:f.pairs[1].b, b:f.pairs[1].a}],
  ['sparse pairs', f => delete f.pairs[0]],
  ['null pair', f => f.pairs[0] = null],
  ['array pair', f => f.pairs[0] = []],
  ['unknown ID', f => f.pairs[0].a = 'missing'],
  ['self pair', f => f.pairs[0].a = f.pairs[0].b],
  ['missing pair ID', f => delete f.pairs[0].a],
  ['NaN cosine', f => f.pairs[0].cosine = NaN],
  ['infinite cosine', f => f.pairs[0].cosine = Infinity],
  ['negative infinite cosine', f => f.pairs[0].cosine = -Infinity],
  ['high cosine', f => f.pairs[0].cosine = 1.001],
  ['low cosine', f => f.pairs[0].cosine = -1.001],
  ['numeric-string cosine', f => f.pairs[0].cosine = '0.9'],
  ['missing cosine', f => delete f.pairs[0].cosine],
  ['missing baseline', f => delete f.pairs[0].baseline],
  ['null baseline', f => f.pairs[0].baseline = null],
  ['nonboolean baseline', f => f.pairs[0].baseline.match = 1],
  ['nonboolean guard', f => f.pairs[0].visualGuard = 'true'],
  ['missing guard', f => delete f.pairs[0].visualGuard]
];
for (const [label, modify] of malformedPairs) test('frozen evaluation rejects ' + label, () => {
  const f = fixture(); modify(f);
  assert.throws(() => evaluate(f), TypeError);
});

test('frozen evaluation rejects incompatible protocols rather than silently applying overrides', () => {
  const f = fixture();
  for (const protocol of [null, [], 'frozen', {},
    {...E.FROZEN_PROTOCOL, cosineThreshold:0.84},
    {...E.FROZEN_PROTOCOL, cosineThreshold:0.86},
    {...E.FROZEN_PROTOCOL, cosineThreshold:'0.85'},
    {...E.FROZEN_PROTOCOL, cosineThreshold:NaN},
    {...E.FROZEN_PROTOCOL, thresholdSource:'external-labels'},
    {...E.FROZEN_PROTOCOL, visualGuard:'relaxed'},
    {...E.FROZEN_PROTOCOL, grouping:'single-link'},
    {...E.FROZEN_PROTOCOL, id:'unrecognized'},
    {...E.FROZEN_PROTOCOL, thresholdGrid:[0.8, 0.85, 0.9]}]) {
    assert.throws(() => E.evaluateFrozen(f.samples, f.pairs, protocol), TypeError);
  }
});
test('fixed ID-order predicate evaluation is distinct from input-order application fallback',async()=>{
 const G=require('../src/grouping.js');
 const samples=[['c','two',6],['b','one',3],['a','one',0]].map(([id,scene,rgb])=>({id,scene,split:'external-holdout',captureTime:null,features:{version:G.CONFIG.version,hash:'0'.repeat(16),rgb:Array(216).fill(rgb),aspect:1,deviation:20}}));
 const pairs=[];for(let a=0;a<samples.length;a++)for(let b=a+1;b<samples.length;b++)pairs.push({a:samples[a].id,b:samples[b].id,baseline:G.pairDecision(samples[a],samples[b]),cosine:.1,visualGuard:false});
 const report=E.evaluateFrozen(samples,pairs),app=await G.groupPhotos(samples);
 assert.equal(report.protocol.ordering,'lexicographic-id');
 assert.deepEqual(app.map(g=>g.ids),[['c','b'],['a']]);
 assert.deepEqual(report.baseline.externalHoldout.partitions,[['a','b'],['c']]);
 assert.equal(report.baseline.externalHoldout.falseGroups,0);
 assert.match(report.partitionNote,/not the application's fixture-order partition/);
});
