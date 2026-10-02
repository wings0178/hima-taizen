const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const path = require('node:path');
const http = require('node:http');
const output = path.resolve(__dirname, '../artifacts');
fs.mkdirSync(output,{recursive:true});
let server;
let base = process.env.GAME_URL;
async function startServer() {
  if (base) return;
  const root = path.resolve(__dirname, '..');
  server = http.createServer((req,res) => {
    const requested = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
    if (!file.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
    fs.readFile(file,(error,data)=>{
      if(error){res.writeHead(404);res.end();return;}
      const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
      res.writeHead(200,{'Content-Type':(mime[path.extname(file)]||'text/plain')+'; charset=utf-8'});res.end(data);
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base='http://127.0.0.1:'+server.address().port;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = [];
async function check(name, fn) { await fn(); report.push(name); console.log('PASS', name); }
async function scene(page) { return page.evaluate(() => ({key:selectedGameKey,active:currentScene.isActive,paused:currentScene.isPaused,raf:window.pendingFrames.size})); }
async function assertOneLoop(page) {
  const s = await scene(page);
  assert.equal(s.raf, s.active && !s.paused ? 1 : 0, JSON.stringify(s));
}
async function touchDrag(page, selector, dx, dy, delay = 0, steps = 5) {
  const box = await page.locator(selector).boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for (let i = 1; i <= steps; i++) {
    if(delay) await sleep(delay);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/steps,y:y+dy*i/steps}]});
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await cdp.detach();
}
(async () => {
  await startServer();
  const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || undefined,headless:true});
  const errors = [];
  const page = await browser.newPage({viewport:{width:1365,height:900}});
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
    window.pendingFrames = new Set();
    window.requestAnimationFrame = callback => {
      const id = request(t => { window.pendingFrames.delete(id); callback(t); });
      window.pendingFrames.add(id); return id;
    };
    window.cancelAnimationFrame = id => { window.pendingFrames.delete(id); cancel(id); };
  });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => {if(msg.type()==='error') errors.push(msg.text());});
  await page.goto(base);
  await check('3 games and original title', async () => {
    assert.equal(await page.locator('.game-item button').count(),3);
    assert.equal(await page.locator('#ui-content h2').textContent(),'恐竜ランナー');
    await assertOneLoop(page);
    await page.screenshot({path:path.join(output, 'desktop.png')});
  });
  await check('instructions are folded and open by click or keyboard in all games', async () => {
    for(const key of ['dino','tetris','danmaku']) {
      await page.locator(`[data-game=${key}]`).click();
      const help = page.locator('.game-help');
      assert.equal(await help.getAttribute('open'),null);
      assert.equal(await help.locator('p').isVisible(),false);
      await help.locator('summary').click();
      assert.equal(await help.locator('p').isVisible(),true);
      assert.equal((await scene(page)).active,false);
      await help.locator('summary').focus();
      await page.keyboard.press('Space');
      assert.equal(await help.locator('p').isVisible(),false);
    }
    await page.locator('[data-game=dino]').click();
  });
  await check('dino jump, pause, repeated resume and restart', async () => {
    await page.getByRole('button',{name:'ゲーム開始',exact:true}).click();
    await page.keyboard.press('Space');
    assert.ok(await page.evaluate(() => currentScene.dino.vy < 0));
    await page.getByRole('button',{name:'一時停止',exact:true}).click();
    await assertOneLoop(page);
    const frozen = await page.evaluate(() => currentScene.frame);
    await sleep(150);
    assert.equal(await page.evaluate(() => currentScene.frame),frozen);
    for(let i=0;i<10;i++) await page.evaluate(() => {currentScene.togglePause();currentScene.togglePause();});
    await assertOneLoop(page);
    await page.getByRole('button',{name:'再開',exact:true}).click();
    for(let i=0;i<10;i++) await page.evaluate(() => currentScene.startGame());
    await assertOneLoop(page);
    await page.getByRole('button',{name:'タイトルへ',exact:true}).click();
    await assertOneLoop(page);
  });
  await check('tetris moves, hold, drop and reset counters', async () => {
    await page.locator('[data-game=tetris]').click();
    await page.getByRole('button',{name:'ゲーム開始',exact:true}).click();
    const x = await page.evaluate(() => currentScene.piece.x);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => currentScene.piece.x),x-1);
    await page.keyboard.press('KeyC');
    assert.ok(await page.evaluate(() => currentScene.holdPieceIndex !== null));
    await page.keyboard.press('Space');
    assert.ok(await page.evaluate(() => currentScene.board.some(row => row.some(Boolean))));
    await page.evaluate(() => {currentScene.dropCounter=990;currentScene.startGame();});
    assert.ok(await page.evaluate(() => currentScene.dropCounter < 200));
    for(let i=0;i<20;i++) await page.evaluate(() => {currentScene.togglePause();currentScene.togglePause();});
    await assertOneLoop(page);
  });
  await check('reel wraparound and 90 rapid switches keep one loop', async () => {
    await page.getByRole('button',{name:'ショートモード',exact:true}).click();
    for(let i=0;i<90;i++) await page.evaluate(() => stepGame(1));
    assert.equal((await scene(page)).key,'tetris');
    await assertOneLoop(page);
    assert.ok(await page.evaluate(() => Object.values(gameRegistry).filter(s=>s.isActive).length===1));
    await page.keyboard.press('PageDown');
    assert.equal((await scene(page)).key,'danmaku');
    await page.waitForFunction(()=>!reelTransition);
    await page.screenshot({path:path.join(output, 'danmaku-desktop.png')});
    await page.keyboard.press('PageDown');
    assert.equal((await scene(page)).key,'dino');
    await page.keyboard.press('PageUp');
    assert.equal((await scene(page)).key,'danmaku');
  });
  await check('danmaku keyboard, bomb, bounded bullets, damage, clear', async () => {
    const x=await page.evaluate(() => currentScene.player.x);
    await page.keyboard.down('ArrowLeft'); await sleep(100); await page.keyboard.up('ArrowLeft');
    assert.ok(await page.evaluate(() => currentScene.player.x) < x);
    await page.keyboard.press('KeyX');
    assert.equal(await page.evaluate(() => currentScene.bombs),2);
    await page.evaluate(() => {
      currentScene.togglePause();
      for(let i=0;i<500;i++) currentScene.emitPattern();
    });
    assert.ok(await page.evaluate(() => currentScene.bullets.length <= 360));
    await page.evaluate(() => {
      currentScene.invincible=0;
      currentScene.bullets=[{x:currentScene.player.x,y:currentScene.player.y,vx:0,vy:0,color:'#fff'}];
      currentScene.update(0.01);
    });
    assert.equal(await page.evaluate(() => currentScene.lives),2);
    await page.evaluate(() => {currentScene.lives=1;currentScene.invincible=0;currentScene.bullets=[{x:currentScene.player.x,y:currentScene.player.y,vx:0,vy:0,color:'#fff'}];currentScene.update(0.01);});
    assert.equal(await page.locator('#ui-content h2').textContent(),'GAME OVER');
    await assertOneLoop(page);
    await page.getByRole('button',{name:'もう一度プレイ',exact:true}).click();
    await page.evaluate(() => {currentScene.togglePause();for(let i=0;i<3;i++){currentScene.enemy.hp=0;currentScene.update(0.01);}});
    assert.equal(await page.locator('#ui-content h2').textContent(),'クリア');
    await assertOneLoop(page);
  });
  await check('reel exit and inactive inputs do not mutate games', async () => {
    await page.getByRole('button',{name:'一覧に戻る',exact:true}).click();
    await assertOneLoop(page);
    const x=await page.evaluate(() => gameRegistry.tetris.piece.x);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => gameRegistry.tetris.piece.x),x);
  });
  await check('slide is visual only, game ticks and input continue, cancelled layers do not accumulate', async () => {
    await page.evaluate(()=>{selectGame('danmaku',false);currentScene.startGame();});
    const geometry = await page.locator('#game-canvas').boundingBox();
    const before = await page.evaluate(()=>({time:currentScene.time,x:currentScene.player.x}));
    await page.evaluate(()=>animateGameSwitch(snapshotGameSurface(),snapshotGameSurface(),1));
    assert.equal(await page.locator('.reel-transition').count(),1);
    assert.equal(await page.evaluate(()=>{
      const r=canvas.getBoundingClientRect();
      return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===canvas;
    }),true);
    await assertOneLoop(page);
    await page.keyboard.down('ArrowLeft');
    await sleep(80);
    await page.keyboard.up('ArrowLeft');
    const after=await page.evaluate(()=>({time:currentScene.time,x:currentScene.player.x}));
    assert.ok(after.time>before.time);
    assert.ok(after.x<before.x);
    assert.deepEqual(await page.locator('#game-canvas').boundingBox(),geometry);
    await page.waitForFunction(()=>!reelTransition);
    await page.evaluate(()=>{
      currentScene.togglePause();
      window.visualState=JSON.stringify({score:currentScene.score,time:currentScene.time,lives:currentScene.lives,bombs:currentScene.bombs,player:currentScene.player,enemy:currentScene.enemy,bullets:currentScene.bullets,shots:currentScene.shots,keys:[...currentScene.keys]});
      animateGameSwitch(snapshotGameSurface(),snapshotGameSurface(),-1);
    });
    await page.screenshot({path:path.join(output,'swipe-animation.png')});
    assert.equal(await page.evaluate(()=>JSON.stringify({score:currentScene.score,time:currentScene.time,lives:currentScene.lives,bombs:currentScene.bombs,player:currentScene.player,enemy:currentScene.enemy,bullets:currentScene.bullets,shots:currentScene.shots,keys:[...currentScene.keys]})===window.visualState),true);
    await page.evaluate(()=>cancelReelTransition());
    assert.equal(await page.locator('.reel-transition').count(),0);
    await page.evaluate(()=>{
      currentScene.togglePause();
      animateGameSwitch(snapshotGameSurface(),snapshotGameSurface(),1);
      currentScene.togglePause();
    });
    assert.equal(await page.locator('.reel-transition').count(),0);
    await assertOneLoop(page);
    await page.getByRole('button',{name:'ショートモード',exact:true}).click();
    for(let i=0;i<30;i++) await page.evaluate(()=>stepGame(1));
    assert.ok(await page.locator('.reel-transition').count()<=1);
    await assertOneLoop(page);
    await page.getByRole('button',{name:'一覧に戻る',exact:true}).click();
    assert.equal(await page.locator('.reel-transition').count(),0);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.getByRole('button',{name:'ショートモード',exact:true}).click();
    await page.evaluate(()=>stepGame(1));
    assert.equal(await page.locator('.reel-transition').count(),0);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.getByRole('button',{name:'一覧に戻る',exact:true}).click();
  });
  await check('enemy marker follows the horizontal position without changing game state', async () => {
    const result=await page.evaluate(()=>{
      selectGame('danmaku',false);currentScene.startGame();currentScene.togglePause();
      const samples=[];
      for(const x of [40,200,360]) {
        currentScene.enemy.x=x;
        const before=JSON.stringify({score:currentScene.score,time:currentScene.time,lives:currentScene.lives,player:currentScene.player,enemy:currentScene.enemy,bullets:currentScene.bullets});
        currentScene.draw();
        currentScene.drawEnemyMarker();
        samples.push({pixel:[...ctx.getImageData(x,canvas.height-6,1,1).data],same:before===JSON.stringify({score:currentScene.score,time:currentScene.time,lives:currentScene.lives,player:currentScene.player,enemy:currentScene.enemy,bullets:currentScene.bullets})});
      }
      return samples;
    });
    for(const sample of result){assert.deepEqual(sample.pixel,[255,71,87,255]);assert.equal(sample.same,true);}
  });
  const mobile = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  const phone = await mobile.newPage();
  phone.on('pageerror', e => errors.push(e.message));
  await phone.goto(base);
  await check('mobile title, start buttons and no overflow at 320/390/768', async () => {
    for(const size of [{width:320,height:568},{width:390,height:844},{width:768,height:1024}]) {
      await phone.setViewportSize(size);
      for(const key of ['dino','tetris','danmaku']) {
        await phone.locator(`[data-game=${key}]`).click();
        await phone.getByRole('button',{name:'ゲーム開始',exact:true}).scrollIntoViewIfNeeded();
        assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const b=await phone.getByRole('button',{name:'ゲーム開始',exact:true}).boundingBox();
        assert.ok(b.y >= 0 && b.y+b.height<=size.height);
      }
    }
    await phone.setViewportSize({width:390,height:844});
    await phone.screenshot({path:path.join(output, 'mobile.png')});
  });
  await check('normal and reel game size match at desktop, phone, tablet and landscape sizes', async () => {
    for(const size of [{width:320,height:568},{width:390,height:844},{width:768,height:1024},{width:1365,height:900},{width:844,height:390}]) {
      await phone.setViewportSize(size);
      for(const key of ['dino','tetris','danmaku']) {
        await phone.evaluate(key=>{setReelMode(false);selectGame(key,false);currentScene.startGame();},key);
        const normal=await phone.locator('#game-canvas').boundingBox();
        await phone.evaluate(()=>setReelMode(true));
        const reel=await phone.locator('#game-canvas').boundingBox();
        for(const property of ['x','y','width','height']) assert.ok(Math.abs(normal[property]-reel[property])<=1,JSON.stringify({size,key,normal,reel}));
        const nav=await phone.locator('#reel-hint').boundingBox();
        assert.ok(nav.x>=0 && nav.x+nav.width<=size.width && nav.y>=0 && nav.y+nav.height<=size.height);
      }
    }
    await phone.evaluate(()=>setReelMode(false));
    await phone.setViewportSize({width:390,height:844});
  });
  await check('real mobile reel swipe and Tetris gestures stay separate', async () => {
    await phone.locator('[data-game=dino]').click();
    await phone.getByRole('button',{name:'ショートモード',exact:true}).click();
    await touchDrag(phone,'#reel-slime',0,-180);
    assert.equal(await phone.evaluate(()=>selectedGameKey),'tetris');
    await touchDrag(phone,'#game-canvas',0,-180,0,2);
    assert.equal(await phone.evaluate(()=>selectedGameKey),'tetris');
    const touchState=await phone.evaluate(()=>({duration:Date.now()-currentScene.touchStartTime,startX:currentScene.touchStartX,startY:currentScene.touchStartY,axis:currentScene.touchAxis,swiping:currentScene.isSwiping,paused:currentScene.isPaused}));
    assert.ok(await phone.evaluate(()=>currentScene.holdPieceIndex!==null),JSON.stringify(touchState));
    await touchDrag(phone,'#game-canvas',0,180,0,2);
    assert.equal(await phone.evaluate(()=>selectedGameKey),'tetris');
    assert.ok(await phone.evaluate(()=>currentScene.board.some(row=>row.some(Boolean))));
    await phone.screenshot({path:path.join(output, 'tetris-mobile.png')});
    await touchDrag(phone,'#reel-slime',0,-180);
    assert.equal(await phone.evaluate(()=>selectedGameKey),'danmaku');
  });
  await check('mobile danmaku drag and held pad release', async () => {
    const x=await phone.evaluate(()=>currentScene.player.x);
    await touchDrag(phone,'#game-canvas',40,0);
    assert.ok(await phone.evaluate(()=>currentScene.player.x) > x);
    assert.equal(await phone.evaluate(()=>selectedGameKey),'danmaku');
    const pad=await phone.locator('[data-code=ArrowLeft]').boundingBox();
    const cdp=await mobile.newCDPSession(phone);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pad.x+pad.width/2,y:pad.y+pad.height/2}]});
    await sleep(100);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await cdp.detach();
    assert.equal(await phone.evaluate(()=>currentScene.keys.size),0);
    await phone.waitForFunction(()=>!reelTransition);
    await phone.screenshot({path:path.join(output, 'danmaku-mobile.png')});
    await phone.getByRole('button',{name:'一時停止',exact:true}).click();
    const frozen=await phone.evaluate(()=>currentScene.time);
    await sleep(150); assert.equal(await phone.evaluate(()=>currentScene.time),frozen);
    await phone.getByRole('button',{name:'再開',exact:true}).click();
    await phone.evaluate(()=>window.dispatchEvent(new Event('blur')));
    assert.equal(await phone.evaluate(()=>currentScene.isPaused),true);
  });
  await check('Tetris pause icon uses the contained image coordinates', async () => {
    await phone.locator('[data-game=tetris]').click();
    const point = await phone.evaluate(() => {
      const r=canvas.getBoundingClientRect(),s=Math.min(r.width/canvas.width,r.height/canvas.height);
      return {x:r.left+(r.width-canvas.width*s)/2+(canvas.width-25)*s,y:r.top+(r.height-canvas.height*s)/2+25*s};
    });
    await phone.touchscreen.tap(point.x,point.y);
    assert.equal(await phone.evaluate(()=>currentScene.isPaused),true);
    await phone.touchscreen.tap(point.x,point.y);
    assert.equal(await phone.evaluate(()=>currentScene.isPaused),false);
    const cdp=await mobile.newCDPSession(phone);
    const box=await phone.locator('#game-canvas').boundingBox();
    const p={x:box.x+box.width/2,y:box.y+box.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    await cdp.detach();
    assert.equal(await phone.evaluate(()=>currentScene.gestureActive),false);
  });
  await check('reel swipe direction, cancelled and horizontal gestures', async () => {
    await touchDrag(phone,'#reel-slime',0,50);
    assert.equal(await phone.evaluate(()=>selectedGameKey),'dino');
    await touchDrag(phone,'#game-canvas',65,0);
    assert.equal(await phone.evaluate(()=>selectedGameKey),'dino');
    const cdp=await mobile.newCDPSession(phone);
    const b=await phone.locator('#game-canvas').boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    await cdp.detach();
    assert.equal(await phone.evaluate(()=>selectedGameKey),'dino');
  });
  await check('slime stretches while pulling and isolates navigation from game input', async () => {
    await phone.evaluate(()=>{selectGame('tetris',true);currentScene.togglePause();});
    const before = await phone.evaluate(()=>JSON.stringify({piece:currentScene.piece,board:currentScene.board,hold:currentScene.holdPieceIndex,score:currentScene.score}));
    const box = await phone.locator('#reel-slime').boundingBox();
    const x=box.x+box.width/2,y=box.y+box.height/2;
    const cdp=await mobile.newCDPSession(phone);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-70}]});
    assert.equal(await phone.locator('.reel-drag-preview').count(),1);
    assert.equal(await phone.locator('#slime-stretch').isVisible(),true);
    assert.equal(await phone.locator('#slime-stretch').getAttribute('class'),'ready');
    const shape=await phone.locator('#slime-stretch-body').getAttribute('d');
    assert.ok(shape.length>50);
    assert.equal(await phone.evaluate(()=>JSON.stringify({piece:currentScene.piece,board:currentScene.board,hold:currentScene.holdPieceIndex,score:currentScene.score})),before);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+15,y:y-180}]});
    assert.notEqual(await phone.locator('#slime-stretch-body').getAttribute('d'),shape);
    await phone.screenshot({path:path.join(output,'slime-pull-mobile.png')});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await phone.evaluate(()=>selectedGameKey),'danmaku');
    assert.equal(await phone.evaluate(()=>JSON.stringify({piece:gameRegistry.tetris.piece,board:gameRegistry.tetris.board,hold:gameRegistry.tetris.holdPieceIndex,score:gameRegistry.tetris.score})),before);
    const ship=await phone.evaluate(()=>({...currentScene.player}));
    await touchDrag(phone,'#reel-slime',0,-120,80);
    assert.equal(await phone.evaluate(()=>selectedGameKey),'dino');
    assert.deepEqual(await phone.evaluate(()=>gameRegistry.danmaku.player),ship);
    await phone.evaluate(()=>selectGame('danmaku',true));
    const playerY=await phone.evaluate(()=>currentScene.player.y);
    await touchDrag(phone,'#game-canvas',0,-180);
    assert.equal(await phone.evaluate(()=>selectedGameKey),'danmaku');
    assert.ok(await phone.evaluate(()=>currentScene.player.y)<playerY);
    assert.equal(await phone.locator('.reel-drag-preview').count(),0);
    await cdp.detach();
  });
  await check('slime taps, short pulls, reversal, pointer loss and multiple fingers never switch', async () => {
    await phone.evaluate(()=>selectGame('tetris',true));
    const before=await phone.evaluate(()=>({hold:currentScene.holdPieceIndex,score:currentScene.score,board:JSON.stringify(currentScene.board)}));
    await phone.locator('#reel-slime').tap();
    await touchDrag(phone,'#reel-slime',0,-25);
    await touchDrag(phone,'#reel-slime',100,0);
    const cdp=await mobile.newCDPSession(phone);
    const box=await phone.locator('#reel-slime').boundingBox(),p={x:box.x+32,y:box.y+32};
    for(const ending of ['touchEnd','touchCancel']) {
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x,y:p.y-130}]});
      if(ending==='touchEnd') await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});
      await cdp.send('Input.dispatchTouchEvent',{type:ending,touchPoints:[]});
      assert.equal(await phone.evaluate(()=>selectedGameKey),'tetris');
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x,y:p.y-130,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y-130,id:1},{x:p.x+80,y:p.y-130,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await phone.evaluate(()=>selectedGameKey),'tetris');
    assert.equal(await phone.evaluate(()=>reelGesture),null);
    assert.equal(await phone.locator('.reel-drag-preview').count(),0);
    assert.deepEqual(await phone.evaluate(()=>({hold:currentScene.holdPieceIndex,score:currentScene.score,board:JSON.stringify(currentScene.board)})),before);
    await cdp.detach();
    await phone.waitForFunction(()=>!slimeReturn);
    assert.equal(await phone.locator('#slime-stretch').isVisible(),false);
  });
  await check('settings default left, persist right, preserve state and close with keyboard', async () => {
    await phone.evaluate(()=>{setReelMode(false);selectGame('danmaku',false);});
    assert.equal(await phone.locator('#reel-slime').isVisible(),false);
    await phone.locator('#settings-open').click();
    assert.equal(await phone.locator('input[value=left]').isChecked(),true);
    await phone.locator('input[value=right]').check();
    assert.equal(await phone.evaluate(()=>JSON.parse(localStorage.getItem(settingsKey)).slimeSide),'right');
    await phone.screenshot({path:path.join(output,'slime-settings-mobile.png')});
    await phone.getByRole('button',{name:'閉じる',exact:true}).click();
    await phone.reload();
    await phone.getByRole('button',{name:'ショートモード',exact:true}).click();
    assert.equal(await phone.locator('#reel-slime').getAttribute('data-side'),'right');
    const right=await phone.locator('#reel-slime').boundingBox();
    assert.ok(right.x>250);
    await touchDrag(phone,'#reel-slime',0,-120);
    assert.equal(await phone.evaluate(()=>selectedGameKey),'tetris');
    await phone.locator('#settings-open').click();
    const frozen=await phone.evaluate(()=>JSON.stringify({piece:currentScene.piece,board:currentScene.board,score:currentScene.score}));
    await sleep(100);
    await phone.keyboard.press('PageDown');
    assert.equal(await phone.evaluate(()=>selectedGameKey),'tetris');
    assert.equal(await phone.evaluate(()=>currentScene.isPaused),true);
    assert.equal(await phone.evaluate(()=>JSON.stringify({piece:currentScene.piece,board:currentScene.board,score:currentScene.score})),frozen);
    await phone.locator('input[value=left]').check();
    await phone.keyboard.press('Escape');
    await phone.waitForFunction(()=>!settingsDialog.open && !currentScene.isPaused);
    assert.equal(await phone.locator('#settings-open').evaluate(e=>e===document.activeElement),true);
    await phone.evaluate(()=>currentScene.togglePause());
    await phone.locator('#settings-open').click();
    await phone.getByRole('button',{name:'閉じる',exact:true}).click();
    assert.equal(await phone.evaluate(()=>currentScene.isPaused),true);
    await phone.evaluate(()=>selectGame('dino',true));
  });
  await check('unavailable settings storage falls back and reports save failure without breaking games', async () => {
    const isolated=await browser.newPage();
    isolated.on('pageerror',e=>errors.push(e.message));
    await isolated.addInitScript(()=>{
      Storage.prototype.getItem=()=>{throw new Error('blocked');};
      Storage.prototype.setItem=()=>{throw new Error('blocked');};
    });
    await isolated.goto(base);
    await isolated.locator('#settings-open').click();
    assert.equal(await isolated.locator('input[value=left]').isChecked(),true);
    await isolated.locator('input[value=right]').check();
    assert.equal(await isolated.locator('#settings-error').isVisible(),true);
    await isolated.getByRole('button',{name:'閉じる',exact:true}).click();
    await isolated.getByRole('button',{name:'ショートモード',exact:true}).click();
    assert.equal(await isolated.locator('#reel-slime').getAttribute('data-side'),'right');
    await isolated.close();
  });

  await check('mouse wheel on the canvas changes games once per burst in both directions', async () => {
    await page.evaluate(()=>{setReelMode(true);selectGame('dino',true);});
    const box=await page.locator('#game-canvas').boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.wheel(0,120);
    await page.waitForFunction(()=>selectedGameKey==='tetris');
    for(let i=0;i<5;i++) await page.mouse.wheel(0,100);
    assert.equal((await scene(page)).key,'tetris');
    await assertOneLoop(page);
    await sleep(220);
    await page.mouse.wheel(0,-120);
    await page.waitForFunction(()=>selectedGameKey==='dino');
    await page.waitForFunction(()=>!reelTransition);
    const stage=await page.locator('#reel-slime').boundingBox();
    await page.mouse.move(stage.x+stage.width/2,stage.y+stage.height/2);
    await page.mouse.down();
    await page.mouse.move(stage.x+stage.width/2,stage.y+stage.height/2-180,{steps:5});
    await page.mouse.up();
    assert.equal((await scene(page)).key,'tetris');
    await assertOneLoop(page);
  });
  await check('reel swipes also work from result screens', async () => {
    await phone.evaluate(()=>{selectGame('dino',true);currentScene.showResult();});
    await touchDrag(phone,'#reel-slime',0,-180);
    assert.equal(await phone.evaluate(()=>selectedGameKey),'tetris');
    await phone.waitForFunction(()=>!reelTransition);
  });
  await check('landscape canvas and navigation remain visible', async () => {
    await phone.setViewportSize({width:844,height:390});
    for(const key of ['dino','tetris','danmaku']) {
      await phone.locator(`[data-game=${key}]`).click();
      const rect=await phone.locator('#game-canvas').boundingBox();
      assert.ok(rect.width>100 && rect.height>100,JSON.stringify(rect));
      const nav=await phone.locator('#reel-hint').boundingBox();
      assert.ok(nav.y+nav.height<=390);
    }
    await phone.screenshot({path:path.join(output, 'landscape.png')});
  });
  await check('slime stays reachable in both corners at mobile sizes and supports reduced motion and keyboard', async () => {
    for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]) {
      await phone.setViewportSize(size);
      for(const side of ['left','right']) {
        await phone.evaluate(side=>applySlimeSide(side),side);
        for(const key of ['dino','tetris','danmaku']) {
          await phone.evaluate(key=>selectGame(key,true),key);
          const b=await phone.locator('#reel-slime').boundingBox();
          assert.ok(b.x>=0 && b.x+b.width<=size.width && b.y>=0 && b.y+b.height<=size.height,JSON.stringify({size,side,key,b}));
          const reachable=await phone.locator('#reel-slime').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
          assert.equal(reachable,true);
        }
      }
    }
    await phone.setViewportSize({width:390,height:844});
    await phone.evaluate(()=>{applySlimeSide('left');selectGame('dino',true);});
    await phone.emulateMedia({reducedMotion:'reduce'});
    await touchDrag(phone,'#reel-slime',0,-120);
    assert.equal(await phone.evaluate(()=>selectedGameKey),'tetris');
    assert.equal(await phone.locator('.reel-transition').count(),0);
    assert.equal(await phone.locator('#slime-stretch').isVisible(),false);
    assert.equal(await phone.locator('#reel-slime svg').evaluate(e=>getComputedStyle(e).animationName),'none');
    await phone.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('#reel-slime').focus();
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.evaluate(()=>selectedGameKey),'danmaku');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(()=>selectedGameKey),'tetris');
    await assertOneLoop(page);
    await phone.screenshot({path:path.join(output,'slime-idle-mobile.png')});
  });
  await check('shared frame and slime position stay identical across all games and title/play/pause/result states', async () => {
    for(const size of [{width:320,height:568},{width:390,height:844},{width:768,height:1024},{width:1365,height:900},{width:844,height:390},{width:640,height:360}]) {
      await phone.setViewportSize(size);
      for(const side of ['left','right']) {
        await phone.evaluate(side=>{setReelMode(true);applySlimeSide(side);},side);
        let baseline;
        for(const key of ['dino','tetris','danmaku']) {
          for(const state of ['play','pause','result','title']) {
            await phone.evaluate(({key,state})=>{
              selectGame(key,true);
              if(state==='pause') currentScene.togglePause();
              if(state==='result') currentScene.showResult();
              if(state==='title') currentScene.showTitle();
            },{key,state});
            const geometry=await phone.evaluate(()=>{
              const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
              return {frame:rect('game-stage'),slime:rect('reel-slime'),dock:rect('game-dock')};
            });
            if(!baseline) baseline=geometry;
            for(const area of ['frame','slime','dock']) for(const property of ['x','y','width','height']) {
              assert.ok(Math.abs(baseline[area][property]-geometry[area][property])<=1,JSON.stringify({size,side,key,state,baseline,geometry}));
            }
            const reachable=await phone.locator('#reel-slime').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
            assert.equal(reachable,true,JSON.stringify({size,side,key,state}));
            assert.ok(geometry.slime.y>=geometry.frame.y+geometry.frame.height,JSON.stringify(geometry));
          }
        }
      }
    }
  });
  await check('game content keeps its aspect ratio and useful size without overlapping buttons at narrow and landscape sizes', async () => {
    for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:640,height:360}]) {
      await phone.setViewportSize(size);
      for(const key of ['dino','tetris','danmaku']) {
        await phone.evaluate(key=>{applySlimeSide('left');selectGame(key,true);currentScene.draw();},key);
        const content=await phone.evaluate(()=>{
          const r=canvas.getBoundingClientRect(),scale=Math.min(r.width/canvas.width,r.height/canvas.height);
          const left=r.x+(r.width-canvas.width*scale)/2,top=r.y+(r.height-canvas.height*scale)/2;
          const a=canvasPoint(left+.5*scale,top+.5*scale),b=canvasPoint(left+(canvas.width-.5)*scale,top+(canvas.height-.5)*scale);
          return {width:canvas.width*scale,height:canvas.height*scale,ratio:canvas.width/canvas.height,scale,a,b,frame:{x:r.x,y:r.y,width:r.width,height:r.height}};
        });
        assert.ok(Math.abs(content.width/content.height-content.ratio)<.001);
        assert.ok(content.width<=content.frame.width+1 && content.height<=content.frame.height+1);
        assert.ok(content.a.inside && content.b.inside);
        assert.ok(Math.abs(content.a.x-.5)<.01 && Math.abs(content.a.y-.5)<.01);
        if(key==='dino') assert.ok(content.width>=280 && content.height>=140,JSON.stringify({size,key,content}));
        if(key==='tetris') assert.ok(content.scale*25>=10,JSON.stringify({size,key,content}));
        if(key==='danmaku') assert.ok(content.height>=220 && content.width>=145,JSON.stringify({size,key,content}));
        for(const selector of ['#play-controls .ui-btn:not([hidden])','#virtual-controls .v-btn','#reel-slime']) {
          for(const button of await phone.locator(selector).all()) {
            if(!await button.isVisible()) continue;
            const r=await button.boundingBox();
            assert.ok(r.x>=0 && r.x+r.width<=size.width+1 && r.y>=0 && r.y+r.height<=size.height+1,JSON.stringify({size,key,r}));
            const reachable=await button.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
            assert.equal(reachable,true,JSON.stringify({size,key,selector,r}));
            assert.ok(r.y+r.height<=content.frame.y+1 || r.y>=content.frame.y+content.frame.height-1);
          }
        }
        if(size.width===390 || size.width===320) {
          await phone.waitForFunction(()=>!slimeReturn && !reelTransition);
          await sleep(70);
          assert.equal(await phone.locator('#reel-slime svg').isVisible(),true);
          await phone.screenshot({path:path.join(output,`shared-${key}-${size.width}.png`)});
        }
      }
    }
  });
  await check('new scenes inherit the common frame and controls without game-name layout rules', async () => {
    await phone.setViewportSize({width:390,height:844});
    const result=await phone.evaluate(()=>{
      selectGame('dino',true);
      const geometry=()=>{const r=gameStage.getBoundingClientRect(),s=reelSlime.getBoundingClientRect();return {frame:[r.x,r.y,r.width,r.height],slime:[s.x,s.y,s.width,s.height]};};
      const before=geometry();
      class LayoutScene extends GameScene {
        constructor(){super('表示確認',{controls:['dpad','bomb']});}
        startGame(){this.hideUI();canvas.width=1200;canvas.height=400;this.isActive=true;this.draw();}
        draw(){ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);}
      }
      gameRegistry.layoutTest=new LayoutScene();
      try {
        selectGame('layoutTest',true);
        return {before,after:geometry(),pad:getComputedStyle(document.getElementById('v-dpad')).display,bomb:document.getElementById('bomb-game').hidden};
      } finally {selectGame('dino',true);delete gameRegistry.layoutTest;renderSidebar();selectGame('dino',true);}
    });
    assert.deepEqual(result.after,result.before);
    assert.equal(result.pad,'flex');assert.equal(result.bomb,false);
  });
  assert.deepEqual(errors,[]);
  report.push('No JavaScript errors');
  fs.writeFileSync(path.join(output, 'verification.json'),JSON.stringify({url:base,checks:report,errors},null,2));
  await browser.close();
  if(server) await new Promise(resolve=>server.close(resolve));
})().catch(e=>{console.error(e);if(server)server.close();process.exit(1);});
