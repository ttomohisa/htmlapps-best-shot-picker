'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/app.js'),'utf8');
function helper(){
 const start=source.indexOf('  function syncKeyedChildren('),end=source.indexOf('  function setTextIfChanged(',start);
 assert(start>=0&&end>start,'keyed rendering helper exists');
 const context={keyedRows:new WeakMap(),Map,Set};vm.createContext(context);vm.runInContext(source.slice(start,end)+'\nthis.sync=syncKeyedChildren;',context);return context.sync;
}
class Node{
 constructor(key='root'){this.key=key;this.children=[];this.parentNode=null;this.moves=0;this.removes=0;this.text='';}
 insertBefore(node,before){if(node.parentNode){const old=node.parentNode;old.children.splice(old.children.indexOf(node),1);}const index=before?this.children.indexOf(before):this.children.length;assert(index>=0);this.children.splice(index,0,node);node.parentNode=this;this.moves++;}
 replaceChildren(){for(const node of [...this.children])node.remove();}
 remove(){if(this.parentNode){const p=this.parentNode;p.children.splice(p.children.indexOf(this),1);this.parentNode=null;p.removes++;}}
}
test('keyed rows retain unaffected node identity and avoid moving stable order',()=>{const sync=helper(),root=new Node();let creates=0;const create=x=>{creates++;return new Node(x.id);},update=(n,x)=>n.text=x.label;
 sync(root,[{id:'a',label:'A'},{id:'b',label:'B'}],x=>x.id,create,update);const [a,b]=root.children;root.moves=0;
 sync(root,[{id:'a',label:'changed'},{id:'b',label:'B'},{id:'c',label:'C'}],x=>x.id,create,update);
 assert.equal(root.children[0],a);assert.equal(root.children[1],b);assert.equal(a.text,'changed');assert.equal(creates,3);assert.equal(root.moves,1);
 root.moves=0;sync(root,[{id:'a',label:'changed'},{id:'b',label:'B'},{id:'c',label:'C'}],x=>x.id,create,update);assert.equal(root.moves,0);
});
test('keyed rows reorder existing nodes, remove obsolete nodes and recreate removed keys',()=>{const sync=helper(),root=new Node(),create=x=>new Node(x),update=()=>{};sync(root,['a','b','c'],x=>x,create,update);const [a,b,c]=root.children;
 sync(root,['c','a'],x=>x,create,update);assert.deepEqual(root.children,[c,a]);assert.equal(b.parentNode,null);
 sync(root,['c','b','a'],x=>x,create,update);assert.notEqual(root.children[1],b);assert.equal(root.children[0],c);assert.equal(root.children[2],a);
 sync(root,[],x=>x,create,update);assert.equal(root.children.length,0);assert.equal(a.parentNode,null);assert.equal(c.parentNode,null);
});
test('external DOM removal cannot resurrect stale row callbacks for reused session IDs',()=>{const sync=helper(),root=new Node();let generation=1;const create=x=>{const n=new Node(x);n.generation=generation;return n;};sync(root,['p1'],x=>x,create,()=>{});const old=root.children[0];old.remove();generation=2;sync(root,['p1'],x=>x,create,()=>{});assert.notEqual(root.children[0],old);assert.equal(root.children[0].generation,2);});

test('fresh session cache discards old owned children and callbacks',()=>{const root=new Node(),first=helper(),create=x=>new Node(x);first(root,['p1'],x=>x,create,()=>{});const old=root.children[0];const next=helper();next(root,[],x=>x,create,()=>{});assert.equal(root.children.length,0);assert.equal(old.parentNode,null);next(root,['p1'],x=>x,create,()=>{});assert.notEqual(root.children[0],old);});
