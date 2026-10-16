const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('optional similarity UI is separately invoked and describes deliberate application in both languages',()=>{
 const html=fs.readFileSync('src/index.template.html','utf8'),app=fs.readFileSync('src/app.js','utf8');
 for(const id of ['similarityTools','findSimilarButton','cancelSimilarityButton','similarityResults','similarityStatus','similarityMeter'])assert(html.includes('id="'+id+'"'));
 assert(html.includes('__BEST_SHOT_SIMILARITY_JS__'));assert(html.includes('__BEST_SHOT_EMBEDDING_CLIENT_JS__'));assert(html.includes('data-i18n="helpSimilarity"'));
 assert(app.includes('async function findSimilarPhotos('));assert(app.includes('function invalidateSimilarity('));assert(app.includes('Similarity.apply('));
 for(const text of ['Find similar-photo candidates','似た写真の候補を探す','Apply this grouping','この組み合わせを適用'])assert(app.includes(text));
 assert(!/real.phone|実機|検証未実施/.test(app.match(/helpSimilarity:[^\n]+/g)?.join('\n')||''));
});

const appSource=()=>fs.readFileSync('src/app.js','utf8');
const functionSource=name=>{
 const source=appSource().match(new RegExp('  (?:async )?function '+name+'\\([^]*?\\n  }'));
 assert(source,`Missing ${name}`);return source[0];
};
test('scope chooser is a labelled native dialog with an independently scrolling list and reachable actions',()=>{
 const html=fs.readFileSync('src/index.template.html','utf8');
 assert.match(html,/<dialog id="similarityScopeDialog"[^>]*aria-labelledby="similarityScopeTitle"[^>]*aria-describedby="similarityScopeHint"/);
 for(const id of ['chooseSimilarityGroupsButton','similarityScopeSummary','similarityScopeList','similarityScopeCount','cancelSimilarityScopeButton','searchSimilarityScopeButton'])assert(html.includes('id="'+id+'"'),id);
 assert.match(html,/#similarityScopeDialog\[open\][^{]*\{[^}]*display:\s*flex/);
 assert.match(html,/\.similarity-scope-body[^}]*overflow:\s*auto/);
 assert.match(html,/\.similarity-scope-footer[^}]*flex:\s*0 0 auto/);
 assert.match(html,/id="similarityScopeCount"[^>]*aria-live="polite"/);
});
test('large sets route to the chooser without selecting or starting an automatic batch',()=>{
 const find=functionSource('findSimilarPhotos'),open=functionSource('openSimilarityScope');
 assert.match(find,/reason==='photo-limit'[^]*openSimilarityScope/);
 assert.match(open,/photoCount<=Similarity\.CONFIG\.maxPhotos[^]*eligibleGroupIds[^]*:\[\]/);
 assert(!open.includes('EmbeddingWorkerClient'));assert(!open.includes('findSimilarPhotos('));
 assert(!/\.slice\(0,\s*36\)/.test(appSource()));
 assert.match(functionSource('renderSimilarity'),/eligibility\.reason!=='photo-limit'/);
});
test('scope draft is separate from committed scope and Search passes whole selected groups to both eligibility and proposals',()=>{
 const app=appSource(),commit=functionSource('searchSimilarityScope'),find=functionSource('findSimilarPhotos');
 assert.match(app,/similarityScope:null, similarityScopeDraft:null/);
 assert.match(commit,/Similarity\.eligibility\(state\.groups,ready\(\)\.map\(p=>p\.id\),state\.similarityScopeDraft\.groupIds\)/);
 assert.match(commit,/if\(!eligibility\.ok\)return/);
 assert.match(commit,/state\.similarityScope=\[\.\.\.eligibility\.eligibleGroupIds\]/);
 assert.match(find,/Similarity\.eligibility\(state\.groups,ready\(\)\.map\(p=>p\.id\),state\.similarityScope\?\?undefined\)/);
 assert.match(find,/Similarity\.propose\(state\.groups,records,\{groupIds:job\.scopeGroupIds\}\)/);
 assert.match(functionSource('renderSimilarityScope'),/group\.ids\.length>Similarity\.CONFIG\.maxPhotos/);
});
test('scope dismissal restores focus, preserves committed scope, and lifecycle invalidation clears scope',()=>{
 const close=functionSource('closeSimilarityScope'),invalidate=functionSource('invalidateSimilarity'),app=appSource();
 assert.match(close,/state\.similarityScopeDraft=null/);assert(!close.includes('state.similarityScope='));
 assert.match(close,/focus\(\{preventScroll:true\}\)/);
 assert.match(app,/similarityScopeDialog'\)\.addEventListener\('cancel',event=>\{event\.preventDefault\(\);closeSimilarityScope\(\);/);
 assert.match(invalidate,/if\(!preserveScope\)state\.similarityScope=null/);
 assert.match(invalidate,/closeSimilarityScope\(/);
 for(const name of ['addFiles','analyzePhotos','editGroup','resetSession'])assert.match(app,new RegExp('function '+name+'\\([^]*?invalidateSimilarity\\('));
 assert(!functionSource('selectPhoto').includes('invalidateSimilarity'));
 assert.match(app,/pagehide',\(\)=>invalidateSimilarity\(''\)/);
 assert.match(functionSource('openSimilarityScope'),/invalidateSimilarity\('',\{preserveScope:true\}\)/);
});

// Execute the actual UI handlers with a tiny DOM fixture; browser tests cover native
// dialog focus trapping, backdrop hit-testing and measured viewport geometry.
const vm=require('node:vm'),Similarity=require('../src/similarity.js');
const group=(id,count,flags={})=>({id,ids:Array.from({length:count},(_,i)=>`${id}-p${i}`),manual:false,reviewed:false,pending:false,...flags});
function scopeHarness(groups,{scope=null,job=null,proposals=[]}={}){
 const nodes=new Map(),calls={searches:[],renders:0};
 function node(tag='div'){
  return {tag,children:[],dataset:{},listeners:{},open:false,disabled:false,isConnected:true,focusCount:0,
   append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},addEventListener(type,handler){this.listeners[type]=handler;},focus(){this.focusCount++;},showModal(){this.open=true;},close(){this.open=false;}};
 }
 const $=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
 const photos=groups.flatMap(g=>g.ids.map(id=>({id,name:`${id}.jpg`,thumbnailUrl:`blob:${id}`,kept:true})));
 const state={groups,photos,load:null,analysis:null,generation:2,inputRevision:3,groupingRevision:4,similarity:job,similarityProposals:proposals,similarityScope:scope,similarityScopeDraft:null};
 const context={state,Similarity,$,ready:()=>photos,byId:id=>photos.find(p=>p.id===id),translate:key=>key,clearTimeout,
  el:(tag,className,text)=>Object.assign(node(tag),{className,textContent:text}),renderSimilarity:()=>calls.renders++,findSimilarPhotos:()=>calls.searches.push([...state.similarityScope])};
 const names=['invalidateSimilarity','closeSimilarityScope','openSimilarityScope','renderSimilarityScope','renderSimilarityScopeCount','searchSimilarityScope'];
 const handlers=vm.runInNewContext(names.map(functionSource).join('\n')+'\n({'+names.join(',')+'})',context);
 return {state,photos,$,calls,...handlers,checkbox:id=>$('#similarityScopeList').children.find(row=>row.children[0].dataset.groupId===id)?.children[0],toggle(id,checked){const box=this.checkbox(id);assert(box&&!box.disabled);box.checked=checked;box.listeners.change();}};
}
test('large chooser starts empty, hides protected groups and explains indivisible oversized groups',()=>{
 const h=scopeHarness([group('oversized',37),group('a',18),group('b',18),group('manual',1,{manual:true}),group('reviewed',1,{reviewed:true}),group('pending',1,{pending:true})]);
 h.openSimilarityScope();
 assert(h.$('#similarityScopeDialog').open);assert.equal(h.$('#similarityScopeList').children.length,3);
 assert(h.checkbox('oversized').disabled);assert(h.$('#similarityScopeList').children[0].children[2].children.some(child=>child.textContent==='similarityScopeTooLarge'));
 assert(h.$('#similarityScopeList').children.every(row=>!row.children[0].checked));assert(h.$('#searchSimilarityScopeButton').disabled);
 assert.equal(h.state.similarityScope,null);assert.equal(h.calls.searches.length,0);
});
test('whole-group draft enforces two groups and 36 photos, and only Search commits canonical selection',()=>{
 const h=scopeHarness([group('a',18),group('b',18),group('c',1)]),before=JSON.stringify([h.state.groups,h.photos]);
 h.openSimilarityScope();h.toggle('b',true);assert(h.$('#searchSimilarityScopeButton').disabled);
 h.toggle('a',true);assert.equal(h.$('#searchSimilarityScopeButton').disabled,false);assert.match(h.$('#similarityScopeCount').textContent,/2 .*36 \/ 36/);
 h.toggle('c',true);assert(h.$('#searchSimilarityScopeButton').disabled);h.searchSimilarityScope();assert.equal(h.calls.searches.length,0);
 h.toggle('c',false);assert.equal(h.state.similarityScope,null);h.searchSimilarityScope();
 assert.deepEqual(Array.from(h.state.similarityScope),['a','b']);assert.equal(h.calls.searches.length,1);assert.equal(h.$('#similarityScopeDialog').open,false);
 assert.equal(JSON.stringify([h.state.groups,h.photos]),before);assert.equal(h.state.similarityScopeDraft,null);
});
test('opening the chooser cancels stale work while cancelling a draft preserves committed scope and restores focus',()=>{
 let aborted=0,disposed=0;
 const h=scopeHarness([group('a',18),group('b',18),group('c',1)],{scope:['a','b'],job:{controller:{abort(){aborted++;}},client:{dispose(){disposed++;}}},proposals:[{id:'old'}]});
 const opener=h.$('#findSimilarButton');h.openSimilarityScope(opener);
 assert.equal(aborted,1);assert.equal(disposed,1);assert.equal(h.state.similarity,null);assert.equal(h.state.similarityProposals.length,0);
 h.toggle('c',true);h.closeSimilarityScope();assert.deepEqual(h.state.similarityScope,['a','b']);assert.equal(h.state.similarityScopeDraft,null);
 assert.equal(opener.focusCount,1);assert.equal(h.calls.searches.length,0);
});
test('input or grouping invalidation clears committed and draft scopes and rejects stale draft submission',()=>{
 const h=scopeHarness([group('a',2),group('b',2)],{scope:['a','b']});h.openSimilarityScope();h.invalidateSimilarity();
 assert.equal(h.state.similarityScope,null);assert.equal(h.state.similarityScopeDraft,null);assert.equal(h.$('#similarityScopeDialog').open,false);
 h.openSimilarityScope();h.state.inputRevision++;h.searchSimilarityScope();assert.equal(h.calls.searches.length,0);assert.equal(h.state.similarityScopeDraft,null);assert.equal(h.$('#similarityScopeDialog').open,false);
});
test('small eligible sessions may preselect every whole group without invoking inference on open',()=>{
 const h=scopeHarness([group('a',2),group('b',2)]);h.openSimilarityScope();
 assert(h.checkbox('a').checked&&h.checkbox('b').checked);assert.equal(h.$('#searchSimilarityScopeButton').disabled,false);
 assert.equal(h.calls.searches.length,0);assert.equal(h.state.similarityScope,null);h.closeSimilarityScope();assert.equal(h.calls.searches.length,0);
});
