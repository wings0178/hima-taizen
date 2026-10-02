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
let reelTransition = null;
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
  cancelReelTransition();
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
  const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const outgoing = animate ? snapshotGameSurface() : null;
  const index = (keys.indexOf(selectedGameKey) + direction + keys.length) % keys.length;
  selectGame(keys[index], true);
  if (animate) {
    // 初期画面の描画だけを行い、更新・時計・入力は既存のループへ任せる。
    currentScene.draw();
    animateGameSwitch(outgoing, snapshotGameSurface(), direction);
  }
}
function snapshotGameSurface() {
  const preview = document.createElement('div');
  preview.className = 'reel-preview';
  if (canvas.style.display !== 'none') {
    const snapshot = document.createElement('canvas');
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    snapshot.getContext('2d').drawImage(canvas, 0, 0);
    preview.appendChild(snapshot);
  } else {
    const label = document.createElement('div');
    label.className = 'reel-preview-title';
    label.textContent = currentScene.name;
    preview.appendChild(label);
  }
  return preview;
}
function cancelReelTransition() {
  const transition = reelTransition;
  reelTransition = null;
  if (!transition) return;
  for (const animation of transition.animations) animation.cancel();
  transition.layer.remove();
}
function animateGameSwitch(outgoing, incoming, direction) {
  const layer = document.createElement('div');
  layer.className = 'reel-transition';
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  layer.append(outgoing, incoming);
  document.getElementById('game-stage').appendChild(layer);
  const options = {duration: 240, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'forwards'};
  const animations = [
    outgoing.animate([{transform: 'translateY(0)'}, {transform: `translateY(${-direction * 100}%)`}], options),
    incoming.animate([{transform: `translateY(${direction * 100}%)`}, {transform: 'translateY(0)'}], options)
  ];
  const transition = {layer, animations};
  reelTransition = transition;
  Promise.all(animations.map(animation => animation.finished)).then(() => {
    if (reelTransition === transition) cancelReelTransition();
  }).catch(() => {});
}
reelToggle.addEventListener('click', () => setReelMode(!reelMode));
document.getElementById('reel-prev').addEventListener('click', () => stepGame(-1));
document.getElementById('reel-next').addEventListener('click', () => stepGame(1));
// ゲームのドラッグ・上下フリックとは別の領域で判定する。
reelNav.addEventListener('pointerdown', e => {
  if (!e.isPrimary) { reelGesture = null; return; }
  if (!reelMode || (e.pointerType === 'mouse' && e.button !== 0)) return;
  if (e.target.closest('button')) return;
  reelGesture = {id: e.pointerId, x: e.clientX, y: e.clientY, key: selectedGameKey};
  reelNav.setPointerCapture(e.pointerId);
});
reelNav.addEventListener('pointerup', e => {
  const start = reelGesture;
  reelGesture = null;
  if (!start || start.id !== e.pointerId || start.key !== selectedGameKey || !reelMode) return;
  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;
  if (Math.abs(dy) >= 45 && Math.abs(dy) > Math.abs(dx) * 1.4) stepGame(dy < 0 ? 1 : -1);
});
reelNav.addEventListener('pointercancel', () => { reelGesture = null; });
reelNav.addEventListener('lostpointercapture', () => { reelGesture = null; });
window.addEventListener('blur', cancelReelTransition);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelReelTransition(); });
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
