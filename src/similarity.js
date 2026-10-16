/* Optional, staged whole-group proposals. No photo files or Keep state enter this module. */
(function(root){
'use strict';
const CONFIG=Object.freeze({version:'guarded-embedding-proposals-v1',featureVersion:'dhash-rgb-v1',cosineThreshold:0.85,hashDistance:12,rgbDistance:48,aspectDelta:0.025,minLumaDeviation:12,maxPhotos:36,embeddingDimensions:256});
const label=value=>typeof value==='string'&&value.trim().length>0;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function validGroups(groups){
 if(!Array.isArray(groups))return false;
 const groupIds=new Set(),photoIds=new Set();
 for(const group of groups){
  if(!object(group)||!label(group.id)||groupIds.has(group.id)||!Array.isArray(group.ids)||!group.ids.length||['manual','reviewed','pending'].some(key=>group[key]!==undefined&&typeof group[key]!=='boolean'))return false;
  groupIds.add(group.id);
  for(const id of group.ids){if(!label(id)||photoIds.has(id))return false;photoIds.add(id);}
 }
 return true;
}
function eligibility(groups,photoIds){
 const result={ok:false,reason:null,eligibleGroupIds:[],photoIds:[],photoCount:0,groupCount:0,limit:CONFIG.maxPhotos};
 if(!validGroups(groups))return{...result,reason:'invalid-groups'};
 let available=null;
 if(photoIds!==undefined){
  if(!Array.isArray(photoIds)&&!(photoIds instanceof Set))return{...result,reason:'invalid-photo-ids'};
  available=new Set();for(const id of photoIds){if(!label(id)||available.has(id))return{...result,reason:'invalid-photo-ids'};available.add(id);}
 }
 for(const group of groups){
  if(group.manual||group.reviewed||group.pending||available&&!group.ids.every(id=>available.has(id)))continue;
  result.eligibleGroupIds.push(group.id);for(const id of group.ids)result.photoIds.push(id);
 }
 result.photoCount=result.photoIds.length;result.groupCount=result.eligibleGroupIds.length;
 result.reason=result.photoCount>CONFIG.maxPhotos?'photo-limit':result.groupCount<2?'too-few-groups':null;result.ok=result.reason===null;
 return result;
}
function validFeatures(value){
 if(!object(value)||value.version!==CONFIG.featureVersion||typeof value.hash!=='string'||!/^[0-9a-f]{16}$/i.test(value.hash)||!Number.isFinite(value.aspect)||value.aspect<=0||!Number.isFinite(value.deviation)||value.deviation<0||value.deviation>127.5+1e-9||!Array.isArray(value.rgb)||value.rgb.length!==216)return false;
 for(let i=0;i<216;i++)if(!Object.prototype.hasOwnProperty.call(value.rgb,i)||!Number.isFinite(value.rgb[i])||value.rgb[i]<-1e-9||value.rgb[i]>255+1e-9)return false;
 return true;
}
function normalized(embedding){
 if(!Array.isArray(embedding)&&!(embedding instanceof Float32Array)&&!(embedding instanceof Float64Array))return null;
 if(embedding.length!==CONFIG.embeddingDimensions)return null;
 let squared=0;
 for(let i=0;i<embedding.length;i++){if(!Object.prototype.hasOwnProperty.call(embedding,i)||!Number.isFinite(embedding[i]))return null;squared+=embedding[i]*embedding[i];}
 const norm=Math.sqrt(squared);if(!Number.isFinite(norm)||norm<=0)return null;
 return Array.from(embedding,value=>value/norm);
}
function pairMatches(a,b){
 if(!a||!b)return false;
 const x=a.features,y=b.features;
 if(Math.min(x.deviation,y.deviation)<CONFIG.minLumaDeviation||Math.max(x.aspect,y.aspect)/Math.min(x.aspect,y.aspect)-1>CONFIG.aspectDelta)return false;
 let bits=BigInt('0x'+x.hash)^BigInt('0x'+y.hash),distance=0;while(bits){bits&=bits-1n;if(++distance>CONFIG.hashDistance)return false;}
 let rgb=0;for(let i=0;i<216;i++)rgb+=Math.abs(x.rgb[i]-y.rgb[i]);if(rgb/216>CONFIG.rgbDistance)return false;
 let cosine=0;for(let i=0;i<CONFIG.embeddingDimensions;i++)cosine+=a.vector[i]*b.vector[i];
 return Number.isFinite(cosine)&&cosine>=CONFIG.cosineThreshold;
}
// A collision-free canonical snapshot covers the entire ordered partition and
// every flag that can protect membership, including groups outside a proposal.
const fingerprint=groups=>JSON.stringify(groups.map(g=>[g.id,g.ids,g.manual??null,g.reviewed??null,g.pending??null]));
function propose(groups,records){
 const result={...eligibility(groups),proposals:[]};if(!result.ok||!Array.isArray(records))return result;
 const evidence=new Map(),eligibleIds=new Set(result.photoIds);
 for(const record of records){
  if(!object(record)||!eligibleIds.has(record.id))continue;
  if(evidence.has(record.id)){evidence.set(record.id,null);continue;}
  const vector=normalized(record.embedding);evidence.set(record.id,vector&&validFeatures(record.features)?{features:record.features,vector}:null);
 }
 const indices=new Map(result.photoIds.map((id,index)=>[id,index])),pairs=new Map();
 const match=(a,b)=>{
  const x=indices.get(a),y=indices.get(b),key=Math.min(x,y)*CONFIG.maxPhotos+Math.max(x,y);
  if(!pairs.has(key))pairs.set(key,pairMatches(evidence.get(a),evidence.get(b)));return pairs.get(key);
 };
 const eligibleGroups=new Set(result.eligibleGroupIds),bins=[];
 for(let index=0;index<groups.length;index++){
  const group=groups[index];if(!eligibleGroups.has(group.id)||group.ids.some(id=>!evidence.get(id)))continue;
  // Existing groups are indivisible: never rescue just their matching members.
  let complete=true;for(let a=0;a<group.ids.length&&complete;a++)for(let b=a+1;b<group.ids.length;b++)if(!match(group.ids[a],group.ids[b])){complete=false;break;}
  if(!complete)continue;
  const destination=bins.find(bin=>group.ids.every(id=>bin.photoIds.every(other=>match(id,other))));
  if(destination){destination.indices.push(index);destination.groupIds.push(group.id);destination.photoIds.push(...group.ids);}
  else bins.push({indices:[index],groupIds:[group.id],photoIds:[...group.ids]});
 }
 const snapshot=fingerprint(groups);
 result.proposals=bins.filter(bin=>bin.groupIds.length>=2).map(bin=>Object.freeze({id:`similarity-${bin.indices.join('-')}`,version:CONFIG.version,groupIds:Object.freeze(bin.groupIds),photoIds:Object.freeze(bin.photoIds),fingerprint:snapshot}));
 return result;
}
const clone=groups=>groups.map(group=>({...group,ids:[...group.ids]}));
function apply(groups,proposal){
 if(!validGroups(groups))throw new TypeError('Invalid group partition');
 if(!object(proposal)||proposal.version!==CONFIG.version||typeof proposal.fingerprint!=='string'||!Array.isArray(proposal.groupIds)||proposal.groupIds.length<2||!Array.isArray(proposal.photoIds))throw new TypeError('Invalid similarity proposal');
 if(proposal.fingerprint!==fingerprint(groups))throw new Error('Stale similarity proposal; search again');
 const selectedIds=new Set();for(const id of proposal.groupIds){if(!label(id)||selectedIds.has(id))throw new TypeError('Invalid proposal group IDs');selectedIds.add(id);}
 const selected=groups.filter(group=>selectedIds.has(group.id)),eligible=eligibility(groups);
 if(!eligible.ok||selected.length!==selectedIds.size||selected.some(group=>group.manual||group.reviewed||group.pending))throw new Error('Proposal groups are no longer eligible');
 const ids=selected.flatMap(group=>group.ids),indices=[];for(let index=0;index<groups.length;index++)if(selectedIds.has(groups[index].id))indices.push(index);
 if(proposal.id!==`similarity-${indices.join('-')}`||JSON.stringify(selected.map(group=>group.id))!==JSON.stringify(proposal.groupIds)||JSON.stringify(ids)!==JSON.stringify(proposal.photoIds))throw new TypeError('Invalid whole-group proposal');
 const merged={...selected[0],ids:[...ids],manual:true,reviewed:false,pending:false},next=[];
 for(const group of groups){if(group===selected[0])next.push(merged);else if(!selectedIds.has(group.id))next.push({...group,ids:[...group.ids]});}
 // This is the same reversible edit contract used by BestShotGrouping.undoEdit.
 // Only these members are restored, so photos imported afterwards survive Undo.
 return{groups:next,patch:{order:groups.map(group=>group.id),before:clone(selected),afterIds:[...proposal.groupIds],members:[...ids]}};
}
const api=Object.freeze({CONFIG,eligibility,propose,apply});if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BestShotSimilarity=api;
})(typeof window!=='undefined'?window:null);
