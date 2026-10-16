const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('optional similarity UI is separately invoked and describes deliberate application in both languages',()=>{
 const html=fs.readFileSync('src/index.template.html','utf8'),app=fs.readFileSync('src/app.js','utf8');
 for(const id of ['similarityTools','findSimilarButton','cancelSimilarityButton','similarityResults','similarityStatus','similarityMeter'])assert(html.includes('id="'+id+'"'));
 assert(html.includes('__BEST_SHOT_SIMILARITY_JS__'));assert(html.includes('__BEST_SHOT_EMBEDDING_CLIENT_JS__'));assert(html.includes('data-i18n="helpSimilarity"'));
 assert(app.includes('async function findSimilarPhotos('));assert(app.includes('function invalidateSimilarity('));assert(app.includes('Similarity.apply('));
 for(const text of ['Find similar-photo candidates','似た写真の候補を探す','Apply this grouping','この組み合わせを適用'])assert(app.includes(text));
 assert(!/real.phone|実機|検証未実施/.test(app.match(/helpSimilarity:[^\n]+/g)?.join('\n')||''));
});
