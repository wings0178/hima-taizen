const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const uiPanel = document.getElementById('ui-panel');
const uiContent = document.getElementById('ui-content');
let currentScene = null;

class GameScene {
  constructor(name) {
    this.name = name;
    this.score = 0;
    this.recordType = 'desc';
    this.scoreUnit = 'pt';
    this.isActive = false;
    this.isPaused = false;
    this.reqId = null;
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
    document.getElementById('v-dpad').style.display = this.name === '弾幕シューティング' ? 'flex' : 'none';
    document.getElementById('v-action').style.display = this.name === '恐竜ランナー' ? 'flex' : 'none';
    document.getElementById('bomb-game').hidden = this.name !== '弾幕シューティング';
  }
  showUI(html) {
    this.cleanup();
    canvas.style.display = 'none';
    uiPanel.style.display = 'block';
    uiContent.innerHTML = html;
    document.getElementById('play-controls').hidden = true;
    document.getElementById('virtual-controls').classList.remove('playing');
  }
  hideUI() {
    this.cleanup();
    uiPanel.style.display = 'none';
    canvas.style.display = 'block';
    this.updateMobileUI();
    canvas.width = 800;
    canvas.height = 600;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    document.getElementById('play-controls').hidden = false;
    document.getElementById('virtual-controls').classList.toggle('playing', this.name !== 'テトリス');
    syncPauseButton();
  }
  togglePause() {
    if (!this.isActive) return;
    this.isPaused = !this.isPaused;
    cancelAnimationFrame(this.reqId);
    this.reqId = null;
    if (this.keys) this.keys.clear();
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
  showTitle() {}
  startGame() {}
  showResult() {}
  stopGameLoop() {
    this.isActive = false;
    cancelAnimationFrame(this.reqId);
    this.reqId = null;
  }
  removeListeners() {}
}
function syncPauseButton() {
  document.getElementById('pause-game').textContent = currentScene && currentScene.isPaused ? '再開' : '一時停止';
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
function pauseHiddenGame() {
  releaseVirtualKeys();
  if (currentScene) currentScene.pauseGame();
}
window.addEventListener('blur', pauseHiddenGame);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseHiddenGame(); });
