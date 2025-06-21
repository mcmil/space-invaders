// Space Invaders – enhanced version
// Features added:
// 1. Inertia-based smooth player movement
// 2. Dynamic enemy fleet movement that never reaches the player
// 3. Enemy shooting mechanic
// 4. Basic audio cues via WebAudio (no external files required)
// 5. Sprite graphics support – place PNGs in assets/ folder (fallback to rectangles)

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 600;

        /* ---------------- Player ---------------- */
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

        /* ---------------- Bullets ---------------- */
        this.playerBullets = [];
        this.enemyBullets = [];

        /* ---------------- Enemies ---------------- */
        this.enemies = [];
        this.enemyCols = 10;
        this.enemyRows = 5;
        this.enemySpacingX = 60;
        this.enemySpacingY = 50;
        this.enemyOffsetX = 80;
        this.enemyOffsetY = 60;
        this.enemyDirection = 1; // 1=right, -1=left
        this.enemySpeed = 1.5;
        this.enemyStepDown = 20;
        this.enemyShootCooldown = 1000; // ms
        this.lastEnemyShot = 0;

        /* ---------------- Game State ---------------- */
        this.score = 0;
        this.level = 1;
        this.gameOver = false;

        /* ---------------- Assets ---------------- */
        this.playerImg = new Image();
        this.playerImg.src = 'assets/player.png';
        this.enemyImg = new Image();
        this.enemyImg.src = 'assets/alien.png';

        /* ---------------- Init ---------------- */
        this.initEnemies();
        this.setupControls();
        requestAnimationFrame(() => this.loop());
    }

    /* ========== Utility Audio ========== */
    playSound(type) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return; // Browser unsupported
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        switch (type) {
            case 'playerShoot': osc.frequency.value = 550; break;
            case 'enemyShoot': osc.frequency.value = 330; break;
            case 'explosion': osc.frequency.value = 120; break;
        }
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.value = 0.15;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
        osc.stop(ctx.currentTime + 0.25);
    }

    /* ========== Controls ========== */
    setupControls() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.leftPressed = true;
            if (e.key === 'ArrowRight') this.rightPressed = true;
            if (e.key === ' ') this.shootPlayer();
        });
        window.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft') this.leftPressed = false;
            if (e.key === 'ArrowRight') this.rightPressed = false;
        });
    }

    /* ========== Entity Creation ========== */
    initEnemies() {
        this.enemies = [];
        for (let row = 0; row < this.enemyRows; row++) {
            for (let col = 0; col < this.enemyCols; col++) {
                this.enemies.push({
                    x: this.enemyOffsetX + col * this.enemySpacingX,
                    y: this.enemyOffsetY + row * this.enemySpacingY,
                    width: 40,
                    height: 40,
                    alive: true
                });
            }
        }
    }

    shootPlayer() {
        // Cooldown can be added later
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

    /* ========== Game Loop ========== */
    loop() {
        if (this.gameOver) return this.drawGameOver();
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    /* ========== Update ========== */
    update() {
        /* --- Player Physics --- */
        if (this.leftPressed) this.player.velX -= this.player.acc;
        if (this.rightPressed) this.player.velX += this.player.acc;
        // Apply friction
        this.player.velX *= this.player.friction;
        // Clamp velocity
        this.player.velX = Math.max(-this.player.maxSpeed, Math.min(this.player.maxSpeed, this.player.velX));
        // Update position
        this.player.x += this.player.velX;
        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, this.player.x));

        /* --- Player Bullets --- */
        this.playerBullets.forEach((b, i) => {
            b.y -= b.speed;
            if (b.y + b.height < 0) this.playerBullets.splice(i, 1);
        });

        /* --- Enemy Movement --- */
        let shouldReverse = false;
        this.enemies.forEach(enemy => {
            if (!enemy.alive) return;
            enemy.x += this.enemySpeed * this.enemyDirection;
            if (enemy.x <= 0 || enemy.x + enemy.width >= this.canvas.width) shouldReverse = true;
        });
        if (shouldReverse) {
            this.enemyDirection *= -1;
            // Move fleet down but cap descent so they never reach the player area (< canvas.height - 200)
            this.enemies.forEach(enemy => {
                enemy.y += this.enemyStepDown;
                if (enemy.y > this.canvas.height - 200) enemy.y = this.canvas.height - 200; // cap
            });
        }

        /* --- Enemy Shooting --- */
        this.enemyTryShoot();

        /* --- Enemy Bullets --- */
        this.enemyBullets.forEach((b, i) => {
            b.y += b.speed;
            if (b.y > this.canvas.height) this.enemyBullets.splice(i, 1);
        });

        /* --- Collisions --- */
        this.handleCollisions();

        /* --- Win/Lose --- */
        if (this.enemies.every(e => !e.alive)) {
            this.level++;
            this.enemySpeed += 0.5;
            this.initEnemies();
        }
        if (this.player.lives <= 0) {
            this.gameOver = true;
        }
    }

    /* ========== Collision Handling ========== */
    handleCollisions() {
        // Player bullets vs enemies
        this.playerBullets.forEach((b, bi) => {
            this.enemies.forEach(enemy => {
                if (!enemy.alive) return;
                if (b.x < enemy.x + enemy.width && b.x + b.width > enemy.x &&
                    b.y < enemy.y + enemy.height && b.y + b.height > enemy.y) {
                    enemy.alive = false;
                    this.playerBullets.splice(bi, 1);
                    this.score += 10;
                    this.playSound('explosion');
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

    /* ========== Draw ========== */
    draw() {
        // Clear
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw player
        if (this.playerImg.complete && this.playerImg.naturalWidth) {
            this.ctx.drawImage(this.playerImg, this.player.x, this.player.y, this.player.width, this.player.height);
        } else {
            this.ctx.fillStyle = '#00ff00';
            this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
        }

        // Draw player bullets
        this.ctx.fillStyle = '#ffffff';
        this.playerBullets.forEach(b => this.ctx.fillRect(b.x, b.y, b.width, b.height));

        // Draw enemies
        this.enemies.forEach(enemy => {
            if (!enemy.alive) return;
            if (this.enemyImg.complete && this.enemyImg.naturalWidth) {
                this.ctx.drawImage(this.enemyImg, enemy.x, enemy.y, enemy.width, enemy.height);
            } else {
                this.ctx.fillStyle = '#ff0000';
                this.ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            }
        });

        // Draw enemy bullets
        this.ctx.fillStyle = '#ffdd00';
        this.enemyBullets.forEach(b => this.ctx.fillRect(b.x, b.y, b.width, b.height));

        // HUD
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`Score: ${this.score}`, 10, 22);
        this.ctx.fillText(`Lives: ${this.player.lives}`, 10, 44);
        this.ctx.fillText(`Level: ${this.level}`, 10, 66);
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
    }
}

window.addEventListener('load', () => new Game());
