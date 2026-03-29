class BalloonFight extends GameScene {
    constructor() {
        super('風船ファイト');
        this.recordType = 'desc'; 
        this.scoreUnit = 'm';
        
        this.reqId = null;
        this.isActive = false;
        
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        
        this.handleBtnLeftDown = () => { this.keys.left = true; };
        this.handleBtnLeftUp = () => { this.keys.left = false; };
        this.handleBtnRightDown = () => { this.keys.right = true; };
        this.handleBtnRightUp = () => { this.keys.right = false; };

        this.art = {
            balloon: [
                [0,1,1,1,0],
                [1,2,1,1,1],
                [1,1,1,1,1],
                [1,1,1,1,1],
                [0,1,1,1,0],
                [0,0,1,0,0],
                [0,0,1,0,0]
            ],
            bird: [
                [2,0,0,0,2],
                [0,1,1,1,0],
                [0,0,1,0,0]
            ],
            airplane: [
                [0,0,2,0,0,0],
                [0,1,1,1,0,0],
                [1,1,1,1,1,1],
                [0,0,1,0,0,0]
            ],
            star: [
                [0,2,0],
                [2,1,2],
                [0,2,0]
            ]
        };
    }

    showTitle() {
        const html = `
            <div style="text-align:center; color:#fff; font-family:sans-serif;">
                <h2 style="font-size: 24px; margin-bottom: 10px;">${this.name}</h2>
                <p style="font-size: 14px; color: #aaa; margin-bottom: 20px;">画面の左右タップ、またはボタンで移動！</p>
                <button onclick="currentScene.startGame()" style="padding:12px 24px; font-size:16px; font-weight:bold; background:#ff4757; color:#fff; border:none; border-radius:8px; cursor:pointer; box-shadow: 0 4px 6px rgba(255,71,87,0.3);">ゲーム開始</button>
                <div style="margin-top: 20px;">
                    ${this.getRecordsHTML()}
                </div>
            </div>
        `;
        this.showUI(html);
    }

    updateMobileUI() {
        const dpad = document.getElementById('v-dpad');
        const action = document.getElementById('v-action');
        const numpad = document.getElementById('v-numpad');
        
        if (dpad) dpad.style.display = 'flex';
        if (action) action.style.display = 'none';
        if (numpad) numpad.style.display = 'none';

        canvas.style.maxHeight = '75vh'; 
        canvas.style.height = '75vh';
        canvas.style.width = 'auto';
        canvas.style.aspectRatio = '9 / 16';

        canvas.width = 450;
        canvas.height = 800;
    }

    startGame() {
        this.hideUI();
        this.removeListeners();

        this.isActive = true;
        this.altitude = 0;
        this.score = 0;
        
        this.balloon = {
            x: canvas.width / 2,
            y: canvas.height * 0.8,
            vx: 0,
            scale: 6,
            width: 30, 
            height: 42
        };

        this.keys = { left: false, right: false };
        this.obstacles = [];
        this.clouds = [];
        this.frameCount = 0;
        this.scrollSpeed = 1.5;

        for(let i=0; i<8; i++) {
            this.clouds.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 30 + 20,
                speed: Math.random() * 1 + 0.5
            });
        }

        this.addListeners();
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    }

    addListeners() {
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        canvas.addEventListener('touchstart', this.handleTouchStart, {passive: false});
        canvas.addEventListener('touchend', this.handleTouchEnd, {passive: false});

        const btnLeft = document.querySelector('[data-key="ArrowLeft"]');
        const btnRight = document.querySelector('[data-key="ArrowRight"]');
        if (btnLeft) {
            btnLeft.addEventListener('touchstart', this.handleBtnLeftDown, {passive: false});
            btnLeft.addEventListener('touchend', this.handleBtnLeftUp, {passive: false});
        }
        if (btnRight) {
            btnRight.addEventListener('touchstart', this.handleBtnRightDown, {passive: false});
            btnRight.addEventListener('touchend', this.handleBtnRightUp, {passive: false});
        }
    }

    removeListeners() {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        canvas.removeEventListener('touchstart', this.handleTouchStart);
        canvas.removeEventListener('touchend', this.handleTouchEnd);

        const btnLeft = document.querySelector('[data-key="ArrowLeft"]');
        const btnRight = document.querySelector('[data-key="ArrowRight"]');
        if (btnLeft) {
            btnLeft.removeEventListener('touchstart', this.handleBtnLeftDown);
            btnLeft.removeEventListener('touchend', this.handleBtnLeftUp);
        }
        if (btnRight) {
            btnRight.removeEventListener('touchstart', this.handleBtnRightDown);
            btnRight.removeEventListener('touchend', this.handleBtnRightUp);
        }
    }

    handleKeyDown(e) {
        if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = true;
    }

    handleKeyUp(e) {
        if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = false;
    }

    handleTouchStart(e) {
        e.preventDefault();
        const touchX = e.touches[0].clientX;
        const rect = canvas.getBoundingClientRect();
        const relativeX = touchX - rect.left;
        
        if (relativeX < rect.width / 2) {
            this.keys.left = true;
        } else {
            this.keys.right = true;
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        this.keys.left = false;
        this.keys.right = false;
    }

    loop(time) {
        if (!this.isActive) return;
        this.reqId = requestAnimationFrame(this.loop.bind(this));
        
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        this.update();
        this.draw();
    }

    update() {
        this.frameCount++;
        
        this.scrollSpeed = 1.5 + (this.altitude / 1000); 
        this.altitude += this.scrollSpeed / 15; 

        const accel = 0.3; 
        const friction = 0.97; 
        if (this.keys.left) this.balloon.vx -= accel;
        if (this.keys.right) this.balloon.vx += accel;
        
        this.balloon.vx *= friction;
        this.balloon.x += this.balloon.vx;

        if (this.balloon.x < this.balloon.width/2) {
            this.balloon.x = this.balloon.width/2;
            this.balloon.vx = 0;
        }
        if (this.balloon.x > canvas.width - this.balloon.width/2) {
            this.balloon.x = canvas.width - this.balloon.width/2;
            this.balloon.vx = 0;
        }

        let spawnRate = Math.max(20, 80 - Math.floor(this.altitude / 50));
        if (this.frameCount % spawnRate === 0) {
            this.spawnObstacle();
        }

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let obs = this.obstacles[i];
            obs.x += obs.vx;
            obs.y += obs.vy + this.scrollSpeed;

            const hitX = Math.abs(this.balloon.x - obs.x) < (this.balloon.width/2 + obs.width/2 - 4);
            const hitY = Math.abs(this.balloon.y - obs.y) < (this.balloon.height/2 + obs.height/2 - 4);
            if (hitX && hitY) {
                this.gameOver();
                return;
            }

            if (obs.y > canvas.height + 100 || obs.x < -100 || obs.x > canvas.width + 100) {
                this.obstacles.splice(i, 1);
            }
        }

        for (let cloud of this.clouds) {
            cloud.y += cloud.speed + (this.scrollSpeed * 0.5);
            if (cloud.y > canvas.height + 50) {
                cloud.y = -50;
                cloud.x = Math.random() * canvas.width;
            }
        }
    }

    spawnObstacle() {
        let type = 'bird';
        if (this.altitude > 300 && Math.random() > 0.4) type = 'airplane';
        if (this.altitude > 1000 && Math.random() > 0.7) type = 'star';
        if (this.altitude > 2000) {
            const r = Math.random();
            if (r < 0.2) type = 'bird';
            else if (r < 0.6) type = 'airplane';
            else type = 'star';
        }

        let obs = { type: type, y: -100 }; // 画面の少し上から出現させる

        if (type === 'bird') {
            obs.x = Math.random() * canvas.width;
            obs.vx = (Math.random() - 0.5) * 3; // 左右に少しフラフラさせる
            obs.vy = 2 + Math.random() * 2; // 上から下へ
            obs.scale = 4;
            obs.width = 20; obs.height = 12;
            obs.color1 = '#1e90ff'; obs.color2 = '#7bed9f';
        } else if (type === 'airplane') {
            obs.x = Math.random() * canvas.width;
            obs.vx = (Math.random() - 0.5) * 2;
            obs.vy = 4 + Math.random() * 3; // 鳥より速く下へ
            obs.scale = 9; // 更に大きく
            obs.width = 54; obs.height = 36;
            obs.color1 = '#a4b0be'; obs.color2 = '#dfe4ea';
        } else if (type === 'star') {
            obs.x = Math.random() * canvas.width;
            obs.vx = (Math.random() - 0.5) * 4;
            obs.vy = 8 + Math.random() * 5; // かなり速い
            obs.scale = 25; // 画面を圧迫する特大サイズ
            obs.width = 75; obs.height = 75;
            obs.color1 = '#eccc68'; obs.color2 = '#ffffff';
        }
        
        this.obstacles.push(obs);
    }

    drawPixelArt(x, y, artArray, scale, color1, color2) {
        const rows = artArray.length;
        const cols = artArray[0].length;
        const startX = x - (cols * scale) / 2;
        const startY = y - (rows * scale) / 2;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (artArray[r][c] !== 0) {
                    ctx.fillStyle = artArray[r][c] === 1 ? color1 : color2;
                    ctx.fillRect(startX + c * scale, startY + r * scale, scale, scale);
                }
            }
        }
    }

    draw() {
        ctx.fillStyle = '#1e1e2f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        for (let cloud of this.clouds) {
            ctx.beginPath();
            ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
            ctx.fill();
        }

        for (let obs of this.obstacles) {
            this.drawPixelArt(obs.x, obs.y, this.art[obs.type], obs.scale, obs.color1, obs.color2);
        }

        this.drawPixelArt(this.balloon.x, this.balloon.y, this.art.balloon, this.balloon.scale, '#ff4757', '#ffffff');

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${Math.floor(this.altitude)} m`, 20, 40);
    }

    gameOver() {
        this.stopGameLoop();
        this.score = Math.floor(this.altitude);
        this.saveRecord(this.score);
        this.showResult();
    }

    stopGameLoop() {
        this.isActive = false;
        if (this.reqId) cancelAnimationFrame(this.reqId);
    }

    showResult() {
        const html = `
            <div style="text-align:center; color:#fff; font-family:sans-serif;">
                <h2 style="font-size: 28px; color: #ff4757; margin-bottom: 10px;">GAME OVER</h2>
                <p style="font-size: 20px; margin-bottom: 30px;">到達高度: <span style="font-weight:bold; font-size:24px;">${this.score} m</span></p>
                <div>
                    <button onclick="currentScene.startGame()" style="margin:5px; padding:12px 24px; font-size:16px; font-weight:bold; background:#2ed573; color:#fff; border:none; border-radius:8px; cursor:pointer; box-shadow: 0 4px 6px rgba(46,213,115,0.3);">もう一度プレイ</button>
                    <button onclick="renderSidebar(); document.querySelector('.game-item.active')?.click();" style="margin:5px; padding:12px 24px; font-size:16px; font-weight:bold; background:#57606f; color:#fff; border:none; border-radius:8px; cursor:pointer;">タイトルへ</button>
                </div>
            </div>
        `;
        this.showUI(html);
    }
}