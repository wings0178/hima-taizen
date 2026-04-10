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

  // --- ローカルストレージ管理 ---
  get storageKey() { return 'hima_records_' + this.name; }

  getRecords() {
    if (this.recordType === 'none') return [];
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  saveRecord(newScore) {
    if (this.recordType === 'none') return;
    let records = this.getRecords();
    records.push(newScore);
    if (this.recordType === 'desc') {
      records.sort((a, b) => b - a);
    } else {
      records.sort((a, b) => a - b);
    }
    records = records.slice(0, 3);
    localStorage.setItem(this.storageKey, JSON.stringify(records));
  }

  getRecordsHTML() {
    if (this.recordType === 'none') return '';
    const records = this.getRecords();
    let html = '<div class="ranking"><h4>🏆ランキングTOP3</h4>';
    if (records.length === 0) {
      html += '<p style="text-align:center; margin:0; font-size:0.9rem; color:#aaa;">まだ記録がないわ</p>';
    } else {
      html += '<ol>';
      records.forEach(r => { html += `<li>${r} ${this.scoreUnit}</li>`; });
      html += '</ol>';
    }
    html += '</div>';
    return html;
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