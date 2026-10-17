'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const MiB = 1024 * 1024;
const limits = Object.freeze({ maxFileBytes:8*MiB, maxInputBytes:256*MiB, maxRssBytes:2048*MiB, minAvailableBytes:1024*MiB, sampleMs:500, caseMs:180000 });
function config(env) {
 const count = env.BSP_RESOURCE_MAX_COUNT || '4';
 assert(['4','100'].includes(count), 'BSP_RESOURCE_MAX_COUNT must be 4 or 100 (always runs 4 first)');
 return { counts:count==='100'?[4,100]:[4], distDir:path.resolve(env.BSP_RESOURCE_DIST_DIR || path.join(__dirname,'../../dist')) };
}
function parseStatus(text) {
 const ppid = text.match(/^PPid:\s+(\d+)/m), rss = text.match(/^VmRSS:\s+(\d+) kB/m);
 // A confirmed zombie has released its address space; an unreadable live
 // renderer must never be treated as zero.
 if(ppid && /^State:\s+Z\b/m.test(text))return {ppid:Number(ppid[1]),rss:0};
 assert(ppid && rss, 'Missing process PPid/RSS measurement');
 return { ppid:Number(ppid[1]), rss:Number(rss[1])*1024 };
}
function stopReason({rss, available}) {
 if (!Number.isFinite(rss) || !Number.isFinite(available)) return 'Resource measurement unavailable';
 if (rss > limits.maxRssBytes) return 'Sampled process-tree RSS crossed diagnostic stop line';
 if (available < limits.minAvailableBytes) return 'Host available RAM fell below diagnostic reserve';
 return null;
}
async function sampleResources(rootPid, io = fs) {
 // Sampled RSS double-counts shared pages; this is not a hard cap or peak memory.
 // Discover topology separately so a missing renderer RSS cannot hide its subtree.
 const pids=(await io.readdir('/proc')).filter(name=>/^\d+$/.test(name)), parents=new Map();
 await Promise.all(pids.map(async name=>{
  try {
   const stat=await io.readFile(`/proc/${name}/stat`,'utf8');
   const fields=stat.slice(stat.lastIndexOf(')')+2).split(/\s+/), ppid=Number(fields[1]);
   assert(stat.includes(')')&&/^\d+$/.test(fields[1]||'')&&Number.isSafeInteger(ppid)&&ppid>=0,'Malformed process topology');
   parents.set(Number(name),ppid);
  } catch(error){if(!['ENOENT','ESRCH'].includes(error.code))throw error;}
 }));
 assert(parents.has(rootPid),'Browser process topology measurement unavailable');
 const selected=new Set([rootPid]);let grew;
 do{grew=false;for(const [pid,ppid] of parents)if(selected.has(ppid)&&!selected.has(pid)){selected.add(pid);grew=true;}}while(grew);
 let browserRss=0, measuredProcesses=0;
 for(const pid of selected){
  try{const measured=parseStatus(await io.readFile(`/proc/${pid}/status`,'utf8'));browserRss+=measured.rss;measuredProcesses++;}
  catch(error){if(pid===rootPid||!['ENOENT','ESRCH'].includes(error.code))throw error;}
 }
 const memory=await io.readFile('/proc/meminfo','utf8'),available=memory.match(/^MemAvailable:\s+(\d+) kB/m);
 assert(available,'Host available RAM measurement unavailable');
 const controllerRss=process.memoryUsage().rss;
 return {rss:browserRss+controllerRss,browserRss,controllerRss,available:Number(available[1])*1024,processes:measuredProcesses};
}
function validateManifest(manifest,count) {
 assert.equal(manifest.profile,'synthetic-geometric-12mp-v1'); assert.equal(manifest.count,count); assert.equal(manifest.files.length,count);
 const names=new Set(); let total=0;
 for(const file of manifest.files){
  assert.match(file.name,/^synthetic-\d{3}\.(jpg|png|webp)$/); assert(!names.has(file.name),'Duplicate fixture name'); names.add(file.name);
  assert([4000,3000].includes(file.width) && [4000,3000].includes(file.height) && file.width*file.height===12000000,'Expected 12MP dimensions');
  assert(['JPEG','PNG','WEBP'].includes(file.format)); assert.match(file.sha256,/^[a-f0-9]{64}$/);
  assert(Number.isSafeInteger(file.bytes)&&file.bytes>0&&file.bytes<=limits.maxFileBytes,'Encoded file budget exceeded'); total+=file.bytes;
 }
 assert(total<=limits.maxInputBytes,'Total input budget exceeded'); return total;
}
module.exports={config,limits,parseStatus,stopReason,sampleResources,validateManifest};
