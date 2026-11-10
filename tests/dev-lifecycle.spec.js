'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {DevLifecycle}=require('../src/dev/lifecycle');
const {getBuildStatus}=require('../src/dev/build-status');
async function until(predicate){const end=Date.now()+3000;while(Date.now()<end){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error('Timed out waiting for lifecycle state');}
describe('Serialized dev build lifecycle',function(){
 this.timeout(6000);let root,dev,watcher,calls,releases,failAssets,active,maximum,stopped;
 beforeEach(()=>{
  root=fs.mkdtempSync(path.join(os.tmpdir(),'ps-lifecycle-'));fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({scripts:{'build-assets':'existing builder'}}));
  watcher=new EventEmitter();watcher.close=async()=>{stopped=true;};calls=[];releases=[];failAssets=false;active=0;maximum=0;stopped=false;
  const children={run:async(command,args)=>{const phase=args.includes('compile')?'html':'assets';calls.push(phase);active++;maximum=Math.max(maximum,active);await new Promise(resolve=>releases.push(resolve));active--;return {failed:phase==='assets'&&failAssets,code:phase==='assets'&&failAssets?1:0};},stop:async()=>{for(const release of releases.splice(0))release();}};
  dev=new DevLifecycle({open:'false',debounce:10},{root,children,watch:()=>{process.nextTick(()=>watcher.emit('ready'));return watcher;}});dev.startPreview=async()=>dev.publish({preview:{state:'listening',port:3000}});
 });
 afterEach(async()=>{await dev.stop();fs.rmSync(root,{recursive:true,force:true});});
 const release=()=>releases.shift()();
 async function initial(){const started=dev.start();await until(()=>calls.length===1);release();await until(()=>calls.length===2);release();await started;}
 it('performs an initial asset and HTML build before publishing ready',async()=>{await initial();assert.deepEqual(calls,['assets','html']);assert.equal(getBuildStatus(root).ready,true);assert.equal(getBuildStatus(root).lastSuccessfulBuild.generation,1);});
 it('coalesces rapid changes during a build and never publishes an older success as current',async()=>{
  const started=dev.start();await until(()=>calls.length===1);for(let i=0;i<6;i++)dev.request('src/scss/style.scss',{assets:true});assert.equal(getBuildStatus(root).state,'building');assert.equal(getBuildStatus(root).pendingChanges.count,1);
  release();await until(()=>calls.length===2);release();await until(()=>calls.length===3);assert.equal(getBuildStatus(root).ready,false);assert.equal(getBuildStatus(root).lastSuccessfulBuild,null);release();await started;
  assert.deepEqual(calls,['assets','html','assets']);assert.equal(maximum,1);assert.equal(getBuildStatus(root).generation,7);assert.equal(getBuildStatus(root).ready,true);
 });
 it('keeps failures visible and clears them only after a later successful rebuild',async()=>{failAssets=true;await initial();assert.equal(getBuildStatus(root).state,'failed');assert.equal(getBuildStatus(root).failure.phase,'assets');failAssets=false;dev.request('src/css/copied.css',{assets:true});await until(()=>calls.length===3);release();await until(()=>getBuildStatus(root).ready);assert.equal(getBuildStatus(root).failure,null);});
 it('routes data and copied-CSS events and invalidates configuration changes',async()=>{
  await initial();watcher.emit('all','change',path.join(root,'src/html/data/default.data.json'));await until(()=>calls.length===3);assert.equal(calls.at(-1),'html');release();await until(()=>getBuildStatus(root).ready);
  watcher.emit('all','change',path.join(root,'src/css/copied.css'));await until(()=>calls.length===4);assert.equal(calls.at(-1),'assets');release();await until(()=>getBuildStatus(root).ready);
  watcher.emit('all','change',path.join(root,'package.json'));assert.equal(getBuildStatus(root).state,'failed');assert.equal(getBuildStatus(root).ready,false);
 });
 it('stops an active build, closes the watcher and invalidates the status owner',async()=>{const started=dev.start();await until(()=>calls.length===1);await dev.stop();await started;assert.equal(stopped,true);assert.equal(getBuildStatus(root).state,'unavailable');assert.deepEqual(calls,['assets']);});
 it('makes watcher failure fatal and cleans up children',async()=>{await initial();const previous=process.exitCode;watcher.emit('error',new Error('watch failed'));await dev.stop();process.exitCode=previous;assert.equal(stopped,true);assert.equal(getBuildStatus(root).state,'unavailable');assert.equal(getBuildStatus(root).lastFailure.phase,'watcher');});
});
