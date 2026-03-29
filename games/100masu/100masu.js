class HyakumasuGameScene extends GameScene {
  constructor() {
    super('百ます計算');
    this.recordType = 'asc'; // 追加（少ない方が上位）
    this.scoreUnit = '秒';   // 追加
    this.boardSize = 9; 
    this.cellSize = 45;
    this.reqId = null;
    this.keydownHandler = (e) => this.handleKeyDown(e);
    this.mousedownHandler = (e) => this.handleMouseDown(e);
  }

  showTitle() {
    this.showUI(`
      <h2>${this.name}</h2>
      <h3>操作方法</h3>
      <p>左上から順に足し算の答えを入力してね。<br>
      【数字キー】入力<br>
      【Enter】確定して次のマスへ<br>
      【矢印キー / マウスクリック】マスの移動・修正</p>
      <div class="btn-group">
        <button class="ui-btn btn-primary" onclick="currentScene.startGame()">ゲーム開始</button>
      </div>
      ${this.getRecordsHTML()}
    `);
  }

  // 配列をシャッフルする便利メソッド
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  startGame() {
    this.hideUI();
    canvas.width = 600; canvas.height = 550;
    
    // 縦横の数字を毎回ランダムに生成
    this.cols = this.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    this.rows = this.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    
    this.answers = Array(81).fill('');
    this.currentIndex = 0;
    this.currentInput = "";

    this.gameState = 'countdown';
    this.countdownStart = Date.now();
    this.startTime = 0;
    this.isActive = true;

    window.addEventListener('keydown', this.keydownHandler);
    canvas.addEventListener('mousedown', this.mousedownHandler);

    this.loop();
  }

  finishGame() {
    this.isActive = false;
    cancelAnimationFrame(this.reqId);
    window.removeEventListener('keydown', this.keydownHandler);
    canvas.removeEventListener('mousedown', this.mousedownHandler);

    const totalTime = Math.floor((Date.now() - this.startTime) / 1000);

    // 正誤判定
    let correct = 0;
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const idx = y * 9 + x;
        const expected = this.rows[y] + this.cols[x];
        if (parseInt(this.answers[idx], 10) === expected) {
          correct++;
        }
      }
    }

// ★全問正解の時だけ記録を保存する
    if (correct === 81) {
      this.saveRecord(totalTime);
    }

    this.showUI(`
      <h2>RESULT</h2>
      <div class="score-display">正解数: ${correct} / 81</div>
      <p>クリアタイム: ${totalTime}秒${correct === 81 ? ' (記録更新!)' : ' (全問正解で記録されます)'}</p>
      <div class="btn-group">
        <button class="ui-btn btn-primary" onclick="currentScene.startGame()">もう一度プレイ</button>
        <button class="ui-btn btn-secondary" onclick="currentScene.showTitle()">タイトルへ</button>
      </div>
    `);
  }

  moveIndex(dx, dy) {
    this.answers[this.currentIndex] = this.currentInput;
    let x = this.currentIndex % 9;
    let y = Math.floor(this.currentIndex / 9);
    x += dx; y += dy;
    if (x < 0) x = 0; if (x > 8) x = 8;
    if (y < 0) y = 0; if (y > 8) y = 8;
    this.currentIndex = y * 9 + x;
    this.currentInput = this.answers[this.currentIndex] || "";
  }

  handleKeyDown(e) {
    if (this.gameState !== 'playing') return;

    if (e.key >= '0' && e.key <= '9') {
      // 答えは最大でも18なので、2桁まで入力可能にする
      if (this.currentInput.length < 2) this.currentInput += e.key;
    } else if (e.key === 'Backspace') {
      this.currentInput = this.currentInput.slice(0, -1);
    } else if (e.key === 'Enter') {
      this.answers[this.currentIndex] = this.currentInput;
      this.currentIndex++;
      if (this.currentIndex >= 81) {
        this.finishGame();
      } else {
        this.currentInput = this.answers[this.currentIndex] || "";
      }
    } else if (e.key === 'ArrowRight') {
      this.moveIndex(1, 0);
    } else if (e.key === 'ArrowLeft') {
      this.moveIndex(-1, 0);
    } else if (e.key === 'ArrowDown') {
      this.moveIndex(0, 1);
    } else if (e.key === 'ArrowUp') {
      this.moveIndex(0, -1);
    }
  }

  handleMouseDown(e) {
    if (this.gameState !== 'playing') return;
    
    // Canvasの描画スケールに合わせてクリック座標を計算
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const startX = 75; const startY = 60; const size = this.cellSize;

    if (mx > startX + size && mx < startX + 10 * size &&
        my > startY + size && my < startY + 10 * size) {
      const x = Math.floor((mx - startX - size) / size);
      const y = Math.floor((my - startY - size) / size);
      
      this.answers[this.currentIndex] = this.currentInput;
      this.currentIndex = y * 9 + x;
      this.currentInput = this.answers[this.currentIndex] || "";
    }
  }

  loop() {
    if (!this.isActive) return;

    const now = Date.now();
    if (this.gameState === 'countdown') {
      const elapsed = now - this.countdownStart;
      if (elapsed > 3000) {
        this.gameState = 'playing';
        this.startTime = Date.now();
      }
    }

    this.draw();
    this.reqId = requestAnimationFrame(() => this.loop());
  }

  draw() {
    ctx.fillStyle = '#1e1e2f'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    const startX = 75; const startY = 60; const size = this.cellSize;

    // タイマー描画
    ctx.fillStyle = '#fff'; ctx.font = '20px Monospace'; ctx.textAlign = 'left';
    if (this.gameState === 'playing') {
      const t = Math.floor((Date.now() - this.startTime) / 1000);
      ctx.fillText(`TIME: ${t}秒`, 20, 30);
    }

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px Arial';

    // グリッド描画
    for (let y = 0; y <= 9; y++) {
      for (let x = 0; x <= 9; x++) {
        const px = startX + x * size;
        const py = startY + y * size;

        // 左上の記号マス
        if (x === 0 && y === 0) {
          ctx.fillStyle = '#ff4757'; ctx.fillRect(px, py, size, size);
          ctx.strokeStyle = '#222'; ctx.strokeRect(px, py, size, size);
          ctx.fillStyle = '#fff'; ctx.fillText('+', px + size/2, py + size/2);
          continue;
        }

        // 行・列のヘッダーマス
        if (y === 0) {
          ctx.fillStyle = '#555'; ctx.fillRect(px, py, size, size);
          ctx.strokeStyle = '#222'; ctx.strokeRect(px, py, size, size);
          ctx.fillStyle = '#fff'; ctx.fillText(this.cols[x-1], px + size/2, py + size/2);
          continue;
        }
        if (x === 0) {
          ctx.fillStyle = '#555'; ctx.fillRect(px, py, size, size);
          ctx.strokeStyle = '#222'; ctx.strokeRect(px, py, size, size);
          ctx.fillStyle = '#fff'; ctx.fillText(this.rows[y-1], px + size/2, py + size/2);
          continue;
        }

        // 入力マス
        const idx = (y - 1) * 9 + (x - 1);
        ctx.fillStyle = '#fff'; ctx.fillRect(px, py, size, size);
        ctx.strokeStyle = '#ccc'; ctx.strokeRect(px, py, size, size);

        // 選択中のマスのハイライト
        if (this.gameState === 'playing' && idx === this.currentIndex) {
          ctx.strokeStyle = '#ff4757';
          ctx.lineWidth = 3;
          ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
          ctx.lineWidth = 1;

          ctx.fillStyle = '#ff4757';
          ctx.fillText(this.currentInput + (Math.floor(Date.now() / 500) % 2 === 0 ? "_" : ""), px + size/2, py + size/2);
        } else {
          // 入力済みの文字を描画
          if (this.answers[idx] !== '') {
            ctx.fillStyle = '#111';
            ctx.fillText(this.answers[idx], px + size/2, py + size/2);
          }
        }
      }
    }

    // カウントダウンのオーバーレイ表示
    if (this.gameState === 'countdown') {
      const elapsed = Date.now() - this.countdownStart;
      const remain = Math.ceil((3000 - elapsed) / 1000);
      
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#ff4757';
      ctx.font = 'bold 80px Arial';
      ctx.fillText(remain > 0 ? remain : 'START!', canvas.width/2, canvas.height/2);
    }
  }
}