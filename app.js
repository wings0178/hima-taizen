// ゲームの登録
const gameRegistry = {
  'dino': new DinoGameScene(),
  'tetris': new TetrisGameScene(),
  '100masu': new HyakumasuGameScene(),
  'reversi': new ReversiGameScene(),
};

const listEl = document.getElementById('game-list');

// サイドバー生成
for (const [key, scene] of Object.entries(gameRegistry)) {
  const li = document.createElement('li');
  li.className = 'game-item';
  li.innerHTML = `<span>${scene.name}</span>`;
  li.onclick = () => selectGame(key, li);
  listEl.appendChild(li);
}

function selectGame(key, element) {
  if (currentScene) currentScene.cleanup();
  
  document.querySelectorAll('.game-item').forEach(el => el.classList.remove('active'));
  element.classList.add('active');

  currentScene = gameRegistry[key];
  currentScene.init();
}

// 初期表示
const firstGameKey = Object.keys(gameRegistry)[0];
if(firstGameKey) selectGame(firstGameKey, listEl.firstChild);