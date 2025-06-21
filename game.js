class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        this.player = {
            x: this.canvas.width / 2,
            y: this.canvas.height - 30,
            width: 50,
            height: 30,
            speed: 5,
            lives: 3
        };
        
        this.bullets = [];
        this.enemies = [];
        this.score = 0;
        this.gameOver = false;
        this.enemySpeed = 2;
        this.enemyDirection = 1;
        this.level = 1;
        
        this.initializeEnemies();
        this.setupControls();
        this.gameLoop();
    }

    initializeEnemies() {
        const rows = 5;
        const cols = 10;
        const enemyWidth = 40;
        const enemyHeight = 40;
        const padding = 10;
        
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                this.enemies.push({
                    x: j * (enemyWidth + padding) + 50,
                    y: i * (enemyHeight + padding) + 50,
                    width: enemyWidth,
                    height: enemyHeight,
                    alive: true
                });
            }
        }
    }

    setupControls() {
        document.addEventListener('keydown', (e) => {
            if (this.gameOver) return;
            
            switch(e.key) {
                case 'ArrowLeft':
                    this.player.x -= this.player.speed;
                    break;
                case 'ArrowRight':
                    this.player.x += this.player.speed;
                    break;
                case ' ':
                    this.shoot();
                    break;
            }
        });
    }

    shoot() {
        this.bullets.push({
            x: this.player.x + this.player.width / 2,
            y: this.player.y,
            width: 2,
            height: 10,
            speed: 5
        });
    }

    update() {
        // Update player position
        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, this.player.x));
        
        // Update bullets
        this.bullets.forEach((bullet, index) => {
            bullet.y -= bullet.speed;
            if (bullet.y < 0) {
                this.bullets.splice(index, 1);
            }
        });

        // Update enemies
        let moveDown = false;
        this.enemies.forEach((enemy, index) => {
            if (enemy.alive) {
                enemy.x += this.enemySpeed * this.enemyDirection;
                
                // Check if enemies hit the walls
                if (enemy.x < 0 || enemy.x > this.canvas.width - enemy.width) {
                    moveDown = true;
                }
            }
        });

        // Move enemies down and change direction
        if (moveDown) {
            this.enemies.forEach(enemy => {
                if (enemy.alive) {
                    enemy.y += enemy.height;
                }
            });
            this.enemyDirection *= -1;
        }

        // Check if enemies have reached the bottom
        this.enemies.forEach(enemy => {
            if (enemy.alive && enemy.y > this.canvas.height - 50) {
                this.gameOver = true;
            }
        });
        
        // Check collisions
        this.checkCollisions();
        
        // Check if game is over
        if (this.player.lives <= 0) {
            this.gameOver = true;
        }

        // Check if level is complete
        if (this.enemies.every(enemy => !enemy.alive)) {
            this.level++;
            this.enemySpeed += 0.5;
            this.initializeEnemies();
        }
    }

    checkCollisions() {
        this.bullets.forEach((bullet, bulletIndex) => {
            this.enemies.forEach((enemy, enemyIndex) => {
                if (enemy.alive && 
                    bullet.x > enemy.x && 
                    bullet.x < enemy.x + enemy.width && 
                    bullet.y > enemy.y && 
                    bullet.y < enemy.y + enemy.height) {
                    
                    enemy.alive = false;
                    this.bullets.splice(bulletIndex, 1);
                    this.score += 10 * (enemy.row + 1); // Higher points for higher rows
                }
            });
        });

        // Check if any enemy bullets hit the player
        this.enemies.forEach(enemy => {
            if (enemy.alive && 
                enemy.y + enemy.height > this.player.y &&
                enemy.x < this.player.x + this.player.width &&
                enemy.x + enemy.width > this.player.x) {
                this.player.lives--;
                enemy.alive = false;
            }
        });
    }

    draw() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw player
        this.ctx.fillStyle = '#00ff00';
        this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);

        // Draw bullets
        this.ctx.fillStyle = '#fff';
        this.bullets.forEach(bullet => {
            this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        });

        // Draw enemies
        this.ctx.fillStyle = '#ff0000';
        this.enemies.forEach(enemy => {
            if (enemy.alive) {
                this.ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            }
        });

        // Draw score, lives, and level
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`Score: ${this.score}`, 10, 20);
        this.ctx.fillText(`Lives: ${this.player.lives}`, 10, 40);
        this.ctx.fillText(`Level: ${this.level}`, 10, 60);
    }

    gameLoop() {
        if (!this.gameOver) {
            this.update();
            this.draw();
            requestAnimationFrame(() => this.gameLoop());
        }
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
});
