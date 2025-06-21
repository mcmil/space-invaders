// Menel Invaders – v5
// • Progressive damage "cracks" overlay for enemies & player
// • Beer-motive HUD (amber bar with white "foam")
// NOTE: place crack1.png..crack3.png and beer_mug.png in assets/ for full effect (fallbacks provided)

class MenelInvaders{
 constructor(){
  /* Canvas */
  this.canvas=document.getElementById('gameCanvas');
  this.ctx=this.canvas.getContext('2d');
  this.canvas.width=800;this.canvas.height=600;

  /* Audio */
  this.audioCtx=null;

  /* Game State */
  this.state='start';this.score=0;this.level=1;

  /* Player */
  this.player={x:this.canvas.width/2-30,y:this.canvas.height-80,width:60,height:60,velX:0,acc:0.6,friction:0.88,maxSpeed:8,lives:3,maxLives:3};
  this.leftPressed=false;this.rightPressed=false;

  /* Bullets */
  this.playerBullets=[];this.enemyBullets=[];

  /* Alien Types */
  this.alienTypes=[
   {img:'assets/alien1.png',hp:1,score:10},
   {img:'assets/alien2.png',hp:2,score:25},
   {img:'assets/alien3.png',hp:3,score:50}
  ];
  this.alienTypes.forEach(t=>{const i=new Image();i.src=t.img;t.imageObj=i;});
  this.playerImg=new Image();this.playerImg.src='assets/player.png';

  /* Crack overlays */
  this.crackImgs=[1,2,3].map(n=>{const i=new Image();i.src=`assets/crack${n}.png`;return i;});

  /* Fleet setup */
  this.enemies=[];this.enemyCols=10;this.enemyRows=5;this.enemySpacingX=60;this.enemySpacingY=50;this.enemyOffsetX=80;this.enemyOffsetY=60;
  this.enemyDirection=1;this.enemySpeed=1.5;this.enemyVerticalDir=1;this.enemyVerticalSpeed=0.3;this.enemyBottomLimit=this.canvas.height-150;
  this.enemyShootCooldown=1000;this.lastEnemyShot=0;

  /* Stars */
  this.stars=[];this.initStars(120);

  /* Init */
  this.initEnemies();this.setupControls();
  requestAnimationFrame(ts=>this.loop(ts));
 }

 /* ===== Stars ===== */
 initStars(c){for(let i=0;i<c;i++){this.stars.push({x:Math.random()*this.canvas.width,y:Math.random()*this.canvas.height,speed:0.3+Math.random()*0.7});}}
 updateStars(){this.stars.forEach(s=>{s.y+=s.speed;if(s.y>this.canvas.height){s.y=0;s.x=Math.random()*this.canvas.width;}});} 
 drawStars(){this.ctx.fillStyle='#ffffff';this.stars.forEach(s=>{this.ctx.fillRect(s.x,s.y,2,2);});}

 /* ===== Audio ===== */
 ensureAudioCtx(){if(!window.AudioContext&&!window.webkitAudioContext)return;if(!this.audioCtx)this.audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(this.audioCtx.state==='suspended')this.audioCtx.resume();}
 playSound(t){if(!this.audioCtx)return;const ctx=this.audioCtx;const o=ctx.createOscillator();const g=ctx.createGain();o.type='square';o.frequency.value={playerShoot:550,enemyShoot:330,explosion:120}[t]||440;g.gain.value=0.15;o.connect(g);g.connect(ctx.destination);o.start();g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.25);o.stop(ctx.currentTime+0.25);} 

 /* ===== Controls ===== */
 setupControls(){window.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')this.leftPressed=true;if(e.key==='ArrowRight')this.rightPressed=true;if(e.key===' '){if(this.state==='start')this.state='playing';else if(this.state==='playing')this.shootPlayer();else if(this.state==='gameover')this.resetGame();}this.ensureAudioCtx();});window.addEventListener('keyup',e=>{if(e.key==='ArrowLeft')this.leftPressed=false;if(e.key==='ArrowRight')this.rightPressed=false;});}

 /* ===== Enemies ===== */
 initEnemies(){this.enemies=[];for(let row=0;row<this.enemyRows;row++){for(let col=0;col<this.enemyCols;col++){const rev=this.enemyRows-1-row;const idx=Math.min(this.alienTypes.length-1,Math.floor(rev/2));const t=this.alienTypes[idx];this.enemies.push({x:this.enemyOffsetX+col*this.enemySpacingX,y:this.enemyOffsetY+row*this.enemySpacingY,width:40,height:40,alive:true,hp:t.hp,maxHp:t.hp,type:idx,oscPhase:Math.random()*Math.PI*2});}}}

 /* ===== Shooting ===== */
 shootPlayer(){this.playerBullets.push({x:this.player.x+this.player.width/2-2,y:this.player.y,width:4,height:12,speed:9});this.playSound('playerShoot');}
 enemyTryShoot(){const now=performance.now();if(now-this.lastEnemyShot<this.enemyShootCooldown)return;const shooters=this.enemies.filter(e=>e.alive);if(!shooters.length)return;const s=shooters[Math.floor(Math.random()*shooters.length)];this.enemyBullets.push({x:s.x+s.width/2-2,y:s.y+s.height,width:4,height:12,speed:5});this.playSound('enemyShoot');this.lastEnemyShot=now;}

 /* ===== Loop ===== */
 loop(ts){if(this.state==='playing'){this.update();this.draw(ts);}else if(this.state==='start'){this.drawStart();}else{this.drawGameOver();}requestAnimationFrame(n=>this.loop(n));}

 /* ===== Update ===== */
 update(){this.updateStars();if(this.leftPressed)this.player.velX-=this.player.acc;if(this.rightPressed)this.player.velX+=this.player.acc;this.player.velX*=this.player.friction;this.player.velX=Math.max(-this.player.maxSpeed,Math.min(this.player.maxSpeed,this.player.velX));this.player.x+=this.player.velX;this.player.x=Math.max(0,Math.min(this.canvas.width-this.player.width,this.player.x));this.playerBullets.forEach((b,i)=>{b.y-=b.speed;if(b.y+b.height<0)this.playerBullets.splice(i,1);});this.enemyBullets.forEach((b,i)=>{b.y+=b.speed;if(b.y>this.canvas.height)this.enemyBullets.splice(i,1);});let rev=false;this.enemies.forEach(e=>{if(!e.alive)return;e.x+=this.enemySpeed*this.enemyDirection;if(e.x<=0||e.x+e.width>=this.canvas.width)rev=true;});if(rev)this.enemyDirection*=-1;this.enemies.forEach(e=>{if(!e.alive)return;e.y+=0.3*this.enemyVerticalDir;});const ys=this.enemies.filter(e=>e.alive).map(e=>e.y);if(ys.length){const min=Math.min(...ys),max=Math.max(...ys);if(max>=this.enemyBottomLimit)this.enemyVerticalDir=-1;else if(min<=this.enemyOffsetY)this.enemyVerticalDir=1;}this.enemyTryShoot();this.handleCollisions();if(this.enemies.every(e=>!e.alive)){this.level++;this.enemySpeed+=0.5;this.initEnemies();}if(this.player.lives<=0){this.state='gameover';this.playSound('explosion');}}

 /* ===== Collisions ===== */
 handleCollisions(){this.playerBullets.forEach((b,bi)=>{this.enemies.forEach(e=>{if(!e.alive)return;if(b.x<e.x+e.width&&b.x+b.width>e.x&&b.y<e.y+e.height&&b.y+b.height>e.y){e.hp--;this.playerBullets.splice(bi,1);if(e.hp<=0){e.alive=false;this.score+=this.alienTypes[e.type].score;this.playSound('explosion');}}});});this.enemyBullets.forEach((b,bi)=>{if(b.x<this.player.x+this.player.width&&b.x+b.width>this.player.x&&b.y<this.player.y+this.player.height&&b.y+b.height>this.player.y){this.enemyBullets.splice(bi,1);this.player.lives--;this.playSound('explosion');}});}

 /* ===== Draw ===== */
 draw(ts){this.ctx.fillStyle='#000';this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);this.drawStars();
  // Player
  if(this.playerImg.complete&&this.playerImg.naturalWidth){this.ctx.drawImage(this.playerImg,this.player.x,this.player.y,this.player.width,this.player.height);}else{this.ctx.fillStyle='#0f0';this.ctx.fillRect(this.player.x,this.player.y,this.player.width,this.player.height);}if(this.player.lives<this.player.maxLives)this.drawCracks(this.player.x,this.player.y,this.player.width,this.player.height,this.player.maxLives-this.player.lives);
  // Bullets
  this.ctx.fillStyle='#fff';this.playerBullets.forEach(b=>this.ctx.fillRect(b.x,b.y,b.width,b.height));this.ctx.fillStyle='#ffdd00';this.enemyBullets.forEach(b=>this.ctx.fillRect(b.x,b.y,b.width,b.height));
  // Enemies
  const time=ts||performance.now();this.enemies.forEach(e=>{if(!e.alive)return;const yR=e.y+Math.sin(time/300+e.oscPhase)*3;const info=this.alienTypes[e.type];const img=info.imageObj;if(img.complete&&img.naturalWidth){const ratio=img.naturalWidth/img.naturalHeight;let dw=e.width,dh=e.height;if(ratio>1){dh=dw/ratio;}else{dw=dh*ratio;}this.ctx.drawImage(img,e.x+(e.width-dw)/2,yR+(e.height-dh)/2,dw,dh);}else{this.ctx.fillStyle=['#ff6666','#ff3333','#cc0000'][e.type]||'#f00';this.ctx.fillRect(e.x,yR,e.width,e.height);}if(e.hp<e.maxHp)this.drawCracks(e.x,yR,e.width,e.height,e.maxHp-e.hp);});
  // Beer HUD
  this.drawHud();
 }

 drawCracks(x,y,w,h,severity){severity=Math.min(severity,this.crackImgs.length);for(let i=0;i<severity;i++){const img=this.crackImgs[i];if(img.complete&&img.naturalWidth){this.ctx.drawImage(img,x,y,w,h);}else{this.ctx.strokeStyle='rgba(255,255,255,0.3)';this.ctx.beginPath();this.ctx.moveTo(x,y);this.ctx.lineTo(x+w,y+h);this.ctx.moveTo(x+w,y);this.ctx.lineTo(x,y+h);this.ctx.stroke();}}}

 drawHud(){const hudW=220,hudH=80;this.ctx.fillStyle='#d48b07';this.ctx.fillRect(0,0,hudW,hudH);this.ctx.fillStyle='#ffffff';this.ctx.fillRect(0,0,hudW,10);this.ctx.fillStyle='#ffffff';this.ctx.font='18px "Comic Sans MS", Arial';this.ctx.fillText('🍺 Score: '+this.score,10,30);this.ctx.fillText('🍺 Lives: '+this.player.lives,10,55);this.ctx.fillText('Lvl:'+this.level,150,55);} 

 drawStart(){this.ctx.fillStyle='#000';this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);this.drawStars();this.ctx.fillStyle='#fff';this.ctx.font='64px Arial';this.ctx.textAlign='center';this.ctx.fillText('MENEL INVADERS',this.canvas.width/2,this.canvas.height/2-40);this.ctx.font='24px Arial';this.ctx.fillText('Press SPACE to Start',this.canvas.width/2,this.canvas.height/2+20);this.ctx.textAlign='left';}
 drawGameOver(){this.ctx.fillStyle='#000';this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);this.drawStars();this.ctx.fillStyle='#fff';this.ctx.font='48px Arial';this.ctx.textAlign='center';this.ctx.fillText('GAME OVER',this.canvas.width/2,this.canvas.height/2-20);this.ctx.font='24px Arial';this.ctx.fillText(`Final Score: ${this.score}`,this.canvas.width/2,this.canvas.height/2+20);this.ctx.fillText('Press SPACE to Restart',this.canvas.width/2,this.canvas.height/2+60);this.ctx.textAlign='left';}

 resetGame(){this.score=0;this.level=1;this.player.lives=this.player.maxLives;this.enemySpeed=1.5;this.enemyDirection=1;this.enemyVerticalDir=1;this.initEnemies();this.state='start';}
}

window.addEventListener('load',()=>new MenelInvaders());
