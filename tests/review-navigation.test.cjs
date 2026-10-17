'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Groups=require('../src/grouping.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/app.js'),'utf8');
function extract(name){const match=source.match(new RegExp('  function '+name+'\\([^]*?\\n  \\}'));assert(match,`Actual ${name} function exists`);return match[0];}
const group=(id,reviewed=false,extra={})=>({id,ids:[id+'-photo'],manual:false,reviewed,...extra});
function harness(groups,current=''){
 const state={groups,groupFilter:current,generation:3,groupingRevision:1,load:null,analysis:null,active:1,analysisMessage:'analysisDone'};
 const nodes=new Map(),calls={render:0,invalidate:0,stop:0};let toast;
 const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'4',append(){},focus(){calls.focus=id;}});return nodes.get(id);};
 const context={state,Groups,$,translate:key=>key,setTextIfChanged:(node,text)=>{node.textContent=text;},render(){calls.render++;},invalidateSimilarity(){calls.invalidate++;},stopAnalysis(){calls.stop++;state.analysis=null;},showToast:(message,options)=>{toast=options;},revealToast(){},Date};
 const api=vm.runInNewContext(['nextUnreviewedGroup','renderReviewNavigation','goToNextUnreviewedGroup','reviewCurrentGroup'].map(extract).join('\n')+'\n({nextUnreviewedGroup,renderReviewNavigation,goToNextUnreviewedGroup,reviewCurrentGroup})',context);
 return{...api,state,calls,$,undo:()=>toast.onAction()};
}
test('Next starts at the first unreviewed group and wraps, excluding the current group',()=>{
 const groups=[group('a',true),group('b'),group('c')],h=harness(groups);
 assert.equal(h.nextUnreviewedGroup(groups,'')?.id,'b');assert.equal(h.nextUnreviewedGroup(groups,'b')?.id,'c');assert.equal(h.nextUnreviewedGroup(groups,'c')?.id,'b');
 assert.equal(h.nextUnreviewedGroup([group('a')],'a'),null);assert.equal(h.nextUnreviewedGroup([group('a',true)],''),null);assert.equal(h.nextUnreviewedGroup([],''),null);
});
test('Next navigates only and never reviews, invalidates analysis or changes group membership',()=>{
 const groups=[group('a'),group('b')],h=harness(groups,'a'),before=JSON.stringify(groups);h.goToNextUnreviewedGroup();
 assert.equal(h.state.groupFilter,'b');assert.equal(JSON.stringify(h.state.groups),before);assert.equal(h.calls.invalidate,0);assert.equal(h.state.groupingRevision,1);assert.equal(h.$('#compareZoom').value,'fit');assert.equal(h.state.active,0);
});
test('Explicit review advances without requiring Keep and Undo returns to the reviewed group',()=>{
 const groups=[group('a'),group('b')],h=harness(groups,'a');h.reviewCurrentGroup();
 assert.equal(h.state.groups[0].reviewed,true);assert.equal(h.state.groupFilter,'b');assert.equal(h.state.groupingRevision,2);assert.equal(h.calls.invalidate,1);assert.equal(h.calls.focus,'#selectA');
 h.undo();assert.equal(h.state.groups[0].reviewed,false);assert.equal(h.state.groupFilter,'a');assert.equal(h.state.groupingRevision,3);assert.equal(h.calls.focus,'#selectA');
});
test('Last group stays visible, repeated review is inert, and reviewing a pending group preserves existing manual protection',()=>{
 const h=harness([group('a',true),group('b',false,{pending:true})],'b');h.reviewCurrentGroup();const after=JSON.stringify(h.state.groups);h.reviewCurrentGroup();
 assert.equal(h.state.groupFilter,'b');assert.equal(h.state.groups[1].reviewed,true);assert.equal(h.state.groups[1].manual,true);assert.equal(h.state.groups[1].pending,false);assert.equal(JSON.stringify(h.state.groups),after);assert.equal(h.state.groupingRevision,2);
});
test('Import and analysis block both navigation actions; All photos cannot be marked reviewed',()=>{
 for(const busy of ['load','analysis']){const h=harness([group('a'),group('b')],'a');h.state[busy]={};h.goToNextUnreviewedGroup();h.reviewCurrentGroup();assert.equal(h.state.groupFilter,'a');assert.equal(h.calls.render,0);assert.equal(h.state.groups[0].reviewed,false);}
 const h=harness([group('a')]);h.reviewCurrentGroup();assert.equal(h.state.groups[0].reviewed,false);assert.equal(h.calls.render,0);
});
test('Review Undo preserves later imported members and refuses a reset session',()=>{
 const h=harness([group('a'),group('b')],'a');h.reviewCurrentGroup();h.state.groups.push(group('later'));h.undo();assert.deepEqual(h.state.groups.map(g=>g.id),['a','b','later']);
 const fresh=harness([group('a')],'a');fresh.reviewCurrentGroup();fresh.state.generation++;fresh.state.groups=[group('new')];fresh.undo();assert.deepEqual(fresh.state.groups.map(g=>g.id),['new']);
});
test('Ordinary reanalysis preserves a reviewed partition; explicit reset clears review normally',async()=>{
 const h=harness([group('a'),group('b')],'a');h.reviewCurrentGroup();const photos=h.state.groups.flatMap(g=>g.ids.map(id=>({id})));
 const normal=await Groups.groupPhotos(photos,{previousGroups:h.state.groups});assert.equal(normal[0].reviewed,true);
 const reset=await Groups.groupPhotos(photos);assert(reset.every(g=>!g.reviewed));
});

test('Opening Organize cancels analysis and refreshes Compare review controls before closing without edits',()=>{
 const h=harness([group('a'),group('b')],'a');h.state.analysis={};h.renderReviewNavigation();
 assert.equal(h.$('#nextUnreviewedButton').disabled,true);assert.equal(h.$('#reviewAndNextButton').disabled,true);
 h.$('#groupDialog').showModal=()=>{};
 const fn=source.match(/  function organizeGroups[^\n]+/)[0];
 const organize=vm.runInNewContext(fn+';organizeGroups',{state:h.state,$:h.$,stopAnalysis:()=>{h.state.analysis=null;},renderGroups(){},renderSimilarity(){},renderCompare:()=>h.renderReviewNavigation(),setOptions(){},groupLabel:()=>'',refreshGroupDialog(){}});
 organize();assert.equal(h.state.analysis,null);
 assert.equal(h.$('#nextUnreviewedButton').disabled,false,'Next is enabled after cancellation');assert.equal(h.$('#reviewAndNextButton').disabled,false,'Review is enabled after cancellation');
});
