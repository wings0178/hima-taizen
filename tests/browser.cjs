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
async function touchDrag(page, selector, dx, dy) {
  const box = await page.locator(selector).boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/5,y:y+dy*i/5}]});
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
  await check('real mobile reel swipe and Tetris gestures stay separate', async () => {
    await phone.locator('[data-game=dino]').click();
    await phone.getByRole('button',{name:'ショートモード',exact:true}).click();
    await touchDrag(phone,'#reel-swipe',0,-80);
    assert.equal(await phone.evaluate(()=>selectedGameKey),'tetris');
    await touchDrag(phone,'#game-canvas',0,-70);
    assert.equal(await phone.evaluate(()=>selectedGameKey),'tetris');
    assert.ok(await phone.evaluate(()=>currentScene.holdPieceIndex!==null));
    await touchDrag(phone,'#game-canvas',0,70);
    assert.equal(await phone.evaluate(()=>selectedGameKey),'tetris');
    assert.ok(await phone.evaluate(()=>currentScene.board.some(row=>row.some(Boolean))));
    await phone.screenshot({path:path.join(output, 'tetris-mobile.png')});
    await touchDrag(phone,'#reel-swipe',0,-80);
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
    await touchDrag(phone,'#reel-swipe',0,65);
    assert.equal(await phone.evaluate(()=>selectedGameKey),'dino');
    await touchDrag(phone,'#reel-swipe',65,0);
    assert.equal(await phone.evaluate(()=>selectedGameKey),'dino');
    const cdp=await mobile.newCDPSession(phone);
    const b=await phone.locator('#reel-swipe').boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    await cdp.detach();
    assert.equal(await phone.evaluate(()=>selectedGameKey),'dino');
  });
  await check('landscape canvas and navigation remain visible', async () => {
    await phone.setViewportSize({width:844,height:390});
    for(const key of ['dino','tetris','danmaku']) {
      await phone.locator(`[data-game=${key}]`).click();
      const rect=await phone.locator('#game-canvas').boundingBox();
      assert.ok(rect.width>100 && rect.height>100,JSON.stringify(rect));
      const nav=await phone.locator('#reel-nav').boundingBox();
      assert.ok(nav.y+nav.height<=390);
    }
    await phone.screenshot({path:path.join(output, 'landscape.png')});
  });
  assert.deepEqual(errors,[]);
  report.push('No JavaScript errors');
  fs.writeFileSync(path.join(output, 'verification.json'),JSON.stringify({url:base,checks:report,errors},null,2));
  await browser.close();
  if(server) await new Promise(resolve=>server.close(resolve));
})().catch(e=>{console.error(e);if(server)server.close();process.exit(1);});
