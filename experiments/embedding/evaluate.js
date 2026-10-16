/* Offline research metrics only. Never used by the photo-selection application. */
(function(root) {
  'use strict';
  const THRESHOLDS = Object.freeze([0.999, 0.995, 0.99, 0.98, 0.97, 0.95, 0.9, 0.85]);
  const pairKey = (a, b) => [a, b].sort().join('|');
  function partition(samples, match) {
    const groups = [];
    for (const sample of [...samples].sort((a, b) => a.id.localeCompare(b.id))) {
      const destination = groups.find(group => group.every(other => match(sample, other)));
      if (destination) destination.push(sample); else groups.push([sample]);
    }
    return groups;
  }
  function metrics(samples, groups) {
    const membership = new Map(groups.flatMap((group, index) => group.map(sample => [sample.id, index])));
    let positivePairs = 0, recoveredPairs = 0, negativePairs = 0, falseJoinedPairs = 0;
    for (let a = 0; a < samples.length; a++) for (let b = a + 1; b < samples.length; b++) {
      const same = samples[a].scene === samples[b].scene;
      const joined = membership.get(samples[a].id) === membership.get(samples[b].id);
      if (same) { positivePairs++; if (joined) recoveredPairs++; }
      else { negativePairs++; if (joined) falseJoinedPairs++; }
    }
    const falseGroups = groups.filter(group => new Set(group.map(sample => sample.scene)).size > 1).length;
    const n = groups.length, p = n ? falseGroups / n : 0, z = 1.96, denominator = 1 + z*z/n;
    const centre = (p + z*z/(2*n)) / denominator;
    const margin = z * Math.sqrt(p*(1-p)/n + z*z/(4*n*n)) / denominator;
    return {photos:samples.length, expectedScenes:new Set(samples.map(s => s.scene)).size,
      groups:n, falseGroups, falseGroupRate:p, descriptiveWilson95:n ? [Math.max(0,centre-margin),Math.min(1,centre+margin)] : null,
      uncertaintyNote:'Descriptive approximation only: independent predicted groups are not established. Not a population confidence bound or release-gate proof.',
      positivePairs,recoveredPairs,recall:positivePairs ? recoveredPairs/positivePairs : null,
      negativePairs,falseJoinedPairs, partitions:groups.map(group=>group.map(sample=>sample.id))};
  }
  function evaluate(samples, pairs) {
    if (!Array.isArray(samples)||!Array.isArray(pairs)||!samples.length) throw new TypeError('Expected labeled samples and complete pairs');
    const ids=new Set(samples.map(sample=>sample.id));
    if(ids.size!==samples.length||samples.some(sample=>typeof sample.id!=='string'||!sample.id||sample.id.includes('|')||typeof sample.scene!=='string'||!sample.scene||!['development','holdout'].includes(sample.split)))throw new TypeError('Invalid sample labels');
    for(const scene of new Set(samples.map(sample=>sample.scene)))if(new Set(samples.filter(sample=>sample.scene===scene).map(sample=>sample.split)).size!==1)throw new TypeError('Scene leakage between splits');
    if(!samples.some(sample=>sample.split==='development')||!samples.some(sample=>sample.split==='holdout'))throw new TypeError('Both splits required');
    if(pairs.length!==samples.length*(samples.length-1)/2||pairs.some(pair=>!ids.has(pair.a)||!ids.has(pair.b)||pair.a===pair.b||!Number.isFinite(pair.cosine)||pair.cosine < -1.00001||pair.cosine > 1.00001||typeof pair.baseline?.match!=='boolean'||typeof pair.visualGuard!=='boolean'))throw new TypeError('Invalid pair evidence');
    if(new Set(pairs.map(pair=>pairKey(pair.a,pair.b))).size!==pairs.length)throw new TypeError('Duplicate pair evidence');
    const lookup = new Map(pairs.map(pair => [pairKey(pair.a,pair.b),pair]));
    const baseline = (a,b) => lookup.get(pairKey(a.id,b.id)).baseline.match;
    const predicate = (strategy, threshold) => (a,b) => {
      const pair = lookup.get(pairKey(a.id,b.id));
      if (strategy === 'baseline') return pair.baseline.match;
      if (strategy === 'cosine-only') return pair.cosine >= threshold;
      return pair.baseline.match || (pair.cosine >= threshold && pair.visualGuard);
    };
    const subsets = Object.fromEntries(['development','holdout'].map(split=>[split,samples.filter(s=>s.split===split)]));
    const result = {protocol:'Scene-disjoint development/holdout pilot. Only development labels select thresholds; no product threshold changes.',
      thresholdGrid:THRESHOLDS, visualGuard:'aspect relative difference <= 0.025; dHash <= 12; mean RGB distance <= 48; both luma deviation >= 12',
      baseline:Object.fromEntries(Object.entries(subsets).map(([split,subset])=>[split,metrics(subset,partition(subset,baseline))])), strategies:{}};
    for (const strategy of ['cosine-only','guarded-hybrid']) {
      const candidates = THRESHOLDS.map(threshold=>({threshold,metrics:metrics(subsets.development,partition(subsets.development,predicate(strategy,threshold)))}));
      const eligible = candidates.filter(candidate=>candidate.metrics.falseGroups===0).sort((a,b)=>(b.metrics.recall??0)-(a.metrics.recall??0)||b.threshold-a.threshold);
      const chosen = eligible[0];
      result.strategies[strategy] = {developmentCandidates:candidates, selectedThreshold:chosen?.threshold??null,
        development:chosen?.metrics??null,holdout:chosen ? metrics(subsets.holdout,partition(subsets.holdout,predicate(strategy,chosen.threshold))) : null};
    }
    return result;
  }
  const api = Object.freeze({THRESHOLDS,pairKey,partition,metrics,evaluate});
  if (typeof module==='object'&&module.exports) module.exports=api;
  if (root) root.EmbeddingPilotEvaluation=api;
})(typeof window!=='undefined'?window:null);
