const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const G=require('../src/grouping.js');
const modulePath=path.join(__dirname,'../src/similarity.js');
const similarity=()=>require(modulePath);
function group(id,ids=[id],flags={}){return{id:`g-${id}`,ids,manual:false,reviewed:false,...flags};}
function vector(angle=0){const values=Array(256).fill(0);values[0]=Math.cos(angle);values[1]=Math.sin(angle);return values;}
function record(id,{color=100,hash='aaaaaaaaaaaaaaaa',aspect=1,deviation=30,embedding=vector()}={}){return{id,features:{version:G.CONFIG.version,hash,rgb:Array(216).fill(color),aspect,deviation},embedding};}
function freeze(value){if(value&&typeof value==='object'&&!ArrayBuffer.isView(value)){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;}

test('publishes the frozen conservative configuration in CommonJS and browser APIs',()=>{
 assert(fs.existsSync(modulePath),'The staged similarity core must exist');
 const S=similarity();assert(Object.isFrozen(S));assert(Object.isFrozen(S.CONFIG));
 assert.equal(S.CONFIG.cosineThreshold,0.85);assert.equal(S.CONFIG.hashDistance,12);assert.equal(S.CONFIG.rgbDistance,48);assert.equal(S.CONFIG.aspectDelta,0.025);assert.equal(S.CONFIG.minLumaDeviation,12);assert.equal(S.CONFIG.maxPhotos,36);assert.equal(S.CONFIG.embeddingDimensions,256);
 const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(modulePath,'utf8'),sandbox);assert.equal(sandbox.window.BestShotSimilarity.CONFIG.cosineThreshold,0.85);
});

test('eligibility excludes manual, reviewed and pending groups without mutating or partially selecting them',()=>{
 const groups=freeze([group('a',['a','b']),group('c'),group('manual',['m'],{manual:true}),group('reviewed',['r'],{reviewed:true}),group('pending',['p'],{pending:true})]);
 const before=structuredClone(groups),S=similarity();assert.equal(typeof S.eligibility,'function');
 const result=S.eligibility(groups);assert.deepEqual(result,{ok:true,reason:null,eligibleGroupIds:['g-a','g-c'],photoIds:['a','b','c'],photoCount:3,groupCount:2,limit:36});
 const partial=S.eligibility(groups,['a','c','m','r','p']);assert.equal(partial.ok,false);assert.equal(partial.reason,'too-few-groups');assert.deepEqual(partial.photoIds,['c']);
 assert.deepEqual(S.eligibility(groups,new Set(['a','b','c'])),result);assert.deepEqual(groups,before);
});

test('the optional 36-photo cap blocks the whole run instead of truncating eligible groups',async()=>{
 const S=similarity(),groups=Array.from({length:37},(_,i)=>group(`p${i}`));assert.equal(typeof S.eligibility,'function');
 const result=S.eligibility(groups);assert.equal(result.ok,false);assert.equal(result.reason,'photo-limit');assert.equal(result.photoCount,37);assert.equal(result.photoIds.length,37);
 const boundary=S.eligibility(groups.slice(0,36));assert.equal(boundary.ok,true);
 assert.equal(S.eligibility([group('many',groups.flatMap(g=>g.ids))]).reason,'photo-limit');
 const normal=await G.groupPhotos(groups.map(g=>record(g.ids[0])));assert.equal(normal.flatMap(g=>g.ids).length,37);
 const locked=groups.map(g=>({...g,manual:true}));assert.equal(S.eligibility([...locked,group('x'),group('y')]).ok,true);
 assert.equal(S.eligibility([]).reason,'too-few-groups');assert.equal(S.eligibility([group('a',['a','b'])]).reason,'too-few-groups');
});

test('malformed partitions are blocked before eligibility or fingerprinting',()=>{
 const S=similarity();assert.equal(typeof S.eligibility,'function');
 const invalid=[undefined,null,{},[null],[group('a',[])],[group('a',['a','a'])],[group('a'),group('a',['b'])],[group('a'),group('b',['a'])],Array(2),[group('a',Array(1))],[group('a',[1])],[{...group('a'),id:''}],[group('a',['a'],{manual:'false'})],[group('a',['a'],{reviewed:null})]];
 for(const groups of invalid){const result=S.eligibility(groups);assert.equal(result.ok,false);assert.equal(result.reason,'invalid-groups');}
 for(const ids of [null,{},['a','a'],[1],Array(1)])assert.equal(S.eligibility([group('a'),group('b')],ids).reason,'invalid-photo-ids');
});

test('proposals stage disjoint whole-group merges in stable order without touching original objects',()=>{
 const S=similarity();assert.equal(typeof S.propose,'function');
 const groups=freeze([group('a',['a','a2']),group('b'),group('c'),group('d'),group('locked',['locked'],{manual:true})]);
 const records=['a','a2','b','c','d','locked'].map(id=>record(id,{color:['c','d'].includes(id)?200:100}));
 for(const item of records)for(const key of ['file','kept'])Object.defineProperty(item,key,{get(){throw new Error(`Must not access ${key}`);}});
 freeze(records);const before=structuredClone(groups),result=S.propose(groups,records);
 assert.equal(result.ok,true);assert.equal(result.reason,null);assert.deepEqual(result.proposals.map(p=>p.groupIds),[['g-a','g-b'],['g-c','g-d']]);assert.deepEqual(result.proposals.map(p=>p.photoIds),[['a','a2','b'],['c','d']]);
 assert.deepEqual(S.propose(groups,[...records].reverse()),result);assert.deepEqual(groups,before);
 for(const proposal of result.proposals){assert.equal(typeof proposal.id,'string');assert.equal(typeof proposal.fingerprint,'string');assert(Object.isFrozen(proposal));assert(Object.isFrozen(proposal.groupIds));assert(Object.isFrozen(proposal.photoIds));}
});

test('complete-link rejects transitive bridges and checks all members inside existing groups',()=>{
 const S=similarity();assert.equal(typeof S.propose,'function');
 const records=[record('a',{embedding:vector(0)}),record('b',{embedding:vector(.4)}),record('c',{embedding:vector(.8)})];
 assert.deepEqual(S.propose([group('a'),group('b'),group('c')],records).proposals.map(p=>p.photoIds),[['a','b']]);
 assert.deepEqual(S.propose([group('a',['a','c']),group('b')],records).proposals,[]);
 const whole=[record('a',{embedding:vector(0)}),record('b',{embedding:vector(.1)}),record('c',{embedding:vector(.5)}),record('d',{embedding:vector(.8)})];
 assert.deepEqual(S.propose([group('ab',['a','b']),group('cd',['c','d'])],whole).proposals,[]);
});

test('every guarded cosine condition is required with inclusive frozen numeric boundaries',()=>{
 const S=similarity();assert.equal(typeof S.propose,'function');const groups=[group('a'),group('b')];
 const accepted=(a,b)=>S.propose(groups,[a,b]).proposals.length;
 const a=record('a',{hash:'0000000000000000',deviation:12});
 assert.equal(accepted(a,record('b',{hash:'0000000000000fff',color:148,aspect:1.025,deviation:12,embedding:vector(Math.acos(.85))})),1);
 for(const options of [{hash:'0000000000001fff'},{color:148.00001},{aspect:1.02501},{deviation:11.9999},{embedding:vector(Math.acos(.849999))}])assert.equal(accepted(a,record('b',{hash:'0000000000000000',...options})),0,JSON.stringify(options));
 const b=record('b',{hash:'0000000000000000',embedding:new Float64Array(vector().map(value=>value*2))});assert.equal(accepted(a,b),1);
 b.embedding=new Float32Array(vector());assert.equal(accepted(a,b),1);
 // Exact duplicate labels and matching embeddings cannot bypass a visual guard.
 const flat=record('a',{deviation:0}),other=record('b',{deviation:0});flat.duplicateSetId=other.duplicateSetId='exact';assert.equal(accepted(flat,other),0);
});

test('malformed, sparse, missing and duplicate evidence abstains instead of producing partial groups',()=>{
 const S=similarity();assert.equal(typeof S.propose,'function');const groups=[group('a'),group('b')],a=record('a');
 const badFeatures=[null,{},...['',null,1,'0'.repeat(15),'g'.repeat(16)].map(hash=>({...a.features,hash})),...['unknown',null,undefined].map(version=>({...a.features,version})),...[null,[],Array(216),new Float32Array(216),Array(216).fill('100')].map(rgb=>({...a.features,rgb})),...[NaN,Infinity,-1,256].map(value=>{const rgb=[...a.features.rgb];rgb[25]=value;return{...a.features,rgb};}),...[0,-1,Infinity,NaN,'1'].map(aspect=>({...a.features,aspect})),...[-1,NaN,Infinity,128,'30',undefined].map(deviation=>({...a.features,deviation}))];
 for(const features of badFeatures)for(const records of [[a,{...record('b'),features}],[{...record('a'),features},record('b')]])assert.deepEqual(S.propose(groups,records).proposals,[]);
 const sparse=vector();delete sparse[10];
 const malformed=[undefined,null,[],Array(256),sparse,vector().slice(0,255),[...vector(),0],new Uint8Array(256),Array(256).fill(0),Array(256).fill('1'),Array(256).fill(Infinity),Array(256).fill(NaN),Array(256).fill(1e308),{length:256}];
 for(const embedding of malformed)assert.deepEqual(S.propose(groups,[a,{...record('b'),embedding}]).proposals,[]);
 for(const records of [undefined,null,{},[],[a],Array(2),[a,null],[a,record('b'),record('b')]])assert.deepEqual(S.propose(groups,records).proposals,[]);
 assert.deepEqual(S.propose([group('a',['a','b']),group('c')],[a,record('c')]).proposals,[]);
});

test('a bad group does not prevent an independent fully evidenced proposal or bypass the cap',()=>{
 const S=similarity();assert.equal(typeof S.propose,'function');
 const groups=[group('bad',['bad','missing']),group('a'),group('b')],records=[record('bad'),record('a'),record('b')];
 assert.deepEqual(S.propose(groups,records).proposals.map(p=>p.photoIds),[['a','b']]);
 const many=Array.from({length:37},(_,i)=>group(`p${i}`));const blocked=S.propose(many,many.map(g=>record(g.ids[0])));assert.equal(blocked.reason,'photo-limit');assert.deepEqual(blocked.proposals,[]);
 const locked=[group('a'),group('b',['b'],{reviewed:true}),group('c',['c'],{pending:true}),group('d',['d'],{manual:true})];assert.equal(S.propose(locked,locked.map(g=>record(g.ids[0]))).reason,'too-few-groups');
});

test('apply changes only the explicitly selected proposal and produces an existing-group Undo patch',()=>{
 const S=similarity();assert.equal(typeof S.apply,'function');
 const groups=freeze([group('a',['a','a2']),group('unrelated'),group('b'),group('c'),group('d')]);
 const records=freeze(groups.flatMap(g=>g.ids).map(id=>record(id,{color:['c','d'].includes(id)?200:id==='unrelated'?255:100})));
 const proposals=S.propose(groups,records).proposals;assert.equal(proposals.length,2);const before=structuredClone({groups,records});
 const edit=S.apply(groups,proposals[0]);assert.deepEqual(edit.groups.map(g=>g.ids),[['a','a2','b'],['unrelated'],['c'],['d']]);
 assert.equal(edit.groups[0].id,'g-a');assert.equal(edit.groups[0].manual,true);assert.equal(edit.groups[0].reviewed,false);assert.equal(edit.groups[0].pending,false);
 for(const id of ['g-unrelated','g-c','g-d'])assert.deepEqual(edit.groups.find(g=>g.id===id),groups.find(g=>g.id===id));
 assert.deepEqual(edit.patch.order,groups.map(g=>g.id));assert.deepEqual(edit.patch.before,[groups[0],groups[2]]);assert.deepEqual(edit.patch.afterIds,['g-a','g-b']);assert.deepEqual(edit.patch.members,['a','a2','b']);
 assert.deepEqual(G.undoEdit(edit.groups,edit.patch),groups);G.validate(edit.groups,groups.flatMap(g=>g.ids));assert.deepEqual({groups,records},before);
 // Every proposal belongs to the original snapshot; a second apply needs a new search.
 assert.throws(()=>S.apply(edit.groups,proposals[1]),/stale/i);assert.throws(()=>S.apply(edit.groups,proposals[0]),/stale/i);
});

test('any changed group partition or review/manual/pending state makes an old proposal stale',()=>{
 const S=similarity();assert.equal(typeof S.apply,'function');
 const groups=[group('a',['a','a2']),group('b'),group('unrelated',['u'],{manual:true})],proposal=S.propose(groups,['a','a2','b'].map(id=>record(id))).proposals[0];
 const changes=[current=>current.push(group('later')),current=>current.pop(),current=>current.reverse(),current=>current[0].ids.reverse(),current=>current[0].ids.push('new'),current=>current[0].id='renamed',current=>{current[0].manual=true;},current=>{current[0].reviewed=true;},current=>{current[0].pending=true;},current=>{current[2].reviewed=true;},current=>{current[1].ids[0]='replaced';}];
 for(const change of changes){const current=structuredClone(groups);change(current);const before=structuredClone(current);assert.throws(()=>S.apply(current,proposal),/stale/i);assert.deepEqual(current,before);}
 assert.deepEqual(S.apply(structuredClone(groups),structuredClone(proposal)).groups[0].ids,['a','a2','b']);
});

test('apply rejects malformed, partial, duplicate and ineligible group selections',()=>{
 const S=similarity();assert.equal(typeof S.apply,'function');
 const groups=[group('a',['a','a2']),group('b'),group('locked',['locked'],{manual:true})],proposal=S.propose(groups,['a','a2','b'].map(id=>record(id))).proposals[0];
 const invalid=[undefined,null,[],{},[proposal],{...proposal,version:'other'},{...proposal,groupIds:['g-a']},{...proposal,groupIds:['g-a','g-a']},{...proposal,groupIds:['g-a','missing']},{...proposal,groupIds:['g-a','g-locked'],photoIds:['a','a2','locked']},{...proposal,groupIds:['g-b','g-a'],photoIds:['b','a','a2']},{...proposal,photoIds:['a','b']},{...proposal,photoIds:['a','a2','b','b']},{...proposal,photoIds:['b','a2','a']},{...proposal,groupIds:Array(2)},{...proposal,photoIds:Array(3)}];
 for(const value of invalid)assert.throws(()=>S.apply(groups,value),/invalid|eligible|proposal/i);
 assert.throws(()=>S.apply([group('a'),group('a')],proposal),/invalid/i);
});

test('proposal Undo retains later photos, unrelated edits and the full partition',async()=>{
 const S=similarity();assert.equal(typeof S.apply,'function');
 const groups=[group('a'),group('unrelated',['u']),group('b')],records=[record('a'),record('u',{color:220}),record('b')];
 const edit=S.apply(groups,S.propose(groups,records).proposals[0]);
 const imported=await G.groupPhotos([...records,record('later',{color:220})],{previousGroups:edit.groups});
 const reviewed=G.editGroups(imported,{type:'review',sourceId:'g-unrelated'}).groups;
 const undone=G.undoEdit(reviewed,edit.patch);assert.deepEqual(undone.map(g=>g.ids),[['a'],['u','later'],['b']]);assert.equal(undone[1].reviewed,true);G.validate(undone,['a','b','u','later']);
 const newMember=edit.groups.map(g=>({...g,ids:g.id==='g-a'?[...g.ids,'moved-later']:[...g.ids]}));
 const withNewMember=G.undoEdit(newMember,edit.patch);G.validate(withNewMember,['a','b','u','moved-later']);assert(withNewMember.some(g=>g.ids.includes('moved-later')));assert.deepEqual(withNewMember.find(g=>g.id==='g-a').ids,['a']);
});

test('apply rejects a copied proposal expanded to another otherwise eligible whole group',()=>{
 const S=similarity(),groups=[group('a'),group('b'),group('c')],records=[record('a'),record('b'),record('c',{color:200})];
 const proposal=S.propose(groups,records).proposals[0];
 assert.throws(()=>S.apply(groups,{...proposal,groupIds:['g-a','g-b','g-c'],photoIds:['a','b','c']}),/invalid/i);
});

test('very large existing groups return a cap reason without spread-argument overflow',()=>{
 const ids=Array.from({length:150000},(_,i)=>`large-${i}`),result=similarity().eligibility([group('large',ids),group('other')]);
 assert.equal(result.ok,false);assert.equal(result.reason,'photo-limit');assert.equal(result.photoCount,150001);
});
