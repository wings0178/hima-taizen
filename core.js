const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const uiPanel = document.getElementById('ui-panel');
const uiContent = document.getElementById('ui-content');

let currentScene = null;

class GameScene {
  constructor(name) { this.name = name; this.score = 0; }
  
  init() { this.showTitle(); }
  cleanup() { this.stopGameLoop(); this.removeListeners(); }

  updateMobileUI() {
    const dpad = document.getElementById('v-dpad');
    const action = document.getElementById('v-action');
    const numpad = document.getElementById('v-numpad');
    
    if (this.name === '恐竜ランナー') {
      dpad.style.display = 'none'; action.style.display = 'flex'; numpad.style.display = 'none';
      canvas.style.maxHeight = '45vh';
    } else if (this.name === 'テトリス') {
      // テトリスは画面スワイプ操作にするため、パッドを全て消して画面を広くするわ
      dpad.style.display = 'none'; action.style.display = 'none'; numpad.style.display = 'none';
      canvas.style.maxHeight = '75vh'; 
    } else if (this.name === '百ます計算') {
      dpad.style.display = 'flex'; action.style.display = 'none'; numpad.style.display = 'flex';
      canvas.style.maxHeight = '45vh';
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

document.querySelectorAll('.v-btn').forEach(btn => {
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    const key = btn.getAttribute('data-key');
    const code = btn.getAttribute('data-code');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: key, code: code }));
  }, {passive: false});
});