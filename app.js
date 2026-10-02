const gameRegistry = {};
try { if (typeof DinoGameScene !== 'undefined') gameRegistry.dino = new DinoGameScene(); } catch (e) { console.warn(e); }
try { if (typeof TetrisGameScene !== 'undefined') gameRegistry.tetris = new TetrisGameScene(); } catch (e) { console.warn(e); }
try { if (typeof DanmakuGameScene !== 'undefined') gameRegistry.danmaku = new DanmakuGameScene(); } catch (e) { console.warn(e); }
const listEl = document.getElementById('game-list');
const reelToggle = document.getElementById('reel-toggle');
const gameStage = document.getElementById('game-stage');
const reelHint = document.getElementById('reel-hint');
let selectedGameKey = null;
let reelMode = false;
let reelGesture = null;
let reelTransition = null;
let reelDragLayer = null;
let reelHelpDrag = null;
const reelPointers = new Set();
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
  cancelReelGesture();
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
  lastWheelEvent = -Infinity;
  wheelUsed = false;
  wheelDistance = 0;
  document.body.classList.toggle('reel-mode', enabled);
  reelToggle.setAttribute('aria-pressed', String(enabled));
  reelToggle.textContent = enabled ? '一覧に戻る' : 'ショートモード';
  reelHint.hidden = !enabled;
  selectGame(selectedGameKey, enabled);
}
function stepGame(direction, offset = 0) {
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
    animateGameSwitch(outgoing, snapshotGameSurface(), direction, offset);
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
function animateGameSwitch(outgoing, incoming, direction, offset = 0) {
  const layer = document.createElement('div');
  layer.className = 'reel-transition';
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  layer.append(outgoing, incoming);
  gameStage.appendChild(layer);
  const height = gameStage.clientHeight;
  const options = {duration: 240, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'forwards'};
  const animations = [
    outgoing.animate([{transform: `translateY(${offset}px)`}, {transform: `translateY(${-direction * height}px)`}], options),
    incoming.animate([{transform: `translateY(${direction * height + offset}px)`}, {transform: 'translateY(0)'}], options)
  ];
  const transition = {layer, animations};
  reelTransition = transition;
  Promise.all(animations.map(animation => animation.finished)).then(() => {
    if (reelTransition === transition) cancelReelTransition();
  }).catch(() => {});
}
reelToggle.addEventListener('click', () => setReelMode(!reelMode));
// 画面全体のジェスチャーを先に判定する。未確定の入力はゲームへ渡さない。
function cancelReelGesture() {
  if (reelGesture && reelGesture.mode === 'play') {
    reelGesture.scene.gestureActive = false;
    if (reelGesture.scene.drag) reelGesture.scene.drag = null;
  }
  reelGesture = null;
  reelHelpDrag = null;
  if (reelDragLayer) reelDragLayer.remove();
  reelDragLayer = null;
}
function reelSwipeThreshold() { return Math.max(90, Math.min(120, gameStage.clientHeight * 0.2)); }
function pointerSample(e) {
  return {pointerId: e.pointerId, pointerType: e.pointerType, button: e.button,
    clientX: e.clientX, clientY: e.clientY, target: e.target, preventDefault() {}};
}
function touchSample(sample, end = false) {
  const touch = {identifier: sample.pointerId, clientX: sample.clientX, clientY: sample.clientY};
  return {target: sample.target, touches: end ? [] : [touch], changedTouches: [touch], preventDefault() {}};
}
function forwardGameGesture(gesture, phase, sample) {
  const scene = gesture.scene;
  if (scene !== currentScene) return;
  if (scene === gameRegistry.tetris) {
    const touch = touchSample(sample, phase === 'end');
    if (phase === 'start') {
      scene.handleTouchStart(touch);
      scene.touchStartTime = Date.now() - (performance.now() - gesture.time);
    } else if (phase === 'move') scene.handleTouchMove(touch);
    else scene.handleTouchEnd(touch);
  } else if (scene === gameRegistry.danmaku) {
    if (phase === 'start') scene.beginDrag(sample);
    else if (phase === 'move') scene.moveDrag(sample);
    else scene.pointerEndHandler(sample);
  } else if (scene === gameRegistry.dino && phase === 'end' &&
    Math.hypot(sample.clientX - gesture.x, sample.clientY - gesture.y) < 12) {
    scene.handleInput({code: 'Space', repeat: false, preventDefault() {}});
  }
}
function lockGameGesture(gesture) {
  if (reelDragLayer) reelDragLayer.remove();
  reelDragLayer = null;
  gesture.mode = 'play';
  forwardGameGesture(gesture, 'start', gesture.start);
  for (const sample of gesture.moves) forwardGameGesture(gesture, 'move', sample);
  gesture.moves = [];
}
function previewReelDrag(gesture, dy) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!reelDragLayer) {
    cancelReelTransition();
    const layer = document.createElement('div');
    layer.className = 'reel-transition reel-drag-preview';
    layer.setAttribute('aria-hidden', 'true');
    layer.inert = true;
    layer.appendChild(snapshotGameSurface());
    const neighbor = document.createElement('div');
    neighbor.className = 'reel-preview';
    const label = document.createElement('div');
    label.className = 'reel-preview-title';
    neighbor.appendChild(label);
    layer.appendChild(neighbor);
    gameStage.appendChild(layer);
    reelDragLayer = layer;
  }
  const direction = dy < 0 ? 1 : -1;
  const keys = Object.keys(gameRegistry);
  const key = keys[(keys.indexOf(gesture.key) + direction + keys.length) % keys.length];
  const offset = Math.max(-gameStage.clientHeight * 0.8, Math.min(gameStage.clientHeight * 0.8, dy));
  reelDragLayer.children[0].style.transform = `translateY(${offset}px)`;
  reelDragLayer.children[1].style.transform = `translateY(${direction * gameStage.clientHeight + offset}px)`;
  reelDragLayer.querySelector('.reel-preview-title').textContent = gameRegistry[key].name;
}
gameStage.addEventListener('pointerdown', e => {
  if (!reelMode || e.target.closest('button, summary') ||
    (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault(); e.stopPropagation();
  reelPointers.add(e.pointerId);
  if (!e.isPrimary || reelPointers.size > 1) { cancelReelGesture(); return; }
  if (e.target.closest('.game-help[open]')) {
    reelHelpDrag = {id: e.pointerId, y: e.clientY, scroll: uiPanel.scrollTop};
    gameStage.setPointerCapture(e.pointerId);
    return;
  }
  cancelReelTransition();
  reelGesture = {id: e.pointerId, x: e.clientX, y: e.clientY, key: selectedGameKey,
    scene: currentScene, time: performance.now(), mode: 'pending', start: pointerSample(e), moves: []};
  gameStage.setPointerCapture(e.pointerId);
}, true);
gameStage.addEventListener('pointermove', e => {
  if (reelHelpDrag && reelHelpDrag.id === e.pointerId) {
    e.preventDefault(); e.stopPropagation();
    uiPanel.scrollTop = reelHelpDrag.scroll + reelHelpDrag.y - e.clientY;
    return;
  }
  const gesture = reelGesture;
  if (!reelMode || !gesture || gesture.id !== e.pointerId) return;
  e.preventDefault(); e.stopPropagation();
  const sample = pointerSample(e);
  const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
  const elapsed = performance.now() - gesture.time;
  if (gesture.mode === 'play') { forwardGameGesture(gesture, 'move', sample); return; }
  if (gesture.mode === 'navigate') { previewReelDrag(gesture, dy); return; }
  gesture.moves.push(sample);
  // 横ドラッグとゆっくりした移動はゲームに確定。大きな上下フリックは切り替え。
  if (Math.abs(dy) >= reelSwipeThreshold() && Math.abs(dy) > Math.abs(dx) * 1.4 && elapsed < 600) {
    gesture.mode = 'navigate';
    previewReelDrag(gesture, dy);
  } else if ((Math.abs(dx) > 10 && Math.abs(dx) >= Math.abs(dy)) || (elapsed >= 220 && Math.abs(dy) / elapsed < 0.35)) {
    lockGameGesture(gesture);
  } else if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.4) previewReelDrag(gesture, dy);
}, true);
gameStage.addEventListener('pointerup', e => {
  reelPointers.delete(e.pointerId);
  if (reelHelpDrag && reelHelpDrag.id === e.pointerId) {
    e.preventDefault(); e.stopPropagation(); reelHelpDrag = null; return;
  }
  const gesture = reelGesture;
  if (!reelMode || !gesture || gesture.id !== e.pointerId) return;
  e.preventDefault(); e.stopPropagation();
  const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
  const threshold = reelSwipeThreshold();
  if (gesture.key === selectedGameKey && gesture.mode !== 'play' &&
    (gesture.mode === 'navigate' || performance.now() - gesture.time < 600) && Math.abs(dy) >= threshold && Math.abs(dy) > Math.abs(dx) * 1.4) {
    stepGame(dy < 0 ? 1 : -1, dy);
  } else {
    if (gesture.mode === 'navigate') { cancelReelGesture(); return; }
    if (gesture.mode === 'pending') lockGameGesture(gesture);
    forwardGameGesture(gesture, 'end', pointerSample(e));
    cancelReelGesture();
  }
}, true);
gameStage.addEventListener('pointercancel', e => {
  reelPointers.delete(e.pointerId);
  cancelReelGesture();
}, true);
for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
  gameStage.addEventListener(type, e => {
    if (!reelMode || e.target.closest('button, summary')) return;
    e.preventDefault(); e.stopPropagation();
  }, {capture: true, passive: false});
}
window.addEventListener('blur', cancelReelTransition);
window.addEventListener('blur', () => {cancelReelGesture(); reelPointers.clear();});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {cancelReelTransition(); cancelReelGesture(); reelPointers.clear();}
});
let lastWheelEvent = -Infinity;
let wheelUsed = false;
let wheelDistance = 0;
gameStage.addEventListener('wheel', e => {
  if (!reelMode || !e.deltaY || e.ctrlKey) return;
  if (e.target.closest('.game-help[open]')) return;
  e.preventDefault();
  const now = performance.now();
  if (now - lastWheelEvent > 180) { wheelUsed = false; wheelDistance = 0; }
  lastWheelEvent = now;
  if (wheelUsed) return;
  wheelDistance += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? gameStage.clientHeight : 1);
  if (Math.abs(wheelDistance) < 35) return;
  wheelUsed = true;
  stepGame(wheelDistance > 0 ? 1 : -1);
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
