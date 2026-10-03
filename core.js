const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const uiPanel = document.getElementById('ui-panel');
const uiContent = document.getElementById('ui-content');
let currentScene = null;

class GameScene {
  constructor(name, {controls = []} = {}) {
    this.name = name;
    this.controls = controls;
    this.score = 0;
    this.recordType = 'desc';
    this.scoreUnit = 'pt';
    this.isActive = false;
    this.isPaused = false;
    this.reqId = null;
    this.savedReelProgress = null;
  }
  init() { this.showTitle(); }
  cleanup() {
    releaseVirtualKeys();
    this.stopGameLoop();
    this.removeListeners();
    this.isPaused = false;
  }
  // 記録機能は既存版と同じく無効。
  saveRecord() {}
  getRecordsHTML() { return ''; }
  updateMobileUI() {
    document.getElementById('v-dpad').style.display = this.controls.includes('dpad') ? 'flex' : 'none';
    document.getElementById('v-action').style.display = this.controls.includes('jump') ? 'flex' : 'none';
    document.getElementById('bomb-game').hidden = !this.controls.includes('bomb');
    document.getElementById('sound-game').hidden = !this.controls.includes('sound');
    document.getElementById('virtual-controls').classList.toggle('playing', this.controls.some(control => ['dpad', 'jump'].includes(control)));
  }
  showUI(html) {
    if (typeof cancelReelTransition === 'function') cancelReelTransition();
    this.cleanup();
    this.savedReelProgress = null;
    canvas.style.display = 'none';
    uiPanel.style.display = 'block';
    uiContent.innerHTML = html;
    document.getElementById('play-controls').hidden = true;
    document.getElementById('virtual-controls').classList.remove('playing');
    syncPauseButton();
  }
  hideUI() {
    this.cleanup();
    this.savedReelProgress = null;
    uiPanel.style.display = 'none';
    canvas.style.display = 'block';
    this.updateMobileUI();
    canvas.width = 800;
    canvas.height = 600;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    document.getElementById('play-controls').hidden = false;
    syncPauseButton();
  }
  togglePause() {
    if (!this.isActive) return;
    this.isPaused = !this.isPaused;
    cancelAnimationFrame(this.reqId);
    this.reqId = null;
    if (this.keys) this.keys.clear();
    releaseVirtualKeys();
    this.gestureActive = false;
    this.drag = null;
    if (this.isPaused) this.draw();
    else {
      this.lastTime = performance.now();
      this.reqId = requestAnimationFrame(t => this.loop(t));
    }
    syncPauseButton();
  }
  pauseGame() {
    if (this.isActive && !this.isPaused) this.togglePause();
  }
  suspendForReel() {
    if (!this.isActive) return;
    const dimensions = {width:canvas.width, height:canvas.height};
    this.cleanup();
    this.savedReelProgress = dimensions;
  }
  restoreReelProgress() {
    const dimensions = this.savedReelProgress;
    if (!dimensions) return;
    this.cleanup();
    this.savedReelProgress = null;
    uiPanel.style.display = 'none';
    canvas.style.display = 'block';
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    this.updateMobileUI();
    if (this.updateBombButton) this.updateBombButton();
    document.getElementById('play-controls').hidden = false;
    this.isActive = true;
    this.isPaused = true;
    this.lastTime = performance.now();
    this.attachListeners();
    this.draw();
    syncPauseButton();
  }
  showTitle() {}
  startGame() {}
  showResult() {}
  stopGameLoop() {
    this.isActive = false;
    cancelAnimationFrame(this.reqId);
    this.reqId = null;
  }
  removeListeners() {}
  attachListeners() {}
}
function syncPauseButton() {
  if (typeof cancelReelTransition === 'function') cancelReelTransition();
  document.getElementById('pause-game').textContent = currentScene && currentScene.isPaused ? '再開' : '一時停止';
  document.getElementById('pause-overlay').hidden = !(currentScene && currentScene.isActive && currentScene.isPaused);
}
function varColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
// object-fit: contain の余白を除き、表示中のゲーム座標へ変換する。
function canvasPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
  if (!scale) return null;
  const left = rect.left + (rect.width - canvas.width * scale) / 2;
  const top = rect.top + (rect.height - canvas.height * scale) / 2;
  const x = (clientX - left) / scale;
  const y = (clientY - top) / scale;
  return {x, y, inside: x >= 0 && y >= 0 && x <= canvas.width && y <= canvas.height};
}
const virtualPointers = new Map();
function virtualKey(btn, type) {
  window.dispatchEvent(new KeyboardEvent(type, {key: btn.dataset.key, code: btn.dataset.code, bubbles: true}));
}
function releaseVirtualKeys() {
  for (const btn of new Set(virtualPointers.values())) virtualKey(btn, 'keyup');
  virtualPointers.clear();
}
document.querySelectorAll('.v-btn').forEach(btn => {
  btn.addEventListener('pointerdown', e => {
    if (!currentScene || !currentScene.isActive || currentScene.isPaused) return;
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    virtualPointers.set(e.pointerId, btn);
    virtualKey(btn, 'keydown');
  });
  const release = e => {
    if (!virtualPointers.has(e.pointerId)) return;
    virtualPointers.delete(e.pointerId);
    if (![...virtualPointers.values()].includes(btn)) virtualKey(btn, 'keyup');
  };
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('lostpointercapture', release);
  btn.addEventListener('click', e => {
    if (e.detail === 0 && currentScene && currentScene.isActive && !currentScene.isPaused) {
      virtualKey(btn, 'keydown');
      virtualKey(btn, 'keyup');
    }
  });
});
document.getElementById('pause-game').addEventListener('click', () => currentScene && currentScene.togglePause());
document.getElementById('quit-game').addEventListener('click', () => currentScene && currentScene.showTitle());
document.getElementById('bomb-game').addEventListener('click', () => currentScene && currentScene.useBomb && currentScene.useBomb());
document.getElementById('sound-game').addEventListener('click', () => currentScene?.toggleSound?.());
function pauseHiddenGame() {
  releaseVirtualKeys();
  if (currentScene) currentScene.pauseGame();
}
window.addEventListener('blur', pauseHiddenGame);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseHiddenGame(); });

// 再開するタップを移動・回転・ジャンプ等のゲーム入力へ重ねて渡さない。
let pauseTap = null;
const pauseStage = document.getElementById('game-stage');
pauseStage.addEventListener('pointerdown', e => {
  if (!currentScene?.isActive || !currentScene.isPaused || e.target.closest('button') || (e.pointerType==='mouse' && e.button!==0)) return;
  e.preventDefault();e.stopPropagation();
  if (!e.isPrimary) {pauseTap=null;return;}
  pauseTap={id:e.pointerId,x:e.clientX,y:e.clientY,scene:currentScene};
  pauseStage.setPointerCapture(e.pointerId);
}, true);
pauseStage.addEventListener('pointerup', e => {
  if (!pauseTap || pauseTap.id!==e.pointerId) return;
  e.preventDefault();e.stopPropagation();
  const tap=pauseTap;pauseTap=null;
  if (tap.scene===currentScene && currentScene.isActive && currentScene.isPaused && Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<12) currentScene.togglePause();
}, true);
pauseStage.addEventListener('pointercancel',()=>{pauseTap=null;});
pauseStage.addEventListener('lostpointercapture',()=>{pauseTap=null;});
for(const type of ['touchstart','touchmove','touchend']) pauseStage.addEventListener(type,e=>{
  if (currentScene?.isPaused || pauseTap) {e.preventDefault();e.stopPropagation();}
},{capture:true,passive:false});
window.addEventListener('blur',()=>{pauseTap=null;});
