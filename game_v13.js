// Menel Invaders – v13
// Added: richer audio cues (player & enemy damage, enemy destroy, win fanfare, lose boom, power-up)
//        revamped beer-themed main menu with epic amber title & bold labels.
// Based directly on v12 (168 lines) with small diffs.

class MenelInvaders {
  constructor() {
    /* === setup identical to v12 === */
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = 800;
    this.canvas.height = 600;
    this.hudHeight = 60;

    /* --- Levels --- */
    this.levels = [
      { name: 'Spindlerowy Mlyn', pattern: 'grid', rows: 5, cols: 10, speed: 1.0, photo: 'assets/spindlerowy.png' },
      { name: 'Utrecht', pattern: 'triangle', rows: 7, cols: 13, speed: 1.15, photo: 'assets/utrecht.png' },
      { name: 'Wroclaw', pattern: 'circle', rows: 9, cols: 9, speed: 1.25, photo: 'assets/wroclaw.png' },
      { name: 'Torun', pattern: 'box', rows: 6, cols: 12, speed: 1.1, photo: 'assets/torun.png' },
      { name: 'Praga', pattern: 'heart', rows: 8, cols: 8, speed: 1.2, photo: 'assets/praga.png' }
    ];
    this.levels.forEach(l=>{const img=new Image(); img.src=l.photo; l.imgObj=img;});

    this.selectedLevel=0; this.currentLevel=0;

    /* --- Assets --- */
    this.playerImg=new Image(); this.playerImg.src='assets/player.png';
    this.alienTypes=[
      {img:'assets/alien1.png', hp:1, score:10},
      {img:'assets/alien2.png', hp:2, score:25},
      {img:'assets/alien3.png', hp:3, score:50}
    ];
    this.alienTypes.forEach(t=>{const i=new Image(); i.src=t.img; t.imageObj=i;});
    this.crackImgs=[1,2,3].map(n=>{const i=new Image(); i.src=`assets/crack${n}.png`; return i;});

    /* Power-ups emojis */
    this.powerEmoji={life:'🍔', rapid:'☕', spread:'🍕', speed:'🚕'};

    /* Starfield */
    this.stars=[]; this.initStars(150);

    /* Player & state */
    this.player={x:0,y:0,width:60,height:60,velX:0,acc:0.6,friction:0.88,maxSpeed:9,lives:3,maxLives:5};
    this.shootCooldownBase=300; this.shootCooldown=this.shootCooldownBase; this.lastShot=0;
    this.spreadFire=false; this.powerTimers={rapid:0, spread:0, speed:0};

    this.enemies=[]; this.playerBullets=[]; this.enemyBullets=[]; this.powerUps=[];
    this.audioCtx=null; this.state='start'; this.score=0;

    /* Controls */
    this.leftPressed=false; this.rightPressed=false; this.setupControls();
    this.setupTouchControls();

    this.loadLevel(0);
    requestAnimationFrame(ts=>this.loop(ts));
  }

  /* ===== helpers ===== */
  imgReady(img){return img.complete&&img.naturalWidth;}

  /* === audio === */
  ensureAudio(){if(!window.AudioContext&&!window.webkitAudioContext) return;if(!this.audioCtx) this.audioCtx=new (window.AudioContext||window.webkitAudioContext)(); if(this.audioCtx.state==='suspended') this.audioCtx.resume();}
  playSound(type){ if(!this.audioCtx) return;
    const freqMap={
      playerShoot:550,
      enemyShoot:330,
      enemyDamage:420,
      explosion:140,
      playerDamage:260,
      power:800,
      win:660,
      lose:110
    };
    const f=freqMap[type]||440;
    const ctx=this.audioCtx, o=ctx.createOscillator(), g=ctx.createGain();
    o.type='square';
    o.frequency.value=f;
    g.gain.value=0.18;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    const dur= type==='win'?0.7: (type==='lose'?0.6:0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+dur);
    o.stop(ctx.currentTime+dur);
  }

  /* === starfield === */
  initStars(n){while(n--){const d=Math.random();this.stars.push({x:Math.random()*this.canvas.width,y:Math.random()*this.canvas.height,vy:0.3+d*0.7,vx:(Math.random()-0.5)*0.2*d,size:2+d*2});}}
  updateStars(){this.stars.forEach(s=>{s.y+=s.vy; s.x+=s.vx; if(s.y>this.canvas.height){s.y=0; s.x=Math.random()*this.canvas.width;} if(s.x<0)s.x+=this.canvas.width; else if(s.x>this.canvas.width)s.x-=this.canvas.width;});}
  drawStars(){this.ctx.fillStyle='#fff'; this.stars.forEach(s=>this.ctx.fillRect(s.x,s.y,s.size,s.size));}

  /* === controls === */
  setupControls(){
    window.addEventListener('keydown',e=>{
      const k=e.key;
      if(['ArrowLeft','a','A'].includes(k)) this.leftPressed=true;
      if(['ArrowRight','d','D'].includes(k)) this.rightPressed=true;
      if(k===' '){ if(this.state==='start'){ this.score=0; this.loadLevel(this.selectedLevel); this.state='playing'; this.playSound('playerShoot'); } else if(this.state==='playing') this.tryShoot(); else if(this.state==='gameover'){ this.state='start'; } }
      if(k==='Escape' && (this.state==='playing'||this.state==='gameover')){ this.saveHighScore(); this.state='start'; this.score=0; this.resetPlayer(); }
      if(this.state==='start'){
        if(k==='ArrowLeft') this.selectedLevel=(this.selectedLevel-1+this.levels.length)%this.levels.length;
        if(k==='ArrowRight') this.selectedLevel=(this.selectedLevel+1)%this.levels.length;
      }
      this.ensureAudio();
    });
    window.addEventListener('keyup',e=>{const k=e.key; if(['ArrowLeft','a','A'].includes(k)) this.leftPressed=false; if(['ArrowRight','d','D'].includes(k)) this.rightPressed=false;});
}

/* === touch controls (mobile) === */
setupTouchControls(){
  const btnLeft=document.getElementById('btnLeft');
  const btnRight=document.getElementById('btnRight');
  const btnShoot=document.getElementById('btnShoot');
  if(!btnLeft) return; // desktop
  const add=(el,evt,fn)=>el&&el.addEventListener(evt,fn,{passive:false});
  // Helpers
  add(btnLeft,'touchstart',e=>{e.preventDefault();this.leftPressed=true;});
  add(btnLeft,'touchend',e=>{e.preventDefault();this.leftPressed=false;});
  add(btnRight,'touchstart',e=>{e.preventDefault();this.rightPressed=true;});
  add(btnRight,'touchend',e=>{e.preventDefault();this.rightPressed=false;});
  add(btnShoot,'touchstart',e=>{e.preventDefault();
    if(this.state==='playing') this.tryShoot();
    else if(this.state==='start') { this.score=0; this.loadLevel(this.selectedLevel); this.state='playing'; this.playSound('playerShoot'); }
  });
}

  /* === Level & patterns (same as v12) === */
  resetPlayer(){ this.player.lives=3; this.player.velX=0; this.shootCooldown=this.shootCooldownBase; this.spreadFire=false; }
  loadLevel(idx){ this.currentLevel=idx; const cfg=this.levels[idx];
    this.enemySpacingX=cfg.pattern==='heart'?50:60;
    this.enemySpacingY=cfg.pattern==='heart'?40:50;
    this.enemyOffsetX=(this.canvas.width-(cfg.cols-1)*this.enemySpacingX)/2-20;
    this.enemyOffsetY=this.hudHeight+20;
    this.enemySpeed=1.5*cfg.speed; this.enemyDirection=1; this.enemyVerticalDir=1; this.enemyVerticalSpeed=0.3;
    this.enemyBottomLimit=this.canvas.height-150; this.enemyShootCooldown=1000; this.lastEnemyShot=0;

    this.resetPlayer(); this.player.x=this.canvas.width/2-this.player.width/2; this.player.y=this.canvas.height-80;

    this.enemies=[]; this.playerBullets=[]; this.enemyBullets=[]; this.powerUps=[];
    this.initPattern(cfg);
  }
  spawnAlien(gx,gy,totalRows){ const x=this.enemyOffsetX+gx*this.enemySpacingX; const y=this.enemyOffsetY+gy*this.enemySpacingY; const rev=totalRows-1-gy; const tIdx=Math.min(this.alienTypes.length-1,Math.floor(rev/2)); const t=this.alienTypes[tIdx]; this.enemies.push({x,y,width:40,height:40,alive:true,hp:t.hp,maxHp:t.hp,type:tIdx,oscPhase:Math.random()*Math.PI*2}); }
  placeGrid(r,c){for(let y=0;y<r;y++)for(let x=0;x<c;x++)this.spawnAlien(x,y,r);}  
  placeTriangle(r){for(let y=0;y<r;y++){const cols=y+1,start=-Math.floor(cols/2);for(let x=0;x<cols;x++)this.spawnAlien(start+x+Math.floor(r/2),y,r);} }
  placeCircle(d){const rad=d/2;for(let gy=-rad;gy<=rad;gy++){for(let gx=-rad;gx<=rad;gx++){if(gx*gx+gy*gy<=rad*rad)this.spawnAlien(gx+rad,gy+rad,d);}} }
  placeHollowBox(r,c){for(let x=0;x<c;x++){this.spawnAlien(x,0,r);this.spawnAlien(x,r-1,r);} for(let y=1;y<r-1;y++){this.spawnAlien(0,y,r);this.spawnAlien(c-1,y,r);} }
  placeHeart(r,c){for(let gy=0;gy<r;gy++){for(let gx=0;gx<c;gx++){const nx=(gx-c/2)/(c/2),ny=(gy-r/2)/(r/2); const eq=Math.pow(nx*nx+ny*ny-0.3,3)-nx*nx*ny*ny*ny; if(eq<=0) this.spawnAlien(gx,gy,r);} }}
  initPattern(cfg){ switch(cfg.pattern){ case 'grid':this.placeGrid(cfg.rows,cfg.cols);break; case 'triangle':this.placeTriangle(cfg.rows);break; case 'circle':this.placeCircle(cfg.rows);break; case 'box':this.placeHollowBox(cfg.rows,cfg.cols);break; case 'heart':this.placeHeart(cfg.rows,cfg.cols);break; } }

  /* === shooting === */
  tryShoot(){ const now=performance.now(); if(now-this.lastShot<this.shootCooldown) return; this.lastShot=now; this.shootPlayer(); }
  shootPlayer(){ if(this.spreadFire){ [-1,0,1].forEach(dx=>this.playerBullets.push({x:this.player.x+this.player.width/2-2, y:this.player.y, dx, speed:9})); } else { this.playerBullets.push({x:this.player.x+this.player.width/2-2, y:this.player.y, dx:0, speed:9}); } this.playSound('playerShoot'); }
  enemyTryShoot(){ const now=performance.now(); if(now-this.lastEnemyShot<this.enemyShootCooldown) return; const shooters=this.enemies.filter(e=>e.alive); if(!shooters.length) return; const s=shooters[Math.floor(Math.random()*shooters.length)]; this.enemyBullets.push({x:s.x+s.width/2-2, y:s.y+s.height, dx:0, speed:5}); this.playSound('enemyShoot'); this.lastEnemyShot=now; }

  /* === power-ups === */
  maybeSpawnPowerUp(x,y){ if(Math.random()<0.15){ const t=['life','rapid','spread','speed'][Math.floor(Math.random()*4)]; this.powerUps.push({x,y,width:24,height:24,type:t,speed:2}); } }
  applyPowerUp(p){ const now=performance.now();
    if(p.type==='life'){
      this.player.lives=Math.min(this.player.maxLives,this.player.lives+1);
    } else if(p.type==='rapid'){
      if(this.powerTimers.rapid && this.powerTimers.rapid>now){ // already active -> extend
        this.powerTimers.rapid+=10000;
      } else {
        this.shootCooldown=this.shootCooldownBase/2;
        this.powerTimers.rapid=now+10000;
      }
    } else if(p.type==='spread'){
      if(this.powerTimers.spread && this.powerTimers.spread>now){
        this.powerTimers.spread+=10000;
      } else {
        this.spreadFire=true;
        this.powerTimers.spread=now+10000;
      }
    } else if(p.type==='speed'){
      if(this.powerTimers.speed && this.powerTimers.speed>now){
        this.powerTimers.speed+=10000;
      } else {
        this.player.maxSpeed*=3;
        this.powerTimers.speed=now+10000;
      }
    }
    this.playSound('power'); }
  updatePowerTimers(){ const now=performance.now(); if(this.powerTimers.rapid&&now>this.powerTimers.rapid){ this.shootCooldown=this.shootCooldownBase; this.powerTimers.rapid=0; }
    if(this.powerTimers.spread&&now>this.powerTimers.spread){ this.spreadFire=false; this.powerTimers.spread=0; }
    if(this.powerTimers.speed&&now>this.powerTimers.speed){ this.player.maxSpeed/=3; this.powerTimers.speed=0; } }

  /* === crack helpers same as v12 === */
  drawZigZagCrack(x,y,w,h){ const seg=6,step=w/seg; let cx=x, cy=y+Math.random()*h; this.ctx.beginPath(); this.ctx.moveTo(cx,cy); for(let i=0;i<seg;i++){ cx+=step; cy+=(Math.random()-0.5)*h*0.5; cy=Math.max(y,Math.min(y+h,cy)); this.ctx.lineTo(cx,cy);} this.ctx.stroke(); }
  drawCracks(x,y,w,h,sev){ const m=4; sev=Math.min(sev,3); const use=this.imgReady(this.crackImgs[0]); if(use){ for(let i=0;i<sev;i++) this.ctx.drawImage(this.crackImgs[i],x+m,y+m,w-2*m,h-2*m);} else { this.ctx.strokeStyle='rgba(255,255,255,0.4)'; this.ctx.lineWidth=2; for(let i=0;i<sev;i++) this.drawZigZagCrack(x+m,y+m,w-2*m,h-2*m);} }

  /* === game loop === */
  loop(ts){
    if(this.state==='playing'){
      this.update();
      this.draw(ts);
    } else if(this.state==='victory'){
      this.drawVictory(ts);
      if(performance.now()-this.victoryAt>3000){
        this.loadLevel(this.nextLevel);
        this.state='playing';
      }
    } else if(this.state==='start') this.drawStart();
    else this.drawGameOver();
    requestAnimationFrame(n=>this.loop(n));
  }

  /* === update === */
  update(){ this.updateStars(); this.updatePowerTimers();
    if(this.leftPressed) this.player.velX-=this.player.acc; if(this.rightPressed) this.player.velX+=this.player.acc; this.player.velX*=this.player.friction; this.player.velX=Math.max(-this.player.maxSpeed,Math.min(this.player.maxSpeed,this.player.velX)); this.player.x+=this.player.velX; this.player.x=Math.max(0,Math.min(this.canvas.width-this.player.width,this.player.x));

    this.playerBullets.forEach((b,i)=>{ b.y-=b.speed; b.x+=b.dx; if(b.y<0) this.playerBullets.splice(i,1); });
    this.enemyBullets.forEach((b,i)=>{ b.y+=b.speed; if(b.y>this.canvas.height) this.enemyBullets.splice(i,1); });
    this.powerUps.forEach((p,i)=>{ p.y+=p.speed; if(p.y>this.canvas.height) this.powerUps.splice(i,1); });

    let rev=false; this.enemies.forEach(e=>{ if(!e.alive) return; e.x+=this.enemySpeed*this.enemyDirection; if(e.x<=0||e.x+e.width>=this.canvas.width) rev=true; }); if(rev) this.enemyDirection*=-1; this.enemies.forEach(e=>{ if(e.alive) e.y+=this.enemyVerticalSpeed*this.enemyVerticalDir; });
    const ys=this.enemies.filter(e=>e.alive).map(e=>e.y); if(ys.length){ const min=Math.min(...ys),max=Math.max(...ys); if(max>=this.enemyBottomLimit) this.enemyVerticalDir=-1; else if(min<=this.enemyOffsetY) this.enemyVerticalDir=1; }

    this.enemyTryShoot();
    this.handleCollisions();

    // win check
    if(this.enemies.every(e=>!e.alive)){
    this.playSound('win');
    this.saveHighScore();
    this.victoryCity=this.levels[this.currentLevel].name;
    this.state='victory';
    this.victoryAt=performance.now();
    this.nextLevel=(this.currentLevel+1)%this.levels.length;
  }
    if(this.player.lives<=0){ this.saveHighScore(); this.playSound('lose'); this.state='gameover'; }
  }

  handleCollisions(){
    // player bullets vs enemies
    this.playerBullets.forEach((b,bi)=>{
      this.enemies.forEach(e=>{
        if(!e.alive) return;
        if(b.x<e.x+e.width && b.x+4>e.x && b.y<e.y+e.height && b.y+12>e.y){
          e.hp--; this.playerBullets.splice(bi,1);
          if(e.hp<=0){ e.alive=false; this.score+=this.alienTypes[e.type].score; this.maybeSpawnPowerUp(e.x+e.width/2,e.y+e.height/2); this.playSound('explosion'); }
          else { this.playSound('enemyDamage'); }
        }
      });
    });
    // enemy bullets vs player
    this.enemyBullets.forEach((b,bi)=>{
      if(b.x<this.player.x+this.player.width && b.x+4>this.player.x && b.y<this.player.y+this.player.height && b.y+12>this.player.y){
        this.enemyBullets.splice(bi,1); this.player.lives--; this.playSound('playerDamage'); }
    });
    // power-ups
    this.powerUps.forEach((p,pi)=>{
      if(p.x<p.x+p.width && p.x+p.width>this.player.x && p.y<p.y+p.height && p.y+p.height>this.player.y){ this.applyPowerUp(p); this.powerUps.splice(pi,1); }
    });
  }

  /* === drawing === */
  drawPowerUps(){ this.ctx.font='20px Arial'; this.ctx.textAlign='center'; this.powerUps.forEach(p=>{ this.ctx.fillText(this.powerEmoji[p.type]||'?', p.x+p.width/2, p.y+p.height); }); this.ctx.textAlign='left'; }
  drawHud(){ const cfg=this.levels[this.currentLevel]; this.ctx.fillStyle='#d48b07'; this.ctx.fillRect(0,0,this.canvas.width,this.hudHeight); this.ctx.fillStyle='#fff'; this.ctx.fillRect(0,0,this.canvas.width,10);
    // Labels bold
    this.ctx.textAlign='left'; let y1=30;
    this.ctx.font='bold 18px Arial'; this.ctx.fillText('City:',10,y1);
    this.ctx.font='18px Arial'; this.ctx.fillText(cfg.name,70,y1);
    y1=50;
    this.ctx.font='bold 18px Arial'; this.ctx.fillText('Lives:',10,y1);
    this.ctx.font='18px Arial'; this.ctx.fillText(this.player.lives,70,y1);
    this.ctx.textAlign='right';
    this.ctx.font='bold 18px Arial'; this.ctx.fillText('HS:',this.canvas.width-220,30);
    this.ctx.font='18px Arial'; this.ctx.fillText(this.getHighScore(this.currentLevel),this.canvas.width-170,30);
    this.ctx.font='bold 18px Arial'; this.ctx.fillText('Score:',this.canvas.width-70,30);
    this.ctx.font='18px Arial'; this.ctx.fillText(this.score,this.canvas.width-10,30);
  // Active power-ups center of HUD
  const active=[]; const now=performance.now();
  if(this.powerTimers.rapid && this.powerTimers.rapid>now) active.push(this.powerEmoji.rapid);
  if(this.powerTimers.spread && this.powerTimers.spread>now) active.push(this.powerEmoji.spread);
  if(this.powerTimers.speed && this.powerTimers.speed>now) active.push(this.powerEmoji.speed);
  if(active.length){
    this.ctx.textAlign='center';
    this.ctx.font='24px Arial';
    this.ctx.fillText(active.join(' '), this.canvas.width/2, 52);
  }
    const img=cfg.imgObj; if(this.imgReady(img)){ const h=this.hudHeight-14, ratio=img.naturalWidth/img.naturalHeight, w=h*ratio, x=(this.canvas.width-w)/2, y=12; this.ctx.drawImage(img,x,y,w,h); this.ctx.strokeStyle='#fff'; this.ctx.strokeRect(x,y,w,h);} this.ctx.textAlign='left'; }
  drawEntities(ts){ const time=ts||performance.now();
    if(this.imgReady(this.playerImg)) this.ctx.drawImage(this.playerImg,this.player.x,this.player.y,this.player.width,this.player.height); else { this.ctx.fillStyle='#0f0'; this.ctx.fillRect(this.player.x,this.player.y,this.player.width,this.player.height);} if(this.player.lives<3) this.drawCracks(this.player.x,this.player.y,this.player.width,this.player.height,3-this.player.lives);
    this.ctx.fillStyle='#fff'; this.playerBullets.forEach(b=>this.ctx.fillRect(b.x,b.y,4,12)); this.ctx.fillStyle='#ff0'; this.enemyBullets.forEach(b=>this.ctx.fillRect(b.x,b.y,4,12));
    this.drawPowerUps();
    this.enemies.forEach(e=>{ if(!e.alive) return; const yR=e.y+Math.sin(time/300+e.oscPhase)*3; const inf=this.alienTypes[e.type]; const img=inf.imageObj; if(this.imgReady(img)){ const r=img.naturalWidth/img.naturalHeight; let dw=e.width, dh=e.height; if(r>1) dh=dw/r; else dw=dh*r; this.ctx.drawImage(img,e.x+(e.width-dw)/2,yR+(e.height-dh)/2,dw,dh);} else { this.ctx.fillStyle=['#f66','#f33','#c00'][e.type]||'#f00'; this.ctx.fillRect(e.x,yR,e.width,e.height);} if(e.hp<e.maxHp) this.drawCracks(e.x,yR,e.width,e.height,e.maxHp-e.hp); }); }
  draw(ts){ this.ctx.fillStyle="#000"; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); this.drawStars(); this.drawEntities(ts); this.drawHud(); }

  drawStart(){ const cfg=this.levels[this.selectedLevel]; this.ctx.fillStyle="#000"; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); this.drawStars();
    // Epic amber title
    this.ctx.fillStyle="#d48b07"; this.ctx.font='bold 64px Impact, "Comic Sans MS", Arial'; this.ctx.textAlign='center'; this.ctx.fillText('MENEL INVADERS', this.canvas.width/2, this.canvas.height/2-120);
    this.ctx.fillStyle="#fff"; this.ctx.font='24px Arial';
    // Bold labels vs values
    this.ctx.font='bold 24px Arial'; this.ctx.fillText('City:', this.canvas.width/2-120, this.canvas.height/2-40);
    this.ctx.font='24px Arial'; this.ctx.fillText(cfg.name, this.canvas.width/2+20, this.canvas.height/2-40);
    this.ctx.font='bold 24px Arial'; this.ctx.fillText('Highscore:', this.canvas.width/2-120, this.canvas.height/2);
    this.ctx.font='24px Arial'; this.ctx.fillText(this.getHighScore(this.selectedLevel), this.canvas.width/2+60, this.canvas.height/2);
    this.ctx.font='bold 24px Arial'; this.ctx.fillText('Press SPACE to Start', this.canvas.width/2, this.canvas.height/2+60);
    this.ctx.font='18px Arial'; this.ctx.fillText('Use ← / → arrows to change city', this.canvas.width/2, this.canvas.height/2+90);

    const img=cfg.imgObj; if(this.imgReady(img)){ const maxH=120, ratio=img.naturalWidth/img.naturalHeight, h=maxH, w=h*ratio, x=this.canvas.width/2-w/2, y=this.canvas.height-h-20; this.ctx.drawImage(img,x,y,w,h); this.ctx.strokeStyle='#fff'; this.ctx.strokeRect(x,y,w,h);} this.ctx.textAlign='left'; }

  drawGameOver(){ this.ctx.fillStyle="#000"; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); this.drawStars(); this.drawHud(); this.ctx.fillStyle="#fff"; this.ctx.font='48px Arial'; this.ctx.textAlign='center'; this.ctx.fillText('GAME OVER', this.canvas.width/2, this.canvas.height/2-20); this.ctx.font='24px Arial'; this.ctx.fillText('Press SPACE to Menu', this.canvas.width/2, this.canvas.height/2+20); this.ctx.textAlign='left'; }

  // victory beer screen
  drawVictory(){ this.ctx.fillStyle="#000"; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); this.drawStars(); this.drawHud(); const cx=this.canvas.width/2, cy=this.canvas.height/2; this.ctx.font='100px Arial'; this.ctx.textAlign='center'; this.ctx.fillText('🍺', cx, cy-20); this.ctx.font='32px Arial'; this.ctx.fillText('You\'ve conquered '+this.victoryCity+'!', cx, cy+60); this.ctx.textAlign='left'; }

  /* === high scores === */
  saveHighScore(){ const key='menelHS_'+this.levels[this.currentLevel].name; const prev=parseInt(localStorage.getItem(key)||'0'); if(this.score>prev) localStorage.setItem(key,this.score); }
  getHighScore(i){ return localStorage.getItem('menelHS_'+this.levels[i].name)||0; }
}

// start the game once DOM is ready
window.addEventListener('load', () => new MenelInvaders());

