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
  }
  
  init() { this.showTitle(); }
  cleanup() { this.stopGameLoop(); this.removeListeners(); }

  // --- ローカルストレージ管理（完全無効化） ---
  saveRecord(newScore) {
    // 各ゲームに saveRecord() の呼び出しが残っていても、
    // ここで何もしないことでエラーを回避しつつ保存を無効化するわ。
  }

  getRecordsHTML() {
    // タイトル画面で getRecordsHTML() が呼ばれても、
    // ただの空文字を返すことで、「まだ記録がない」という文言ごと
    // ランキングのUIを跡形もなく消し去ってあげる。
    return '';
  }
  // --- スマホUI管理 ---
  updateMobileUI() {
    const dpad = document.getElementById('v-dpad');
    const action = document.getElementById('v-action');
    
    if (this.name === '恐竜ランナー') {
      if(dpad) dpad.style.display = 'none'; 
      if(action) action.style.display = 'flex';
      canvas.style.maxHeight = '45vh';
    } else if (this.name === '本格テトリス' || this.name === 'テトリス') {
      if(dpad) dpad.style.display = 'none'; 
      if(action) action.style.display = 'none'; 
      canvas.style.maxHeight = '75vh'; 
    } else {
      if(dpad) dpad.style.display = 'flex'; 
      if(action) action.style.display = 'none'; 
      canvas.style.maxHeight = '60vh'; 
    }
  }

  showUI(html) {
    canvas.style.display = 'none';
    uiPanel.style.display = 'block';
    uiContent.innerHTML = html;
    const vc = document.getElementById('virtual-controls');
    if (vc) vc.classList.remove('playing');
  }

  hideUI() {
    uiPanel.style.display = 'none';
    canvas.style.display = 'block';
    this.updateMobileUI();

    // 画面縮小・解像度バグを防ぐ初期化処理
    if (canvas && ctx) {
      canvas.width = 800;
      canvas.height = 600;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;
    }

    const vc = document.getElementById('virtual-controls');
    if (vc) vc.classList.add('playing');
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