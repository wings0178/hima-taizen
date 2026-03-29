// ==========================================
// 設定の保存と読み込み (エラー対策済み)
// ==========================================
let appSettings = { hiddenGames: [] };
try {
  const saved = localStorage.getItem('hima_settings');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed && Array.isArray(parsed.hiddenGames)) {
      appSettings = parsed;
    }
  }
} catch (e) {
  console.warn('セーブデータの読み込みに失敗しました。初期化します。');
}

function saveSettings() {
  localStorage.setItem('hima_settings', JSON.stringify(appSettings));
  renderSidebar();
}

// ==========================================
// ゲームの安全な登録（コピペミスによるフリーズ防止策）
// ==========================================
const gameRegistry = {};

try { if (typeof DinoGameScene !== 'undefined') gameRegistry['dino'] = new DinoGameScene(); } catch(e) { console.warn(e); }
try { if (typeof TetrisGameScene !== 'undefined') gameRegistry['tetris'] = new TetrisGameScene(); } catch(e) { console.warn(e); }
try { if (typeof HyakumasuGameScene !== 'undefined') gameRegistry['100masu'] = new HyakumasuGameScene(); } catch(e) { console.warn(e); }
try { if (typeof HoundHareScene !== 'undefined') gameRegistry['houndhare'] = new HoundHareScene(); } catch(e) { console.warn(e); }
try { if (typeof BalloonFight !== 'undefined') gameRegistry['balloon'] = new BalloonFight(); } catch(e) { console.warn(e); }

const listEl = document.getElementById('game-list');
const optionsModal = document.getElementById('options-modal');
const curtain = document.getElementById('swipe-curtain');
const shortsUI = document.getElementById('shorts-ui');

let isShortsMode = false;
let isCurtainMoving = false;

// ==========================================
// サイドバーの生成（非表示対応）
// ==========================================
function renderSidebar() {
  if (!listEl) return;
  listEl.innerHTML = '';
  for (const [key, scene] of Object.entries(gameRegistry)) {
    if (appSettings.hiddenGames.includes(key)) continue;

    const li = document.createElement('li');
    li.className = 'game-item';
    li.innerHTML = `<span>${scene.name}</span>`;
    li.onclick = () => {
      exitShortsMode();
      selectGame(key, li);
    };
    listEl.appendChild(li);
  }
  
  const available = Object.keys(gameRegistry).filter(k => !appSettings.hiddenGames.includes(k));
  if (available.length === 0 && !isShortsMode) {
    if (currentScene) currentScene.cleanup();
    const uiPanel = document.getElementById('ui-panel');
    if (uiPanel) uiPanel.style.display = 'none';
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.display = 'none';
  }
}

function selectGame(key, element) {
  if (currentScene) currentScene.cleanup();
  
  document.querySelectorAll('.game-item').forEach(el => el.classList.remove('active'));
  if (element) element.classList.add('active');

  currentScene = gameRegistry[key];
  if (currentScene) currentScene.init(); 
}

// ==========================================
// オプション画面の制御
// ==========================================
const btnOptions = document.getElementById('btn-options');
if (btnOptions) {
  btnOptions.onclick = () => {
    const hideList = document.getElementById('hide-games-list');
    if (!hideList) return;
    hideList.innerHTML = '';
    
    for (const [key, scene] of Object.entries(gameRegistry)) {
      const lbl = document.createElement('label');
      lbl.className = 'checkbox-label';
      const isHidden = appSettings.hiddenGames.includes(key);
      
      lbl.innerHTML = `<input type="checkbox" value="${key}" ${!isHidden ? 'checked' : ''}> ${scene.name} を表示する`;
      
      lbl.querySelector('input').onchange = (e) => {
        if (e.target.checked) {
          appSettings.hiddenGames = appSettings.hiddenGames.filter(k => k !== key);
        } else {
          if (!appSettings.hiddenGames.includes(key)) appSettings.hiddenGames.push(key);
        }
        saveSettings();
      };
      hideList.appendChild(lbl);
    }
    if (optionsModal) optionsModal.style.display = 'flex';
  };
}

window.closeOptions = () => {
  if (optionsModal) optionsModal.style.display = 'none';
};

// ==========================================
// ショートモード（TikTok風）の制御
// ==========================================
const btnShorts = document.getElementById('btn-shorts');
if (btnShorts) {
  btnShorts.onclick = () => {
    if (isShortsMode) return;
    isShortsMode = true;
    if (shortsUI) shortsUI.style.display = 'block';
    document.querySelectorAll('.game-item').forEach(el => el.classList.remove('active'));
    nextShortsGame();
  };
}

function exitShortsMode() {
  isShortsMode = false;
  if (shortsUI) shortsUI.style.display = 'none';
}

function nextShortsGame() {
  if (isCurtainMoving) return;
  isCurtainMoving = true;
  
  const availableGames = Object.keys(gameRegistry).filter(k => !appSettings.hiddenGames.includes(k));
  if (availableGames.length === 0) {
    alert('表示できるゲームがありません。オプションからゲームをオンにしてください。');
    isCurtainMoving = false;
    exitShortsMode();
    return;
  }
  
  if (curtain) {
    curtain.classList.remove('slide-out', 'no-transition');
    curtain.classList.add('slide-in');
  }

  setTimeout(() => {
    if (currentScene) currentScene.cleanup();
    
    let nextKey = availableGames[Math.floor(Math.random() * availableGames.length)];
    
    // 同じゲームが連続しないようにする配慮
    if (availableGames.length > 1 && currentScene && gameRegistry[nextKey] === currentScene) {
       let filtered = availableGames.filter(k => gameRegistry[k] !== currentScene);
       nextKey = filtered[Math.floor(Math.random() * filtered.length)];
    }

    currentScene = gameRegistry[nextKey];
    if (currentScene) currentScene.startGame();
    
    if (curtain) {
      curtain.classList.remove('slide-in');
      curtain.classList.add('slide-out');
      
      setTimeout(() => {
        curtain.classList.add('no-transition');
        curtain.classList.remove('slide-out');
        isCurtainMoving = false;
      }, 350);
    } else {
      isCurtainMoving = false;
    }
  }, 350);
}

// --- スワイプとホイールの検知 ---
let shortsStartY = 0;

if (shortsUI) {
  shortsUI.addEventListener('touchstart', e => {
    shortsStartY = e.touches[0].clientY;
    e.preventDefault();
  }, {passive: false});

  shortsUI.addEventListener('touchend', e => {
    let dy = e.changedTouches[0].clientY - shortsStartY;
    if (dy < -30 || dy > 30) nextShortsGame();
    e.preventDefault();
  });
}

const mainContent = document.getElementById('main-content');
if (mainContent) {
  mainContent.addEventListener('wheel', e => {
    if (isShortsMode && !isCurtainMoving) {
      if (e.deltaY > 50 || e.deltaY < -50) {
        nextShortsGame();
      }
    }
  });
}

// ==========================================
// 初期化実行
// ==========================================
renderSidebar();
const firstAvailable = Object.keys(gameRegistry).find(k => !appSettings.hiddenGames.includes(k));
if (firstAvailable) {
  selectGame(firstAvailable, listEl ? listEl.firstChild : null);
} else if (Object.keys(gameRegistry).length === 0) {
   // ゲームが1つも読み込めなかった場合のエラー表示
   if (listEl) listEl.innerHTML = '<li style="padding:15px; color:#ff4757;">ゲームの読み込みに失敗しました。コードを確認してください。</li>';
}