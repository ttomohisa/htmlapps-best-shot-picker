const fs=require('node:fs/promises'),path=require('node:path');
const {build}=require('./burst-build.cjs');
(async()=>build({outDir:path.resolve(__dirname,'../../test-results/embedding-worker'),sources:['src/grouping.js','experiments/embedding/evaluate.js','experiments/embedding/worker-client.js','experiments/embedding/worker-runner.js'],extraData:{workerSource:await fs.readFile(path.join(__dirname,'worker-entry.js'),'utf8')}}))().catch(e=>{console.error(e);process.exitCode=1;});
