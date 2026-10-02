function slimeReady(dx, dy) { return Math.abs(dy) >= 48 && Math.abs(dy) > Math.abs(dx) * 1.2; }
function drawSlimeStretch(gesture, dx, dy) {
  const rect = gameStage.getBoundingClientRect();
  const base = gesture.base;
  const hx = Math.max(24, Math.min(rect.width - 24, base.x + dx * .7));
  const hy = Math.max(24, Math.min(innerHeight - rect.top - 24, base.y + dy * .85));
  const length = Math.max(1, Math.hypot(hx - base.x, hy - base.y));
  const ux = (hx - base.x) / length, uy = (hy - base.y) / length;
  const scale = reelSlime.offsetWidth / 64;
  const point = (along, across) => `${base.x + ux * along - uy * across * scale},${base.y + uy * along + ux * across * scale}`;
  document.getElementById('slime-stretch-body').setAttribute('d',
    `M${point(0,24)} C${point(length*.3,9)} ${point(length*.7,9)} ${point(length,18)} C${point(length+30,32)} ${point(length+30,-32)} ${point(length,-18)} C${point(length*.7,-9)} ${point(length*.3,-9)} ${point(0,-24)} C${point(-30,-34)} ${point(-30,34)} ${point(0,24)}Z`);
  document.getElementById('slime-face').setAttribute('transform', `translate(${hx},${hy}) scale(${scale})`);
  const label = document.getElementById('slime-direction');
  const keys = reelGameKeys(), direction = dy < 0 ? 1 : -1;
  const key = keys[(keys.indexOf(gesture.key) + direction + keys.length) % keys.length];
  label.textContent = `${direction === 1 ? '次' : '前'}：${gameRegistry[key].name}`;
  label.style.left = `${Math.max(8, Math.min(rect.width - 160, hx - 60))}px`;
  label.style.top = `${Math.max(8, Math.min(rect.height - 30, hy - 50))}px`;
  label.hidden = Math.abs(dy) < 8;
  slimeStretch.classList.toggle('ready', slimeReady(dx, dy));
  slimeStretch.hidden = false;
  reelSlime.classList.add('pulling');
}
function returnSlime(gesture, switched = false) {
  cancelReelGesture();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !reelMode || Math.hypot(gesture.dx, gesture.dy) < 3) return;
  if (switched) {
    reelSlime.querySelector('svg').animate([{transform:'scale(1.18,.8)'},{transform:'scale(.92,1.12)'},{transform:'scale(1)'}], {duration:240});
    return;
  }
  drawSlimeStretch(gesture, gesture.dx, gesture.dy);
  document.getElementById('slime-direction').hidden = true;
  slimeStretch.style.transformOrigin = `${gesture.base.x}px ${gesture.base.y}px`;
  const animation = slimeStretch.animate([{transform:'scale(1)'},{transform:'scale(1.08,.1)'}], {duration:180,easing:'cubic-bezier(.3,.8,.3,1)',fill:'forwards'});
  slimeReturn = animation;
  animation.finished.then(() => {
    if (slimeReturn !== animation) return;
    cancelReelGesture();
    reelSlime.querySelector('svg').animate([{transform:'scale(1.18,.8)'},{transform:'scale(.92,1.12)'},{transform:'scale(1)'}], {duration:240});
  }).catch(() => {});
}
reelSlime.addEventListener('pointerdown', e => {
  if (!reelMode || settingsDialog.open || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault(); e.stopPropagation();
  cancelReelGesture();
  if (!e.isPrimary) return;
  cancelReelTransition();
  const stage = gameStage.getBoundingClientRect(), handle = reelSlime.getBoundingClientRect();
  reelGesture = {id:e.pointerId, x:e.clientX, y:e.clientY, key:selectedGameKey, dx:0, dy:0,
    base:{x:handle.left + handle.width/2 - stage.left, y:handle.top + handle.height/2 - stage.top}};
  reelSlime.setPointerCapture(e.pointerId);
});
reelSlime.addEventListener('pointermove', e => {
  const gesture = reelGesture;
  if (!gesture || gesture.id !== e.pointerId) return;
  e.preventDefault(); e.stopPropagation();
  gesture.dx = e.clientX - gesture.x; gesture.dy = e.clientY - gesture.y;
  if (Math.hypot(gesture.dx, gesture.dy) < 3) {
    if (reelDragLayer) reelDragLayer.remove();
    reelDragLayer = null;
    slimeStretch.hidden = true;
    reelSlime.classList.remove('pulling');
    return;
  }
  drawSlimeStretch(gesture, gesture.dx, gesture.dy);
  if (Math.abs(gesture.dy) > 8 || reelDragLayer) previewReelDrag(gesture, gesture.dy);
});
reelSlime.addEventListener('pointerup', e => {
  const gesture = reelGesture;
  if (!gesture || gesture.id !== e.pointerId) return;
  e.preventDefault(); e.stopPropagation();
  gesture.dx = e.clientX - gesture.x; gesture.dy = e.clientY - gesture.y;
  const switched = gesture.key === selectedGameKey && slimeReady(gesture.dx, gesture.dy);
  if (switched) {
    const offset = Math.max(-gameStage.clientHeight*.8, Math.min(gameStage.clientHeight*.8, gesture.dy));
    stepGame(gesture.dy < 0 ? 1 : -1, offset);
  }
  returnSlime(gesture, switched);
});
reelSlime.addEventListener('pointercancel', cancelReelGesture);
reelSlime.addEventListener('lostpointercapture', () => { if (reelGesture) cancelReelGesture(); });
reelSlime.addEventListener('keydown', e => {
  if (!reelMode || !['ArrowUp','ArrowDown'].includes(e.code)) return;
  e.preventDefault(); e.stopPropagation();
  if (!e.repeat) stepGame(e.code === 'ArrowUp' ? 1 : -1);
});
for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
  reelSlime.addEventListener(type, e => {e.preventDefault(); e.stopPropagation();}, {passive:false});
}
window.addEventListener('pointerdown', e => {
  if (reelGesture && reelGesture.id !== e.pointerId) cancelReelGesture();
}, true);

// 設定は端末内だけに保存。開く前のプレイ状態を保って閉じる。
const settingsKey = 'hima-taizen-settings-v1';
let slimeSide = 'left';
try {
  const stored = JSON.parse(localStorage.getItem(settingsKey));
  if (stored && stored.slimeSide === 'right') slimeSide = 'right';
  if (Array.isArray(stored?.games)) {
    const games=Object.keys(gameRegistry).filter(key=>stored.games.includes(key));
    if (games.length) reelSettings.games=games;
  }
  if (typeof stored?.keepProgress==='boolean') reelSettings.keepProgress=stored.keepProgress;
} catch (_) {}
function renderGameSlots() {
  const slots=document.getElementById('game-slots');
  slots.replaceChildren();
  for(const [key,scene] of Object.entries(gameRegistry)) {
    const label=document.createElement('label'), input=document.createElement('input');
    input.type='checkbox';input.value=key;input.name='reel-game';input.checked=reelSettings.games.includes(key);
    label.append(input,document.createTextNode(scene.name));slots.appendChild(label);
  }
  document.getElementById('keep-progress').checked=reelSettings.keepProgress;
}
renderGameSlots();
function applySlimeSide(side) {
  cancelReelGesture();
  slimeSide = side === 'right' ? 'right' : 'left';
  reelSlime.dataset.side = slimeSide;
  document.querySelector(`input[name="slime-side"][value="${slimeSide}"]`).checked = true;
}
applySlimeSide(slimeSide);
let settingsGame = null;
document.getElementById('settings-open').addEventListener('click', () => {
  cancelReelGesture(); cancelReelTransition();
  settingsGame = currentScene && currentScene.isActive && !currentScene.isPaused ? currentScene : null;
  if (settingsGame) settingsGame.pauseGame();
  settingsDialog.showModal();
});
settingsDialog.addEventListener('close', () => {
  if (settingsGame && settingsGame === currentScene && settingsGame.isActive && settingsGame.isPaused) settingsGame.togglePause();
  settingsGame = null;
});
settingsDialog.addEventListener('change', e => {
  if (e.target.matches('input[name="slime-side"]')) applySlimeSide(e.target.value);
  else if(e.target.matches('input[name="reel-game"]')) {
    const games=[...document.querySelectorAll('input[name="reel-game"]:checked')].map(input=>input.value);
    const slotsError=document.getElementById('slots-error');
    slotsError.hidden=games.length>0;
    if(!games.length){e.target.checked=true;return;}
    reelSettings.games=games;
    if(reelMode && !games.includes(selectedGameKey)) {selectGame(games[0],true);currentScene.pauseGame();}
    for(const button of listEl.querySelectorAll('button')) button.disabled=reelMode && !games.includes(button.dataset.game);
    const keys=reelMode?reelGameKeys():Object.keys(gameRegistry);
    document.getElementById('reel-position').textContent=`${currentScene.name} · ${keys.indexOf(selectedGameKey)+1} / ${keys.length}`;
  } else if(e.target.id==='keep-progress') {
    reelSettings.keepProgress=e.target.checked;
    if(!reelSettings.keepProgress) for(const scene of Object.values(gameRegistry)) scene.savedReelProgress=null;
  } else return;
  const error = document.getElementById('settings-error');
  try { localStorage.setItem(settingsKey, JSON.stringify({slimeSide,...reelSettings})); error.hidden = true; }
  catch (_) { error.hidden = false; }
});
window.addEventListener('keydown', e => { if (settingsDialog.open) e.stopPropagation(); }, true);

let dinoTap = null;
canvas.addEventListener('pointerdown', e => {
  if (reelMode && currentScene === gameRegistry.dino && e.isPrimary && e.button === 0) dinoTap = {id:e.pointerId,x:e.clientX,y:e.clientY};
});
canvas.addEventListener('pointerup', e => {
  if (dinoTap && dinoTap.id === e.pointerId && currentScene === gameRegistry.dino && Math.hypot(e.clientX-dinoTap.x,e.clientY-dinoTap.y)<12) {
    currentScene.handleInput({code:'Space',repeat:false,preventDefault(){}});
  }
  dinoTap = null;
});
canvas.addEventListener('pointercancel', () => {dinoTap=null;});
