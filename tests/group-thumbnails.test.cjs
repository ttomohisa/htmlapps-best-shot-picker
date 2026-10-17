'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/app.js'),'utf8');
function extract(name){const match=source.match(new RegExp('  function '+name+'\\([^]*?\\n  \\}'));assert(match,`Actual ${name} function exists`);return match[0];}
function harness(photos,candidateId=null){
 const index=new Map(photos.map(p=>[p.id,p])),state={qualityResults:new Map([['g',{candidateId}]]),groupFilter:'g'};
 const context={state,byId:id=>index.get(id),groupLabel:g=>`Group ${g.id} · ${g.ids.length} photos`,setTextIfChanged:(n,t)=>{if(n.textContent!==t)n.textContent=t;},setAttributeIfChanged:(n,k,v)=>{v=String(v);if(n.getAttribute(k)!==v)n.setAttribute(k,v);}};
 const api=vm.runInNewContext(['groupRepresentative','updateGroupChip'].map(extract).join('\n')+'\n({groupRepresentative,updateGroupChip})',context);
 return {...api,state,index};
}
const photo=(id,extra={})=>({id,thumbnailUrl:`blob:thumb-${id}`,kept:false,file:{name:`${id}.png`},...extra});
const group={id:'g',ids:['a','b'],reviewed:false};
test('The current technical candidate represents its group without changing Keep, members or originals',()=>{
 const photos=[photo('a'),photo('b')],h=harness(photos,'b'),before=JSON.stringify({photos,group}),file=photos[1].file;
 assert.equal(h.groupRepresentative(group),photos[1]);assert.equal(JSON.stringify({photos,group}),before);assert.equal(photos[1].file,file);
});
test('Without a candidate, the first available thumbnail is the representative, regardless of Keep',()=>{
 const photos=[photo('a'),photo('b',{kept:true})],h=harness(photos);
 assert.equal(h.groupRepresentative(group),photos[0]);h.state.qualityResults.clear();assert.equal(h.groupRepresentative(group),photos[0]);
});
test('A stale candidate outside the current group cannot represent it',()=>{
 const photos=[photo('a'),photo('b'),photo('outside')],h=harness(photos,'outside');
 assert.equal(h.groupRepresentative(group),photos[0]);assert.equal(h.groupRepresentative({...group,ids:['b']}),photos[1]);
});
test('Missing records and missing thumbnails fall back without creating new image resources',()=>{
 const photos=[photo('a',{thumbnailUrl:''}),photo('b')],h=harness(photos,'a');
 assert.equal(h.groupRepresentative({...group,ids:['missing','a','b']}),photos[1]);
 assert.equal(h.groupRepresentative({...group,ids:['missing','a']}),null);assert.equal(h.groupRepresentative({...group,ids:[]}),null);
});
test('Representatives follow current membership after editing and Undo',()=>{
 const photos=[photo('a'),photo('b')],h=harness(photos,'b');
 assert.equal(h.groupRepresentative(group).id,'b');assert.equal(h.groupRepresentative({...group,ids:['a']}).id,'a');assert.equal(h.groupRepresentative(group).id,'b');
});
function chip(){
 const attributes=new Map(),image={hidden:false,attributes:new Map(),writes:0,getAttribute(k){return this.attributes.get(k)??null;},setAttribute(k,v){this.attributes.set(k,String(v));this.writes++;},removeAttribute(k){this.attributes.delete(k);}},label={textContent:''},classes=new Set();
 return {image,label,classList:{contains:k=>classes.has(k),toggle:(k,on)=>on?classes.add(k):classes.delete(k)},querySelector:s=>s==='img'?image:label,getAttribute:k=>attributes.get(k)??null,setAttribute:(k,v)=>attributes.set(k,String(v))};
}
test('Chip updates retain thumbnail and label nodes and avoid redundant source writes',()=>{
 const photos=[photo('a'),photo('b')],h=harness(photos),button=chip(),{image,label}=button;
 h.updateGroupChip(button,group);assert.equal(image.getAttribute('src'),'blob:thumb-a');assert.equal(label.textContent,'Group g · 2 photos');assert.equal(button.getAttribute('aria-pressed'),'true');
 const writes=image.writes;h.updateGroupChip(button,group);assert.equal(image.writes,writes);assert.equal(button.image,image);assert.equal(button.label,label);
 h.state.qualityResults.set('g',{candidateId:'b'});h.updateGroupChip(button,group);assert.equal(image.getAttribute('src'),'blob:thumb-b');
 h.state.groupFilter='';h.updateGroupChip(button,group);assert.equal(button.getAttribute('aria-pressed'),'false');
});
test('A group with no remaining thumbnail clears the prior source rather than showing a stale photo',()=>{
 const h=harness([photo('a')]),button=chip();h.updateGroupChip(button,group);h.index.clear();h.updateGroupChip(button,group);
 assert.equal(button.image.hidden,true);assert.equal(button.image.getAttribute('src'),null);
});
