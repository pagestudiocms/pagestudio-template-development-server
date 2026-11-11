'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createBuildStatus,getBuildStatus,STALE_MS}=require('../src/dev/build-status');
const {resolveDevConfig}=require('../src/dev/config');
describe('Cross-process build status and configuration',function(){
 let root,owner;
 beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'ps-status-'));});
 afterEach(()=>{if(owner)owner.close();owner=null;fs.rmSync(root,{recursive:true,force:true});});
 const ready=()=>({state:'ready',phase:null,generation:1,activeGeneration:null,pendingChanges:{count:0,files:[]},lastSuccessfulBuild:{generation:1,completedAt:new Date().toISOString()},preview:{state:'listening',port:3000}});
 it('reports missing status as unavailable and never creates files during reads',()=>{assert.equal(getBuildStatus(root).state,'unavailable');assert.deepEqual(fs.readdirSync(root),[]);});
 it('tracks idle, building, ready and failed without exposing raw failure details',()=>{
  owner=createBuildStatus(root);assert.equal(getBuildStatus(root).state,'idle');
  owner.update({state:'building',generation:1,activeGeneration:1,pendingChanges:{count:1,files:['changed']}});assert.equal(getBuildStatus(root).ready,false);
  owner.update(ready());assert.equal(getBuildStatus(root).ready,true);
  owner.update({state:'failed',failure:{phase:'assets',code:1,message:'SECRET_TOKEN=hidden',stack:'private'}});
  const failed=getBuildStatus(root);assert.equal(failed.state,'failed');assert.equal(failed.ready,false);assert.ok(!JSON.stringify(failed).includes('SECRET_TOKEN'));assert.equal(failed.lastSuccessfulBuild.generation,1);
  owner.update({...ready(),failure:null});assert.equal(getBuildStatus(root).ready,true);
 });
 it('requires no pending changes, matching generation and a listening preview for ready',()=>{
  owner=createBuildStatus(root);for(const change of [{pendingChanges:{count:1,files:['changed']}},{generation:2},{preview:{state:'starting'}},{activeGeneration:1}]){owner.update({...ready(),...change});assert.equal(getBuildStatus(root).state,'unavailable');}
 });
 it('invalidates stopped, stale, mismatched and partially published owners',()=>{
  owner=createBuildStatus(root);owner.update(ready());assert.equal(getBuildStatus(root,Date.now()+STALE_MS+1000).reason,'stale');
  const lock=path.join(root,'.pagestudio/dev.lock'),record={...owner.record};
  fs.writeFileSync(lock,JSON.stringify({...record,state:'building'}));assert.equal(getBuildStatus(root).reason,'updating');
  fs.writeFileSync(lock,JSON.stringify({...record,sessionId:'other'}));assert.equal(getBuildStatus(root).reason,'owner-mismatch');
  fs.writeFileSync(lock,JSON.stringify(record));owner.close();assert.equal(getBuildStatus(root).reason,'stopped');
 });
 it('rejects duplicate live owners and resets success after a dead owner/restart',()=>{
  owner=createBuildStatus(root);owner.update(ready());assert.throws(()=>createBuildStatus(root),/already owns/);const previous=owner.record.sessionId;owner.close();
  const dead={...owner.record,pid:2147483647};for(const file of ['dev.lock','build-status.json'])fs.writeFileSync(path.join(root,'.pagestudio',file),JSON.stringify(dead));
  assert.equal(getBuildStatus(root).ready,false);owner=createBuildStatus(root);assert.notEqual(owner.record.sessionId,previous);assert.equal(getBuildStatus(root).lastSuccessfulBuild,null);assert.equal(getBuildStatus(root).ready,false);
 });
 it('handles malformed records, unsupported schema and symlinked status paths as unavailable',()=>{
  owner=createBuildStatus(root);const file=path.join(root,'.pagestudio/build-status.json');
  for(const source of ['null','not json',JSON.stringify({...owner.record,schemaVersion:'99'})]){fs.writeFileSync(file,source);assert.equal(getBuildStatus(root).state,'unavailable');}
  fs.unlinkSync(file);fs.symlinkSync(path.join(root,'.pagestudio/dev.lock'),file);assert.equal(getBuildStatus(root).state,'unavailable');
 });
 it('serializes dead-owner recovery and refuses an occupied recovery guard',()=>{
  owner=createBuildStatus(root);const dead={...owner.record,pid:2147483647};owner.close();fs.writeFileSync(path.join(root,'.pagestudio/dev.lock'),JSON.stringify(dead));
  const guard=path.join(root,'.pagestudio/dev.lock.recovery');fs.writeFileSync(guard,'');assert.throws(()=>createBuildStatus(root),/reclaiming/);fs.unlinkSync(guard);
  owner=createBuildStatus(root);assert.equal(getBuildStatus(root).state,'idle');assert.ok(!fs.existsSync(guard));
 });
 it('selects existing one-shot asset scripts, Grunt fallback, or HTML-only mode without running them',()=>{
  const pkg=path.join(root,'package.json');fs.writeFileSync(pkg,JSON.stringify({scripts:{start:'dev',build:'package-only'}}));assert.equal(resolveDevConfig({},root).assetBuild,null);
  for(const file of ['Gruntfile.js','webpack.config.js'])fs.writeFileSync(path.join(root,file),'throw new Error("never execute")');assert.equal(resolveDevConfig({},root).assetBuild.label,'grunt:webpack');
  fs.writeFileSync(pkg,JSON.stringify({scripts:{'build-assets':'grunt webpack',custom:'other builder'}}));assert.equal(resolveDevConfig({},root).assetBuild.label,'npm:build-assets');assert.equal(resolveDevConfig({assetScript:'custom'},root).assetBuild.label,'npm:custom');assert.equal(resolveDevConfig({assetScript:'none'},root).assetBuild,null);
  assert.throws(()=>resolveDevConfig({assetScript:'missing'},root),/does not exist/);assert.throws(()=>resolveDevConfig({assetWatch:'src/**'},root),/literal paths/);
 });
 it('honors configuration with CLI precedence and rejects generated output watch loops',()=>{
  fs.writeFileSync(path.join(root,'site.config.json'),JSON.stringify({src:'templates',out:'public',port:9000,dev:{assetWatch:['styles'],debounceMs:25}}));const config=resolveDevConfig({port:'8000'},root);
  assert.equal(config.port,8000);assert.equal(config.debounceMs,25);assert.equal(config.layouts,path.join(root,'templates/layouts'));assert.deepEqual(config.assetWatch,[path.join(root,'styles')]);assert.throws(()=>resolveDevConfig({assetWatch:'public/css'},root),/output directory/);
 });
});
