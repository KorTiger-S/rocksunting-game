'use strict';
/* ---------- 스플래시: 롹순팅 등교 애니메이션 + Press Enter ---------- */
const SP={on:false,t:0,raf:0,last:0,ctx:$('#spCv').getContext('2d')};
const SP_WALK=4.6,SP_END=5.2;   /* 걷기 끝(초), 문으로 들어간 뒤 Press Enter가 나오는 시점(초) */
/* 시즌2(10월) 가을 테마: 노을 하늘 · 단풍 나무 · 떨어지는 낙엽. 학교 건물은 프리킥 경기장과 같은 building()을 써요 */
const SP_AUTUMN=['#e4572e','#f29e4c','#f1c453','#c0392b','#d35400'];
const SP_LEAVES=Array.from({length:28},(_,i)=>({x:(i*151)%W,sp:22+(i*37)%34,sw:18+(i*13)%26,ph:i*1.7,r:6+(i*7)%6,col:SP_AUTUMN[i%SP_AUTUMN.length],off:(i*89)%H}));
function spLeaf(c,x,y,r,rot,col){   /* 단풍잎(다섯 갈래) */
  c.save();c.translate(x,y);c.rotate(rot);c.fillStyle=col;c.beginPath();
  for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,rr2=k%2?r*.45:r;c.lineTo(Math.cos(a)*rr2,Math.sin(a)*rr2);}
  c.closePath();c.fill();c.strokeStyle='rgba(90,30,10,.5)';c.lineWidth=1;c.beginPath();c.moveTo(0,0);c.lineTo(0,r*1.1);c.stroke();c.restore();
}
function spAutumnSky(c){
  const g=c.createLinearGradient(0,0,0,HOR);g.addColorStop(0,'#f6a15b');g.addColorStop(.55,'#fbc98e');g.addColorStop(1,'#fde6c4');c.fillStyle=g;c.fillRect(0,0,W,HOR+2);
  c.fillStyle='rgba(255,236,190,.9)';c.beginPath();c.arc(640,112,34,0,7);c.fill();   /* 늦은 오후 해 */
  c.fillStyle='rgba(255,245,230,.7)';[[140,70,58],[430,96,74],[700,58,48]].forEach(a=>{c.beginPath();c.ellipse(a[0],a[1],a[2],a[2]*.33,0,0,7);c.fill();});
  building(c,0);
  [[20,HOR+2,0],[140,HOR-4,1],[700,HOR,2],[820,HOR-6,3]].forEach(([x,y,k])=>{   /* building()의 초록 나무 위에 단풍 */
    c.fillStyle='#7a5a3a';c.fillRect(x-3,y-4,6,16);
    [[0,-22,26],[-14,-12,17],[14,-12,17]].forEach(([dx,dy,rad],j)=>{c.fillStyle=SP_AUTUMN[(k+j)%SP_AUTUMN.length];c.beginPath();c.arc(x+dx,y+dy,rad,0,7);c.fill();});
  });
}
function spDraw(c,t){
  spAutumnSky(c);
  c.fillStyle='#b8a24c';c.fillRect(0,HOR,W,46);   /* 누렇게 물든 잔디 */
  c.fillStyle='#d8d0bd';c.fillRect(0,HOR+46,W,H-HOR-46);
  SP_LEAVES.slice(0,12).forEach((l,i)=>spLeaf(c,(l.x+i*23)%W,HOR+52+((l.off*3)%(H-HOR-60)),l.r*.8,l.ph,l.col));   /* 바닥에 쌓인 낙엽 */
  c.fillStyle='rgba(0,0,0,.08)';c.fillRect(0,HOR+46,W,4);
  c.fillStyle='#e6dfcd';c.beginPath();c.moveTo(372,HOR);c.lineTo(428,HOR);c.lineTo(600,H);c.lineTo(200,H);c.closePath();c.fill();
  c.fillStyle='#6d1f31';rr(c,372,HOR-58,56,58,4);c.fill();
  c.fillStyle='#e8a91c';c.beginPath();c.arc(418,HOR-28,3,0,7);c.fill();
  c.fillStyle='#b5a891';c.fillRect(366,HOR,68,6);
  TX(c,'롹순팅 키우기',W/2,38,50,'#fff','center','#6d1f31');
  c.fillStyle='#6d1f31';rr(c,14,14,236,30,15);c.fill();   /* 시즌 표시 (왼쪽 위: 가운데 아래는 학교 간판 자리) */
  TX(c,'🍂 시즌2 · 헛다리짚기 훈련',132,30,17,'#ffe7b8','center');
  TX(c,'v'+APP_VERSION,W/2,H-16,16,'#fff','center','rgba(35,42,69,.85)');
  const p1=clamp(t/2.4,0,1),p2=clamp((t-2.4)/(SP_WALK-2.4),0,1);
  let x,y,s,face;
  if(t<2.4){x=-40+440*p1;y=H-46;s=2.6;face='tired';}
  else{x=400;y=(H-46)+(HOR+4-(H-46))*p2;s=2.6-1.2*p2;face='resolve';}
  if(t<SP_END){
    c.save();c.globalAlpha=t<SP_WALK?1:clamp(1-(t-SP_WALK)/(SP_END-SP_WALK),0,1);
    kid(c,x,y,s,{face,run:t<SP_WALK,ph:t*11});
    c.restore();
  }
  SP_LEAVES.forEach(l=>{   /* 떨어지는 낙엽 */
    const y=((l.off+t*l.sp)%(H+30))-15,x=(l.x+Math.sin(t*1.3+l.ph)*l.sw+t*9)%(W+20)-10;
    spLeaf(c,x,y,l.r,t*1.6+l.ph,l.col);
  });
  if(t>=SP_END){
    const a=.7+.3*Math.sin((t-SP_END)*4.5);
    c.save();c.globalAlpha=clamp((t-SP_END)*3,0,1)*a;
    TX(c,'Press ENTER',W/2,H-90,44,'#fff','center','#232a45');c.restore();
    c.save();c.globalAlpha=clamp((t-SP_END)*3,0,1);TX(c,'(화면을 눌러도 돼요)',W/2,H-48,18,'#fff','center','rgba(35,42,69,.8)');c.restore();
  }
}
function spFrame(now){
  if(!SP.on)return;
  SP.raf=requestAnimationFrame(spFrame);
  const dt=Math.min(.05,(now-SP.last)/1000);SP.last=now;SP.t+=dt;
  try{spDraw(SP.ctx,SP.t);}catch(e){console.error(e);}
}
function showSplash(){
  SP.on=true;SP.t=0;SP.last=performance.now();$('#splash').hidden=false;
  try{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)SP.t=SP_END;}catch(e){}
  SP.raf=requestAnimationFrame(spFrame);
}
function spNext(){
  if(!SP.on)return;
  if(SP.t<SP_END){SP.t=SP_END;return;}   /* 걷는 중에 누르면 바로 Press ENTER 화면으로 */
  SP.on=false;cancelAnimationFrame(SP.raf);$('#splash').hidden=true;sfx('start');
  setTimeout(()=>{try{$('#lgToLogin').focus();}catch(e){}},30);
}
window.addEventListener('keydown',e=>{if(SP.on&&(e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();spNext();}},true);
$('#splash').addEventListener('pointerdown',spNext);

