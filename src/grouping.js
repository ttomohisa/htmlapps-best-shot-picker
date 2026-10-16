/* Conservative, deterministic grouping. No file bytes or selection state are mutated. */
(function(root){
'use strict';
const CONFIG=Object.freeze({version:'dhash-rgb-v1',captureWindowMs:6000,timedHashDistance:6,untimedHashDistance:1,timedRgbDistance:15,untimedRgbDistance:3,timedAspectDelta:0.025,untimedAspectDelta:0.005,minLumaDeviation:12});
function features(rgba,width,height,aspect){
 if(width!==9||height!==8||rgba.length!==width*height*4||!Number.isFinite(aspect)||aspect<=0)throw new TypeError('Expected oriented 9 by 8 RGBA pixels and a positive aspect ratio');
 const rgb=[],luma=[];for(let i=0;i<rgba.length;i+=4){const alpha=rgba[i+3]/255;const values=[0,1,2].map(n=>rgba[i+n]*alpha+255*(1-alpha));rgb.push(...values);luma.push(values[0]*.2126+values[1]*.7152+values[2]*.0722);}
 let hash=0n;for(let y=0;y<8;y++)for(let x=0;x<8;x++)hash=(hash<<1n)|(luma[y*9+x]>luma[y*9+x+1]?1n:0n);
 const mean=luma.reduce((a,b)=>a+b,0)/luma.length;const deviation=Math.sqrt(luma.reduce((a,b)=>a+(b-mean)**2,0)/luma.length);
 return{version:CONFIG.version,hash:hash.toString(16).padStart(16,'0'),rgb,aspect,deviation};
}
function hamming(a,b){let bits=BigInt('0x'+a)^BigInt('0x'+b),count=0;while(bits){bits&=bits-1n;count++;}return count;}
function pairDecision(a,b,config=CONFIG){
 if(a.duplicateSetId&&a.duplicateSetId===b.duplicateSetId)return{match:true,reason:'exact-bytes'};
 const x=a.features,y=b.features;if(!x||!y||x.version!==config.version||y.version!==config.version)return{match:false,reason:'features-unavailable'};
 const ta=a.captureTime,tb=b.captureTime;const timed=!!(ta&&tb&&ta.domain===tb.domain&&Number.isFinite(ta.valueMs)&&Number.isFinite(tb.valueMs));
 if(timed&&Math.abs(ta.valueMs-tb.valueMs)>config.captureWindowMs)return{match:false,reason:'capture-time-gap'};
 if(Math.min(x.deviation,y.deviation)<config.minLumaDeviation)return{match:false,reason:'low-information'};
 const aspectDelta=Math.max(x.aspect,y.aspect)/Math.min(x.aspect,y.aspect)-1;if(aspectDelta>(timed?config.timedAspectDelta:config.untimedAspectDelta))return{match:false,reason:'aspect'};
 const distance=hamming(x.hash,y.hash);if(distance>(timed?config.timedHashDistance:config.untimedHashDistance))return{match:false,reason:'hash',distance};
 if(x.rgb.length!==216||y.rgb.length!==216)return{match:false,reason:'features-unavailable'};
 const rgbDistance=x.rgb.reduce((sum,value,i)=>sum+Math.abs(value-y.rgb[i]),0)/x.rgb.length;
 return{match:rgbDistance<=(timed?config.timedRgbDistance:config.untimedRgbDistance),reason:timed?'capture-and-visual':'strict-visual',distance,rgbDistance};
}
const clone=groups=>groups.map(group=>({...group,ids:[...group.ids]}));
function validate(groups,ids){const expected=new Set(ids),seen=new Set();for(const group of groups){if(!group.ids.length)throw new Error('Empty group');for(const id of group.ids){if(!expected.has(id)||seen.has(id))throw new Error('Invalid partition');seen.add(id);}}if(seen.size!==expected.size)throw new Error('Unassigned photo');return true;}
async function groupPhotos(photos,{previousGroups=[],reset=false,signal,onProgress}={}){
 const byId=new Map(photos.map(p=>[p.id,p])),groups=clone(previousGroups).filter(g=>!reset||g.manual).map(g=>({...g,ids:g.ids.filter(id=>byId.has(id))})).filter(g=>g.ids.length);
 const assigned=new Set(groups.flatMap(g=>g.ids));let pairs=0,processed=assigned.size;
 const check=()=>{if(signal?.aborted)throw new DOMException('Cancelled','AbortError');};
 for(const photo of photos){check();if(assigned.has(photo.id))continue;let destination=null;
  for(const group of groups){if(group.manual)continue;let match=true;for(const id of group.ids){check();if(++pairs%200===0){onProgress?.({processed,total:photos.length,pairs});await new Promise(resolve=>setTimeout(resolve,0));check();}if(!pairDecision(photo,byId.get(id)).match){match=false;break;}}if(match){destination=group;break;}}
  if(destination){destination.ids.push(photo.id);destination.reviewed=false;}else groups.push({id:`g-${photo.id}`,ids:[photo.id],manual:false,reviewed:false});
  assigned.add(photo.id);processed++;onProgress?.({processed,total:photos.length,pairs});
 }
 check();validate(groups,photos.map(p=>p.id));return groups;
}
function editGroups(groups,{type,sourceId,targetId,photoId}){
 const result=clone(groups),source=result.find(g=>g.id===sourceId),target=result.find(g=>g.id===targetId);if(!source)throw new Error('Unknown source group');
 const affected=new Set([sourceId]);if(type==='merge'||type==='move'){if(!target||target===source)throw new Error('Choose another group');affected.add(targetId);}
 if(type==='review'){source.reviewed=!source.reviewed;if(source.pending){source.manual=true;source.pending=false;}}
 else if(type==='split'||type==='move'){
  if(!source.ids.includes(photoId)||type==='split'&&source.ids.length<2)throw new Error('Choose a photo from a multi-photo group');
  source.ids=source.ids.filter(id=>id!==photoId);source.manual=true;source.reviewed=false;
  if(type==='split'){let id=`manual-${photoId}`,n=1;while(result.some(g=>g.id===id))id=`manual-${photoId}-${n++}`;result.push({id,ids:[photoId],manual:true,reviewed:false});affected.add(id);}
  else{target.ids.push(photoId);target.manual=true;target.reviewed=false;}
 }else if(type==='merge'){target.ids.push(...source.ids);source.ids=[];target.manual=true;target.reviewed=false;}else throw new Error('Unknown edit');
 const next=result.filter(g=>g.ids.length);validate(next,groups.flatMap(g=>g.ids));
 return{groups:next,patch:{order:groups.map(g=>g.id),before:clone(groups.filter(g=>affected.has(g.id))),afterIds:[...affected],members:groups.filter(g=>affected.has(g.id)).flatMap(g=>g.ids)}};
}
function undoEdit(groups,patch){
 const members=new Set(patch.members),restored=clone(patch.before),result=[];const occupied=new Set(restored.map(g=>g.id));
 for(const group of groups){const rest=group.ids.filter(id=>!members.has(id));if(!rest.length)continue;let id=group.id;while(occupied.has(id))id+='-later';occupied.add(id);result.push({...group,id,ids:rest});}
 const positions=new Map(patch.order.map((id,i)=>[id,i]));result.push(...restored);result.sort((a,b)=>(positions.get(a.id)??Infinity)-(positions.get(b.id)??Infinity));
 validate(result,groups.flatMap(g=>g.ids));return result;
}
const api=Object.freeze({CONFIG,features,hamming,pairDecision,groupPhotos,editGroups,undoEdit,validate});if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BestShotGrouping=api;
})(typeof window!=='undefined'?window:null);
