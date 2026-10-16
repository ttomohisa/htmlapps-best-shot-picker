// Build/source contract; behavioral transitions are exercised in quality.browser.cjs.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('quality source is embedded once between grouping and app, with build validation',()=>{
 const html=fs.readFileSync(path.join(root,'src/index.template.html'),'utf8'),build=fs.readFileSync(path.join(root,'build-standalone.ps1'),'utf8');
 assert.equal(html.split('__BEST_SHOT_QUALITY_JS__').length-1,1);
 assert(html.indexOf('__BEST_SHOT_GROUPING_JS__')<html.indexOf('__BEST_SHOT_QUALITY_JS__'));
 assert(html.indexOf('__BEST_SHOT_QUALITY_JS__')<html.indexOf('__BEST_SHOT_APP_JS__'));
 assert.match(build,/src\/quality\.js/);assert.match(build,/qualitySource -match/);
});
test('quality disclosure and comparison containers exist without replacing canonical header',()=>{
 const html=fs.readFileSync(path.join(root,'src/index.template.html'),'utf8');
 for(const id of ['qualitySummary','qualityA','qualityB','qualityPreview']) assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/\.photo-quality\{display:grid/);assert.match(html,/\.preview-quality\{[^}]*max-height:19dvh;overflow-y:auto/);assert.match(html,/id="qualityPreview"[^>]*tabindex="0"[^>]*data-i18n-aria-label="qualityTitle"/);assert.match(html,/data-i18n="helpQuality"/);assert.match(html,/class="brand-mark"/);
 assert.match(html,/data-i18n="localBadge">完全ローカル処理/);
});
