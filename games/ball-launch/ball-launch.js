class BallLaunchGameScene extends GameScene {
  constructor() {
    super('ボール発射ゲーム', {controls: ['sound']});
    this.muted = false;
    try { this.muted = localStorage.getItem('hima-ball-muted') === 'true'; } catch (_) {}
    this.down = e => this.pointerDown(e);
    this.move = e => this.pointerMove(e);
    this.up = e => this.pointerUp(e);
    this.cancel = () => { this.drag = null; this.pointerId = null; };
    this.keyDown = e => this.handleKey(e, true);
    this.keyUp = e => this.handleKey(e, false);
    this.keys = new Set();
    this.patternNames = ['ピラミッド', '壁', '交互積み', '橋', '塔'];
    this.patternIndex = -1;
    this.shotCount = 0;
  }
  showTitle() {
    this.showUI(`<h2>${this.name}</h2><details class="game-help"><summary>操作方法</summary><p>画面下のボールを引っ張り、離して発射。下に長く引くほど強く飛びます。左右に引いて狙いを調整。<br>3球で積み木を崩します。積み方は毎回ランダムです。<br>キーボード：← → で狙い、Spaceを長押しして発射。P / Escで一時停止。</p></details><div class="btn-group"><button class="ui-btn btn-primary" onclick="currentScene.startGame()">ゲーム開始</button></div><details class="game-help ball-credits"><summary>素材・ライセンス</summary><p>効果音：<a href="https://kenney.nl/assets/impact-sounds" target="_blank" rel="noopener">Kenney Impact Sounds</a> / <a href="https://kenney.nl/assets/rpg-audio" target="_blank" rel="noopener">RPG Audio</a>（CC0）。3D描画：Three.js、物理演算：cannon-es（MIT）。</p></details>`);
  }
  ensureEngine() {
    if (this.renderer) return;
    const {THREE} = Ball3D;
    this.renderer = new THREE.WebGLRenderer({antialias:true, alpha:false});
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(720, 900, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(52, .8, .1, 80);
    this.camera.position.set(0, 5.3, 13.7);
    this.camera.lookAt(0, .6, 1.2);
    this.ballGeometry = new THREE.SphereGeometry(.32, 20, 14);
    this.ballMaterial = new THREE.MeshStandardMaterial({color:0xff5967, roughness:.28, metalness:.08});
    this.blockGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.blockMaterials = [0xefb56d,0xe87c65,0x79b8b0,0x8f9fbf,0xf0d28a].map(color => new THREE.MeshStandardMaterial({color,roughness:.72}));
    this.staticMaterials = [];
    this.staticGeometry = [];
    this.renderer.domElement.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      this.engineLost = true;
      if (currentScene === this) this.showEngineError();
    });
  }
  showEngineError() {
    this.showUI('<h2>3D画面を表示できません</h2><p>ページを再読み込みしてください。改善しない場合は、別のブラウザーでお試しください。</p>');
  }
  startGame() {
    this.unlockAudio();
    this.hideUI();
    canvas.width = 720; canvas.height = 900;
    try { this.ensureEngine(); if (this.engineLost) throw new Error('context lost'); }
    catch (_) { this.showEngineError(); return; }
    this.resetRound();
    this.isActive = true;
    this.lastTime = performance.now();
    this.attachListeners(); this.syncSound(); this.draw();
    this.reqId = requestAnimationFrame(t => this.loop(t));
  }
  resetRound(forcedPattern) {
    const {THREE,CANNON} = Ball3D;
    if (this.scene) {
      this.scene.traverse(object=>{if(object.isLight && object.shadow?.map)object.shadow.map.dispose();});
      for (const g of this.staticGeometry) g.dispose();
      for (const m of this.staticMaterials) m.dispose();
    }
    this.staticGeometry = []; this.staticMaterials = [];
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x243542);
    this.scene.fog = new THREE.Fog(0x243542, 24, 48);
    this.scene.add(new THREE.HemisphereLight(0xfff4dc, 0x536477, 2.4));
    const light = new THREE.DirectionalLight(0xffeed5, 3.1);
    light.position.set(-5, 11, 7); light.castShadow = true;
    light.shadow.mapSize.set(1024,1024);
    Object.assign(light.shadow.camera,{left:-10,right:10,top:10,bottom:-10});
    light.shadow.bias = -.0008;
    this.scene.add(light);
    this.world = new CANNON.World({gravity:new CANNON.Vec3(0,-9.82,0),allowSleep:true});
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.solver.iterations = 14;
    this.world.defaultContactMaterial.friction = .48;
    this.world.defaultContactMaterial.restitution = .08;
    this.world.defaultContactMaterial.contactEquationStiffness = 1e7;
    this.world.defaultContactMaterial.contactEquationRelaxation = 4;
    this.blocks = []; this.balls = []; this.shotsLeft = 3; this.score = 0;
    this.elapsed = 0; this.sinceShot = 0; this.hasFired = false; this.finishDelay = 0;
    this.aimX = 0; this.power = .68; this.drag = null; this.pointerId = null;
    this.keyCharge = null; this.keys.clear(); this.shotCount = 0;
    this.lastImpactTime = -1; this.lastImpactBody = new Map();
    const floorBody = new CANNON.Body({mass:0,shape:new CANNON.Plane()});
    floorBody.quaternion.setFromEuler(-Math.PI/2,0,0);floorBody.position.y=-.6;
    this.world.addBody(floorBody);
    this.staticBox(30,.15,34,0,-.7,-4,0x344b58);
    this.staticBox(7.2,.55,4.4,0,.42,-2,0xa48264);
    this.staticBox(6.85,.08,4.05,0,.735,-2,0xddbf98);
    // The launch rest is visual only; the projectile starts clear of it.
    this.staticBox(1.5,.13,1.2,0,.05,6.8,0x5c7480,false);
    this.launchOrigin = new THREE.Vector3(0,.85,6.8);
    this.readyBall = new THREE.Mesh(this.ballGeometry,this.ballMaterial);
    this.readyBall.position.copy(this.launchOrigin);this.readyBall.castShadow=true;
    this.scene.add(this.readyBall);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.52,.035,8,40),new THREE.MeshBasicMaterial({color:0xe9c790}));
    ring.rotation.x=-Math.PI/2; ring.position.set(0,.14,6.8);this.scene.add(ring);
    this.staticGeometry.push(ring.geometry);this.staticMaterials.push(ring.material);
    this.trajectory = new THREE.Group();this.scene.add(this.trajectory);
    this.dotGeometry = new THREE.SphereGeometry(.045,6,4);
    this.dotMaterial = new THREE.MeshBasicMaterial({color:0xffe7b9});
    this.staticGeometry.push(this.dotGeometry);this.staticMaterials.push(this.dotMaterial);
    for(let i=0;i<24;i++){const dot=new THREE.Mesh(this.dotGeometry,this.dotMaterial);this.trajectory.add(dot);}
    this.previousPatternIndex = this.patternIndex;
    const next = forcedPattern ?? Math.floor(Math.random()*4);
    this.patternIndex = forcedPattern ?? (next >= this.patternIndex ? next+1 : next);
    if(this.previousPatternIndex<0 && forcedPattern===undefined) this.patternIndex=Math.floor(Math.random()*5);
    this.buildPattern(this.patternIndex);
    // Settle without awarding points or playing the placement contacts.
    for(let i=0;i<90;i++)this.world.step(1/120);
    for(const b of this.blocks){b.initial=b.body.position.clone();b.initialQuaternion=b.body.quaternion.clone();}
    this.world.time=0;this.world.accumulator=0;
  }
  staticBox(w,h,d,x,y,z,color,physical=true) {
    const {THREE,CANNON}=Ball3D;
    const geometry=new THREE.BoxGeometry(w,h,d),material=new THREE.MeshStandardMaterial({color,roughness:.85});
    this.staticGeometry.push(geometry);this.staticMaterials.push(material);
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.receiveShadow=true;mesh.castShadow=true;this.scene.add(mesh);
    if(physical)this.world.addBody(new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2)),position:new CANNON.Vec3(x,y,z)}));
  }
  block(x,y,z,w=.85,h=.85,d=.85,color=0) {
    const {THREE,CANNON}=Ball3D;
    const mesh=new THREE.Mesh(this.blockGeometry,this.blockMaterials[color%5]);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);
    const body=new CANNON.Body({mass:.75*w*h*d,shape:new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2)),position:new CANNON.Vec3(x,y,z),linearDamping:.06,angularDamping:.12,sleepSpeedLimit:.12,sleepTimeLimit:.5});
    body.addEventListener('collide', e=>this.impact(e,body,color));this.world.addBody(body);
    this.blocks.push({mesh,body,fallen:false});
  }
  buildPattern(index) {
    const base=.79;
    if(index===0) for(let row=0;row<5;row++)for(let col=0;col<5-row;col++)this.block((col-(4-row)/2)*.93,base+.43+row*.865,-2,.88,.85,.88,row);
    if(index===1) for(let row=0;row<4;row++)for(let col=0;col<5;col++)this.block((col-2)*.92+(row%2)*.06,base+.42+row*.845,-2,.88,.83,.9,(col+row)%5);
    if(index===2) for(let row=0;row<6;row++)for(let col=0;col<3;col++) {
      const along=row%2===0;this.block(along?(col-1)*.82:0,base+.21+row*.435,along?-2:-2+(col-1)*.82,along?.78:2.4,.42,along?2.4:.78,row);
    }
    if(index===3) {
      for(let side of [-1,1])for(let row=0;row<3;row++)this.block(side*1.4,base+.43+row*.865,-2,.88,.85,1.1,row);
      this.block(0,base+2.82,-2,3.75,.42,1.1,2);
      for(let row=0;row<2;row++)for(let col=0;col<3-row;col++)this.block((col-(2-row)/2)*.91,base+3.46+row*.865,-2,.88,.85,.9,row+3);
    }
    if(index===4)for(let tower=0;tower<3;tower++)for(let row=0;row<5;row++)this.block((tower-1)*1.62,base+.4+row*.815,-2+(tower===1?-.4:.15),.9,.8,.9,(row+tower)%5);
  }
  launchVelocity(power=this.power,aimX=this.aimX) {
    return {x:aimX*5.7,y:3.1+power*2.35,z:-(12.6+power*6.2)};
  }
  fire() {
    if(!this.isActive || this.isPaused || !this.shotsLeft || this.sinceShot<.45 && this.hasFired)return false;
    const {THREE,CANNON}=Ball3D;
    const body=new CANNON.Body({mass:4.2,shape:new CANNON.Sphere(.32),position:new CANNON.Vec3(0,.85,6.8),linearDamping:.012,angularDamping:.05});
    const v=this.launchVelocity();body.velocity.set(v.x,v.y,v.z);
    body.addEventListener('collide', e=>this.impact(e,body,0));
    const mesh=new THREE.Mesh(this.ballGeometry,this.ballMaterial);mesh.castShadow=true;this.scene.add(mesh);this.world.addBody(body);this.balls.push({mesh,body});
    this.shotsLeft--;this.shotCount++;this.hasFired=true;this.sinceShot=0;
    this.readyBall.visible=this.shotsLeft>0;this.playSound('launch',.48,1+Math.random()*.07);
    return true;
  }
  impact(event,body,color) {
    if(!this.hasFired || !this.isActive || this.isPaused)return;
    const speed=Math.abs(event.contact.getImpactVelocityAlongNormal());
    if(speed<.7 || this.elapsed-this.lastImpactTime<.048 || this.elapsed-(this.lastImpactBody.get(body.id)??-1)<.13)return;
    this.lastImpactTime=this.elapsed;this.lastImpactBody.set(body.id,this.elapsed);
    const name=color%3===0?'plate':color%3===1?'wood1':'wood2';
    this.playSound(name,Math.min(.47,.075+speed*.037),.91+Math.random()*.18);
  }
  pointerDown(e) {
    if(!this.isActive || this.isPaused || !this.shotsLeft || !e.isPrimary || e.button!==0 || this.pointerId!==null)return;
    const p=canvasPoint(e.clientX,e.clientY);if(!p?.inside)return;
    const origin=this.screenPoint(this.launchOrigin);
    // A generous launch region remains usable on a narrow screen.
    if(p.y<origin.y-120)return;
    e.preventDefault();this.unlockAudio();this.pointerId=e.pointerId;
    this.drag={x:p.x,y:p.y,endX:p.x,endY:p.y};canvas.setPointerCapture(e.pointerId);
  }
  pointerMove(e) {
    if(!this.drag || e.pointerId!==this.pointerId || this.isPaused)return;
    const p=canvasPoint(e.clientX,e.clientY);if(!p)return;e.preventDefault();
    this.drag.endX=p.x;this.drag.endY=p.y;
    this.aimX=Math.max(-1,Math.min(1,(this.drag.x-p.x)/180));
    this.power=Math.max(.12,Math.min(1,(p.y-this.drag.y)/180));
  }
  pointerUp(e) {
    if(!this.drag || e.pointerId!==this.pointerId)return;
    const drag=this.drag;this.pointerMove(e);this.cancel();
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    if(Math.hypot(drag.endX-drag.x,drag.endY-drag.y)>14 && drag.endY-drag.y>8)this.fire();
  }
  handleKey(e,pressed) {
    if(e.target.closest?.('button,input,summary,dialog') || !this.isActive)return;
    if(['KeyP','Escape'].includes(e.code) && pressed && !e.repeat){e.preventDefault();this.togglePause();return;}
    if(this.isPaused)return;
    if(!['ArrowLeft','ArrowRight','Space'].includes(e.code))return;
    e.preventDefault();
    if(pressed)this.keys.add(e.code);else this.keys.delete(e.code);
    if(e.code==='Space'){
      if(pressed && !e.repeat){this.unlockAudio();this.keyCharge=performance.now();}
      if(!pressed && this.keyCharge!==null){this.power=Math.max(.12,Math.min(1,(performance.now()-this.keyCharge)/850));this.keyCharge=null;this.fire();}
    }
  }
  togglePause() {
    this.cancel();this.keyCharge=null;super.togglePause();
    if(this.isPaused)this.stopAudio();
  }
  stopAudio() {
    for(const sound of this.playingSounds||[])try{sound.stop();}catch(_){}
    this.playingSounds?.clear();
  }
  attachListeners() {
    canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointermove',this.move);
    canvas.addEventListener('pointerup',this.up);canvas.addEventListener('pointercancel',this.cancel);canvas.addEventListener('lostpointercapture',this.cancel);
    window.addEventListener('keydown',this.keyDown);window.addEventListener('keyup',this.keyUp);this.syncSound();
  }
  removeListeners() {
    canvas.removeEventListener('pointerdown',this.down);canvas.removeEventListener('pointermove',this.move);
    canvas.removeEventListener('pointerup',this.up);canvas.removeEventListener('pointercancel',this.cancel);canvas.removeEventListener('lostpointercapture',this.cancel);
    window.removeEventListener('keydown',this.keyDown);window.removeEventListener('keyup',this.keyUp);
    const id=this.pointerId;this.cancel();if(id!==undefined && id!==null && canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
    this.keys.clear();this.keyCharge=null;
    this.stopAudio();
  }
  loop(t) {
    this.reqId=null;if(!this.isActive || this.isPaused)return;
    const dt=Math.min(.04,Math.max(0,(t-this.lastTime)/1000));this.lastTime=t;
    this.update(dt);if(!this.isActive)return;this.draw();this.reqId=requestAnimationFrame(next=>this.loop(next));
  }
  update(dt) {
    this.elapsed+=dt;this.sinceShot+=dt;
    if(this.keys.has('ArrowLeft'))this.aimX=Math.max(-1,this.aimX-dt*.65);
    if(this.keys.has('ArrowRight'))this.aimX=Math.min(1,this.aimX+dt*.65);
    if(this.keyCharge!==null)this.power=Math.max(.12,Math.min(1,(performance.now()-this.keyCharge)/850));
    this.world.step(1/120,dt,6);
    if(this.hasFired){
      for(const block of this.blocks){
        const p=block.body.position,initial=block.initial,q=block.body.quaternion,iq=block.initialQuaternion;
        const angle=2*Math.acos(Math.min(1,Math.abs(q.x*iq.x+q.y*iq.y+q.z*iq.z+q.w*iq.w)));
        if(!block.fallen && (p.y<initial.y-.38 || Math.hypot(p.x-initial.x,p.z-initial.z)>.68 || angle>.75)){block.fallen=true;this.score++;}
      }
      const done=this.score===this.blocks.length;
      if(done || !this.shotsLeft && this.sinceShot>3.7){this.finishDelay+=dt;if(this.finishDelay>1.35)this.showResult();}
    }
  }
  screenPoint(vector) {
    const p=vector.clone().project(this.camera);return {x:(p.x+1)*360,y:(1-p.y)*450};
  }
  draw() {
    if(!this.renderer || !this.scene || this.engineLost)return;
    const {THREE}=Ball3D;
    for(const item of [...this.blocks,...this.balls]){item.mesh.position.copy(item.body.position);item.mesh.quaternion.copy(item.body.quaternion);}
    const v=this.launchVelocity();this.trajectory.visible=this.shotsLeft>0;
    this.trajectory.children.forEach((dot,i)=>{const t=(i+1)*.035;dot.position.set(v.x*t,.85+v.y*t-4.91*t*t,6.8+v.z*t);dot.visible=dot.position.y>.8 && dot.position.z>-3.4;});
    this.renderer.render(this.scene,this.camera);
    ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.drawImage(this.renderer.domElement,0,0,720,900);
    ctx.fillStyle='rgba(20,31,39,.9)';ctx.fillRect(0,0,720,82);
    ctx.font='600 28px sans-serif';ctx.fillStyle='#fff0d8';ctx.textAlign='left';ctx.fillText(`倒した積み木 ${this.score} / ${this.blocks.length}`,28,36);
    ctx.font='22px sans-serif';ctx.fillStyle='#c1d3da';ctx.fillText(this.patternNames[this.patternIndex],28,67);
    ctx.textAlign='right';ctx.font='600 28px sans-serif';ctx.fillStyle='#ffbec4';ctx.fillText(`残り ${this.shotsLeft} 球`,692,42);
    if(this.shotsLeft){
      const origin=this.screenPoint(this.launchOrigin);
      if(this.drag){
        const end={x:Math.max(40,Math.min(680,origin.x+this.drag.endX-this.drag.x)),y:Math.max(origin.y,Math.min(820,origin.y+this.drag.endY-this.drag.y))};
        ctx.strokeStyle='#ffb4a0';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(origin.x-28,origin.y);ctx.lineTo(end.x,end.y);ctx.lineTo(origin.x+28,origin.y);ctx.stroke();
        ctx.fillStyle='#ff5967';ctx.beginPath();ctx.arc(end.x,end.y,19,0,Math.PI*2);ctx.fill();
      }
      const charging=this.drag || this.keyCharge!==null;
      ctx.fillStyle='rgba(20,31,39,.88)';ctx.fillRect(0,832,720,68);ctx.textAlign='center';ctx.fillStyle='#fff0d8';ctx.font='24px sans-serif';
      ctx.fillText(charging?`強さ ${Math.round(this.power*100)}%`:'ボールを下に引いて離す',360,863);
      if(charging){ctx.fillStyle='#455a65';ctx.fillRect(200,878,320,7);ctx.fillStyle='#ff9a82';ctx.fillRect(200,878,320*this.power,7);}
    }
  }
  showResult() {
    const all=this.blocks && this.score===this.blocks.length;
    this.showUI(`<h2>${all?'全部倒した！':'結果'}</h2><p class="ball-result">${this.score} / ${this.blocks?.length||0} 個</p><div class="btn-group"><button class="ui-btn btn-primary" onclick="currentScene.startGame()">次の積み方</button><button class="ui-btn btn-secondary" onclick="currentScene.showTitle()">タイトルへ</button></div>`);
  }
  syncSound(){const b=document.getElementById('sound-game');if(b){b.textContent=this.muted?'音：OFF':'音：ON';b.setAttribute('aria-pressed',String(!this.muted));}}
  toggleSound(){this.muted=!this.muted;try{localStorage.setItem('hima-ball-muted',String(this.muted));}catch(_){}this.syncSound();if(!this.muted)this.unlockAudio();else for(const sound of this.playingSounds||[])try{sound.stop();}catch(_){};}
  unlockAudio() {
    if(this.muted)return;
    try {
      if(!this.audioContext){
        const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
        this.audioContext=new Audio();this.playingSounds=new Set();this.audioBuffers={};
        this.audioReady=Promise.all(Object.entries(BALL_AUDIO).map(async([name,base64])=>{
          const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
          this.audioBuffers[name]=await this.audioContext.decodeAudioData(bytes.buffer);
        })).catch(()=>{});
      }
      if(this.audioContext.state==='suspended')this.audioContext.resume().catch(()=>{});
    }catch(_){}
  }
  playSound(name,volume,rate=1) {
    if(!this.isActive || this.isPaused || this.muted || !this.audioBuffers?.[name] || this.audioContext?.state!=='running' || this.playingSounds.size>=7)return;
    const source=this.audioContext.createBufferSource(),gain=this.audioContext.createGain();
    source.buffer=this.audioBuffers[name];source.playbackRate.value=rate;gain.gain.value=volume;
    source.connect(gain);gain.connect(this.audioContext.destination);this.playingSounds.add(source);
    source.onended=()=>{this.playingSounds.delete(source);source.disconnect();gain.disconnect();};source.start();
  }
}
