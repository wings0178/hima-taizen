const gameRegistry = {};

try { if (typeof DinoGameScene !== 'undefined') gameRegistry['dino'] = new DinoGameScene(); } catch(e) { console.warn(e); }
try { if (typeof TetrisGameScene !== 'undefined') gameRegistry['tetris'] = new TetrisGameScene(); } catch(e) { console.warn(e); }

const listEl = document.getElementById('game-list');

function renderSidebar() {
  if (!listEl) return;
  listEl.innerHTML = '';
  for (const [key, scene] of Object.entries(gameRegistry)) {
    const li = document.createElement('li');
    li.className = 'game-item';
    li.innerHTML = `<span>${scene.name}</span>`;
    li.onclick = () => selectGame(key, li);
    listEl.appendChild(li);
  }
}

function selectGame(key, element) {
  if (currentScene) currentScene.cleanup();
  
  document.querySelectorAll('.game-item').forEach(el => el.classList.remove('active'));
  if (element) element.classList.add('active');

  currentScene = gameRegistry[key];
  if (currentScene) currentScene.init(); 
}

// 初期化実行
renderSidebar();
const firstAvailable = Object.keys(gameRegistry)[0];
if (firstAvailable) {
  selectGame(firstAvailable, listEl.firstChild);
} else {
  if (listEl) listEl.innerHTML = '<li style="padding:15px; color:#ff4757;">ゲームの読み込みに失敗しました。</li>';
}