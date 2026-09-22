'use strict';
/* ---------- 스플래시: 롹순팅 등교 애니메이션 + Press Enter ---------- */
const SP={on:false,t:0,raf:0,last:0,ctx:$('#spCv').getContext('2d')};
const SP_WALK=4.6,SP_END=5.2;   /* 걷기 끝(초), 문으로 들어간 뒤 Press Enter가 나오는 시점(초) */
function spDraw(c,t){
  skyField(c);
  c.fillStyle='#6bb56f';c.fillRect(0,HOR,W,46);
  c.fillStyle='#d8d0bd';c.fillRect(0,HOR+46,W,H-HOR-46);
  c.fillStyle='rgba(0,0,0,.08)';c.fillRect(0,HOR+46,W,4);
  c.fillStyle='#e6dfcd';c.beginPath();c.moveTo(372,HOR);c.lineTo(428,HOR);c.lineTo(600,H);c.lineTo(200,H);c.closePath();c.fill();
  c.fillStyle='#6d1f31';rr(c,372,HOR-58,56,58,4);c.fill();
  c.fillStyle='#e8a91c';c.beginPath();c.arc(418,HOR-28,3,0,7);c.fill();
  c.fillStyle='#b5a891';c.fillRect(366,HOR,68,6);
  TX(c,'롹순팅 키우기',W/2,38,50,'#fff','center','#6d1f31');
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

