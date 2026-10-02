const SPRITES = {
  dino: [
    [0,0,0,0,0,1,1,1,1,0], [0,0,0,0,0,1,0,1,1,0], [0,0,0,0,0,1,1,1,1,0],
    [0,0,0,0,0,1,1,1,0,0], [1,0,0,0,1,1,1,0,0,0], [1,1,0,1,1,1,1,0,0,0],
    [0,1,1,1,1,1,1,1,0,0], [0,0,1,1,1,1,1,0,0,0], [0,0,0,1,0,0,1,0,0,0], [0,0,0,1,0,0,1,0,0,0]
  ],
  cactus: [
    [0,0,1,0,0], [0,1,1,0,0], [1,1,1,0,1], [1,1,1,1,1], [0,1,1,1,0], [0,1,1,0,0], [0,1,1,0,0]
  ],
  ptera: [
    [0,0,0,1,0,0,0], [0,1,1,1,1,0,0], [1,1,1,1,1,1,1], [0,0,1,1,1,0,0], [0,0,0,1,0,0,0]
  ]
};

class DinoGameScene extends GameScene {
  constructor() {
    super('恐竜ランナー');
    this.recordType = 'desc'; // 追加
    this.scoreUnit = 'pt';    // 追加
    this.pixelSize = 3;
    this.dino = { x: 50, y: 0, w: 10 * this.pixelSize, h: 10 * this.pixelSize, vy: 0, gravity: 0.8, jumpPower: -13, groundY: 250 };
    this.obstacles = []; this.frame = 0; this.isActive = false; this.reqId = null;
    this.keydownHandler = (e) => this.handleInput(e);
  }

  showTitle() {
    this.showUI(`
      <h2>${this.name}</h2>
      <h3>操作方法</h3>
      <p>Space：ジャンプ<br>スマホ：ジャンプボタン<br>P / Esc：一時停止</p>
      <div class="btn-group">
        <button class="ui-btn btn-primary" onclick="currentScene.startGame()">ゲーム開始</button>
      </div>
      ${this.getRecordsHTML()}
    `);
  }

  startGame() {
    this.hideUI();
    canvas.width = 640; canvas.height = 320;
    this.dino.y = this.dino.groundY; this.dino.vy = 0;
    this.obstacles = []; this.frame = 0; this.score = 0;
    this.accumulator = 0; this.lastTime = performance.now();
    this.isActive = true;
    window.addEventListener('keydown', this.keydownHandler);
    this.reqId = requestAnimationFrame(t => this.loop(t));
  }

  showResult() {
    this.saveRecord(this.score); // 追加
    this.showUI(`
      <h2>GAME OVER</h2>
      <div class="score-display">${this.score} pt</div>
      <div class="btn-group">
        <button class="ui-btn btn-primary" onclick="currentScene.startGame()">もう一度プレイ</button>
        <button class="ui-btn btn-secondary" onclick="currentScene.showTitle()">タイトルへ</button>
      </div>
    `);
  }

  handleInput(e) {
    if (!this.isActive) return;
    if (['Space', 'KeyP', 'Escape'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyP' || e.code === 'Escape') { if (!e.repeat) this.togglePause(); return; }
    if (!this.isPaused && e.code === 'Space' && !e.repeat && this.dino.y === this.dino.groundY) {
      this.dino.vy = this.dino.jumpPower;
    }
  }

  stopGameLoop() { super.stopGameLoop(); }
  removeListeners() { window.removeEventListener('keydown', this.keydownHandler); }

  loop(time) {
    if (!this.isActive || this.isPaused) return;
    this.accumulator += Math.min(time - this.lastTime, 100);
    this.lastTime = time;
    while (this.accumulator >= 1000 / 60 && this.isActive) {
      this.update();
      this.accumulator -= 1000 / 60;
    }
    if (!this.isActive) return;
    this.draw();
    this.reqId = requestAnimationFrame(t => this.loop(t));
  }

  update() {
    this.frame++; this.score++;
    this.dino.vy += this.dino.gravity;
    this.dino.y += this.dino.vy;
    if (this.dino.y > this.dino.groundY) { this.dino.y = this.dino.groundY; this.dino.vy = 0; }

    if (this.frame % 100 === 0) {
      if (Math.random() < 0.3) {
        const pteraY = Math.random() < 0.5 ? this.dino.groundY - 40 : this.dino.groundY - 10;
        this.obstacles.push({ type: 'ptera', x: canvas.width, y: pteraY, w: 7 * this.pixelSize, h: 5 * this.pixelSize, speed: 8 });
      } else {
        this.obstacles.push({ type: 'cactus', x: canvas.width, y: this.dino.groundY + this.dino.h - (7 * this.pixelSize), w: 5 * this.pixelSize, h: 7 * this.pixelSize, speed: 6 });
      }
    }

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      let obs = this.obstacles[i]; obs.x -= obs.speed;
      if (obs.x + obs.w < 0) { this.obstacles.splice(i, 1); continue; }
      let margin = 5;
      if (this.dino.x + margin < obs.x + obs.w && this.dino.x + this.dino.w - margin > obs.x &&
          this.dino.y + margin < obs.y + obs.h && this.dino.y + this.dino.h - margin > obs.y) {
        this.stopGameLoop(); this.showResult();
        return;
      }
    }
  }

  drawSprite(sprite, offsetX, offsetY, color) {
    ctx.fillStyle = color;
    for (let y = 0; y < sprite.length; y++) {
      for (let x = 0; x < sprite[y].length; x++) {
        if (sprite[y][x] === 1) {
          ctx.fillRect(offsetX + x * this.pixelSize, offsetY + y * this.pixelSize, this.pixelSize, this.pixelSize);
        }
      }
    }
  }

  draw() {
    ctx.fillStyle = '#1e1e2f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.beginPath();
    for(let i = 0; i < canvas.width; i+=20) {
      let offset = (this.frame * 6) % 20;
      ctx.moveTo(i - offset, this.dino.groundY + this.dino.h);
      ctx.lineTo(i - offset + 10, this.dino.groundY + this.dino.h);
    }
    ctx.stroke();

    this.drawSprite(SPRITES.dino, this.dino.x, this.dino.y, '#ff4757');
    this.obstacles.forEach(obs => {
      if (obs.type === 'cactus') this.drawSprite(SPRITES.cactus, obs.x, obs.y, '#2ed573');
      if (obs.type === 'ptera') {
        let flapY = Math.sin(this.frame / 5) * 2;
        this.drawSprite(SPRITES.ptera, obs.x, obs.y + flapY, '#1e90ff');
      }
    });

    ctx.fillStyle = '#fff'; ctx.font = '20px Monospace'; ctx.textAlign='left'; ctx.fillText(`SCORE: ${this.score}`, 20, 30);
    if (this.isPaused) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Arial'; ctx.textAlign = 'center';
      ctx.fillText('一時停止', canvas.width / 2, canvas.height / 2);
    }
  }
}

