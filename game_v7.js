// Menel Invaders – v7
// • Crack overlay improved (random Y, margin) – covers whole sprite without touching edges
// • Multi-level system with city themes & high-scores per level
//     – Level selection on start screen (←/→ cycle)
//     – Each level defines rows, cols, speed multiplier & background photo
//     – Victory cycles to next level
//     – High scores saved in localStorage (menelHS_<levelName>)

class MenelInvaders {
  constructor() {
    /* Canvas setup */
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = 800; this.canvas.height = 600;
    this.hudHeight = 60;

    /* Levels */
    this.levels = [
      { name: 'Warsaw', rows: 5, cols: 10, speed: 1.0, photo: 'assets/warsaw.jpg' },
      { name: 'Krakow', rows: 6, cols: 12, speed: 1.2, photo: 'assets/krakow.jpg' },
      { name: 'Gdansk', rows: 4, cols: 8,  speed: 0.9, photo: 'assets/gdansk.jpg' }
    ];
    this.selectedLevel = 0; // for menu
    this.currentLevel = 0;  // during play

    /* Background photo */
    this.bgImg = new Image();

    /* Audio */
    this.audioCtx = null;

    /* Game state */
    this.state = 'start';
    this.score = 0;

    /* Player */
    this.player = { x: 0, y: 0, width: 60, height: 60, velX: 0, acc: 0.6, friction: 0.88, maxSpeed: 8, lives: 3, maxLives: 3 };

    /* Assets */
    this.playerImg = new Image(); this.playerImg.src = 'assets/player.png';
    this.alienTypes = [
      { img: 'assets/alien1.png', hp: 1, score: 10 },
      { img: 'assets/alien2.png', hp: 2, score: 25 },
      { img: 'assets/alien3.png', hp: 3, score: 50 }
    ];
    this.alienTypes.forEach(t => { const i = new Image(); i.src = t.img; t.imageObj = i; });
    this.crackImgs = [1,2,3].map(n=>{const i=new Image(); i.src=`assets/crack${n}.png`; return i;});

    /* Stars */
    this.stars = []; this.initStars(120);

    /* Collections */
    this.enemies = []; this.playerBullets = []; this.enemyBullets = [];

    /* Controls */
    this.leftPressed = false; this.rightPressed = false;
    this.setupControls();

    /* Load initial level */
    this.loadLevel(0);
    requestAnimationFrame(ts=>this.loop(ts));
  }

  /* ------------- Level handling ------------- */
  loadLevel(index) {
    this.currentLevel = index;
    const cfg = this.levels[index];
    this.enemyRows = cfg.rows;
    this.enemyCols = cfg.cols;
    this.enemySpeedBase = cfg.speed;
    this.enemySpeed = 1.5 * cfg.speed;
    this.enemyDirection = 1;
    this.enemyVerticalDir = 1;
    this.enemyVerticalSpeed = 0.3;
    this.enemySpacingX = 60;
    this.enemySpacingY = 50;
    this.enemyOffsetX = 80;
    this.enemyOffsetY = this.hudHeight + 20;
    this.enemyBottomLimit = this.canvas.height - 150;
    this.lastEnemyShot = 0;
    this.enemyShootCooldown = 1000;
    // background
    this.bgImg.src = cfg.photo;
    // player pos
    this.player.x = this.canvas.width/2 - this.player.width/2;
    this.player.y = this.canvas.height - 80;
    // init enemies
    this.initEnemies();
  }

  nextLevel() {
    const next = (this.currentLevel + 1) % this.levels.length;
    this.loadLevel(next);
  }

  /* ------------- Stars ------------- */
  initStars(n){for(let i=0;i<n;i++){this.stars.push({x:Math.random()*this.canvas.width,y:Math.random()*this.canvas.height,speed:0.3+Math.random()*0.7});}}
  updateStars(){this.stars.forEach(s=>{s.y+=s.speed; if(s.y>this.canvas.height){s.y=0; s.x=Math.random()*this.canvas.width;} });}
  drawStars(){this.ctx.fillStyle='#fff'; this.stars.forEach(s=>this.ctx.fillRect(s.x,s.y,2,2));}

  /* ------------- Controls ------------- */
  setupControls(){
    window.addEventListener('keydown',e=>{
      const key=e.key;
      if(['ArrowLeft','a','A'].includes(key)) this.leftPressed=true;
      if(['ArrowRight','d','D'].includes(key)) this.rightPressed=true;
      if(key===' '){
        if(this.state==='start'){ this.loadLevel(this.selectedLevel); this.state='playing'; }
        else if(this.state==='playing') this.shootPlayer();
        else if(this.state==='gameover'){ this.state='start'; this.score=0; this.player.lives=this.player.maxLives; }
      }
      if(this.state==='start'){
        if(key==='ArrowLeft') this.selectedLevel=(this.selectedLevel-1+this.levels.length)%this.levels.length;
        if(key==='ArrowRight') this.selectedLevel=(this.selectedLevel+1)%this.levels.length;
      }
      this.ensureAudioCtx();
    });
    window.addEventListener('keyup',e=>{ const key=e.key; if(['ArrowLeft','a','A'].includes(key)) this.leftPressed=false; if(['ArrowRight','d','D'].includes(key)) this.rightPressed=false; });
  }

  /* ------------- Audio ------------- */
  ensureAudioCtx(){if(!window.AudioContext&&!window.webkitAudioContext)return; if(!this.audioCtx) this.audioCtx=new(window.AudioContext||window.webkitAudioContext)(); if(this.audioCtx.state==='suspended') this.audioCtx.resume();}
  playSound(t){ if(!this.audioCtx) return; const ctx=this.audioCtx; const o=ctx.createOscillator(); const g=ctx.createGain(); o.type='square'; o.frequency.value={playerShoot:550,enemyShoot:330,explosion:120}[t]||440; g.gain.value=0.15; o.connect(g); g.connect(ctx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.25); o.stop(ctx.currentTime+0.25); }

  /* ------------- Enemies ------------- */
  initEnemies(){
    this.enemies=[];
    for(let row=0; row<this.enemyRows; row++){
      for(let col=0; col<this.enemyCols; col++){
        const rev=this.enemyRows-1-row;
        const typeIndex=Math.min(this.alienTypes.length-1, Math.floor(rev/2));
        const t=this.alienTypes[typeIndex];
        this.enemies.push({x:this.enemyOffsetX+col*this.enemySpacingX,y:this.enemyOffsetY+row*this.enemySpacingY,width:40,height:40,alive:true,hp:t.hp,maxHp:t.hp,type:typeIndex,oscPhase:Math.random()*Math.PI*2});
      }
    }
  }

  /* ------------- Shooting ------------- */
  shootPlayer(){this.playerBullets.push({x:this.player.x+this.player.width/2-2,y:this.player.y,width:4,height:12,speed:9}); this.playSound('playerShoot'); }
  enemyTryShoot(){ const now=performance.now(); if(now-this.lastEnemyShot<1000) return; const shooters=this.enemies.filter(e=>e.alive); if(!shooters.length) return; const s=shooters[Math.floor(Math.random()*shooters.length)]; this.enemyBullets.push({x:s.x+s.width/2-2,y:s.y+s.height,width:4,height:12,speed:5}); this.playSound('enemyShoot'); this.lastEnemyShot=now; }

  /* ------------- Crack drawing ------------- */
  drawCracks(x,y,w,h,severity){ const margin=4; severity=Math.min(severity,3); const useImg=this.crackImgs[0].complete&&this.crackImgs[0].naturalWidth; if(useImg){ for(let i=0;i<severity;i++) this.ctx.drawImage(this.crackImgs[i],x+margin,y+margin,w-2*margin,h-2*margin); } else { this.ctx.strokeStyle='rgba(255,255,255,0.4)'; this.ctx.lineWidth=2; for(let i=0;i<severity;i++){ this.drawZigZagCrack(x+margin,y+margin,w-2*margin,h-2*margin); } } }
  drawZigZagCrack(x,y,w,h){ const segments=6; const stepX=w/segments; let curX=x; let curY=y + Math.random()*h; this.ctx.beginPath(); this.ctx.moveTo(curX,curY); for(let i=0;i<segments;i++){ curX+=stepX; curY+= (Math.random()-0.5)*h*0.5; curY=Math.max(y,Math.min(y+h,curY)); this.ctx.lineTo(curX,curY);} this.ctx.stroke(); }

  /* ------------- Game loop ------------- */
  loop(ts){ if(this.state==='playing'){ this.update(); this.draw(ts);} else if(this.state==='start'){ this.drawStart();} else { this.drawGameOver();} requestAnimationFrame(n=>this.loop(n)); }

  /* ------------- Update ------------- */
  update(){ this.updateStars();
    if(this.leftPressed) this.player.velX-=this.player.acc;
    if(this.rightPressed) this.player.velX+=this.player.acc;
    this.player.velX*=this.player.friction; this.player.velX=Math.max(-this.player.maxSpeed, Math.min(this.player.maxSpeed,this.player.velX));
    this.player.x+=this.player.velX; this.player.x=Math.max(0, Math.min(this.canvas.width-this.player.width, this.player.x));
    // bullets
    this.playerBullets.forEach((b,i)=>{b.y-=b.speed; if(b.y<0) this.playerBullets.splice(i,1);});
    this.enemyBullets.forEach((b,i)=>{b.y+=b.speed; if(b.y>this.canvas.height) this.enemyBullets.splice(i,1);});
    // enemy move
    let reverse=false; this.enemies.forEach(e=>{if(!e.alive) return; e.x+=this.enemySpeed*this.enemyDirection; if(e.x<=0||e.x+e.width>=this.canvas.width) reverse=true;}); if(reverse) this.enemyDirection*=-1;
    // vertical bounce
    this.enemies.forEach(e=>{if(e.alive) e.y+=this.enemyVerticalSpeed*this.enemyVerticalDir;});
    const ys=this.enemies.filter(e=>e.alive).map(e=>e.y); if(ys.length){ const minY=Math.min(...ys), maxY=Math.max(...ys); if(maxY>=this.enemyBottomLimit) this.enemyVerticalDir=-1; else if(minY<=this.enemyOffsetY) this.enemyVerticalDir=1; }
    this.enemyTryShoot();
    this.handleCollisions();
    if(this.enemies.every(e=>!e.alive)){ this.saveHighScore(); this.nextLevel(); }
    if(this.player.lives<=0){ this.saveHighScore(); this.state='gameover'; this.playSound('explosion'); }
  }

  saveHighScore(){ const lvlName=this.levels[this.currentLevel].name; const key='menelHS_'+lvlName; const prev=parseInt(localStorage.getItem(key)||'0'); if(this.score>prev) localStorage.setItem(key,this.score); }
  getHighScore(idx){ const key='menelHS_'+this.levels[idx].name; return localStorage.getItem(key)||0; }

  /* ------------- Collisions ------------- */
  handleCollisions(){ this.playerBullets.forEach((b,bi)=>{ this.enemies.forEach(e=>{ if(!e.alive) return; if(b.x<e.x+e.width && b.x+b.width>e.x && b.y<e.y+e.height && b.y+b.height>e.y){ e.hp--; this.playerBullets.splice(bi,1); if(e.hp<=0){ e.alive=false; this.score+=this.alienTypes[e.type].score; this.playSound('explosion'); } } }); }); this.enemyBullets.forEach((b,bi)=>{ if(b.x<this.player.x+this.player.width && b.x+b.width>this.player.x && b.y<this.player.y+this.player.height && b.y+b.height>this.player.y){ this.enemyBullets.splice(bi,1); this.player.lives--; this.playSound('explosion'); } }); }

  /* ------------- Draw ------------- */
  drawBackground(){ if(this.bgImg.complete&&this.bgImg.naturalWidth){ this.ctx.drawImage(this.bgImg,0,this.hudHeight,this.canvas.width,this.canvas.height-this.hudHeight); } }

  draw(ts){ this.ctx.fillStyle='#000'; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
    this.drawBackground(); this.drawStars();
    // player
    if(this.playerImg.complete&&this.playerImg.naturalWidth) this.ctx.drawImage(this.playerImg,this.player.x,this.player.y,this.player.width,this.player.height); else {this.ctx.fillStyle='#0f0'; this.ctx.fillRect(this.player.x,this.player.y,this.player.width,this.player.height);} if(this.player.lives<this.player.maxLives) this.drawCracks(this.player.x,this.player.y,this.player.width,this.player.height,this.player.maxLives-this.player.lives);
    // bullets
    this.ctx.fillStyle='#fff'; this.playerBullets.forEach(b=>this.ctx.fillRect(b.x,b.y,b.width,b.height)); this.ctx.fillStyle='#ffdd00'; this.enemyBullets.forEach(b=>this.ctx.fillRect(b.x,b.y,b.width,b.height));
    // enemies
    const time=ts||performance.now(); this.enemies.forEach(e=>{ if(!e.alive) return; const yRender=e.y+Math.sin(time/300+e.oscPhase)*3; const info=this.alienTypes[e.type]; const img=info.imageObj; if(img.complete&&img.naturalWidth){ const ratio=img.naturalWidth/img.naturalHeight; let dw=e.width, dh=e.height; if(ratio>1) dh=dw/ratio; else dw=dh*ratio; this.ctx.drawImage(img,e.x+(e.width-dw)/2,yRender+(e.height-dh)/2,dw,dh);} else { this.ctx.fillStyle=['#ff6666','#ff3333','#cc0000'][e.type]||'#f00'; this.ctx.fillRect(e.x,yRender,e.width,e.height);} if(e.hp<e.maxHp) this.drawCracks(e.x,yRender,e.width,e.height,e.maxHp-e.hp); });
    this.drawHud(); }

  drawHud(){ const cfg=this.levels[this.currentLevel]; const hudY=0; this.ctx.fillStyle='#d48b07'; this.ctx.fillRect(0,hudY,this.canvas.width,this.hudHeight); this.ctx.fillStyle='#fff'; this.ctx.fillRect(0,hudY,this.canvas.width,10);
    this.ctx.fillStyle='#fff'; this.ctx.font='18px "Comic Sans MS",Arial'; this.ctx.fillText('🍺 '+cfg.name+'  Score:'+this.score,10,hudY+30); this.ctx.fillText('Lives:'+this.player.lives+'  Lvl:'+this.currentLevel+1,10,hudY+50); const hs=this.getHighScore(this.currentLevel); this.ctx.fillText('HS:'+hs,this.canvas.width-120,hudY+50); }

  drawStart(){ this.ctx.fillStyle='#000'; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); this.drawBackground(); this.drawStars(); this.drawHud();
    const cfg=this.levels[this.selectedLevel]; if(cfg.photo){ const img=new Image(); img.src=cfg.photo; if(img.complete&&img.naturalWidth) this.ctx.drawImage(img,0,this.hudHeight,this.canvas.width,this.canvas.height-this.hudHeight);} this.ctx.fillStyle='#fff'; this.ctx.font='48px Arial'; this.ctx.textAlign='center'; this.ctx.fillText('MENEL INVADERS',this.canvas.width/2,this.canvas.height/2-80); this.ctx.font='24px Arial'; this.ctx.fillText('Choose City (←/→)  -  '+cfg.name,this.canvas.width/2,this.canvas.height/2-20); this.ctx.fillText('Highscore: '+this.getHighScore(this.selectedLevel),this.canvas.width/2,this.canvas.height/2+10); this.ctx.fillText('Press SPACE to Start',this.canvas.width/2,this.canvas.height/2+50); this.ctx.textAlign='left'; }

  drawGameOver(){ this.ctx.fillStyle='#000'; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); this.drawBackground(); this.drawStars(); this.drawHud(); this.ctx.fillStyle='#fff'; this.ctx.font='48px Arial'; this.ctx.textAlign='center'; this.ctx.fillText('GAME OVER',this.canvas.width/2,this.canvas.height/2-20); this.ctx.font='24px Arial'; this.ctx.fillText('Press SPACE to Menu',this.canvas.width/2,this.canvas.height/2+20); this.ctx.textAlign='left'; }
}

window.addEventListener('load',()=>new MenelInvaders());
