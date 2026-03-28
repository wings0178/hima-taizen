class TetrisGameScene extends GameScene {
  constructor() {
    super('シンプルテトリス');
    this.cols = 10; this.rows = 20; this.blockSize = 25;
    this.board = null; this.piece = null;
    this.dropCounter = 0; this.dropInterval = 1000; this.lastTime = 0;
    this.isActive = false; this.reqId = null;
    this.colors = [null, '#ff4757', '#2ed573', '#1e90ff', '#ffa502', '#ff6348', '#a4b0be', '#f1c40f'];
    this.keydownHandler = (e) => this.handleInput(e);
  }

  showTitle() {
    this.showUI(`
      <h2>${this.name}</h2>
      <h3>操作方法</h3>
      <p>【←/→】キー：左右移動<br>【↓】キー：落下加速<br>【↑】キー：回転<br>横一列を揃えて消していこう。</p>
      <div class="btn-group">
        <button class="ui-btn btn-primary" onclick="currentScene.startGame()">ゲーム開始</button>
      </div>
    `);
  }

  startGame() {
    this.hideUI();
    canvas.width = this.cols * this.blockSize; canvas.height = this.rows * this.blockSize;
    this.board = Array.from({length: this.rows}, () => Array(this.cols).fill(0));
    this.score = 0; this.dropInterval = 1000;
    this.isActive = true;
    this.spawnPiece();
    window.addEventListener('keydown', this.keydownHandler);
    this.reqId = requestAnimationFrame((t) => this.loop(t));
  }

  showResult() {
    this.showUI(`
      <h2>GAME OVER</h2>
      <div class="score-display">${this.score} pt</div>
      <div class="btn-group">
        <button class="ui-btn btn-primary" onclick="currentScene.startGame()">もう一度プレイ</button>
        <button class="ui-btn btn-secondary" onclick="currentScene.showTitle()">タイトルへ</button>
      </div>
    `);
  }

  stopGameLoop() { this.isActive = false; cancelAnimationFrame(this.reqId); }
  removeListeners() { window.removeEventListener('keydown', this.keydownHandler); }

  spawnPiece() {
    const pieces = [
      [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
      [[2,2],[2,2]],
      [[0,3,0],[3,3,3],[0,0,0]],
      [[0,0,4],[4,4,4],[0,0,0]],
      [[5,0,0],[5,5,5],[0,0,0]],
      [[0,6,6],[6,6,0],[0,0,0]],
      [[7,7,0],[0,7,7],[0,0,0]]
    ];
    const shape = pieces[Math.floor(Math.random() * pieces.length)];
    this.piece = { matrix: shape, x: Math.floor(this.cols/2) - Math.floor(shape[0].length/2), y: 0 };
    if (this.collide()) { this.stopGameLoop(); this.showResult(); }
  }

  collide(newX, newY, newMatrix) {
    const m = newMatrix || this.piece.matrix;
    const px = newX === undefined ? this.piece.x : newX;
    const py = newY === undefined ? this.piece.y : newY;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (m[y][x] !== 0) {
          let bx = px + x; let by = py + y;
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
      this.piece.x += offsets[i];
      if(!this.collide(undefined, undefined, newMatrix)) {
        this.piece.matrix = newMatrix; return;
      }
      this.piece.x = oldX; 
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
    this.piece.y++;
    if (this.collide()) {
      this.piece.y--; this.merge(); this.sweep(); this.spawnPiece();
    }
    this.dropCounter = 0;
  }

  handleInput(e) {
    if(!this.isActive) return;
    if(e.code === 'ArrowLeft') { this.piece.x--; if (this.collide()) this.piece.x++; }
    else if (e.code === 'ArrowRight') { this.piece.x++; if (this.collide()) this.piece.x--; }
    else if (e.code === 'ArrowDown') { this.drop(); }
    else if (e.code === 'ArrowUp') { this.rotate(); }
  }

  loop(time = 0) {
    if (!this.isActive) return;
    const deltaTime = time - this.lastTime; this.lastTime = time;
    this.dropCounter += deltaTime;
    if (this.dropCounter > this.dropInterval) this.drop();
    this.draw();
    this.reqId = requestAnimationFrame((t) => this.loop(t));
  }

  draw() {
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const drawMatrix = (matrix, offset, isPiece) => {
      matrix.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            ctx.fillStyle = this.colors[value];
            ctx.fillRect((x + offset.x) * this.blockSize, (y + offset.y) * this.blockSize, this.blockSize - 1, this.blockSize - 1);
            if(isPiece) {
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.fillRect((x + offset.x) * this.blockSize + 2, (y + offset.y) * this.blockSize + 2, this.blockSize - 5, 4);
            }
          }
        });
      });
    };
    drawMatrix(this.board, {x:0, y:0}, false);
    drawMatrix(this.piece.matrix, {x: this.piece.x, y: this.piece.y}, true);
  }
}