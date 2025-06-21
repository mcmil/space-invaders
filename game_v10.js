// Menel Invaders – v10
// • HUD miniature centered
// • Always use animated starfield background (no full-screen city photo)
// • Starfield now has parallax: each star drifts slightly sideways as it falls
// • ESC key, city patterns, cracks, etc. retained from v9

class MenelInvaders {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = 800;
    this.canvas.height = 600;
    this.hudHeight = 60;

    /* City data */
    this.levels = [
      { name: 'Spindlerowy Mlyn', pattern: 'grid', rows: 5, cols: 10, speed: 1.0, photo: 'assets/spindlerowy.jpg' },
      { name: 'Utrecht',            pattern: 'triangle', rows: 7, cols: 13, speed: 1.15, photo: 'assets/utrecht.jpg' },
      { name: 'Wroclaw',            pattern: 'circle', rows: 9, cols: 9, speed: 1.25, photo: 'assets/wroclaw.jpg' },
      { name: 'Torun',              pattern: 'box', rows: 6, cols: 12, speed: 1.1,  photo: 'assets/torun.jpg' }
    ];
    this.levels.forEach(l=>{const img=new Image(); img.src=l.photo; l.imgObj=img;});

    this.selectedLevel = 0;
    this.currentLevel = 0;

    /* Images */
    this.playerImg = new Image(); this.playerImg.src = 'assets/player.png';
    this.alienTypes=[{img:'assets/alien1.png',hp:1,score:10},{img:'assets/alien2.png',hp:2,score:25},{img:'assets/alien3.png',hp:3,score:50}];
    this.alienTypes.forEach(t=>{const i=new Image(); i.src=t.img; t.imageObj=i;});
    this.crackImgs=[1,2,3].map(n=>{const i=new Image(); i.src=`assets/crack${n}.png`; return i;});

    /* Stars */
    this.stars=[]; this.initStars(150);

    /* Player */
    this.player={x:0,y:0,width:60,height:60,velX:0,acc:0.6,friction:0.88,maxSpeed:8,lives:3,maxLives:3};

    /* Collections */
    this.enemies=[]; this.playerBullets=[]; this.enemyBullets=[];

    /* State */
    this.audioCtx=null; this.state='start'; this.score=0;

    /* Controls */
    this.leftPressed=false; this.rightPressed=false; this.setupControls();

    /* Load first level for pattern logic */
    this.loadLevel(0);
    requestAnimationFrame(ts=>this.loop(ts));
  }

  /* ----- Helpers ----- */
  imgReady(img){return img.complete && img.naturalWidth;}

  /* ----- Stars with parallax ----- */
  initStars(n){
    while(n--){
      const depth=Math.random(); // 0 (near) .. 1 (far)
      this.stars.push({
        x:Math.random()*this.canvas.width,
        y:Math.random()*this.canvas.height,
        vy:0.3+depth*0.7,
        vx:(Math.random()-0.5)*0.2*depth, // subtle horizontal drift
        size:2+depth*2
      });
    }
  }
  updateStars(){
    this.stars.forEach(s=>{
      s.y+=s.vy; s.x+=s.vx;
      if(s.y>this.canvas.height){ s.y=0; s.x=Math.random()*this.canvas.width; }
      if(s.x<0) s.x+=this.canvas.width; else if(s.x>this.canvas.width) s.x-=this.canvas.width;
    });
  }
  drawStars(){
    this.stars.forEach(s=>{ this.ctx.fillStyle='#fff'; this.ctx.fillRect(s.x,s.y,s.size,s.size); });
  }

  /* ----- Controls ----- */
  setupControls(){
    window.addEventListener('keydown',e=>{
      const k=e.key;
      if(['ArrowLeft','a','A'].includes(k)) this.leftPressed=true;
      if(['ArrowRight','d','D'].includes(k)) this.rightPressed=true;
      if(k===' '){
        if(this.state==='start'){ this.loadLevel(this.selectedLevel); this.state='playing'; }
        else if(this.state==='playing') this.shootPlayer();
        else if(this.state==='gameover'){ this.state='start'; }
      }
      if(k==='Escape'){
        if(this.state==='playing'||this.state==='gameover'){ this.saveHighScore(); this.state='start'; this.score=0; this.player.lives=this.player.maxLives; }
      }
      if(this.state==='start'){
        if(k==='ArrowLeft') this.selectedLevel=(this.selectedLevel-1+this.levels.length)%this.levels.length;
        if(k==='ArrowRight') this.selectedLevel=(this.selectedLevel+1)%this.levels.length;
      }
      this.ensureAudioCtx();
    });
    window.addEventListener('keyup',e=>{const k=e.key; if(['ArrowLeft','a','A'].includes(k)) this.leftPressed=false; if(['ArrowRight','d','D'].includes(k)) this.rightPressed=false;});
  }

  /* ----- Audio ----- */
  ensureAudioCtx(){ if(!window.AudioContext&&!window.webkitAudioContext) return; if(!this.audioCtx) this.audioCtx=new (window.AudioContext||window.webkitAudioContext)(); if(this.audioCtx.state==='suspended') this.audioCtx.resume(); }
  playSound(t){ if(!this.audioCtx) return; const ctx=this.audioCtx; const o=ctx.createOscillator(); const g=ctx.createGain(); o.type='square'; o.frequency.value={playerShoot:550,enemyShoot:330,explosion:120}[t]||440; g.gain.value=0.15; o.connect(g); g.connect(ctx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.25); o.stop(ctx.currentTime+0.25); }

  /* ----- Level & pattern (same as v9 but without bg photo) ----- */
  loadLevel(idx){
    this.currentLevel=idx; const cfg=this.levels[idx];
    // fleet params
    this.enemySpeedBase=cfg.speed; this.enemySpeed=1.5*cfg.speed; this.enemyDirection=1; this.enemyVerticalDir=1; this.enemyVerticalSpeed=0.3;
    this.enemyOffsetY=this.hudHeight+20; this.enemyBottomLimit=this.canvas.height-150;
    this.enemyShootCooldown=1000; this.lastEnemyShot=0;
    this.enemySpacingX=60; this.enemySpacingY=50; this.enemyOffsetX=80;

    // player
    this.player.x=this.canvas.width/2-this.player.width/2; this.player.y=this.canvas.height-80; this.player.velX=0;

    // build formation
    this.initPattern(cfg);
  }
  initPattern(cfg){ this.enemies=[]; const p=cfg.pattern; if(p==='grid') this.placeGrid(cfg.rows,cfg.cols); else if(p==='triangle') this.placeTriangle(cfg.rows); else if(p==='circle') this.placeCircle(cfg.rows); else if(p==='box') this.placeHollowBox(cfg.rows,cfg.cols); }
  spawnAlien(gx,gy,totalRows){ const x=this.enemyOffsetX+gx*this.enemySpacingX; const y=this.enemyOffsetY+gy*this.enemySpacingY; const rev=totalRows-1-gy; const typeIdx=Math.min(this.alienTypes.length-1,Math.floor(rev/2)); const t=this.alienTypes[typeIdx]; this.enemies.push({x,y,width:40,height:40,alive:true,hp:t.hp,maxHp:t.hp,type:typeIdx,oscPhase:Math.random()*Math.PI*2}); }
  placeGrid(r,c){ for(let y=0;y<r;y++){ for(let x=0;x<c;x++) this.spawnAlien(x,y,r);} }
  placeTriangle(r){ for(let y=0;y<r;y++){ const cols=y+1; const start=-Math.floor(cols/2); for(let x=0;x<cols;x++) this.spawnAlien(start+x+Math.floor(r/2),y,r);} }
  placeCircle(d){ const rad=d/2; for(let gy=-rad;gy<=rad;gy++){ for(let gx=-rad;gx<=rad;gx++){ if(gx*gx+gy*gy<=rad*rad) this.spawnAlien(gx+rad,gy+rad,d);} } }
  placeHollowBox(r,c){ for(let x=0;x<c;x++){ this.spawnAlien(x,0,r); this.spawnAlien(x,r-1,r);} for(let y=1;y<r-1;y++){ this.spawnAlien(0,y,r); this.spawnAlien(c-1,y,r);} }

  /* ----- Shooting / collisions identical to v9 ----- */
  shootPlayer(){this.playerBullets.push({x:this.player.x+this.player.width/2-2,y:this.player.y,width:4,height:12,speed:9}); this.playSound('playerShoot'); }
  enemyTryShoot(){ const now=performance.now(); if(now-this.lastEnemyShot<this.enemyShootCooldown) return; const s=this.enemies.filter(e=>e.alive); if(!s.length) return; const shooter=s[Math.floor(Math.random()*s.length)]; this.enemyBullets.push({x:shooter.x+shooter.width/2-2,y:shooter.y+shooter.height,width:4,height:12,speed:5}); this.playSound('enemyShoot'); this.lastEnemyShot=now; }
  handleCollisions(){ this.playerBullets.forEach((b,bi)=>{ this.enemies.forEach(e=>{ if(!e.alive) return; if(b.x<e.x+e.width && b.x+b.width>e.x && b.y<e.y+e.height && b.y+b.height>e.y){ e.hp--; this.playerBullets.splice(bi,1); if(e.hp<=0){ e.alive=false; this.score+=this.alienTypes[e.type].score; this.playSound('explosion'); } } }); }); this.enemyBullets.forEach((b,bi)=>{ if(b.x<this.player.x+this.player.width && b.x+b.width>this.player.x && b.y<this.player.y+this.player.height && b.y+b.height>this.player.y){ this.enemyBullets.splice(bi,1); this.player.lives--; this.playSound('explosion'); } }); }

  /* ----- Cracks (unchanged) ----- */
  drawZigZagCrack(x,y,w,h){ const seg=6, step=w/seg; let cx=x, cy=y+Math.random()*h; this.ctx.beginPath(); this.ctx.moveTo(cx,cy); for(let i=0;i<seg;i++){ cx+=step; cy+=(Math.random()-0.5)*h*0.5; cy=Math.max(y,Math.min(y+h,cy)); this.ctx.lineTo(cx,cy);} this.ctx.stroke(); }
  drawCracks(x,y,w,h,sev){ const m=4; sev=Math.min(sev,3); const use=this.imgReady(this.crackImgs[0]); if(use){ for(let i=0;i<sev;i++) this.ctx.drawImage(this.crackImgs[i],x+m,y+m,w-2*m,h-2*m); } else { this.ctx.strokeStyle='rgba(255,255,255,0.4)'; this.ctx.lineWidth=2; for(let i=0;i<sev;i++) this.drawZigZagCrack(x+m,y+m,w-2*m,h-2*m); } }

  /* ----- Loop ----- */
  loop(ts){ if(this.state==='playing'){ this.update(); this.draw(ts);} else if(this.state==='start') this.drawStart(); else this.drawGameOver(); requestAnimationFrame(n=>this.loop(n)); }

  /* ----- Update ----- */
  update(){
    this.updateStars();

    if(this.leftPressed) this.player.velX-=this.player.acc; if(this.rightPressed) this.player.velX+=this.player.acc;
    this.player.velX*=this.player.friction; this.player.velX=Math.max(-this.player.maxSpeed,Math.min(this.player.maxSpeed,this.player.velX));
    this.player.x+=this.player.velX; this.player.x=Math.max(0,Math.min(this.canvas.width-this.player.width,this.player.x));

    this.playerBullets.forEach((b,i)=>{ b.y-=b.speed; if(b.y<0) this.playerBullets.splice(i,1); });
    this.enemyBullets.forEach((b,i)=>{ b.y+=b.speed; if(b.y>this.canvas.height) this.enemyBullets.splice(i,1); });

    let rev=false; this.enemies.forEach(e=>{ if(!e.alive) return; e.x+=this.enemySpeed*this.enemyDirection; if(e.x<=0||e.x+e.width>=this.canvas.width) rev=true; }); if(rev) this.enemyDirection*=-1;
    this.enemies.forEach(e=>{ if(e.alive) e.y+=this.enemyVerticalSpeed*this.enemyVerticalDir; });
    const ys=this.enemies.filter(e=>e.alive).map(e=>e.y); if(ys.length){ const min=Math.min(...ys), max=Math.max(...ys); if(max>=this.enemyBottomLimit) this.enemyVerticalDir=-1; else if(min<=this.enemyOffsetY) this.enemyVerticalDir=1; }

    this.enemyTryShoot();
    this.handleCollisions();

    if(this.enemies.every(e=>!e.alive)){ this.saveHighScore(); this.loadLevel((this.currentLevel+1)%this.levels.length); }
    if(this.player.lives<=0){ this.saveHighScore(); this.state='gameover'; this.playSound('explosion'); }
  }

  /* ----- Drawing ----- */
  drawHud(){ const cfg=this.levels[this.currentLevel];
    this.ctx.fillStyle='#d48b07'; this.ctx.fillRect(0,0,this.canvas.width,this.hudHeight); this.ctx.fillStyle='#fff'; this.ctx.fillRect(0,0,this.canvas.width,10);
    // texts left & right
    this.ctx.fillStyle='#fff'; this.ctx.font='18px "Comic Sans MS",Arial'; this.ctx.textAlign='left';
    this.ctx.fillText('🍺 '+cfg.name,10,30);
    this.ctx.fillText('Lives:'+this.player.lives,10,50);
    this.ctx.textAlign='right'; this.ctx.fillText('HS:'+this.getHighScore(this.currentLevel)+'  Score:'+this.score,this.canvas.width-10,30);

    // centered miniature
    const img=cfg.imgObj; if(this.imgReady(img)){
      const maxH=this.hudHeight-14; const ratio=img.naturalWidth/img.naturalHeight; const h=maxH; const w=h*ratio; const x=(this.canvas.width-w)/2; const y=12; this.ctx.drawImage(img,x,y,w,h); this.ctx.strokeStyle='#fff'; this.ctx.strokeRect(x,y,w,h);
    }
    this.ctx.textAlign='left';
  }

  drawEntities(ts){
    const time=ts||performance.now();
    // player
    if(this.imgReady(this.playerImg)) this.ctx.drawImage(this.playerImg,this.player.x,this.player.y,this.player.width,this.player.height); else { this.ctx.fillStyle='#0f0'; this.ctx.fillRect(this.player.x,this.player.y,this.player.width,this.player.height);} if(this.player.lives<this.player.maxLives) this.drawCracks(this.player.x,this.player.y,this.player.width,this.player.height,this.player.maxLives-this.player.lives);
    // bullets
    this.ctx.fillStyle='#fff'; this.playerBullets.forEach(b=>this.ctx.fillRect(b.x,b.y,b.width,b.height)); this.ctx.fillStyle='#ffdd00'; this.enemyBullets.forEach(b=>this.ctx.fillRect(b.x,b.y,b.width,b.height));
    // enemies
    this.enemies.forEach(e=>{ if(!e.alive) return; const yR=e.y+Math.sin(time/300+e.oscPhase)*3; const inf=this.alienTypes[e.type]; const img=inf.imageObj; if(this.imgReady(img)){ const ratio=img.naturalWidth/img.naturalHeight; let dw=e.width, dh=e.height; if(ratio>1) dh=dw/ratio; else dw=dh*ratio; this.ctx.drawImage(img,e.x+(e.width-dw)/2,yR+(e.height-dh)/2,dw,dh);} else { this.ctx.fillStyle=['#ff6666','#ff3333','#cc0000'][e.type]||'#f00'; this.ctx.fillRect(e.x,yR,e.width,e.height);} if(e.hp<e.maxHp) this.drawCracks(e.x,yR,e.width,e.height,e.maxHp-e.hp); });
  }

  draw(ts){ this.ctx.fillStyle='#000'; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); this.drawStars(); this.drawEntities(ts); this.drawHud(); }

  drawStart(){ const cfg=this.levels[this.selectedLevel]; this.ctx.fillStyle='#000'; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); this.drawStars();
    this.ctx.fillStyle='#fff'; this.ctx.font='48px Arial'; this.ctx.textAlign='center'; this.ctx.fillText('MENEL INVADERS',this.canvas.width/2,this.canvas.height/2-100);
    this.ctx.font='24px Arial'; this.ctx.fillText('Choose City (←/→) – '+cfg.name,this.canvas.width/2,this.canvas.height/2-40);
    this.ctx.fillText('Highscore: '+this.getHighScore(this.selectedLevel),this.canvas.width/2,this.canvas.height/2-10);
    this.ctx.fillText('Press SPACE to Start',this.canvas.width/2,this.canvas.height/2+30);
    // miniature bottom center
    const img=cfg.imgObj; if(this.imgReady(img)){ const maxH=120; const ratio=img.naturalWidth/img.naturalHeight; const h=maxH; const w=h*ratio; const x=this.canvas.width/2-w/2; const y=this.canvas.height-h-20; this.ctx.drawImage(img,x,y,w,h); this.ctx.strokeStyle='#fff'; this.ctx.strokeRect(x,y,w,h);} this.ctx.textAlign='left'; }

  drawGameOver(){ this.ctx.fillStyle='#000'; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); this.drawStars(); this.drawHud(); this.ctx.fillStyle='#fff'; this.ctx.font='48px Arial'; this.ctx.textAlign='center'; this.ctx.fillText('GAME OVER',this.canvas.width/2,this.canvas.height/2-20); this.ctx.font='24px Arial'; this.ctx.fillText('Press SPACE to Menu',this.canvas.width/2,this.canvas.height/2+20); this.ctx.textAlign='left'; }

  /* ----- HUD util ----- */
  saveHighScore(){ const key='menelHS_'+this.levels[this.currentLevel].name; const prev=parseInt(localStorage.getItem(key)||'0'); if(this.score>prev) localStorage.setItem(key,this.score); }
  getHighScore(idx){ return localStorage.getItem('menelHS_'+this.levels[idx].name)||0; }
}

window.addEventListener('load',()=>new MenelInvaders());
