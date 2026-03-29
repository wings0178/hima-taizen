class TetrisGameScene extends GameScene {
  constructor() {
    super('本格テトリス');
    this.cols = 10; this.rows = 20; this.blockSize = 25;
    // UI表示用にCanvas幅を広げるためのオフセット（左に4マス、右に4マスの余白）
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
    
    // イベントハンドラのバインド
    this.keydownHandler = (e) => this.handleInput(e);
    this.touchStartHandler = (e) => this.handleTouchStart(e);
    this.touchEndHandler = (e) => this.handleTouchEnd(e);
    this.touchY = 0;
    this.touchX = 0;

    // ミノの定義（正方形マトリクス）
    this.PIECES = [
      null,
      [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // 1: I
      [[2,2],[2,2]],                             // 2: O
      [[0,3,0],[3,3,3],[0,0,0]],                 // 3: T
      [[0,0,4],[4,4,4],[0,0,0]],                 // 4: L
      [[5,0,0],[5,5,5],[0,0,0]],                 // 5: J
      [[0,6,6],[6,6,0],[0,0,0]],                 // 6: S
      [[7,7,0],[0,7,7],[0,0,0]]                  // 7: Z
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
      <span style="color:var(--accent-color);font-size:0.9rem;">※スマホ：下スワイプで一気に落下、上スワイプでホールド</span>
      </p>
      <div class="btn-group">
        <button class="ui-btn btn-primary" onclick="currentScene.startGame()">ゲーム開始</button>
      </div>
    `);
  }

  startGame() {
    this.hideUI();
    // 盤面10マス + 左余白4マス(HOLD) + 右余白4マス(NEXT)
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
    canvas.addEventListener('touchstart', this.touchStartHandler, {passive: false});
    canvas.addEventListener('touchend', this.touchEndHandler, {passive: false});

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
    canvas.removeEventListener('touchstart', this.touchStartHandler);
    canvas.removeEventListener('touchend', this.touchEndHandler);
  }

  // 7種1巡のランダム生成アルゴリズム
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
    
    this.hasHeld = false; // ホールド権の復活
    
    if (this.collide()) { 
      this.stopGameLoop(); 
      this.showResult(); 
    }
  }

  holdPiece() {
    if (this.hasHeld) return; // 1ターンに1回しかホールドできない
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
    let offsets = [0, 1, -1, 2, -2]; // 簡易スーパーローテーション（壁蹴り）
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
      this.draw(); // ポーズ画面を描画するために一度呼ぶ
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
    // ポーズボタン領域（右上）のタップ判定
    const rect = canvas.getBoundingClientRect();
    const touchX = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
    const touchY = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
    
    if (touchX > canvas.width - 50 && touchY < 50) {
      this.togglePause();
      e.preventDefault();
      return;
    }

    if (this.isPaused) {
      // ポーズ中の「やめる」ボタンタップ判定
      if (touchX > canvas.width/2 - 60 && touchX < canvas.width/2 + 60 && touchY > canvas.height/2 + 20 && touchY < canvas.height/2 + 60) {
        this.quitGame();
      } else {
        this.togglePause(); // それ以外は再開
      }
      e.preventDefault();
      return;
    }

    this.touchY = e.touches[0].clientY;
    this.touchX = e.touches[0].clientX;
  }

  handleTouchEnd(e) {
    if (!this.isActive || this.isPaused || this.isGameOver) return;
    const endY = e.changedTouches[0].clientY;
    const endX = e.changedTouches[0].clientX;
    const dy = endY - this.touchY;
    const dx = endX - this.touchX;
    
    // スワイプ判定（縦方向への動きが大きく、かつ40px以上動かした場合）
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 40) {
      if (dy > 0) {
        this.hardDrop(); // 下スワイプ
      } else {
        this.holdPiece(); // 上スワイプ
      }
      e.preventDefault();
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
    
    // UI枠の描画（背景）
    ctx.fillStyle = '#222';
    // 左(HOLD)
    ctx.fillRect(0, 0, this.boardOffset * this.blockSize, canvas.height);
    // 右(NEXT)
    ctx.fillRect((this.boardOffset + this.cols) * this.blockSize, 0, 4 * this.blockSize, canvas.height);

    ctx.fillStyle = '#fff'; ctx.font = '14px Arial'; ctx.textAlign = 'center';
    ctx.fillText('HOLD', 2 * this.blockSize, 1.5 * this.blockSize);
    ctx.fillText('NEXT', (this.boardOffset + this.cols + 2) * this.blockSize, 1.5 * this.blockSize);

    // テキスト・スコア表示
    ctx.fillText(`SCORE`, (this.boardOffset + this.cols + 2) * this.blockSize, 12 * this.blockSize);
    ctx.fillText(`${this.score}`, (this.boardOffset + this.cols + 2) * this.blockSize, 13.5 * this.blockSize);

    // ポーズボタンのアイコン[||]を描画
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

    // 盤面の描画
    drawMatrix(this.board, this.boardOffset, 0);

    // ゴーストミノの描画
    if (this.piece) {
      const ghostY = this.getGhostY();
      drawMatrix(this.piece.matrix, this.piece.x + this.boardOffset, ghostY, 0.2);
      
      // 操作中のミノの描画
      drawMatrix(this.piece.matrix, this.piece.x + this.boardOffset, this.piece.y);
    }

    // HOLDミノの描画
    if (this.holdPieceIndex !== null) {
      const holdShape = this.PIECES[this.holdPieceIndex];
      // 枠の中心に配置するためのオフセット計算
      let dx = 2 - holdShape[0].length / 2;
      let dy = 3;
      // 操作済みで灰色にする処理を足してもいいけど、安っぽくなるから透過度で表現
      drawMatrix(holdShape, dx, dy, this.hasHeld ? 0.3 : 1.0);
    }

    // NEXTミノの描画
    if (this.nextPieceIndex !== null) {
      const nextShape = this.PIECES[this.nextPieceIndex];
      let dx = (this.boardOffset + this.cols + 2) - nextShape[0].length / 2;
      let dy = 3;
      drawMatrix(nextShape, dx, dy);
    }

    // ボードの境界線
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
    ctx.strokeRect(this.boardOffset * this.blockSize, 0, this.cols * this.blockSize, this.rows * this.blockSize);

    // ポーズ画面のオーバーレイ
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
      ctx.fillText('※それ以外の場所をタップで再開', canvas.width / 2, canvas.height / 2 + 85);
    }
  }
}