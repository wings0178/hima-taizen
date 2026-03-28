const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const uiPanel = document.getElementById('ui-panel');
const uiContent = document.getElementById('ui-content');

let currentScene = null;

class GameScene {
  constructor(name) { this.name = name; this.score = 0; }
  
  init() { this.showTitle(); }
  cleanup() { this.stopGameLoop(); this.removeListeners(); }

  // どのゲームか判定して、必要なバーチャルパッドだけを表示するわ
  updateMobileUI() {
    const dpad = document.getElementById('v-dpad');
    const action = document.getElementById('v-action');
    const numpad = document.getElementById('v-numpad');
    
    if (this.name === '恐竜ランナー') {
      dpad.style.display = 'none'; action.style.display = 'flex'; numpad.style.display = 'none';
    } else if (this.name === 'シンプルテトリス') {
      dpad.style.display = 'flex'; action.style.display = 'none'; numpad.style.display = 'none';
    } else if (this.name === '百ます計算') {
      dpad.style.display = 'flex'; action.style.display = 'none'; numpad.style.display = 'flex';
    }
  }

  showUI(html) {
    canvas.style.display = 'none';
    uiPanel.style.display = 'block';
    uiContent.innerHTML = html;
    document.getElementById('virtual-controls').classList.remove('playing');
  }
  hideUI() {
    uiPanel.style.display = 'none';
    canvas.style.display = 'block';
    this.updateMobileUI();
    document.getElementById('virtual-controls').classList.add('playing');
  }

  showTitle() {}
  startGame() {}
  showResult() {}
  stopGameLoop() {}
  removeListeners() {}
}

function varColor(name) { 
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); 
}

// バーチャルパッドのイベント登録
document.querySelectorAll('.v-btn').forEach(btn => {
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault(); // スマホ特有のダブルタップ拡大などを防ぐ
    const key = btn.getAttribute('data-key');
    const code = btn.getAttribute('data-code');
    // 擬似的にキーボードイベントを発火
    window.dispatchEvent(new KeyboardEvent('keydown', { key: key, code: code }));
  }, {passive: false});
});