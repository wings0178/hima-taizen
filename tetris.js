class TetrisGameScene extends GameScene {
  constructor() {
    super('テトリス');
    this.cols = 10; this.rows = 20; this.blockSize = 25;
    this.boardOffset = 4; 
    this.board = null; 
    
    this.bag = [];
    this.piece = null;
    this.nextPieceIndex = null;
    this.holdPieceIndex = null;
    this.hasHeld = false;

    this.dropCounter = 0; this.dropInterval = 1000; this.lastTime = 0;
    this.isActive = false; this.isPaused = false; this.isGameOver = false;
    this.reqId = null;

    this.colors = [null, '#ff4757', '#2ed573', '#1e90ff', '#ffa502', '#ff6348', '#a4b0be', '#f1c40f'];
    
    this.keydownHandler = (e) => this.handleInput(e);
    this.touchStartHandler = (e) => this.handleTouchStart(e);
    this.touchMoveHandler = (e) => this.handleTouchMove(e);
    this.touchEndHandler = (e) => this.handleTouchEnd(e);

    // スマホスワイプ操作用の変数
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.touchStartTime = 0;
    this.isSwiping = false;
    this.touchAxis = null; // スワイプの軸固定用

    // タッチイベントを画面全体で拾うためのターゲット
    this.touchTarget = document.getElementById('main-content');

    this.PIECES = [
      null,
      [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
      [[2,2],[2,2]],
      [[0,3,0],[3,3,3],[0,0,0]],
      [[0,0,4],[4,4,4],[0,0,0]],
      [[5,0,0],[5,5,5],[0,0,0]],
      [[0,6,6],[6,6,0],[0,0,0]],
      [[7,7,0],[0,7,7],[0,0,0]]
    ];
  }

  showTitle() {
    this.showUI(`
      <h2>${this.name}</h2>
      <h3>操作方法</h3>
      <p>
      【←/→】移動 【↑】回転 【↓】ソフトドロップ<br>
      【Space】ハードドロップ 【Shift / C】ホールド<br>
      【P / Esc】ポーズ<br>
      <span style="color:var(--accent-color);font-size:0.9rem;">
      ※スマホ操作（画面下の空きスペースでも操作可能）<br>
      タップ：回転<br>
      左右にドラッグ：移動<br>
      下フリック：一気に落下<br>
      上フリック：ホールド
      </span>
      </p>
      <div class="btn-group">
        <button class="ui-btn btn-primary" onclick="currentScene.startGame()">ゲーム開始</button>
      </div>
    `);
  }

  startGame() {
    this.hideUI();
    canvas.width = (this.cols + 8) * this.blockSize; 
    canvas.height = this.rows * this.blockSize;
    this.board = Array.from({length: this.rows}, () => Array(this.cols).fill(0));
    this.score = 0; this.dropInterval = 1000;
    this.bag = [];
    this.holdPieceIndex = null;
    this.nextPieceIndex = this.drawFromBag();
    
    this.isActive = true;
    this.isPaused = false;
    this.isGameOver = false;

    window.addEventListener('keydown', this.keydownHandler);
    // キャンバスではなくメインコンテンツ全体にイベントを貼る
    this.touchTarget.addEventListener('touchstart', this.touchStartHandler, {passive: false});
    this.touchTarget.addEventListener('touchmove', this.touchMoveHandler, {passive: false});
    this.touchTarget.addEventListener('touchend', this.touchEndHandler, {passive: false});

    this.spawnPiece();
    this.lastTime = performance.now();
    this.reqId = requestAnimationFrame((t) => this.loop(t));
  }

  showResult() {
    this.isGameOver = true;
    this.showUI(`
      <h2>GAME OVER</h2>
      <div class="score-display">${this.score} pt</div>
      <div class="btn-group">
        <button class="ui-btn btn-primary" onclick="currentScene.startGame()">もう一度プレイ</button>
        <button class="ui-btn btn-secondary" onclick="currentScene.quitGame()">タイトルへ</button>
      </div>
    `);
  }

  quitGame() {
    this.stopGameLoop();
    this.showTitle();
  }

  stopGameLoop() { 
    this.isActive = false; 
    cancelAnimationFrame(this.reqId); 
  }

  removeListeners() { 
    window.removeEventListener('keydown', this.keydownHandler);
    this.touchTarget.removeEventListener('touchstart', this.touchStartHandler);
    this.touchTarget.removeEventListener('touchmove', this.touchMoveHandler);
    this.touchTarget.removeEventListener('touchend', this.touchEndHandler);
  }

  drawFromBag() {
    if (this.bag.length === 0) {
      this.bag = [1, 2, 3, 4, 5, 6, 7];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop();
  }

  spawnPiece(specificIndex = null) {
    let typeIndex = specificIndex;
    if (typeIndex === null) {
      typeIndex = this.nextPieceIndex;
      this.nextPieceIndex = this.drawFromBag();
    }
    
    const shape = this.PIECES[typeIndex];
    this.piece = {
      typeIndex: typeIndex,
      matrix: shape,
      x: Math.floor(this.cols/2) - Math.floor(shape[0].length/2),
      y: 0
    };
    
    this.hasHeld = false; 
    
    if (this.collide()) { 
      this.stopGameLoop(); 
      this.showResult(); 
    }
  }

  holdPiece() {
    if (this.hasHeld) return;
    const currentType = this.piece.typeIndex;
    if (this.holdPieceIndex === null) {
      this.holdPieceIndex = currentType;
      this.spawnPiece();
    } else {
      const temp = this.holdPieceIndex;
      this.holdPieceIndex = currentType;
      this.spawnPiece(temp);
    }
    this.hasHeld = true;
    this.dropCounter = 0;
  }

  hardDrop() {
    while (!this.collide(this.piece.x, this.piece.y + 1)) {
      this.piece.y++;
    }
    this.merge(); 
    this.sweep(); 
    this.spawnPiece();
    this.dropCounter = 0;
  }

  collide(newX = this.piece.x, newY = this.piece.y, newMatrix = this.piece.matrix) {
    for (let y = 0; y < newMatrix.length; y++) {
      for (let x = 0; x < newMatrix[y].length; x++) {
        if (newMatrix[y][x] !== 0) {
          let bx = newX + x; let by = newY + y;
          if (bx < 0 || bx >= this.cols || by >= this.rows || (by >= 0 && this.board[by][bx] !== 0)) return true;
        }
      }
    }
    return false;
  }

  rotate() {
    const m = this.piece.matrix;
    const d = m.length;
    let newMatrix = Array.from({length: d}, () => Array(d).fill(0));
    for (let y = 0; y < d; y++) {
      for (let x = 0; x < d; x++) { newMatrix[x][d - 1 - y] = m[y][x]; }
    }
    
    let oldX = this.piece.x;
    let offsets = [0, 1, -1, 2, -2];
    for(let i=0; i<offsets.length; i++) {
      if(!this.collide(this.piece.x + offsets[i], this.piece.y, newMatrix)) {
        this.piece.x += offsets[i];
        this.piece.matrix = newMatrix; return;
      }
    }
  }

  merge() {
    this.piece.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) this.board[y + this.piece.y][x + this.piece.x] = value;
      });
    });
  }

  sweep() {
    let linesCleared = 0;
    outer: for (let y = this.rows - 1; y >= 0; y--) {
      for (let x = 0; x < this.cols; x++) { if (this.board[y][x] === 0) continue outer; }
      const row = this.board.splice(y, 1)[0].fill(0);
      this.board.unshift(row);
      linesCleared++; y++;
    }
    if(linesCleared > 0) {
      this.score += [0, 10, 30, 60, 100][linesCleared];
      this.dropInterval = Math.max(100, 1000 - this.score * 2);
    }
  }

  drop() {
    if (!this.collide(this.piece.x, this.piece.y + 1)) {
      this.piece.y++;
    } else {
      this.merge(); this.sweep(); this.spawnPiece();
    }
    this.dropCounter = 0;
  }

  togglePause() {
    if (this.isGameOver) return;
    this.isPaused = !this.isPaused;
    if (!this.isPaused) {
      this.lastTime = performance.now();
      this.reqId = requestAnimationFrame((t) => this.loop(t));
    } else {
      this.draw(); 
    }
  }

  handleInput(e) {
    if (!this.isActive || this.isGameOver) return;
    
    if (e.code === 'KeyP' || e.code === 'Escape') {
      this.togglePause();
      return;
    }
    
    if (this.isPaused) return;

    if (e.code === 'ArrowLeft') { if (!this.collide(this.piece.x - 1, this.piece.y)) this.piece.x--; }
    else if (e.code === 'ArrowRight') { if (!this.collide(this.piece.x + 1, this.piece.y)) this.piece.x++; }
    else if (e.code === 'ArrowDown') { this.drop(); }
    else if (e.code === 'ArrowUp') { this.rotate(); }
    else if (e.code === 'Space') { this.hardDrop(); }
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyC') { this.holdPiece(); }
  }

  handleTouchStart(e) {
    if (!this.isActive || this.isGameOver) return;
    
    const clientX = e.touches[0].clientX;
    const clientY = e.touches[0].clientY;
    const rect = canvas.getBoundingClientRect();

    // キャンバス内をタップしたかどうかの判定
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      const touchX = (clientX - rect.left) * (canvas.width / rect.width);
      const touchY = (clientY - rect.top) * (canvas.height / rect.height);
      
      // ポーズボタン領域
      if (touchX > canvas.width - 50 && touchY < 50) {
        this.togglePause();
        e.preventDefault();
        return;
      }

      if (this.isPaused) {
        if (touchX > canvas.width/2 - 60 && touchX < canvas.width/2 + 60 && touchY > canvas.height/2 + 20 && touchY < canvas.height/2 + 60) {
          this.quitGame();
        } else {
          this.togglePause();
        }
        e.preventDefault();
        return;
      }
    } else {
      // キャンバス外をタップして、かつポーズ中の場合は再開
      if (this.isPaused) {
        this.togglePause();
        e.preventDefault();
        return;
      }
    }

    if (this.isPaused) return;

    this.touchStartX = clientX;
    this.touchStartY = clientY;
    this.lastTouchX = this.touchStartX;
    this.lastTouchY = this.touchStartY;
    this.touchStartTime = Date.now();
    this.isSwiping = false;
    this.touchAxis = null; // 新たにタッチした時は軸をリセット
  }

  handleTouchMove(e) {
    if (!this.isActive || this.isPaused || this.isGameOver) return;
    e.preventDefault(); 

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - this.lastTouchX;
    const dy = currentY - this.lastTouchY;
    const totalDx = currentX - this.touchStartX;
    const totalDy = currentY - this.touchStartY;

    // 動き始めに、横スワイプか縦フリックかを判断して軸を固定する
    if (this.touchAxis === null && (Math.abs(totalDx) > 10 || Math.abs(totalDy) > 10)) {
      this.touchAxis = Math.abs(totalDy) > Math.abs(totalDx) ? 'y' : 'x';
    }

    const sensitivityX = 25; 
    const sensitivityY = 35; 

    if (Math.abs(totalDx) > 10 || Math.abs(totalDy) > 10) {
      this.isSwiping = true;
    }

    // 縦フリックと判定された場合は、横方向の移動を完全に無視する（誤爆防止）
    if (this.touchAxis !== 'y') {
      if (dx > sensitivityX) {
        if (!this.collide(this.piece.x + 1, this.piece.y)) this.piece.x++;
        this.lastTouchX = currentX;
      } else if (dx < -sensitivityX) {
        if (!this.collide(this.piece.x - 1, this.piece.y)) this.piece.x--;
        this.lastTouchX = currentX;
      }
    }

    // 下へのゆっくりなドラッグはソフトドロップ
    if (this.touchAxis === 'y' && dy > sensitivityY) {
      if (!this.collide(this.piece.x, this.piece.y + 1)) {
        this.piece.y++;
        this.score += 1; 
      }
      this.lastTouchY = currentY;
    }
  }

  handleTouchEnd(e) {
    if (!this.isActive || this.isPaused || this.isGameOver) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const duration = Date.now() - this.touchStartTime;

    const totalDx = touchEndX - this.touchStartX;
    const totalDy = touchEndY - this.touchStartY;

    if (!this.isSwiping && duration < 300) {
      // ほとんど動かさずに指を離した場合は「タップ（回転）」
      this.rotate();
    } else if (duration < 300) {
      // 短時間で大きく動かした場合は「フリック」
      if (Math.abs(totalDy) > Math.abs(totalDx) && Math.abs(totalDy) > 40) {
        if (totalDy > 0) {
          this.hardDrop(); 
        } else {
          this.holdPiece(); 
        }
      }
    }
  }

  getGhostY() {
    let ghostY = this.piece.y;
    while (!this.collide(this.piece.x, ghostY + 1)) { ghostY++; }
    return ghostY;
  }

  loop(time = 0) {
    if (!this.isActive || this.isPaused || this.isGameOver) return;
    const deltaTime = time - this.lastTime; this.lastTime = time;
    this.dropCounter += deltaTime;
    if (this.dropCounter > this.dropInterval) this.drop();
    this.draw();
    this.reqId = requestAnimationFrame((t) => this.loop(t));
  }

  draw() {
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, this.boardOffset * this.blockSize, canvas.height);
    ctx.fillRect((this.boardOffset + this.cols) * this.blockSize, 0, 4 * this.blockSize, canvas.height);

    ctx.fillStyle = '#fff'; ctx.font = '14px Arial'; ctx.textAlign = 'center';
    ctx.fillText('HOLD', 2 * this.blockSize, 1.5 * this.blockSize);
    ctx.fillText('NEXT', (this.boardOffset + this.cols + 2) * this.blockSize, 1.5 * this.blockSize);

    ctx.fillText(`SCORE`, (this.boardOffset + this.cols + 2) * this.blockSize, 12 * this.blockSize);
    ctx.fillText(`${this.score}`, (this.boardOffset + this.cols + 2) * this.blockSize, 13.5 * this.blockSize);

    ctx.fillStyle = '#888';
    ctx.fillRect(canvas.width - 35, 15, 8, 20);
    ctx.fillRect(canvas.width - 20, 15, 8, 20);

    const drawMatrix = (matrix, offsetX, offsetY, alpha = 1.0) => {
      ctx.globalAlpha = alpha;
      matrix.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            ctx.fillStyle = this.colors[value];
            ctx.fillRect((x + offsetX) * this.blockSize, (y + offsetY) * this.blockSize, this.blockSize - 1, this.blockSize - 1);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect((x + offsetX) * this.blockSize + 2, (y + offsetY) * this.blockSize + 2, this.blockSize - 5, 4);
          }
        });
      });
      ctx.globalAlpha = 1.0;
    };

    drawMatrix(this.board, this.boardOffset, 0);

    if (this.piece) {
      const ghostY = this.getGhostY();
      drawMatrix(this.piece.matrix, this.piece.x + this.boardOffset, ghostY, 0.2);
      drawMatrix(this.piece.matrix, this.piece.x + this.boardOffset, this.piece.y);
    }

    if (this.holdPieceIndex !== null) {
      const holdShape = this.PIECES[this.holdPieceIndex];
      let dx = 2 - holdShape[0].length / 2;
      let dy = 3;
      drawMatrix(holdShape, dx, dy, this.hasHeld ? 0.3 : 1.0);
    }

    if (this.nextPieceIndex !== null) {
      const nextShape = this.PIECES[this.nextPieceIndex];
      let dx = (this.boardOffset + this.cols + 2) - nextShape[0].length / 2;
      let dy = 3;
      drawMatrix(nextShape, dx, dy);
    }

    ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
    ctx.strokeRect(this.boardOffset * this.blockSize, 0, this.cols * this.blockSize, this.rows * this.blockSize);

    if (this.isPaused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#fff'; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center';
      ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 20);

      ctx.fillStyle = '#ff4757';
      ctx.fillRect(canvas.width / 2 - 60, canvas.height / 2 + 20, 120, 40);
      ctx.fillStyle = '#fff'; ctx.font = '16px Arial';
      ctx.fillText('タイトルへ戻る', canvas.width / 2, canvas.height / 2 + 45);
      
      ctx.font = '12px Arial'; ctx.fillStyle = '#ccc';
      ctx.fillText('※画面のどこかをタップで再開', canvas.width / 2, canvas.height / 2 + 85);
    }
  }
}