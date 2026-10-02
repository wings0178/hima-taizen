const gameRegistry = {};
try { if (typeof DinoGameScene !== 'undefined') gameRegistry.dino = new DinoGameScene(); } catch (e) { console.warn(e); }
try { if (typeof TetrisGameScene !== 'undefined') gameRegistry.tetris = new TetrisGameScene(); } catch (e) { console.warn(e); }
try { if (typeof DanmakuGameScene !== 'undefined') gameRegistry.danmaku = new DanmakuGameScene(); } catch (e) { console.warn(e); }
const listEl = document.getElementById('game-list');
const reelToggle = document.getElementById('reel-toggle');
const reelNav = document.getElementById('reel-nav');
let selectedGameKey = null;
let reelMode = false;
let reelGesture = null;
function renderSidebar() {
  listEl.innerHTML = '';
  for (const [key, scene] of Object.entries(gameRegistry)) {
    const li = document.createElement('li');
    li.className = 'game-item';
    const button = document.createElement('button');
    button.textContent = scene.name;
    button.dataset.game = key;
    button.addEventListener('click', () => selectGame(key));
    li.appendChild(button);
    listEl.appendChild(li);
  }
}
function selectGame(key, autoStart = reelMode) {
  const nextScene = gameRegistry[key];
  if (!nextScene) return;
  reelGesture = null;
  if (currentScene) currentScene.cleanup();
  selectedGameKey = key;
  currentScene = nextScene;
  for (const button of listEl.querySelectorAll('button')) {
    const active = button.dataset.game === key;
    button.parentElement.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    if (active && window.matchMedia('(max-width: 768px)').matches) {
      listEl.scrollLeft = button.parentElement.offsetLeft - listEl.offsetLeft - 10;
    }
  }
  if (autoStart) currentScene.startGame();
  else currentScene.init();
  const keys = Object.keys(gameRegistry);
  document.getElementById('reel-position').textContent = `${currentScene.name} · ${keys.indexOf(key) + 1} / ${keys.length}`;
}
function setReelMode(enabled) {
  reelMode = enabled;
  lastWheelSwitch = -Infinity;
  document.body.classList.toggle('reel-mode', enabled);
  reelToggle.setAttribute('aria-pressed', String(enabled));
  reelToggle.textContent = enabled ? '一覧に戻る' : 'ショートモード';
  reelNav.hidden = !enabled;
  selectGame(selectedGameKey, enabled);
}
function stepGame(direction) {
  if (!reelMode) return;
  const keys = Object.keys(gameRegistry);
  if (!keys.length) return;
  const index = (keys.indexOf(selectedGameKey) + direction + keys.length) % keys.length;
  selectGame(keys[index], true);
}
reelToggle.addEventListener('click', () => setReelMode(!reelMode));
document.getElementById('reel-prev').addEventListener('click', () => stepGame(-1));
document.getElementById('reel-next').addEventListener('click', () => stepGame(1));
// ゲームのドラッグ・上下フリックとは別の領域で判定する。
const mainContent = document.getElementById('main-content');
mainContent.addEventListener('pointerdown', e => {
  if (!e.isPrimary) { reelGesture = null; return; }
  if (!reelMode || (e.pointerType === 'mouse' && e.button !== 0)) return;
  if (e.target.closest('canvas, button, #virtual-controls, #play-controls, #ui-panel')) return;
  reelGesture = {id: e.pointerId, x: e.clientX, y: e.clientY, key: selectedGameKey};
  if (e.pointerType === 'mouse') mainContent.setPointerCapture(e.pointerId);
});
mainContent.addEventListener('pointerup', e => {
  const start = reelGesture;
  reelGesture = null;
  if (!start || start.id !== e.pointerId || start.key !== selectedGameKey || !reelMode) return;
  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;
  if (Math.abs(dy) >= 45 && Math.abs(dy) > Math.abs(dx) * 1.4) stepGame(dy < 0 ? 1 : -1);
});
mainContent.addEventListener('pointercancel', () => { reelGesture = null; });
let lastWheelSwitch = -Infinity;
document.getElementById('reel-swipe').addEventListener('wheel', e => {
  if (!reelMode || Math.abs(e.deltaY) < 20) return;
  e.preventDefault();
  const now = performance.now();
  if (now - lastWheelSwitch < 450) return;
  lastWheelSwitch = now;
  stepGame(e.deltaY > 0 ? 1 : -1);
}, {passive: false});
window.addEventListener('keydown', e => {
  if (!reelMode || e.repeat || !['PageDown', 'PageUp'].includes(e.code)) return;
  e.preventDefault();
  stepGame(e.code === 'PageDown' ? 1 : -1);
});
renderSidebar();
const firstAvailable = Object.keys(gameRegistry)[0];
if (firstAvailable) selectGame(firstAvailable, false);
else uiContent.textContent = 'ゲームを読み込めませんでした。ページを再読み込みしてください。';
