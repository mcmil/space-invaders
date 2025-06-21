// Menel Invaders – enhanced version v3
//  • Fixes audio cut-out by using a single reusable AudioContext
//  • Adds start screen (game state handling)
//  • Adds alien oscillation animation
//  • Supports multiple alien types with different hit-points and sprites (alien1.png, alien2.png, ...)
//  • Keeps earlier improvements: physics player, enemy shooting, etc.

class MenelInvaders {
    constructor() {
        /* ========== Canvas & Context ========== */
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 600;

        /* ========== Audio ========== */
        this.audioCtx = null; // lazily created on first user interaction

        /* ========== Game State ========== */
        this.state = 'start'; // start | playing | gameover
        this.score = 0;
        this.level = 1;

        /* ========== Player ========== */
        this.player = {
            x: this.canvas.width / 2 - 30,
            y: this.canvas.height - 80,
            width: 60,
            height: 60,
            velX: 0,
            acc: 0.6,
            friction: 0.88,
            maxSpeed: 8,
            lives: 3
        };
        this.leftPressed = false;
        this.rightPressed = false;

        /* ========== Bullets ========== */
        this.playerBullets = [];
        this.enemyBullets = [];

        /* ========== Alien Types ========== */
        this.alienTypes = [
            { img: 'assets/alien1.png', hp: 1, score: 10 },
            { img: 'assets/alien2.png', hp: 2, score: 25 },
            { img: 'assets/alien3.png', hp: 3, score: 50 }
        ];
        // Preload images (with fallback)
        this.alienTypes.forEach(t => {
            const i = new Image();
            i.src = t.img;
            t.imageObj = i;
        });
        this.playerImg = new Image();
        this.playerImg.src = 'assets/player.png';

        /* ========== Enemies Setup Values ========== */
        this.enemies = [];
        this.enemyCols = 10;
        this.enemyRows = 5;
        this.enemySpacingX = 60;
        this.enemySpacingY = 50;
        this.enemyOffsetX = 80;
        this.enemyOffsetY = 60;
        this.enemyDirection = 1;
        this.enemySpeed = 1.5;
        this.enemyStepDown = 20;
        this.enemyShootCooldown = 1000; // ms
        this.lastEnemyShot = 0;

        /* ========== Init & Loop ========== */
        this.initEnemies();
        this.setupControls();
        requestAnimationFrame((ts) => this.loop(ts));
    }

    /* ---------------- Utils ---------------- */
    ensureAudioCtx() {
        if (!window.AudioContext && !window.webkitAudioContext) return; // unsupported
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    }

    playSound(type) {
        if (!this.audioCtx) return; // call ensureAudioCtx first
        const ctx = this.audioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        switch (type) {
            case 'playerShoot': osc.frequency.value = 550; break;
            case 'enemyShoot': osc.frequency.value = 330; break;
            case 'explosion': osc.frequency.value = 120; break;
        }
        gain.gain.value = 0.15;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
        osc.stop(ctx.currentTime + 0.25);
    }

    /* ---------------- Controls ---------------- */
    setupControls() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.leftPressed = true;
            if (e.key === 'ArrowRight') this.rightPressed = true;
            if (e.key === ' ') {
                if (this.state === 'start') {
                    this.startGame();
                } else if (this.state === 'playing') {
                    this.shootPlayer();
                } else if (this.state === 'gameover') {
                    this.resetGame();
                }
            }
            this.ensureAudioCtx(); // first user gesture creates/resumes audio
        });
        window.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft') this.leftPressed = false;
            if (e.key === 'ArrowRight') this.rightPressed = false;
        });
    }

    startGame() {
        this.state = 'playing';
    }

    resetGame() {
        this.score = 0;
        this.level = 1;
        this.player.lives = 3;
        this.enemySpeed = 1.5;
        this.enemyDirection = 1;
        this.initEnemies();
        this.state = 'start';
    }

    /* ---------------- Enemies ---------------- */
    initEnemies() {
        this.enemies = [];
        for (let row = 0; row < this.enemyRows; row++) {
            for (let col = 0; col < this.enemyCols; col++) {
                const typeIndex = Math.min(this.alienTypes.length - 1, Math.floor(row / 2));
                const t = this.alienTypes[typeIndex];
                this.enemies.push({
                    x: this.enemyOffsetX + col * this.enemySpacingX,
                    y: this.enemyOffsetY + row * this.enemySpacingY,
                    width: 40,
                    height: 40,
                    alive: true,
                    hp: t.hp,
                    type: typeIndex,
                    oscPhase: Math.random() * Math.PI * 2
                });
            }
        }
    }

    /* ---------------- Shooting ---------------- */
    shootPlayer() {
        this.playerBullets.push({
            x: this.player.x + this.player.width / 2 - 2,
            y: this.player.y,
            width: 4,
            height: 12,
            speed: 9
        });
        this.playSound('playerShoot');
    }

    enemyTryShoot() {
        const now = performance.now();
        if (now - this.lastEnemyShot < this.enemyShootCooldown) return;
        const shooters = this.enemies.filter(e => e.alive);
        if (!shooters.length) return;
        const shooter = shooters[Math.floor(Math.random() * shooters.length)];
        this.enemyBullets.push({
            x: shooter.x + shooter.width / 2 - 2,
            y: shooter.y + shooter.height,
            width: 4,
            height: 12,
            speed: 5
        });
        this.playSound('enemyShoot');
        this.lastEnemyShot = now;
    }

    /* ---------------- Main Loop ---------------- */
    loop(timestamp) {
        if (this.state === 'playing') {
            this.update();
            this.draw(timestamp);
        } else if (this.state === 'start') {
            this.drawStartScreen();
        } else if (this.state === 'gameover') {
            this.drawGameOver();
        }
        requestAnimationFrame((ts) => this.loop(ts));
    }

    /* ---------------- Update ---------------- */
    update() {
        /* Player physics */
        if (this.leftPressed) this.player.velX -= this.player.acc;
        if (this.rightPressed) this.player.velX += this.player.acc;
        this.player.velX *= this.player.friction;
        this.player.velX = Math.max(-this.player.maxSpeed, Math.min(this.player.maxSpeed, this.player.velX));
        this.player.x += this.player.velX;
        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, this.player.x));

        /* Player bullets */
        this.playerBullets.forEach((b, i) => {
            b.y -= b.speed;
            if (b.y + b.height < 0) this.playerBullets.splice(i, 1);
        });

        /* Enemy fleet movement */
        let shouldReverse = false;
        this.enemies.forEach(enemy => {
            if (!enemy.alive) return;
            enemy.x += this.enemySpeed * this.enemyDirection;
            if (enemy.x <= 0 || enemy.x + enemy.width >= this.canvas.width) shouldReverse = true;
        });
        if (shouldReverse) {
            this.enemyDirection *= -1;
            this.enemies.forEach(enemy => {
                enemy.y += this.enemyStepDown;
                if (enemy.y > this.canvas.height - 200) enemy.y = this.canvas.height - 200;
            });
        }

        /* Enemy shooting */
        this.enemyTryShoot();

        /* Enemy bullets */
        this.enemyBullets.forEach((b, i) => {
            b.y += b.speed;
            if (b.y > this.canvas.height) this.enemyBullets.splice(i, 1);
        });

        /* Collisions */
        this.handleCollisions();

        /* Win/Lose */
        if (this.enemies.every(e => !e.alive)) {
            this.level++;
            this.enemySpeed += 0.5;
            this.initEnemies();
        }
        if (this.player.lives <= 0) {
            this.state = 'gameover';
            this.playSound('explosion');
        }
    }

    /* ---------------- Collisions ---------------- */
    handleCollisions() {
        // Player bullets vs enemies
        this.playerBullets.forEach((b, bi) => {
            this.enemies.forEach(enemy => {
                if (!enemy.alive) return;
                if (b.x < enemy.x + enemy.width && b.x + b.width > enemy.x &&
                    b.y < enemy.y + enemy.height && b.y + b.height > enemy.y) {
                    enemy.hp -= 1;
                    this.playerBullets.splice(bi, 1);
                    if (enemy.hp <= 0) {
                        enemy.alive = false;
                        const alienInfo = this.alienTypes[enemy.type];
                        this.score += alienInfo.score;
                        this.playSound('explosion');
                    }
                }
            });
        });

        // Enemy bullets vs player
        this.enemyBullets.forEach((b, bi) => {
            if (b.x < this.player.x + this.player.width && b.x + b.width > this.player.x &&
                b.y < this.player.y + this.player.height && b.y + b.height > this.player.y) {
                this.enemyBullets.splice(bi, 1);
                this.player.lives -= 1;
                this.playSound('explosion');
            }
        });
    }

    /* ---------------- Draw ---------------- */
    draw(timestamp) {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Player
        if (this.playerImg.complete && this.playerImg.naturalWidth) {
            this.ctx.drawImage(this.playerImg, this.player.x, this.player.y, this.player.width, this.player.height);
        } else {
            this.ctx.fillStyle = '#00ff00';
            this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
        }

        // Player bullets
        this.ctx.fillStyle = '#ffffff';
        this.playerBullets.forEach(b => this.ctx.fillRect(b.x, b.y, b.width, b.height));

        // Enemy bullets
        this.ctx.fillStyle = '#ffdd00';
        this.enemyBullets.forEach(b => this.ctx.fillRect(b.x, b.y, b.width, b.height));

        // Enemies with oscillation
        const time = timestamp || performance.now();
        this.enemies.forEach(enemy => {
            if (!enemy.alive) return;
            const renderY = enemy.y + Math.sin(time / 300 + enemy.oscPhase) * 3; // 3px oscillation
            const alienInfo = this.alienTypes[enemy.type];
            const imgObj = alienInfo.imageObj;
            if (imgObj.complete && imgObj.naturalWidth) {
                this.ctx.drawImage(imgObj, enemy.x, renderY, enemy.width, enemy.height);
            } else {
                this.ctx.fillStyle = ['#ff6666', '#ff3333', '#cc0000'][enemy.type] || '#ff0000';
                this.ctx.fillRect(enemy.x, renderY, enemy.width, enemy.height);
            }
        });

        // HUD
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`Score: ${this.score}`, 10, 22);
        this.ctx.fillText(`Lives: ${this.player.lives}`, 10, 44);
        this.ctx.fillText(`Level: ${this.level}`, 10, 66);
    }

    drawStartScreen() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '64px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('MENEL INVADERS', this.canvas.width / 2, this.canvas.height / 2 - 40);
        this.ctx.font = '24px Arial';
        this.ctx.fillText('Press SPACE to Start', this.canvas.width / 2, this.canvas.height / 2 + 20);
        this.ctx.textAlign = 'left';
    }

    drawGameOver() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 20);
        this.ctx.font = '24px Arial';
        this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 20);
        this.ctx.fillText('Press SPACE to Restart', this.canvas.width / 2, this.canvas.height / 2 + 60);
        this.ctx.textAlign = 'left';
    }
}

window.addEventListener('load', () => new MenelInvaders());
