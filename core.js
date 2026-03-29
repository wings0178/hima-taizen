const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const uiPanel = document.getElementById('ui-panel');
const uiContent = document.getElementById('ui-content');

let currentScene = null;

class GameScene {
  constructor(name) { 
    this.name = name; 
    this.score = 0; 
    // ランキングの並び順と単位（ゲームごとに上書きするわよ）
    this.recordType = 'desc'; // 'desc': 降順(高い方が良い), 'asc': 昇順(少ない方が良い), 'none': 記録しない
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
      records.sort((a, b) => b - a); // 降順
    } else {
      records.sort((a, b) => a - b); // 昇順
    }
    records = records.slice(0, 3); // 上位3つだけ残す
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
    const numpad = document.getElementById('v-numpad');
    
    if (this.name === '恐竜ランナー') {
      dpad.style.display = 'none'; action.style.display = 'flex'; numpad.style.display = 'none';
      canvas.style.maxHeight = '45vh';
    } else if (this.name === '本格テトリス') {
      dpad.style.display = 'none'; action.style.display = 'none'; numpad.style.display = 'none';
      canvas.style.maxHeight = '75vh'; 
    } else if (this.name === '百ます計算') {
      dpad.style.display = 'flex'; action.style.display = 'none'; numpad.style.display = 'flex';
      canvas.style.maxHeight = '45vh';
    } else {
      // 猟犬とうさぎ等のデフォルト
      dpad.style.display = 'none'; action.style.display = 'none'; numpad.style.display = 'none';
      canvas.style.maxHeight = '60vh'; 
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