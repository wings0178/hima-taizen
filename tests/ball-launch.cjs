const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts/ball');fs.mkdirSync(output,{recursive:true});
let server,base=process.env.GAME_URL;const report=[],errors=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function check(name,fn){await fn();report.push(name);console.log('PASS',name);}
async function start(page){await page.evaluate(()=>selectGame('ball',true,false));assert.equal(await page.evaluate(()=>currentScene.isActive),true);}
async function launchPosition(page){return page.evaluate(()=>{const r=canvas.getBoundingClientRect(),s=Math.min(r.width/canvas.width,r.height/canvas.height),p=currentScene.screenPoint(currentScene.launchOrigin);return{x:r.x+(r.width-canvas.width*s)/2+p.x*s,y:r.y+(r.height-canvas.height*s)/2+p.y*s,scale:s};});}
async function drag(page,dx,dy,touch=false,cancel=false){
 const p=await launchPosition(page);
 if(touch){const c=await page.context().newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});for(let i=1;i<=5;i++)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+dx*p.scale*i/5,y:p.y+dy*p.scale*i/5}]});await c.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await c.detach();}
 else{await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+dx*p.scale,p.y+dy*p.scale,{steps:5});await page.mouse.up();}
}
async function state(page){return page.evaluate(()=>({left:currentScene.shotsLeft,score:currentScene.score,pattern:currentScene.patternIndex,elapsed:currentScene.elapsed,positions:currentScene.blocks.map(b=>[...b.body.position.toArray(),...b.body.quaternion.toArray()])}));}
async function geometry(page){return page.evaluate(()=>Object.fromEntries(['game-stage','game-dock','reel-slime'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,[r.x,r.y,r.width,r.height]];})));}
(async()=>{
 if(!base){server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':decodeURIComponent(new URL(req.url,'http://localhost').pathname)));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);res.end();return;}const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wav':'audio/wav'};res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain'});res.end(data);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||undefined,headless:true});
 const page=await browser.newPage({viewport:{width:1365,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const request=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window);window.pendingFrames=new Set();window.requestAnimationFrame=cb=>{const id=request(t=>{pendingFrames.delete(id);cb(t)});pendingFrames.add(id);return id};window.cancelAnimationFrame=id=>{pendingFrames.delete(id);cancel(id)};});
 await page.goto(base);
 await check('four games, title/help, credits and full four-game reel cycle',async()=>{
  assert.equal(await page.locator('.game-item button').count(),4);assert.deepEqual(await page.evaluate(()=>reelGameKeys()),['dino','tetris','danmaku','ball']);
  await page.locator('[data-game=ball]').click();assert.equal(await page.locator('#ui-content h2').innerText(),'ボール発射ゲーム');
  await page.locator('.game-help').first().locator('summary').click();assert.ok((await page.locator('#ui-content').innerText()).includes('3球'));
  await page.evaluate(()=>{setReelMode(true);selectGame('danmaku',true);stepGame(1);});assert.equal(await page.evaluate(()=>selectedGameKey),'ball');
  await page.evaluate(()=>stepGame(1));assert.equal(await page.evaluate(()=>selectedGameKey),'dino');await start(page);
 });
 await check('five stable physical stacks, ball contacts cause collapse and score, bridge and towers can be aimed',async()=>{
  const result=await page.evaluate(()=>{
   let results=[];currentScene.pauseGame();
   for(let pattern=0;pattern<5;pattern++){
    const s=currentScene;s.isActive=true;s.isPaused=true;s.resetRound(pattern);const before=s.blocks.map(b=>b.body.position.clone());
    for(let i=0;i<240;i++)s.update(1/120);
    const drift=Math.max(...s.blocks.map((b,i)=>b.body.position.distanceTo(before[i])));
    s.aimX=pattern===3?.33:0;s.power=.8;s.isPaused=false;s.fire();s.isPaused=true;
    for(let i=0;i<300 && s.isActive;i++)s.update(1/120);
    results.push({pattern,drift,score:s.score,count:s.blocks.length});
   }return results;
  });
  for(const r of result){assert.ok(r.drift<.02,JSON.stringify(r));assert.ok(r.score>0,JSON.stringify(r));assert.ok(r.score<=r.count);}
  fs.writeFileSync(path.join(output,'physics.json'),JSON.stringify(result,null,2));await start(page);
 });
 await check('mouse pull changes direction/power, exactly one ball fires, click and upward pull do not fire',async()=>{
  await drag(page,90,170);assert.equal(await page.evaluate(()=>currentScene.shotsLeft),2);assert.ok(await page.evaluate(()=>currentScene.balls[0].body.velocity.x<0));
  await start(page);await drag(page,0,0);assert.equal(await page.evaluate(()=>currentScene.shotsLeft),3);
  await drag(page,0,-80);assert.equal(await page.evaluate(()=>currentScene.shotsLeft),3);await drag(page,-95,100);assert.equal(await page.evaluate(()=>currentScene.shotsLeft),2);
 });
 await check('keyboard charge/release launches once and pause cancels a charged shot',async()=>{
  await start(page);await page.locator('#game-canvas').click({position:{x:5,y:5}});await page.keyboard.down('ArrowRight');await sleep(120);await page.keyboard.up('ArrowRight');
  assert.ok(await page.evaluate(()=>currentScene.aimX>0));await page.keyboard.down('Space');await sleep(350);await page.keyboard.up('Space');assert.equal(await page.evaluate(()=>currentScene.shotsLeft),2);
  await page.keyboard.down('Space');await page.keyboard.press('KeyP');await page.keyboard.up('Space');assert.equal(await page.evaluate(()=>currentScene.shotsLeft),2);
 });
 await check('CC0 sounds decode, play only on live interactions, stop on pause; mute persists',async()=>{
  await start(page);await drag(page,0,120);await page.evaluate(()=>currentScene.audioReady);
  assert.deepEqual(await page.evaluate(()=>Object.keys(currentScene.audioBuffers).sort()),['launch','plate','wood1','wood2']);
  await page.evaluate(()=>currentScene.playSound('wood1',.2));assert.ok(await page.evaluate(()=>currentScene.playingSounds.size>0));
  await page.evaluate(()=>currentScene.pauseGame());assert.equal(await page.evaluate(()=>currentScene.playingSounds.size),0);
  await page.locator('#sound-game').click();assert.equal(await page.evaluate(()=>currentScene.muted),true);
  await page.reload();await start(page);assert.equal(await page.locator('#sound-game').innerText(),'音：OFF');await drag(page,0,140);assert.equal(await page.evaluate(()=>currentScene.playingSounds?.size||0),0);
  await page.locator('#sound-game').click();assert.equal(await page.evaluate(()=>currentScene.muted),false);
 });
 await check('four-game suspend/restore preserves bodies, score and balls, resume tap does not shoot',async()=>{
  await page.evaluate(()=>{reelSettings.games=Object.keys(gameRegistry);reelSettings.keepProgress=true;setReelMode(true);selectGame('ball',true,false);});await drag(page,0,140);
  await page.evaluate(()=>currentScene.pauseGame());const saved=await state(page);
  await page.evaluate(()=>{stepGame(1);stepGame(1);stepGame(1);stepGame(1)});assert.equal(await page.evaluate(()=>selectedGameKey),'ball');assert.equal(await page.evaluate(()=>currentScene.isPaused),true);assert.deepEqual(await state(page),saved);
  await page.evaluate(()=>cancelReelTransition());await page.locator('#game-canvas').click();assert.equal(await page.evaluate(()=>currentScene.isPaused),false);assert.equal(await page.evaluate(()=>currentScene.shotsLeft),2);
  await page.evaluate(()=>currentScene.pauseGame());
 });
 await check('three-ball exhaustion reaches result; next layout differs; loop remains singular after repeated changes',async()=>{
  await start(page);await page.evaluate(()=>{currentScene.pauseGame();currentScene.isPaused=false;for(let i=0;i<3;i++){currentScene.aimX=1;currentScene.sinceShot=1;currentScene.fire();}currentScene.isPaused=true;for(let i=0;i<650 && currentScene.isActive;i++)currentScene.update(1/120);});
  assert.equal(await page.locator('#game-canvas').isVisible(),false);assert.equal(await page.getByRole('button',{name:'次の積み方'}).count(),1);
  const previous=await page.evaluate(()=>currentScene.patternIndex);await page.getByRole('button',{name:'次の積み方'}).click();assert.notEqual(await page.evaluate(()=>currentScene.patternIndex),previous);
  await page.evaluate(()=>{for(let i=0;i<32;i++)stepGame(1);});assert.equal(await page.evaluate(()=>pendingFrames.size),await page.evaluate(()=>currentScene.isPaused?0:1));assert.equal(await page.evaluate(()=>Object.values(gameRegistry).filter(s=>s.isActive).length),1);
  await page.evaluate(()=>{if(currentScene.isPaused)currentScene.togglePause();});assert.equal(await page.evaluate(()=>pendingFrames.size),1);
 });
 const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});phone.on('pageerror',e=>errors.push(e.message));await phone.goto(base);
 await check('native touch pull/cancel and shot gesture stay separate from slime swipes',async()=>{
  await phone.evaluate(()=>{setReelMode(true);selectGame('ball',true,false);});await drag(phone,-60,165,true);assert.equal(await phone.evaluate(()=>selectedGameKey),'ball');assert.equal(await phone.evaluate(()=>currentScene.shotsLeft),2);
  await sleep(500);await drag(phone,30,80,true,true);assert.equal(await phone.evaluate(()=>currentScene.shotsLeft),2);assert.equal(await phone.evaluate(()=>currentScene.pointerId),null);
  await phone.screenshot({path:path.join(output,'mobile-play.png')});
 });
 await check('shared frame/slime stay fixed on six sizes in title, play, pause, result; launch has pull room and no clipping',async()=>{
  for(const size of [{width:320,height:568},{width:390,height:844},{width:768,height:1024},{width:1365,height:900},{width:844,height:390},{width:640,height:360}]){
   await phone.setViewportSize(size);
   for(const side of ['left','right']){
    await phone.evaluate(side=>{applySlimeSide(side);selectGame('dino',true,false);currentScene.pauseGame();},side);const before=await geometry(phone);
    for(const stage of ['play','pause','result','title']){
     await start(phone);if(stage==='pause')await phone.evaluate(()=>currentScene.pauseGame());if(stage==='result')await phone.evaluate(()=>currentScene.showResult());if(stage==='title')await phone.evaluate(()=>currentScene.showTitle());
     assert.deepEqual(await geometry(phone),before);assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     for(const button of await phone.locator('#play-controls button:not([hidden])').all())if(await button.isVisible()){const box=await button.boundingBox();assert.ok(box.x>=0 && box.x+box.width<=size.width+1);}
    }
    await start(phone);const projection=await phone.evaluate(()=>({origin:currentScene.screenPoint(currentScene.launchOrigin),top:currentScene.screenPoint(new Ball3D.THREE.Vector3(0,5.1,-2))}));assert.ok(projection.origin.y<680);assert.ok(projection.top.y>82);
   }
  }
  await phone.setViewportSize({width:390,height:844});await phone.evaluate(()=>{setReelMode(false);selectGame('ball',true,false);currentScene.resetRound(0);currentScene.draw();});await phone.screenshot({path:path.join(output,'mobile.png')});
  await phone.setViewportSize({width:844,height:390});await start(phone);await phone.screenshot({path:path.join(output,'landscape.png')});
  await start(page);await page.evaluate(()=>{setReelMode(false);selectGame('ball',true,false);currentScene.resetRound(3);currentScene.draw();});await page.screenshot({path:path.join(output,'desktop.png')});
 });
 await check('no WebGL shows recovery instructions while original games remain playable',async()=>{
  const limited=await browser.newPage();await limited.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2')return null;return get.call(this,type,...args);};});await limited.goto(base);await limited.evaluate(()=>selectGame('ball',true,false));assert.equal(await limited.locator('#ui-content h2').innerText(),'3D画面を表示できません');await limited.evaluate(()=>selectGame('tetris',true,false));assert.equal(await limited.evaluate(()=>currentScene.isActive),true);await limited.close();
 });
 if(!process.env.GAME_URL)await check('local file supports 3D and embedded WAV with no CDN/server',async()=>{
  const local=await browser.newPage();await local.goto('file:///'+path.join(root,'index.html').replaceAll('\\','/'));await start(local);await drag(local,0,130);await local.evaluate(()=>currentScene.audioReady);assert.equal(await local.evaluate(()=>currentScene.shotsLeft),2);assert.equal(await local.evaluate(()=>Object.keys(currentScene.audioBuffers).length),4);await local.close();
 });
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({url:base,checks:report,errors},null,2));
 await browser.close();if(server)await new Promise(r=>server.close(r));
})().catch(e=>{console.error(e);if(server)server.close();process.exit(1)});
