'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {spawn}=require('node:child_process');
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {StdioClientTransport}=require('@modelcontextprotocol/sdk/client/stdio.js');
const {getBuildStatus}=require('../src/dev/build-status');
const CLI=path.resolve(__dirname,'../bin/pagestudio'),MCP=path.resolve(__dirname,'../bin/pagestudio-mcp.js');
const quote=value=>"'"+value.replace(/'/g,"'\\''")+"'";
const write=(root,file,source)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),source);};
async function until(predicate,timeout=12000){const end=Date.now()+timeout;while(Date.now()<end){const value=await predicate();if(value)return value;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('Timed out waiting for subprocess state');}
const builder=`const fs=require('fs');
let lock;try{lock=fs.openSync('build.active','wx');}catch(_){process.exit(42);}
fs.writeFileSync('asset.pid',String(process.pid));fs.appendFileSync('events.jsonl',JSON.stringify({type:'start',pid:process.pid})+'\\n');
const scss=fs.readFileSync('src/scss/style.scss','utf8'),js=fs.readFileSync('src/js/main.js','utf8'),copied=fs.readFileSync('src/css/copied.css','utf8');
function unlock(){try{fs.closeSync(lock);fs.unlinkSync('build.active');}catch(_){}}
process.on('SIGTERM',()=>{unlock();process.exit(0)});
setTimeout(()=>{
 if(scss.includes('FAIL')){console.error('PRIVATE_CREDENTIAL=fixture-only');unlock();process.exit(1);}
 fs.mkdirSync('compiled/assets/css',{recursive:true});fs.mkdirSync('compiled/assets/js',{recursive:true});
 fs.writeFileSync('compiled/assets/css/style.css',scss);fs.writeFileSync('compiled/assets/css/copied.css',copied);fs.writeFileSync('compiled/assets/js/main.js',js);
 fs.appendFileSync('events.jsonl',JSON.stringify({type:'end',pid:process.pid})+'\\n');unlock();
},250);`;
const fetchPage=port=>new Promise((resolve,reject)=>http.get(`http://127.0.0.1:${port}/index.html`,response=>{let text='';response.on('data',chunk=>text+=chunk);response.on('end',()=>resolve(text));}).on('error',reject));
describe('npm start lifecycle and separate MCP process',function(){
 this.timeout(30000);let root,child,closed,logs,client;
 beforeEach(async()=>{
  root=fs.mkdtempSync(path.join(os.tmpdir(),'ps-dev-cli-'));logs='';child=null;closed=null;
  write(root,'package.json',JSON.stringify({scripts:{start:`${quote(process.execPath)} ${quote(CLI)} dev --open false --port 0 --debounce 30`,'build-assets':'node build-assets.js'}}));
  write(root,'build-assets.js',builder);write(root,'src/scss/style.scss','.btn {color:red}');write(root,'src/js/main.js','initial JS');write(root,'src/css/copied.css','initial copied CSS');write(root,'src/html/partials/header.html','<header>Initial</header>');
  for(const name of ['index','about']){write(root,`src/html/layouts/${name}.html`,'<html><body>{{ template:partial name="header" }}<h1>{{ title }}</h1></body></html>');write(root,`src/html/data/${name}.data.json`,JSON.stringify({title:name}));}
  client=new Client({name:'dev-status-test',version:'1.0.0'});await client.connect(new StdioClientTransport({command:process.execPath,args:[MCP],env:{...process.env,PAGESTUDIO_PROJECT_ROOT:root},stderr:'pipe'}));
 });
 async function launch(){
  logs='';child=spawn('npm',['run','start'],{cwd:root,stdio:['ignore','pipe','pipe']});child.stdout.on('data',data=>{logs=(logs+data.toString()).slice(-100000);});child.stderr.on('data',data=>{logs=(logs+data.toString()).slice(-100000);});closed=new Promise(resolve=>child.once('close',resolve));
  return until(()=>{const status=getBuildStatus(root);return status.ready&&status;}).catch(error=>{throw new Error(error.message+'\n'+logs);});
 }
 async function stop(){
  if(!child)return;const status=getBuildStatus(root);if(status.available)process.kill(status.pid,'SIGTERM');else if(child.exitCode===null)child.kill('SIGTERM');
  let timeout;try{await Promise.race([closed,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Dev process did not exit')),5000);})]);}finally{clearTimeout(timeout);}child=null;
 }
 const statusTool=async()=>JSON.parse((await client.callTool({name:'pagestudio_get_build_status',arguments:{}})).content[0].text);
 afterEach(async()=>{try{await stop();}finally{if(client)await client.close();fs.rmSync(root,{recursive:true,force:true});}});
 it('starts initial assets/HTML, watchers and an HTTP preview with one npm start',async()=>{
  assert.equal((await statusTool()).state,'unavailable');assert.ok(!fs.existsSync(path.join(root,'.pagestudio')));const status=await launch();assert.equal((await statusTool()).ready,true);
  assert.match(fs.readFileSync(path.join(root,'compiled/index.html'),'utf8'),/Initial/);assert.equal(fs.readFileSync(path.join(root,'compiled/assets/js/main.js'),'utf8'),'initial JS');assert.match(await fetchPage(status.preview.port),/<h1>index<\/h1>/);
 });
 it('updates HTML, partials, JSON data, SCSS, JS and copied CSS, including layout deletion',async()=>{
  let status=await launch();async function edit(file,source){write(root,file,source);const generation=status.generation;status=await until(()=>{const s=getBuildStatus(root);return s.ready&&s.generation>generation&&s;});}
  await edit('src/html/partials/header.html','<header>Changed</header>');for(const page of ['index','about'])assert.match(fs.readFileSync(path.join(root,`compiled/${page}.html`),'utf8'),/Changed/);
  await edit('src/html/data/index.data.json','{"title":"New data"}');assert.match(fs.readFileSync(path.join(root,'compiled/index.html'),'utf8'),/New data/);
  await edit('src/scss/style.scss','.btn {color:blue}');assert.match(fs.readFileSync(path.join(root,'compiled/assets/css/style.css'),'utf8'),/blue/);
  await edit('src/js/main.js','updated JS');assert.equal(fs.readFileSync(path.join(root,'compiled/assets/js/main.js'),'utf8'),'updated JS');
  await edit('src/css/copied.css','updated copied CSS');assert.equal(fs.readFileSync(path.join(root,'compiled/assets/css/copied.css'),'utf8'),'updated copied CSS');
  await edit('src/html/layouts/index.html','<html><body>Updated HTML</body></html>');assert.match(fs.readFileSync(path.join(root,'compiled/index.html'),'utf8'),/Updated HTML/);
  const generation=status.generation;fs.unlinkSync(path.join(root,'src/html/layouts/about.html'));await until(()=>{const s=getBuildStatus(root);return s.ready&&s.generation>generation;});assert.ok(!fs.existsSync(path.join(root,'compiled/about.html')));
 });
 it('serializes concurrent edits and publishes only the final generation as ready',async()=>{
  const initial=await launch();write(root,'src/scss/style.scss','.btn {color:blue}');await until(()=>getBuildStatus(root).state==='building'&&fs.existsSync(path.join(root,'build.active')));
  for(let i=0;i<5;i++){write(root,'src/scss/style.scss',`.btn {z-index:${i}}`);await new Promise(resolve=>setTimeout(resolve,20));}assert.equal((await statusTool()).ready,false);
  const final=await until(()=>{const s=getBuildStatus(root);return s.ready&&s.generation>initial.generation&&s;});assert.equal(final.lastSuccessfulBuild.generation,final.generation);assert.match(fs.readFileSync(path.join(root,'compiled/assets/css/style.css'),'utf8'),/z-index:4/);
  const events=fs.readFileSync(path.join(root,'events.jsonl'),'utf8').trim().split('\n').map(JSON.parse);let active=0;for(const event of events){active+=event.type==='start'?1:-1;assert.ok(active===0||active===1);}assert.equal(active,0);
 });
 it('exposes asset/HTML failure across MCP and recovers without leaking raw errors',async()=>{
  await launch();write(root,'src/scss/style.scss','FAIL');await until(()=>getBuildStatus(root).state==='failed');const failed=await statusTool();assert.equal(failed.failure.phase,'assets');assert.ok(!JSON.stringify(failed).includes('PRIVATE_CREDENTIAL'));assert.match(logs,/PRIVATE_CREDENTIAL/);
  write(root,'src/scss/style.scss','.btn {color:green}');await until(()=>getBuildStatus(root).ready);write(root,'src/html/data/index.data.json','not json');await until(()=>getBuildStatus(root).state==='failed');assert.equal((await statusTool()).failure.phase,'html');
  write(root,'src/html/data/index.data.json','{"title":"Recovered"}');await until(()=>getBuildStatus(root).ready);assert.equal((await statusTool()).failure,null);
 });
 it('invalidates shutdown and resets owner/session success across a restart',async()=>{const first=await launch();await stop();assert.equal((await statusTool()).state,'unavailable');const second=await launch();assert.notEqual(second.sessionId,first.sessionId);assert.equal(second.generation,1);assert.equal(second.lastSuccessfulBuild.generation,1);});
 it('shuts down an active asset process and keeps MCP read-only afterwards',async()=>{
  await launch();write(root,'src/scss/style.scss','.btn {color:purple}');await until(()=>getBuildStatus(root).state==='building'&&fs.existsSync(path.join(root,'build.active')));const pid=Number(fs.readFileSync(path.join(root,'asset.pid'),'utf8'));await stop();
  await until(()=>{try{process.kill(pid,0);return false;}catch(_){return true;}});const before=fs.readFileSync(path.join(root,'.pagestudio/build-status.json'));assert.equal((await statusTool()).ready,false);assert.deepEqual(fs.readFileSync(path.join(root,'.pagestudio/build-status.json')),before);
 });
 it('supports HTML-only projects without choosing an unrelated packaging build script',async()=>{const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));delete pkg.scripts['build-assets'];pkg.scripts.build='node never-run.js';write(root,'package.json',JSON.stringify(pkg));const status=await launch();assert.equal(status.assetBuild,'none (HTML-only readiness)');assert.ok(!fs.existsSync(path.join(root,'events.jsonl')));});
 it('honors configured layout/partial/data roots and a custom preview output directory',async()=>{
  fs.renameSync(path.join(root,'src/html/layouts'),path.join(root,'src/html/pages'));write(root,'site.config.json',JSON.stringify({layouts:'src/html/pages',out:'public',dev:{assetScript:false}}));const status=await launch();assert.ok(fs.existsSync(path.join(root,'public/index.html')));assert.match(await fetchPage(status.preview.port),/Initial/);assert.equal(status.assetBuild,'none (HTML-only readiness)');
 });
 it('uses the existing Grunt/Webpack/Sass pipeline for initial and copied-CSS rebuilds',async()=>{
  fs.symlinkSync(path.resolve(__dirname,'../node_modules'),path.join(root,'node_modules'),'dir');const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));pkg.scripts['build-assets']='grunt webpack copycss';write(root,'package.json',JSON.stringify(pkg));
  write(root,'Gruntfile.js',`module.exports=grunt=>{grunt.initConfig({webpack:{build:require('./webpack.config.js')}});grunt.loadNpmTasks('grunt-webpack');grunt.registerTask('copycss',()=>require('fs').copyFileSync('src/css/copied.css','compiled/assets/css/copied.css'));};`);
  write(root,'webpack.config.js',`const path=require('path'),Mini=require('mini-css-extract-plugin');module.exports={mode:'development',entry:{main:'./src/js/main.js',style:'./src/scss/style.scss'},output:{path:path.resolve(__dirname,'compiled/assets/js')},module:{rules:[{test:/\\.scss$/,use:[Mini.loader,'css-loader','sass-loader']}]},plugins:[new Mini({filename:'../css/[name].css'})]};`);
  write(root,'src/js/main.js','console.log("initial JS");');write(root,'src/scss/style.scss','$color: red; .text-left { .btn { color: $color; } }');const initial=await launch();assert.match(fs.readFileSync(path.join(root,'compiled/assets/css/style.css'),'utf8'),/\.text-left \.btn/);
  write(root,'src/css/copied.css','updated by Grunt copy');await until(()=>{const s=getBuildStatus(root);return s.ready&&s.generation>initial.generation;});assert.equal(fs.readFileSync(path.join(root,'compiled/assets/css/copied.css'),'utf8'),'updated by Grunt copy');assert.equal((await statusTool()).assetBuild,'npm:build-assets');
 });
 it('reports startup configuration failure and exits without leaving owned children',async()=>{child=spawn(process.execPath,[CLI,'dev','--asset-script','does-not-exist','--open','false'],{cwd:root,stdio:'ignore'});closed=new Promise(resolve=>child.once('close',resolve));assert.equal(await closed,1);assert.equal((await statusTool()).state,'unavailable');assert.equal((await statusTool()).lastFailure.phase,'startup');});
 it('makes preview startup failure visible and terminates dev rather than reporting success',async()=>{
  const occupied=http.createServer();await new Promise(resolve=>occupied.listen(0,'127.0.0.1',resolve));try{child=spawn(process.execPath,[CLI,'dev','--open','false','--port',String(occupied.address().port)],{cwd:root,stdio:'ignore'});closed=new Promise(resolve=>child.once('close',resolve));assert.equal(await closed,1);const status=await statusTool();assert.equal(status.ready,false);assert.equal(status.lastFailure.phase,'preview');}finally{await new Promise(resolve=>occupied.close(resolve));}
 });
 it('rejects a second dev owner without disturbing the current session',async()=>{const first=await launch();const duplicate=spawn(process.execPath,[CLI,'dev','--open','false','--port','0'],{cwd:root,stdio:'ignore'});assert.equal(await new Promise(resolve=>duplicate.once('close',resolve)),1);const current=await statusTool();assert.equal(current.ready,true);assert.equal(current.sessionId,first.sessionId);});
});
