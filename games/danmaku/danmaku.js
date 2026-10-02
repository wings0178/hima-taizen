class DanmakuGameScene extends GameScene {
  constructor() {
    super('弾幕シューティング', {controls: ['dpad', 'bomb']});
    this.keys = new Set();
    this.keydownHandler = e => this.handleKey(e, true);
    this.keyupHandler = e => this.handleKey(e, false);
    this.pointerDownHandler = e => this.beginDrag(e);
    this.pointerMoveHandler = e => this.moveDrag(e);
    this.pointerEndHandler = e => {
      if (this.drag && this.drag.id === e.pointerId) this.drag = null;
    };
  }
  showTitle() {
    this.showUI(`
      <h2>${this.name}</h2>
      <details class="game-help"><summary>操作方法</summary>
      <p>方向キー / WASD：移動　Shift：低速<br>
      スマホ：ドラッグで移動　射撃は自動<br>
      X / ボムボタン：弾を消去<br>P / Esc：一時停止<br>
      残機3・ボム3。3つの弾幕を突破するとクリア。
      <span class="reel-input-help">スライムを上下に引くとゲーム切り替え</span></p>
      </details>
      <div class="btn-group"><button class="ui-btn btn-primary" onclick="currentScene.startGame()">ゲーム開始</button></div>
    `);
  }
  startGame() {
    this.hideUI();
    canvas.width = 400;
    canvas.height = 600;
    this.player = {x: 200, y: 510};
    this.lives = 3;
    this.bombs = 3;
    this.score = 0;
    this.wave = 1;
    this.time = 0;
    this.invincible = 1.5;
    this.shotTimer = 0;
    this.bulletTimer = 0.8;
    this.flash = 0;
    this.shots = [];
    this.bullets = [];
    this.drag = null;
    this.keys.clear();
    this.newEnemy();
    this.isActive = true;
    this.lastTime = performance.now();
    this.updateBombButton();
    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
    canvas.addEventListener('pointerdown', this.pointerDownHandler);
    canvas.addEventListener('pointermove', this.pointerMoveHandler);
    canvas.addEventListener('pointerup', this.pointerEndHandler);
    canvas.addEventListener('pointercancel', this.pointerEndHandler);
    canvas.addEventListener('lostpointercapture', this.pointerEndHandler);
    this.reqId = requestAnimationFrame(t => this.loop(t));
  }
  newEnemy() {
    const hp = 100 + this.wave * 20;
    this.enemy = {x: 200, y: 85, hp, maxHp: hp};
    this.waveTime = 0;
    this.pattern = 0;
    this.bullets = [];
    this.bulletTimer = 1;
  }
  removeListeners() {
    window.removeEventListener('keydown', this.keydownHandler);
    window.removeEventListener('keyup', this.keyupHandler);
    canvas.removeEventListener('pointerdown', this.pointerDownHandler);
    canvas.removeEventListener('pointermove', this.pointerMoveHandler);
    canvas.removeEventListener('pointerup', this.pointerEndHandler);
    canvas.removeEventListener('pointercancel', this.pointerEndHandler);
    canvas.removeEventListener('lostpointercapture', this.pointerEndHandler);
    this.keys.clear();
    this.drag = null;
  }
  togglePause() {
    this.drag = null;
    super.togglePause();
  }
  handleKey(e, down) {
    const movement = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'];
    if (movement.includes(e.code)) {
      if (this.isActive) e.preventDefault();
      if (down && !this.isPaused) this.keys.add(e.code);
      else this.keys.delete(e.code);
    }
    if (!down || !this.isActive || e.repeat) return;
    if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); this.togglePause(); }
    if (e.code === 'KeyX' || e.code === 'Space') { e.preventDefault(); this.useBomb(); }
  }
  beginDrag(e) {
    if (!this.isActive || this.isPaused || (e.pointerType === 'mouse' && e.button !== 0) || this.drag) return;
    const point = canvasPoint(e.clientX, e.clientY);
    if (!point || !point.inside) return;
    e.preventDefault();
    this.drag = {id: e.pointerId, x: point.x, y: point.y};
    canvas.setPointerCapture(e.pointerId);
  }
  moveDrag(e) {
    if (!this.drag || this.drag.id !== e.pointerId || !this.isActive || this.isPaused) return;
    const point = canvasPoint(e.clientX, e.clientY);
    if (!point) return;
    this.player.x += point.x - this.drag.x;
    this.player.y += point.y - this.drag.y;
    this.drag.x = point.x;
    this.drag.y = point.y;
    this.clampPlayer();
  }
  clampPlayer() {
    this.player.x = Math.max(12, Math.min(canvas.width - 12, this.player.x));
    this.player.y = Math.max(140, Math.min(canvas.height - 16, this.player.y));
  }
  useBomb() {
    if (!this.isActive || this.isPaused || this.bombs <= 0) return;
    this.bombs--;
    this.bullets = [];
    this.enemy.hp -= 25;
    this.invincible = Math.max(this.invincible, 1);
    this.flash = 0.3;
    this.updateBombButton();
  }
  updateBombButton() {
    const button = document.getElementById('bomb-game');
    button.textContent = `ボム（${this.bombs}）`;
    button.disabled = this.bombs <= 0;
  }
  emitBullet(angle, speed, color) {
    if (this.bullets.length >= 360) return;
    this.bullets.push({x: this.enemy.x, y: this.enemy.y + 18, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color});
  }
  emitPattern() {
    this.pattern++;
    if (this.wave === 1) {
      for (let i = 0; i < 14; i++) this.emitBullet(i * Math.PI * 2 / 14 + this.pattern * 0.13, 95, '#ff4757');
      this.bulletTimer = 0.85;
    } else if (this.wave === 2) {
      const aim = Math.atan2(this.player.y - this.enemy.y, this.player.x - this.enemy.x);
      for (let i = -3; i <= 3; i++) this.emitBullet(aim + i * 0.19, 135, '#1e90ff');
      for (let i = 0; i < 10; i++) this.emitBullet(i * Math.PI * 2 / 10 + this.pattern * 0.2, 80, '#ffa502');
      this.bulletTimer = 0.7;
    } else {
      for (let i = 0; i < 6; i++) this.emitBullet(i * Math.PI * 2 / 6 + this.pattern * 0.24, 120, '#2ed573');
      if (this.pattern % 5 === 0) {
        const aim = Math.atan2(this.player.y - this.enemy.y, this.player.x - this.enemy.x);
        for (let i = -2; i <= 2; i++) this.emitBullet(aim + i * 0.22, 145, '#ff4757');
      }
      this.bulletTimer = 0.18;
    }
  }
  update(dt) {
    this.time += dt;
    this.waveTime += dt;
    this.invincible = Math.max(0, this.invincible - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.enemy.x = 200 + Math.sin(this.waveTime * 0.8) * 85;
    const held = (...codes) => codes.some(code => this.keys.has(code));
    let dx = Number(held('ArrowRight','KeyD')) - Number(held('ArrowLeft','KeyA'));
    let dy = Number(held('ArrowDown','KeyS')) - Number(held('ArrowUp','KeyW'));
    const length = Math.hypot(dx, dy) || 1;
    const speed = held('ShiftLeft','ShiftRight') ? 100 : 230;
    this.player.x += dx / length * speed * dt;
    this.player.y += dy / length * speed * dt;
    this.clampPlayer();
    this.shotTimer -= dt;
    if (this.shotTimer <= 0) {
      for (const offset of [-6, 6]) this.shots.push({x: this.player.x + offset, y: this.player.y - 10});
      this.shotTimer = 0.12;
    }
    this.shots = this.shots.filter(shot => {
      shot.y -= 480 * dt;
      if (Math.abs(shot.x - this.enemy.x) < 24 && Math.abs(shot.y - this.enemy.y) < 24) {
        this.enemy.hp--;
        this.score += 10;
        return false;
      }
      return shot.y > -15;
    });
    if (this.enemy.hp <= 0) {
      this.score += 1000;
      if (this.wave === 3) { this.showResult(true); return; }
      this.wave++;
      this.newEnemy();
      this.invincible = Math.max(this.invincible, 1.5);
      this.shots = [];
    }
    this.bulletTimer -= dt;
    if (this.bulletTimer <= 0) this.emitPattern();
    let hit = false;
    this.bullets = this.bullets.filter(bullet => {
      const x = bullet.x, y = bullet.y;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      // 軌跡との距離で、高速な弾のすり抜けも判定する。
      const vx = bullet.x - x, vy = bullet.y - y;
      const t = Math.max(0, Math.min(1, ((this.player.x - x) * vx + (this.player.y - y) * vy) / (vx * vx + vy * vy || 1)));
      if (this.invincible <= 0 && Math.hypot(this.player.x - x - t * vx, this.player.y - y - t * vy) < 7) hit = true;
      return bullet.x > -20 && bullet.x < 420 && bullet.y > -20 && bullet.y < 620;
    });
    if (hit) {
      this.lives--;
      this.invincible = 2;
      this.bullets = [];
      this.flash = 0.15;
      if (this.lives <= 0) this.showResult(false);
    }
  }
  loop(time) {
    if (!this.isActive || this.isPaused) return;
    const dt = Math.min(Math.max((time - this.lastTime) / 1000, 0), 0.05);
    this.lastTime = time;
    this.update(dt);
    if (!this.isActive) return;
    this.draw();
    this.reqId = requestAnimationFrame(t => this.loop(t));
  }
  drawPixelSprite(rows, x, y, color) {
    ctx.fillStyle = color;
    rows.forEach((row, j) => [...row].forEach((pixel, i) => {
      if (pixel === '1') ctx.fillRect(x + (i - row.length / 2) * 3, y + (j - rows.length / 2) * 3, 3, 3);
    }));
  }
  draw() {
    ctx.fillStyle = '#1e1e2f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#424258';
    for (let i = 0; i < 45; i++) ctx.fillRect((i * 73 + 17) % 400, (i * 131 + this.time * 20) % 600, 2, 2);
    ctx.fillStyle = '#444'; ctx.fillRect(20, 48, 360, 5);
    ctx.fillStyle = '#ff4757'; ctx.fillRect(20, 48, 360 * Math.max(0, this.enemy.hp / this.enemy.maxHp), 5);
    this.drawPixelSprite(['000111000','010111010','111111111','011111110','001111100','010010010'], this.enemy.x, this.enemy.y, '#ff4757');
    ctx.fillStyle = '#f1c40f';
    for (const shot of this.shots) ctx.fillRect(shot.x - 2, shot.y - 8, 4, 12);
    for (const bullet of this.bullets) {
      ctx.fillStyle = bullet.color; ctx.beginPath(); ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    }
    if (this.invincible <= 0 || Math.floor(this.time * 12) % 2 === 0) {
      this.drawPixelSprite(['0001000','0001000','0011100','1011101','1111111','0111110','0100010'], this.player.x, this.player.y, '#e0e0e0');
    }
    ctx.fillStyle = '#ff4757'; ctx.beginPath(); ctx.arc(this.player.x, this.player.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '15px Arial'; ctx.textAlign = 'left';
    ctx.fillText(`残機 ${this.lives}   WAVE ${this.wave} / 3`, 20, 29);
    ctx.textAlign = 'right'; ctx.fillText(`${this.score} pt`, 380, 29);
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash})`; ctx.fillRect(0, 0, 400, 600); }
    this.drawEnemyMarker();
    if (this.isPaused) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, 400, 600);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Arial'; ctx.textAlign = 'center'; ctx.fillText('一時停止', 200, 300);
    }
  }
  drawEnemyMarker() {
    // 敵の横位置を下端へ投影する。ゲームの座標・当たり判定は変更しない。
    ctx.save();
    const x = this.enemy.x;
    const y = canvas.height - 6;
    ctx.fillStyle = '#ff4757';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x - 6, y + 3);
    ctx.lineTo(x + 6, y + 3);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }
  showResult(clear = false) {
    this.saveRecord(this.score);
    this.showUI(`
      <h2>${clear ? 'クリア' : 'GAME OVER'}</h2>
      <div class="score-display">${this.score} pt</div>
      <div class="btn-group">
        <button class="ui-btn btn-primary" onclick="currentScene.startGame()">もう一度プレイ</button>
        <button class="ui-btn btn-secondary" onclick="currentScene.showTitle()">タイトルへ</button>
      </div>
    `);
  }
}
