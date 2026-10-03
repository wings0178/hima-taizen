class TetrisGameScene extends GameScene {
  constructor() {
    super('テトリス', {controls: ['sound']});
    this.muted = false;
    try { this.muted = localStorage.getItem('hima-tetris-muted') === 'true'; } catch (_) {}
    this.audio = new TetrisAudio(this);
    this.keepResultSound = false;
    this.recordType = 'desc'; // 追加
    this.scoreUnit = 'pt';    // 追加
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
    this.touchCancelHandler = () => { this.gestureActive = false; };
    this.gestureActive = false;

    this.touchStartX = 0;
    this.touchStartY = 0;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.touchStartTime = 0;
    this.isSwiping = false;
    this.touchAxis = null; 

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
      <details class="game-help"><summary>操作方法</summary>
      <p>
      【←/→】移動 【↑】回転 【↓】ソフトドロップ<br>
      【Space】ハードドロップ 【Shift / C】ホールド<br>
      【P / Esc】一時停止<br>一時停止中：画面タップで再開<br>
      <span style="color:var(--accent-color);font-size:0.9rem;">
      スマホ：ゲーム画面で操作<br>
      タップ：回転<br>
      左右にドラッグ：移動<br>
      下フリック：一気に落下<br>
      上フリック：ホールド
      <span class="reel-input-help">スライムを上下に引くとゲーム切り替え</span>
      </span>
      </p>
      </details>
      <div class="btn-group">
        <button class="ui-btn btn-primary" onclick="currentScene.startGame()">ゲーム開始</button>
      </div>
      <details class="game-help"><summary>音楽・効果音</summary>
      <p>100ptでオーケストラ風BGMに切り替わります。<br>
      BGM音源：<a href="https://fc.sitefactory.info/bgm.html" target="_blank" rel="noopener">FC音工場</a>「コロブチカ」。<br>
      オーケストラ風編曲：本ゲーム用の独自編曲（原曲：ロシア民謡）。楽器音源：VSCO 2 CE（CC0）。<br>
      効果音：<a href="https://kenney.nl/assets/digital-audio" target="_blank" rel="noopener">Kenney Digital Audio</a>（CC0）。</p></details>
      ${this.getRecordsHTML()}
    `);
  }

  attachListeners() {
    this.syncSound();
    window.addEventListener('keydown', this.keydownHandler);
    this.touchTarget.addEventListener('touchstart', this.touchStartHandler, {passive: false});
    this.touchTarget.addEventListener('touchmove', this.touchMoveHandler, {passive: false});
    this.touchTarget.addEventListener('touchend', this.touchEndHandler, {passive: false});
    this.touchTarget.addEventListener('touchcancel', this.touchCancelHandler);
  }

  startGame() {
    this.hideUI();
    this.audio.reset();
    this.audio.unlock();
    canvas.width = (this.cols + 8) * this.blockSize; 
    canvas.height = this.rows * this.blockSize;
    this.board = Array.from({length: this.rows}, () => Array(this.cols).fill(0));
    this.score = 0;
    this.dropCounter = 0; this.gestureActive = false;
    this.dropInterval = 1000; // 常に1秒間隔で落下
    this.bag = [];
    this.holdPieceIndex = null;
    this.nextPieceIndex = this.drawFromBag();
    
    this.isActive = true;
    this.isPaused = false;
    this.isGameOver = false;

    this.attachListeners();

    this.spawnPiece();
    this.audio.update();
    this.lastTime = performance.now();
    this.reqId = requestAnimationFrame((t) => this.loop(t));
  }

  showResult() {
    this.keepResultSound = this.audio.finish();
    this.isGameOver = true;
    this.saveRecord(this.score); // 追加
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
    if (this.keepResultSound) this.keepResultSound = false;
    else this.audio.stop();
    super.stopGameLoop();
  }


  syncSound() {
    const button = document.getElementById('sound-game');
    if (!button || currentScene !== this) return;
    const blocked = !this.muted && this.audio.context && this.audio.context.state !== 'running';
    button.textContent = this.muted ? '音：OFF' : this.audio.failed ? '音：再試行' : blocked ? '音：再開' : '音：ON';
    button.setAttribute('aria-pressed', String(!this.muted));
    button.setAttribute('aria-label', this.muted ? 'BGM・効果音をオン' : this.audio.failed || blocked ? 'BGM・効果音を再開' : 'BGM・効果音をオフ');
  }
  toggleSound() {
    if (!this.muted && (this.audio.failed || this.audio.context?.state !== 'running')) {
      this.audio.unlock(); this.audio.update(); this.syncSound(); return;
    }
    this.muted = !this.muted;
    try { localStorage.setItem('hima-tetris-muted', String(this.muted)); } catch (_) {}
    if (this.muted) this.audio.stop();
    else { this.audio.unlock(); this.audio.update(); }
    this.syncSound();
  }
  movePiece(direction) {
    if (this.collide(this.piece.x + direction, this.piece.y)) return;
    this.piece.x += direction;
    this.audio.play('move', .085);
  }

  removeListeners() { 
    window.removeEventListener('keydown', this.keydownHandler);
    this.touchTarget.removeEventListener('touchstart', this.touchStartHandler);
    this.touchTarget.removeEventListener('touchmove', this.touchMoveHandler);
    this.touchTarget.removeEventListener('touchend', this.touchEndHandler);
    this.touchTarget.removeEventListener('touchcancel', this.touchCancelHandler);
    this.gestureActive = false;
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
    this.audio.play('hold', .18);
    this.dropCounter = 0;
  }

  hardDrop() {
    this.audio.play('drop', .22);
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
        this.piece.matrix = newMatrix; this.audio.play('rotate', .12); return;
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
      this.audio.play(linesCleared === 4 ? 'tetris' : 'clear', .23);
      this.audio.update();
      // スピードアップ処理を削除。常に同じ速度を維持。
    }
  }

  drop() {
    if (!this.collide(this.piece.x, this.piece.y + 1)) {
      this.piece.y++;
    } else {
      this.audio.play('lock', .17);
      this.merge(); this.sweep(); this.spawnPiece();
    }
    this.dropCounter = 0;
  }

  togglePause() {
    if (!this.isActive || this.isGameOver) return;
    super.togglePause();
    if (this.isPaused) this.audio.stop();
    else { this.audio.unlock(); this.audio.update(); }
    this.syncSound();
  }

  handleInput(e) {
    if (!this.isActive || this.isGameOver) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space', 'KeyP', 'Escape', 'KeyC', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
    
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (!e.repeat) this.togglePause();
      return;
    }
    
    if (this.isPaused) return;
    this.audio.unlock();

    if (e.code === 'ArrowLeft') { this.movePiece(-1); }
    else if (e.code === 'ArrowRight') { this.movePiece(1); }
    else if (e.code === 'ArrowDown') { this.drop(); }
    else if (e.code === 'ArrowUp') { this.rotate(); }
    else if (e.code === 'Space') { this.hardDrop(); }
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyC') { this.holdPiece(); }
  }

  handleTouchStart(e) {
    this.gestureActive = false;
    if (!this.isActive || this.isGameOver) return;
    if (e.touches.length !== 1 || e.target.closest('button, #reel-nav, #virtual-controls, #ui-panel')) return;
    
    const clientX = e.touches[0].clientX;
    const clientY = e.touches[0].clientY;
    const point = canvasPoint(clientX, clientY);

    if (point && point.inside) {
      const touchX = point.x;
      const touchY = point.y;
      
      if (touchX > canvas.width - 50 && touchY < 50) {
        this.togglePause();
        e.preventDefault();
        return;
      }

    }

    if (this.isPaused) return;
    if (reelMode && !point?.inside) return;
    this.audio.unlock();
    e.preventDefault();
    this.gestureActive = true;
    this.touchId = e.touches[0].identifier;

    this.touchStartX = clientX;
    this.touchStartY = clientY;
    this.lastTouchX = this.touchStartX;
    this.lastTouchY = this.touchStartY;
    this.touchStartTime = Date.now();
    this.isSwiping = false;
    this.touchAxis = null; 
  }

  handleTouchMove(e) {
    if (!this.gestureActive || !this.isActive || this.isPaused || this.isGameOver) return;
    if (e.touches.length !== 1) { this.gestureActive = false; return; }
    e.preventDefault(); 

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - this.lastTouchX;
    const dy = currentY - this.lastTouchY;
    const totalDx = currentX - this.touchStartX;
    const totalDy = currentY - this.touchStartY;

    if (this.touchAxis === null && (Math.abs(totalDx) > 10 || Math.abs(totalDy) > 10)) {
      this.touchAxis = Math.abs(totalDy) > Math.abs(totalDx) ? 'y' : 'x';
    }

    const sensitivityX = 25; 
    const sensitivityY = 35; 

    if (Math.abs(totalDx) > 10 || Math.abs(totalDy) > 10) {
      this.isSwiping = true;
    }

    if (this.touchAxis !== 'y') {
      if (dx > sensitivityX) {
        this.movePiece(1);
        this.lastTouchX = currentX;
      } else if (dx < -sensitivityX) {
        this.movePiece(-1);
        this.lastTouchX = currentX;
      }
    }

    if (this.touchAxis === 'y' && dy > sensitivityY) {
      if (!this.collide(this.piece.x, this.piece.y + 1)) {
        this.piece.y++;
        this.score += 1;
        this.audio.play('move', .06);
        this.audio.update();
      }
      this.lastTouchY = currentY;
    }
  }

  handleTouchEnd(e) {
    if (!this.gestureActive || !this.isActive || this.isPaused || this.isGameOver) return;
    const touch = Array.from(e.changedTouches).find(t => t.identifier === this.touchId);
    if (!touch) return;
    this.gestureActive = false;
    e.preventDefault();
    
    const touchEndX = touch.clientX;
    const touchEndY = touch.clientY;
    const duration = Date.now() - this.touchStartTime;

    const totalDx = touchEndX - this.touchStartX;
    const totalDy = touchEndY - this.touchStartY;

    if (!this.isSwiping && duration < 300) {
      this.rotate();
    } else if (duration < 300) {
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
    this.audio.update();
    const deltaTime = Math.min(time - this.lastTime, 100); this.lastTime = time;
    this.dropCounter += deltaTime;
    if (this.dropCounter > this.dropInterval) this.drop();
    if (!this.isActive || this.isGameOver) return;
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

  }
}
