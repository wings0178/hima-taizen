const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const {chromium} = require('playwright');
const out = path.resolve(__dirname, '../artifacts/tetris-audio');
fs.mkdirSync(out,{recursive:true});
let server, browser, base = process.env.GAME_URL;
const checks=[], errors=[];
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name);}
async function boot(page){
 await page.goto(base);
 await page.locator('[data-game=tetris]').click();
 await page.getByRole('button',{name:'ゲーム開始',exact:true}).click();
 await page.waitForFunction(()=>gameRegistry.tetris.audio.buffers.chip && gameRegistry.tetris.audio.current && gameRegistry.tetris.audio.context.state==='running');
 await page.evaluate(()=>gameRegistry.tetris.audio.ready);
}
async function silence(page){return page.evaluate(()=>{
 const a=gameRegistry.tetris.audio;
 if(!window.audioProbe){
  window.audioProbe=a.context.createAnalyser();audioProbe.fftSize=2048;
  const zero=a.context.createGain();zero.gain.value=0;a.master.connect(audioProbe);audioProbe.connect(zero);zero.connect(a.context.destination);
 }
 const data=new Float32Array(audioProbe.fftSize);audioProbe.getFloatTimeDomainData(data);
 return Math.sqrt(data.reduce((s,n)=>s+n*n,0)/data.length);
});}
(async()=>{
 if(!base){
  const root=path.resolve(__dirname,'..');
  server=http.createServer((req,res)=>{
   const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));
   if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
   fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}
    const mime={'.js':'application/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.wav':'audio/wav','.mp3':'audio/mpeg'};
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);
   });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 }
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||undefined,headless:true});
 const page=await browser.newPage({viewport:{width:1365,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);
 await check('audio is lazy and silent on titles',async()=>{
  assert.equal(await page.evaluate(()=>!!gameRegistry.tetris.audio.context),false);
  assert.equal(await page.locator('script[src="./games/tetris/sounds.js"]').count(),0);
 });
 await boot(page);
 await check('real decoded BGM and eight effects; output contains audio',async()=>{
  assert.equal(await page.evaluate(()=>Object.keys(currentScene.audio.buffers).length),10);
  assert.equal(await page.locator('#sound-game').textContent(),'音：ON');
  await silence(page);await page.waitForTimeout(120);
  assert.ok(await silence(page)>.0001);
  assert.equal(await page.evaluate(()=>currentScene.audio.current.track),'chip');
 });
 const loopMetrics=await page.evaluate(async()=>{
  const a=currentScene.audio,result=[];
  for(const track of ['chip','orchestra']){
   const duration=a.duration(track),sr=a.buffers[track].sampleRate;
   const offline=new OfflineAudioContext(2,Math.ceil((duration+.1)*sr),sr);
   const s=offline.createBufferSource();s.buffer=a.buffers[track];s.loop=true;s.loopEnd=duration;s.connect(offline.destination);s.start();
   const rendered=await offline.startRendering();const data=rendered.getChannelData(0),idx=Math.round(duration*sr);
   let maxStep=0,energy=0,zeroRun=0,maxZeroRun=0;
   for(let i=idx-220;i<idx+220;i++){
    maxStep=Math.max(maxStep,Math.abs(data[i]-data[i-1]));energy+=data[i]*data[i];
    zeroRun=Math.abs(data[i])<1e-5?zeroRun+1:0;maxZeroRun=Math.max(maxZeroRun,zeroRun);
   }
   result.push({track,duration,decodedDuration:s.buffer.duration,boundaryStep:Math.abs(data[idx]-data[idx-1]),maxStep,rms:Math.sqrt(energy/440),maxSilenceMs:maxZeroRun/sr*1000});
  }
  return result;
 });
 await check('both BGM loops render across their boundaries without padding gaps',async()=>{
  for(const m of loopMetrics){assert.ok(m.rms>.0001,JSON.stringify(m));assert.ok(m.maxSilenceMs<4,JSON.stringify(m));assert.ok(m.boundaryStep<.1,JSON.stringify(m));}
 });
 await page.evaluate(()=>{
  const a=currentScene.audio,play=a.play.bind(a);window.effectEvents=[];
  a.play=(name,...args)=>{const played=play(name,...args);if(played)effectEvents.push(name);return played;};
 });
 await check('keyboard move, rotate, hold and hard drop trigger the correct effects',async()=>{
  await page.keyboard.press('ArrowLeft');await page.waitForTimeout(70);
  await page.keyboard.press('ArrowUp');await page.waitForTimeout(70);
  await page.keyboard.press('KeyC');await page.waitForTimeout(70);
  const before=await page.evaluate(()=>effectEvents.filter(x=>x==='hold').length);
  await page.keyboard.press('KeyC');
  assert.equal(await page.evaluate(()=>effectEvents.filter(x=>x==='hold').length),before);
  await page.keyboard.press('Space');
  const e=await page.evaluate(()=>effectEvents);for(const n of ['move','rotate','hold','drop'])assert.ok(e.includes(n),JSON.stringify(e));
 });
 await check('a real four-line clear crosses 100pt and schedules exactly one transition',async()=>{
  await page.evaluate(()=>{
   currentScene.board=Array.from({length:20},()=>Array(10).fill(0));
   for(let y=16;y<20;y++)for(let x=0;x<10;x++)if(x!==4)currentScene.board[y][x]=1;
   currentScene.piece={typeIndex:1,x:4,y:0,matrix:[[1],[1],[1],[1]]};currentScene.score=0;
  });
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(()=>currentScene.score),100);
  assert.equal(await page.evaluate(()=>currentScene.audio.desired),'orchestra');
  assert.ok(await page.evaluate(()=>effectEvents.includes('tetris')));
  const start=await page.evaluate(()=>currentScene.audio.transition?.start);
  assert.ok(start>0);
  await page.waitForFunction(()=>currentScene.audio.current?.track==='orchestra' && currentScene.audio.voices.size===1);
  await page.evaluate(()=>{for(let i=0;i<100;i++)currentScene.audio.update();});
  assert.equal(await page.evaluate(()=>currentScene.audio.voices.size),1);
 });
 await check('pause is silent; resume preserves track and position',async()=>{
  await page.locator('#pause-game').click();await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>currentScene.audio.voices.size),0);
  assert.ok(await silence(page)<.00001);
  const offset=await page.evaluate(()=>currentScene.audio.offsets.orchestra);
  assert.ok(offset>.1);
  await page.locator('#pause-game').click();
  assert.equal(await page.evaluate(()=>currentScene.audio.current.track),'orchestra');
  assert.equal(await page.evaluate(()=>currentScene.audio.current.offset),offset);
 });
 await check('mute silences BGM and SE and is saved independently of ball game',async()=>{
  await page.locator('#sound-game').click();await page.waitForTimeout(150);
  assert.equal(await page.locator('#sound-game').textContent(),'音：OFF');
  assert.ok(await silence(page)<.00001);
  const before=await page.evaluate(()=>effectEvents.length);await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(()=>effectEvents.length),before);
  assert.equal(await page.evaluate(()=>localStorage.getItem('hima-tetris-muted')),'true');
  await page.reload();await page.locator('[data-game=tetris]').click();await page.getByRole('button',{name:'ゲーム開始',exact:true}).click();
  assert.equal(await page.locator('#sound-game').textContent(),'音：OFF');
  assert.equal(await page.evaluate(()=>!!currentScene.audio.context),false);
  await page.locator('#sound-game').click();await page.waitForFunction(()=>currentScene.audio.current);
 });
 await check('switching games silences Tetris; saved progress restores paused',async()=>{
  await page.locator('#reel-toggle').click();
  if(await page.evaluate(()=>currentScene.isPaused))await page.locator('#pause-game').click();
  await page.evaluate(()=>{currentScene.score=100;currentScene.audio.update();});
  await page.waitForFunction(()=>currentScene.audio.current?.track==='orchestra');
  await page.evaluate(()=>selectGame('dino'));
  assert.equal(await page.evaluate(()=>gameRegistry.tetris.audio.voices.size),0);
  await page.evaluate(()=>selectGame('tetris'));
  assert.equal(await page.evaluate(()=>currentScene.isPaused),true);
  assert.equal(await page.evaluate(()=>currentScene.audio.voices.size),0);
  await page.locator('#pause-game').click();assert.equal(await page.evaluate(()=>currentScene.audio.current.track),'orchestra');
 });
 await check('game over stops BGM, plays one jingle, and leaving stops it',async()=>{
  await page.evaluate(()=>currentScene.showResult());
  assert.equal(await page.evaluate(()=>currentScene.audio.voices.size),0);
  assert.equal(await page.evaluate(()=>currentScene.audio.effects.size),1);
  await page.getByRole('button',{name:'タイトルへ',exact:true}).click();
  assert.equal(await page.evaluate(()=>currentScene.audio.effects.size),0);
 });
 await check('restart begins the chiptune at zero',async()=>{
  await page.getByRole('button',{name:'ゲーム開始',exact:true}).click();
  assert.equal(await page.evaluate(()=>currentScene.audio.current.track),'chip');
  assert.equal(await page.evaluate(()=>currentScene.audio.current.offset),0);
  await page.locator('#pause-game').click();
 });
 await page.screenshot({path:path.join(out,'desktop.png')});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mobile.png')});
 await check('direct local index.html decodes both tracks without network',async()=>{
  if(process.env.GAME_URL)return;
  const local=await browser.newPage();local.on('pageerror',e=>errors.push(e.message));
  await local.goto('file:///'+path.resolve(__dirname,'../index.html').replaceAll('\\','/'));
  await local.locator('[data-game=tetris]').click();await local.getByRole('button',{name:'ゲーム開始',exact:true}).click();
  await local.waitForFunction(()=>currentScene.audio.buffers.chip&&currentScene.audio.buffers.orchestra&&currentScene.audio.current);
  await local.close();
 });
 await check('late loading does not play after leaving Tetris',async()=>{
  const late=await browser.newPage();late.on('pageerror',e=>errors.push(e.message));
  await late.route('**/games/tetris/sounds.js',async route=>{await new Promise(r=>setTimeout(r,400));await route.continue();});
  await late.goto(base);await late.locator('[data-game=tetris]').click();await late.getByRole('button',{name:'ゲーム開始',exact:true}).click();
  await late.locator('[data-game=dino]').click();
  await late.waitForFunction(()=>gameRegistry.tetris.audio.buffers.chip);
  assert.equal(await late.evaluate(()=>gameRegistry.tetris.audio.voices.size),0);await late.close();
 });
 await check('audio load failure keeps play working and the retry button recovers',async()=>{
  const fail=await browser.newPage();await fail.route('**/games/tetris/sounds.js',route=>route.abort());
  await fail.goto(base);await fail.locator('[data-game=tetris]').click();await fail.getByRole('button',{name:'ゲーム開始',exact:true}).click();
  await fail.waitForFunction(()=>currentScene.audio.failed);
  const before=await fail.evaluate(()=>currentScene.piece.x);await fail.keyboard.press('ArrowLeft');
  assert.equal(await fail.evaluate(()=>currentScene.piece.x),before-1);
  await fail.unroute('**/games/tetris/sounds.js');await fail.locator('#sound-game').click();
  await fail.waitForFunction(()=>currentScene.audio.current);await fail.evaluate(()=>currentScene.audio.ready);
  assert.equal(await fail.evaluate(()=>currentScene.audio.failed),false);await fail.close();
 });
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({url:base,checks,loopMetrics,errors},null,2));
 await browser.close();if(server)await new Promise(r=>server.close(r));
})().catch(async e=>{console.error(e);if(browser)await browser.close();if(server)server.close();process.exitCode=1;});
