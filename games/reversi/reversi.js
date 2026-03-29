class ReversiGameScene extends GameScene {
  constructor() {
    super('オセロ');
    this.boardSize = 8;
    this.board = [];
    this.playerColor = 1; // 1: 黒, 2: 白
    this.turn = 1; // 1: 黒, 2: 白
    this.isGameOver = false;
    this.cpuTimer = 0;
    
    this.cursorX = 3;
    this.cursorY = 3;
    this.isKeyboardMode = false;
    
    this.handleInputBound = this.handleInput.bind(this);
    this.handleKeyDownBound = this.handleKeyDown.bind(this);
    this.handleResizeBound = this.resizeCanvas.bind(this);

    this.DIRECTIONS = [
      [-1, -1], [0, -1], [1, -1],
      [-1,  0],          [1,  0],
      [-1,  1], [0,  1], [1,  1]
    ];

    this.WEIGHTS = [
      [ 30, -12,  0, -1, -1,  0, -12,  30],
      [-12, -15, -3, -3, -3, -3, -15, -12],
      [  0,  -3,  0, -1, -1,  0,  -3,   0],
      [ -1,  -3, -1, -1, -1, -1,  -3,  -1],
      [ -1,  -3, -1, -1, -1, -1,  -3,  -1],
      [  0,  -3,  0, -1, -1,  0,  -3,   0],
      [-12, -15, -3, -3, -3, -3, -15, -12],
      [ 30, -12,  0, -1, -1,  0, -12,  30]
    ];
  }

  showTitle() {
    const html = `
      <div style="text-align: center;">
        <h2 style="color: #fff; margin-bottom: 10px;">オセロ</h2>
        <p style="color: #aaa; margin-bottom: 20px; font-size: 14px;">白黒はっきりさせましょう。</p>
        <button class="btn-primary" onclick="currentScene.startGame(1)" style="margin-bottom: 10px; display: block; width: 100%;">黒（先手）で開始</button>
        <button class="btn-primary" onclick="currentScene.startGame(2)" style="display: block; width: 100%;">白（後手）で開始</button>
      </div>
    `;
    this.showUI(html);
  }

  startGame(playerColor = 1) {
    this.hideUI();
    this.removeListeners();
    this.playerColor = playerColor;
    this.turn = 1;
    this.isGameOver = false;
    this.cpuTimer = 0;
    this.isKeyboardMode = false;
    
    const unusedPads = document.querySelectorAll('.d-pad, .virtual-pad, .controls, #controls, #virtual-pad, .joystick, .keypad, .arrows');
    unusedPads.forEach(pad => {
      if (pad) pad.style.display = 'none';
    });
    
    this.board = Array.from({ length: 8 }, () => Array(8).fill(0));
    this.board[3][3] = 2;
    this.board[3][4] = 1;
    this.board[4][3] = 1;
    this.board[4][4] = 2;

    // ゲーム開始時にキャンバスサイズを親要素に合わせる
    this.resizeCanvas();

    canvas.addEventListener('mousedown', this.handleInputBound);
    canvas.addEventListener('touchstart', this.handleInputBound, { passive: false });
    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('resize', this.handleResizeBound);

    this.isActive = true;
    this.loop();
  }

  stopGameLoop() {
    this.isActive = false;
    cancelAnimationFrame(this.reqId);
  }

  removeListeners() {
    canvas.removeEventListener('mousedown', this.handleInputBound);
    canvas.removeEventListener('touchstart', this.handleInputBound);
    window.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('resize', this.handleResizeBound);
  }

  resizeCanvas() {
    if (canvas.parentElement) {
      // 親の実際のピクセルサイズを取得して、内部解像度を完全に一致させる
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    }
  }

  getLayout() {
    const w = canvas.width;
    const h = canvas.height;
    const minDim = Math.min(w, h);
    
    const padding = minDim * 0.05;
    const available = minDim - (padding * 2);
    const cellSize = Math.max(1, Math.floor(available / 8));
    
    const boardX = (w - cellSize * 8) / 2;
    const boardY = (h - cellSize * 8) / 2 + (h * 0.05); 
    
    return { cellSize, boardX, boardY };
  }

  handleInput(e) {
    if (!this.isActive || this.turn !== this.playerColor || this.isGameOver) return;
    
    this.isKeyboardMode = false;
    if (e.type === 'touchstart') e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

    // 内部解像度と表示サイズが一致しているはずだが、念のためスケール計算を残す
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const layout = this.getLayout();
    const bx = Math.floor((x - layout.boardX) / layout.cellSize);
    const by = Math.floor((y - layout.boardY) / layout.cellSize);

    if (bx >= 0 && bx < 8 && by >= 0 && by < 8) {
      if (this.canPlace(bx, by, this.turn)) {
        this.placeStone(bx, by, this.turn);
        this.advanceTurn();
      }
    }
  }

  handleKeyDown(e) {
    if (!this.isActive || this.turn !== this.playerColor || this.isGameOver) return;
    
    this.isKeyboardMode = true;

    if (e.key === 'ArrowUp') { this.cursorY = Math.max(0, this.cursorY - 1); e.preventDefault(); }
    if (e.key === 'ArrowDown') { this.cursorY = Math.min(7, this.cursorY + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { this.cursorX = Math.max(0, this.cursorX - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { this.cursorX = Math.min(7, this.cursorX + 1); e.preventDefault(); }
    
    if (e.key === 'Enter' || e.key === ' ') {
      if (this.canPlace(this.cursorX, this.cursorY, this.turn)) {
        this.placeStone(this.cursorX, this.cursorY, this.turn);
        this.advanceTurn();
      }
      e.preventDefault();
    }
  }

  canPlace(x, y, color) {
    if (this.board[y][x] !== 0) return false;
    const opponent = color === 1 ? 2 : 1;
    
    for (const [dx, dy] of this.DIRECTIONS) {
      let nx = x + dx;
      let ny = y + dy;
      let foundOpponent = false;
      
      while (nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && this.board[ny][nx] === opponent) {
        foundOpponent = true;
        nx += dx;
        ny += dy;
      }
      
      if (foundOpponent && nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && this.board[ny][nx] === color) {
        return true;
      }
    }
    return false;
  }

  placeStone(x, y, color) {
    this.board[y][x] = color;
    const opponent = color === 1 ? 2 : 1;
    
    for (const [dx, dy] of this.DIRECTIONS) {
      let nx = x + dx;
      let ny = y + dy;
      let stonesToFlip = [];
      
      while (nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && this.board[ny][nx] === opponent) {
        stonesToFlip.push({x: nx, y: ny});
        nx += dx;
        ny += dy;
      }
      
      if (stonesToFlip.length > 0 && nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && this.board[ny][nx] === color) {
        for (const pos of stonesToFlip) {
          this.board[pos.y][pos.x] = color;
        }
      }
    }
  }

  hasValidMove(color) {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (this.canPlace(x, y, color)) return true;
      }
    }
    return false;
  }

  advanceTurn() {
    this.turn = this.turn === 1 ? 2 : 1;
    
    if (!this.hasValidMove(this.turn)) {
      this.turn = this.turn === 1 ? 2 : 1;
      
      if (!this.hasValidMove(this.turn)) {
        this.endGame();
      }
    }
  }

  endGame() {
    this.isGameOver = true;
    let blackCount = 0;
    let whiteCount = 0;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (this.board[y][x] === 1) blackCount++;
        if (this.board[y][x] === 2) whiteCount++;
      }
    }
    
    let resultText = blackCount > whiteCount ? "黒の勝ち" : (whiteCount > blackCount ? "白の勝ち" : "引き分け");
    if (this.playerColor === 1 && blackCount > whiteCount || this.playerColor === 2 && whiteCount > blackCount) {
      resultText += "（あなたの勝利です）";
    } else if (blackCount !== whiteCount) {
      resultText += "（あなたの負けです）";
    }

    const html = `
      <h2 style="color: #fff; margin-bottom: 20px;">結果発表</h2>
      <div style="font-size: 24px; color: #fff; margin-bottom: 10px;">${resultText}</div>
      <div style="color: #aaa; margin-bottom: 20px;">
        黒: ${blackCount} / 白: ${whiteCount}
      </div>
      <button class="btn-primary" onclick="currentScene.showTitle()" style="display: block; width: 100%;">タイトルへ</button>
    `;
    setTimeout(() => this.showResult(html), 1500); 
  }

  showResult(html) {
    this.showUI(html);
  }

  processCPU() {
    if (this.isGameOver || this.turn === this.playerColor) return;
    
    this.cpuTimer++;
    if (this.cpuTimer > 50) {
      this.cpuTimer = 0;
      let bestMove = null;
      let maxScore = -Infinity;
      
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          if (this.canPlace(x, y, this.turn)) {
            const score = this.WEIGHTS[y][x] + (Math.random() * 2);
            if (score > maxScore) {
              maxScore = score;
              bestMove = {x, y};
            }
          }
        }
      }
      
      if (bestMove) {
        this.placeStone(bestMove.x, bestMove.y, this.turn);
      }
      this.advanceTurn();
    }
  }

  update() {
    this.processCPU();
  }

  draw() {
    const layout = this.getLayout();
    const { cellSize, boardX, boardY } = layout;

    ctx.fillStyle = '#1e1e2f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#1e6b3c';
    ctx.fillRect(boardX, boardY, cellSize * 8, cellSize * 8);

    ctx.strokeStyle = '#1e1e2f';
    ctx.lineWidth = Math.max(1, cellSize * 0.05);
    for (let y = 0; y <= 8; y++) {
      ctx.beginPath();
      ctx.moveTo(boardX, boardY + y * cellSize);
      ctx.lineTo(boardX + cellSize * 8, boardY + y * cellSize);
      ctx.stroke();
    }
    for (let x = 0; x <= 8; x++) {
      ctx.beginPath();
      ctx.moveTo(boardX + x * cellSize, boardY);
      ctx.lineTo(boardX + x * cellSize, boardY + cellSize * 8);
      ctx.stroke();
    }

    const radius = cellSize * 0.4;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const cx = boardX + x * cellSize + cellSize / 2;
        const cy = boardY + y * cellSize + cellSize / 2;

        if (this.board[y][x] !== 0) {
          ctx.beginPath();
          ctx.arc(cx + 2, cy + 2, radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fillStyle = this.board[y][x] === 1 ? '#111' : '#f0f0f0';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = this.board[y][x] === 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.8)';
          ctx.fill();
        } else if (this.turn === this.playerColor && this.canPlace(x, y, this.playerColor) && !this.isKeyboardMode) {
          ctx.beginPath();
          ctx.arc(cx, cy, radius * 0.15, 0, Math.PI * 2);
          ctx.fillStyle = '#2ed573';
          ctx.fill();
        }
      }
    }

    if (this.isKeyboardMode && this.turn === this.playerColor) {
      const cx = boardX + this.cursorX * cellSize;
      const cy = boardY + this.cursorY * cellSize;
      ctx.strokeStyle = '#ff4757';
      ctx.lineWidth = Math.max(2, cellSize * 0.1);
      ctx.strokeRect(cx, cy, cellSize, cellSize);
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, Math.max(30, canvas.height * 0.08));

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(14, canvas.height * 0.04)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let statusText = this.isGameOver ? "ゲーム終了" : (this.turn === this.playerColor ? "あなたの番です" : "CPU思考中...");
    ctx.fillText(statusText, canvas.width / 2, Math.max(15, canvas.height * 0.04));
  }

  loop() {
    if (!this.isActive) return;
    this.update();
    this.draw();
    this.reqId = requestAnimationFrame(this.loop.bind(this));
  }
}