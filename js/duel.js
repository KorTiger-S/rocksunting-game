'use strict';
/* ---------- 1:1 페널티킥 대결 (backend/schema.sql 의 rk_duel_*) ----------
   피파 온라인 방식: 슈터는 골대 안을 자유롭게 조준하고 파워 게이지를 맞춰 차요. 골키퍼는 다이브 방향을 골라요.
   판정은 전부 서버가 해요. 브라우저는 선택을 보내고, 결과를 받아 애니메이션만 보여줘요.
   골대 좌표: x -1(왼쪽 골포스트)~1(오른쪽), y 0(바닥)~1(크로스바). 밖으로 나가면 빗나가요. */
const DU={code:null,st:null,shown:0,anim:null,open:false,poll:0,raf:0,last:0,left:0,leftAt:0,pickedRound:-1,pickIdx:-1,fail:0,ctx:null,lastMsg:'',msgBase:'',
  aim:{x:0,y:.55},ph:'aim',gt:0,gv:0,sent:null,round:-1,endPlayed:false,lastSec:-1};
const duOk=()=>!!(USER&&!USER.guest&&cloudUrl());
let duBet=0;   /* 새 방을 만들 때 걸 판돈 (0~5,000원) */
const DU_BETMAX=5000;
const duBetMax=()=>Math.floor(Math.min(DU_BETMAX,Math.max(0,S.money))/100)*100;
const DU_ERR={bad_pin:'비밀번호가 맞지 않아요.',locked:'비밀번호를 여러 번 틀려서 잠겼어요. 잠시 후 다시 시도해 주세요.',no_room:'그런 코드의 방이 없어요.',full:'이미 시작한 방이에요.',closed:'이미 끝난 방이에요.',busy:'이미 참여 중인 대결이 있어요. "방 만들기"를 누르면 그 방으로 돌아가요.',no_user:'클라우드에 등록된 ID가 아니에요. 잠시 후 다시 시도해 주세요.',not_member:'이 방의 참가자가 아니에요.',no_money:'소지금이 모자라요.'};
const DU_ZN=['위 왼쪽','위 가운데','위 오른쪽','아래 왼쪽','아래 가운데','아래 오른쪽'];
const DU_SWEET=[.72,.88];   /* 게이지 초록 구간 (서버는 파워 0.8에서 오차가 가장 작아요) */
const DU_RES={goal:'GOAL!',saved:'SAVE!',post:'POST!',miss:'빗나갔다!'};
const duEsc=s=>String(s==null?'':s).replace(/[<>&"]/g,'');
const duX=n=>240+180*n,duY=n=>200-150*n,duNx=x=>(x-240)/180,duNy=y=>(200-y)/150;
function renderDuelCard(){
  const ok=duOk(),mx=duBetMax();
  duBet=clamp(duBet,0,mx);
  $('#duBetV').textContent=duBet?`판돈 ${fmt(duBet)}원`:'판돈 없음';
  $('#duBm').disabled=!ok||duBet<=0;$('#duBp').disabled=!ok||duBet+100>mx;$('#duBb').disabled=!ok||duBet+500>mx;
  $('#duMake').disabled=!ok;$('#duJoin').disabled=!ok;$('#duCode').disabled=!ok;
  $('#duNote').textContent=ok?'':(USER&&USER.guest?'Guest는 대결할 수 없어요. 로그인해 주세요.':'클라우드에 연결되어 있어야 대결할 수 있어요.');
}
const duCall=(a,x)=>api('duel_'+a,Object.assign({id:USER.id,pin:USER.pin,code:DU.code},x));
async function duEnter(action,code){
  if(!duOk())return;
  $('#duMake').disabled=true;$('#duJoin').disabled=true;$('#duNote').textContent='';
  DU.code=code||null;
  let err='';
  try{
    if(dirty){try{await cloudPush();}catch(e){}}   /* 판돈은 서버의 소지금에서 빠지니, 내 최신 소지금을 먼저 올려 둬요 */
    if(action==='join'){
      const pk=await duCall('peek');
      if(!pk.mine){
        if(pk.bet>S.money)throw new Error('no_money');
        const q=pk.bet>0?`${pk.host} 님의 방이에요.
판돈 ${fmt(pk.bet)}원 (이기면 ${fmt(pk.bet*2)}원)이 걸려 있어요.
참가하면 바로 ${fmt(pk.bet)}원이 빠져요. 참가할까요?`:`${pk.host} 님의 방이에요. (판돈 없음) 참가할까요?`;
        if(!confirm(q)){DU.code=null;renderDuelCard();return;}
      }
    }
    duStart(await duCall(action,action==='create'?{bet:duBet}:{}));
  }
  catch(e){DU.code=null;err=DU_ERR[e.message]||'연결에 실패했어요. 잠시 후 다시 시도해 주세요.';}
  renderDuelCard();
  if(err)$('#duNote').textContent=err;
}
$('#duBm').addEventListener('click',()=>{duBet-=100;renderDuelCard();});
$('#duBp').addEventListener('click',()=>{duBet+=100;renderDuelCard();});
$('#duBb').addEventListener('click',()=>{duBet+=500;renderDuelCard();});
$('#duMake').addEventListener('click',()=>duEnter('create'));
$('#duJoin').addEventListener('click',()=>{
  const c=$('#duCode').value.trim().toUpperCase();
  if(!/^[A-Z2-9]{4}$/.test(c)){$('#duNote').textContent='코드는 영문/숫자 4자리예요.';return;}
  duEnter('join',c);
});
$('#duCode').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#duJoin').click();}});
/* 판돈은 서버가 소지금을 직접 바꿔요. 응답에 들어 있는 내 소지금을 그대로 받아 와요. */
function duMoney(m){if(typeof m==='number'&&m!==S.money){S.money=m;save();}}
function duStart(st){
  duMoney(st.money);
  DU.code=st.code;DU.st=st;DU.shown=st.hist.length;DU.anim=null;DU.pickedRound=-1;DU.pickIdx=-1;DU.fail=0;DU.open=true;
  DU.round=-1;DU.sent=null;DU.endPlayed=false;DU.lastSec=-1;sfx('chime');
  DU.left=st.left;DU.leftAt=performance.now();
  $('#duel').hidden=false;
  try{document.activeElement.blur();}catch(e){}   /* Space가 포커스된 버튼을 누르지 않게 */
  if(!DU.ctx)DU.ctx=$('#duCv').getContext('2d');
  cancelAnimationFrame(DU.raf);DU.last=performance.now();DU.raf=requestAnimationFrame(duFrame);
  duRender();duPoll();
}
function duPoll(){
  clearTimeout(DU.poll);if(!DU.open)return;
  DU.poll=setTimeout(async()=>{
    try{duGot(await duCall('state'));DU.fail=0;}catch(e){duErr(e);}
    duPoll();
  },1600);
}
function duGot(st){
  if(!DU.open)return;
  if(DU.st&&st.hist.length<DU.st.hist.length)return;   /* 늦게 도착한 옛 응답은 무시 */
  if(DU.st&&DU.st.status==='waiting'&&st.status==='playing')sfx('whistle');   /* 친구가 들어왔어요 */
  DU.st=st;DU.left=st.left;DU.leftAt=performance.now();duMoney(st.money);duRender();
}
function duErr(e){
  const m=e&&e.message;
  if(m==='no_room'||m==='not_member'||m==='closed'||m==='bad_pin'||m==='locked'||m==='no_user'){toast(DU_ERR[m]||'대결이 끝났어요.');duClose(false);return;}
  if(++DU.fail>=2)$('#duMsg').textContent='연결이 불안정해요. 다시 시도하는 중…';
}
function duClose(leave){
  const code=DU.code,st=DU.st;
  DU.open=false;clearTimeout(DU.poll);cancelAnimationFrame(DU.raf);$('#duel').hidden=true;
  const pendingLeave=!!(leave&&code&&st&&st.status!=='done');
  if(pendingLeave)api('duel_leave',{id:USER.id,pin:USER.pin,code}).then(r=>{duMoney(r.money);renderHub();if(st.bet>0&&st.status==='waiting')toast('판돈을 돌려받았어요.');maybeLoan();}).catch(()=>{});
  DU.code=null;DU.st=null;DU.anim=null;renderHub();if(!pendingLeave)maybeLoan();
}
$('#duLeave').addEventListener('click',()=>{
  const st=DU.st;if(!st)return;
  if(st.status==='playing'&&!confirm(st.bet>0?`지금 나가면 몰수패예요. 판돈 ${fmt(st.bet)}원을 잃어요. 나갈까요?`:'지금 나가면 몰수패예요. 나갈까요?'))return;
  duClose(true);
});
$('#duCopy').addEventListener('click',()=>{
  const c=DU.code||'';
  try{navigator.clipboard.writeText(c).then(()=>toast('코드를 복사했어요.'),()=>toast('코드: '+c));}catch(e){toast('코드: '+c);}
});
const duZ=$('#duZones'),duCv=$('#duCv');
for(let i=0;i<6;i++){const b=document.createElement('button');b.type='button';b.textContent=String(i+1);b.setAttribute('aria-label','다이브: '+DU_ZN[i]);b.addEventListener('click',()=>duPick(i));duZ.appendChild(b);}
/* 지금 내가 할 수 있는 행동: 슈터(kick) 또는 골키퍼(keep). 결과 애니메이션 중이거나 이미 제출했으면 없어요. */
function duCan(role){const st=DU.st;return !!(DU.open&&st&&st.status==='playing'&&!DU.anim&&DU.shown===st.hist.length&&st.role===role&&!st.mine&&DU.pickedRound!==st.round);}
const duCanShoot=()=>duCan('kick'),duCanPick=()=>duCan('keep');
/* 슈터: 1) 조준(마우스/방향키) → 클릭/Space로 확정 2) 게이지가 초록 구간일 때 다시 클릭/Space → 발사 */
function duAct(){
  if(!duCanShoot())return;
  if(DU.ph==='aim'){DU.ph='power';DU.gt=0;DU.gv=0;sfx('tick');duRender();return;}
  if(DU.ph==='power')duShoot(Math.round(DU.gv*1000)/1000);
}
async function duShoot(pw){
  const st=DU.st,a={x:Math.round(DU.aim.x*1000)/1000,y:Math.round(DU.aim.y*1000)/1000};
  DU.pickedRound=st.round;DU.sent={x:a.x,y:a.y,p:pw};duRender();
  try{duGot(await duCall('pick',{round:st.round,ax:a.x,ay:a.y,pw}));DU.fail=0;}
  catch(e){DU.pickedRound=-1;DU.sent=null;DU.ph='aim';duErr(e);duRender();}
}
/* 골키퍼: 다이브할 칸 고르기 */
async function duPick(i){
  if(!duCanPick())return;
  const st=DU.st;DU.pickedRound=st.round;DU.pickIdx=i;duRender();
  try{duGot(await duCall('pick',{round:st.round,pick:i}));DU.fail=0;}
  catch(e){DU.pickedRound=-1;DU.pickIdx=-1;duErr(e);duRender();}
}
function duPos(e){const r=duCv.getBoundingClientRect();return{x:(e.clientX-r.left)*480/r.width,y:(e.clientY-r.top)*300/r.height};}
function duSetAim(e){const p=duPos(e);DU.aim.x=clamp(duNx(p.x),-1.2,1.2);DU.aim.y=clamp(duNy(p.y),0,1.25);}
duCv.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&duCanShoot()&&DU.ph==='aim')duSetAim(e);});
duCv.addEventListener('pointerdown',e=>{if(duCanShoot()&&DU.ph==='aim')duSetAim(e);});
duCv.addEventListener('click',duAct);
window.addEventListener('keydown',e=>{
  if(!DU.open||e.ctrlKey||e.metaKey||e.altKey)return;
  if(/^[1-6]$/.test(e.key)){if(!e.repeat)duPick(+e.key-1);return;}
  if(e.code==='Space'||e.key==='Enter'){if(duCanShoot()){e.preventDefault();if(!e.repeat)duAct();}}
  else if(e.code.startsWith('Arrow')&&duCanShoot())e.preventDefault();
});
function duSide(el,name,me,hist,side,goals){
  const ks=hist.filter(h=>h.k===side).map(h=>h.r==='goal'?'●':'✕');
  while(ks.length<5)ks.push('○');
  el.className='dside'+(me?' me':'');
  el.innerHTML=`<b>${duEsc(name)}${me?' (나)':''}</b><span class="n">${goals}</span><div class="dots" aria-label="${ks.join(' ')}">${ks.join(' ')}</div>`;
}
function duRender(){
  const st=DU.st;if(!st||!DU.open)return;
  const wait=st.status==='waiting';
  $('#duWait').hidden=!wait;$('#duPlay').hidden=wait;
  $('#duCodeBig').textContent=st.code;
  $('#duT').textContent=wait?'상대를 기다리는 중':'1:1 페널티킥 대결';
  $('#duPot').textContent=st.bet>0?(wait?`🪙 판돈 ${fmt(st.bet)}원을 걸었어요. 친구가 들어오면 승자가 ${fmt(st.bet*2)}원을 가져가요. (방을 닫으면 돌려받아요)`:`🪙 판돈 ${fmt(st.bet)}원씩 · 승자가 ${fmt(st.bet*2)}원을 가져가요`):'';
  if(wait){$('#duLeave').textContent='방 닫기';return;}
  if(DU.round!==st.round){DU.round=st.round;DU.ph='aim';DU.gt=0;DU.gv=0;DU.sent=null;}   /* 새 킥이 시작되면 조준부터 */
  if(!DU.anim&&DU.shown<st.hist.length){DU.anim={h:st.hist[DU.shown],t:0};DU.shown++;}
  const hs=st.hist.slice(0,DU.shown);
  let hg=0,gg=0;hs.forEach(h=>{if(h.r==='goal'){if(h.k==='host')hg++;else gg++;}});
  duSide($('#duS0'),st.host,st.me==='host',hs,'host',hg);
  duSide($('#duS1'),st.guest,st.me==='guest',hs,'guest',gg);
  const live=!DU.anim&&DU.shown===st.hist.length;
  const done=live&&st.status==='done';
  $('#duLeave').textContent=done?'닫기':'포기하고 나가기';
  $('#duRound').textContent=done?'경기 종료':DU.shown<10?`${Math.floor(DU.shown/2)+1}번째 킥 / 5`:'서든데스';
  const canK=duCanPick();
  duZ.style.display=st.role==='keep'&&!done?'':'none';   /* 다이브 칸은 골키퍼일 때만. 슈터는 캔버스에서 직접 조준해요 */
  [...duZ.children].forEach((b,i)=>{b.disabled=!canK;b.classList.toggle('sel',DU.pickedRound===st.round&&DU.pickIdx===i&&!DU.anim);});
  duCv.style.cursor=duCanShoot()&&DU.ph==='aim'?'crosshair':'default';
  $('#duTip').hidden=done;
  $('#duTip').textContent=st.role==='kick'?'마우스(또는 방향키)로 조준 → 클릭/Space로 확정 → 게이지가 초록 구간일 때 다시 클릭! 골대 밖은 빗나가요.':'다이브할 방향을 고르세요. 칸을 누르거나 숫자키 1~6 (위쪽 1·2·3, 아래쪽 4·5·6)';
  let msg='';
  if(done){
    const w=st.winner,mine=st.me;
    if(w==='draw')msg='🤝 무승부예요.';
    else if(w===mine)msg=st.reason==='left'?'🏆 상대가 나가서 승리했어요!':'🏆 승리! 축하해요!';
    else msg=st.reason==='left'?'😢 자리를 비워서 패배했어요.':'😢 아쉽게 패배했어요.';
    msg+=`  (${hg} : ${gg})`;
    if(!DU.endPlayed){DU.endPlayed=true;sfx(w==='draw'?'chime':w===mine?'bigwin':'lose');if(st.bet>0&&w===mine)setTimeout(()=>sfx('coin'),800);
      if(w!=='draw'){S.mood=clamp((S.mood==null?50:S.mood)+(w===mine?6:-6),0,100);save();}}   /* 대결도 이기면 기분이 좋아지고 지면 나빠져요 */
    if(st.bet>0)msg+=w==='draw'?`  🪙 판돈 ${fmt(st.bet)}원을 돌려받았어요.`:w===mine?`  💰 +${fmt(st.bet)}원`:`  💸 -${fmt(st.bet)}원`;
  }else if(live){
    if(duCanShoot())msg=DU.ph==='aim'?'🎯 슛할 곳을 조준하세요!':'⚡ 초록 구간에서 클릭!';
    else if(canK)msg='🧤 다이브할 곳을 고르세요!';
    else msg=st.mine||DU.pickedRound===st.round?(st.role==='kick'?'슛! 골키퍼를 기다리는 중…':'선택 완료! 상대를 기다리는 중…'):'잠시만요…';
  }
  DU.msgBase=msg;
  DU.lastMsg=null;duTick();   /* null: 화면 문구를 반드시 다시 그리게 */
}
function duTick(){   /* 남은 시간 표시만 가볍게 갱신 */
  const st=DU.st;if(!st||st.status!=='playing'||DU.anim||DU.shown!==st.hist.length){if(DU.lastMsg!==DU.msgBase){$('#duMsg').textContent=DU.msgBase||'';DU.lastMsg=DU.msgBase;}return;}
  const s=Math.max(0,Math.ceil(DU.left-(performance.now()-DU.leftAt)/1000));
  if(s<=5&&s>0&&s!==DU.lastSec&&(duCanShoot()||duCanPick())){DU.lastSec=s;sfx('tick');}   /* 마지막 5초는 째깍 */
  const t=(DU.msgBase||'')+(s>0?`  (${s}초)`:'');
  if(t!==DU.lastMsg){$('#duMsg').textContent=t;DU.lastMsg=t;}
}
const duZone=i=>({x:duX(((i%3)-1)*.667),y:duY(i<3?.75:.25)});   /* 다이브 칸의 중심 (서버 판정과 같은 좌표) */
const duEase=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
const DU_END=2.4;
function duFrame(now){
  if(!DU.open)return;
  DU.raf=requestAnimationFrame(duFrame);
  const dt=Math.min(.05,(now-DU.last)/1000);DU.last=now;
  if(DU.anim){
    const A=DU.anim;A.t+=dt;
    if(!A.k1&&A.t>=.3){A.k1=true;sfx('kick');}
    if(!A.k2&&A.t>=.85){A.k2=true;const r=A.h.r;
      if(r==='goal'){sfx('net');sfx('crowd');}else if(r==='saved'){sfx('thud');setTimeout(()=>sfx('aww'),200);}
      else if(r==='post')sfx('ping');else{sfx('whoosh');setTimeout(()=>sfx('aww'),250);}}
    if(A.t>=DU_END){DU.anim=null;duRender();}
  }
  else if(duCanShoot()){
    if(DU.ph==='aim'){   /* 방향키 조준 */
      const dx=(held.ArrowRight?1:0)-(held.ArrowLeft?1:0),dy=(held.ArrowUp?1:0)-(held.ArrowDown?1:0);
      if(dx||dy){DU.aim.x=clamp(DU.aim.x+dx*dt*1.1,-1.2,1.2);DU.aim.y=clamp(DU.aim.y+dy*dt*.9,0,1.25);}
    }else if(DU.ph==='power'){const pv=DU.gv;DU.gt+=dt;const x=(DU.gt*.9)%2;DU.gv=x<1?x:2-x;if(Math.floor(DU.gv*12)!==Math.floor(pv*12))sfx('gauge',DU.gv);}   /* 0→1→0 왕복 */
  }
  try{duDraw(DU.ctx,DU.anim);}catch(e){console.error(e);}
  duTick();
}
function duPlayer(c,x,y,swing){   /* 슈터 (발끝 기준 위치) */
  c.save();c.translate(x,y);
  c.fillStyle='#232a45';c.fillRect(-8,-14,7,14);
  c.fillStyle='#e2334d';c.fillRect(-9,-38,18,25);
  c.fillStyle='#f1c9a5';c.beginPath();c.arc(0,-46,9,0,7);c.fill();c.strokeStyle='#232a45';c.lineWidth=2;c.stroke();
  c.save();c.translate(3,-14);c.rotate(-.6+1.5*swing);c.fillStyle='#232a45';c.fillRect(-4,0,8,16);c.restore();
  c.restore();
}
function duDraw(c,a){
  const st=DU.st;
  c.fillStyle='#5aa864';c.fillRect(0,0,480,300);
  c.fillStyle='rgba(255,255,255,.07)';for(let i=0;i<8;i++)if(i%2)c.fillRect(0,i*38,480,38);
  c.fillStyle='#2b4a3a';c.fillRect(60,50,360,150);   /* 골대 안쪽 */
  c.strokeStyle='rgba(255,255,255,.3)';c.lineWidth=1;c.beginPath();
  for(let x=60;x<=420;x+=20){c.moveTo(x,50);c.lineTo(x,200);}for(let y=50;y<=200;y+=20){c.moveTo(60,y);c.lineTo(420,y);}c.stroke();
  c.strokeStyle='#fff';c.lineWidth=6;c.lineJoin='round';c.beginPath();c.moveTo(60,200);c.lineTo(60,50);c.lineTo(420,50);c.lineTo(420,200);c.stroke();
  c.strokeStyle='rgba(255,255,255,.8)';c.lineWidth=3;c.beginPath();c.moveTo(0,200);c.lineTo(480,200);c.stroke();
  let kx=240,ky=170,rot=0,bx=240,by=265,br=11,bal=1,txt='',col='#fff',swing=0,flash=0;
  if(a){
    const h=a.h,t=a.t,gx=duX(h.fx),gy=duY(h.fy);
    const tz=h.r==='saved'?{x:gx,y:gy}:duZone(h.gp);   /* 막을 땐 공이 있는 곳까지 몸을 던지고, 아니면 고른 칸으로 */
    swing=duEase(t/.3);
    const kt=duEase((t-.3)/.45);kx=240+(tz.x-240)*kt;ky=170+(tz.y-170)*kt;rot=(tz.x-240)/120*.9*kt;
    const bt=duEase((t-.35)/.5);bx=240+(gx-240)*bt;by=265+(gy-265)*bt;br=11-4*bt;
    if(t>.85){
      const d=t-.85;
      if(h.r==='saved'){by+=d*d*90;bx+=d*(tz.x>240?-30:tz.x<240?30:0);bal=Math.max(0,1-d*.6);}
      else if(h.r==='post'){bx+=(gx>=240?-1:1)*d*70;by+=d*d*60;flash=Math.max(0,1-d*3);}
      else if(h.r==='miss'){if(Math.abs(h.fx)>1.06)bx+=Math.sign(h.fx)*d*140;else by-=d*120;br=Math.max(3,br-d*4);}
    }
    if(t>.95){txt=DU_RES[h.r]||'';col=h.r==='goal'?'#ffd84a':h.r==='saved'?'#7fd6ff':h.r==='post'?'#ffb35c':'#ff8a8a';}
  }
  duPlayer(c,212,292,a?swing:0);
  /* 골키퍼 */
  c.save();c.translate(kx,ky);c.rotate(rot);
  c.fillStyle='#e8a91c';c.fillRect(-14,-18,28,44);c.fillStyle='#232a45';c.fillRect(-11,26,9,14);c.fillRect(2,26,9,14);
  c.strokeStyle='#e8a91c';c.lineWidth=7;c.lineCap='round';c.beginPath();c.moveTo(-14,-12);c.lineTo(-28,-30);c.moveTo(14,-12);c.lineTo(28,-30);c.stroke();
  c.fillStyle='#fff';c.beginPath();c.arc(-28,-32,6,0,7);c.arc(28,-32,6,0,7);c.fill();
  c.fillStyle='#f1c9a5';c.beginPath();c.arc(0,-30,12,0,7);c.fill();c.strokeStyle='#232a45';c.lineWidth=2;c.stroke();
  c.restore();
  if(flash>0){c.strokeStyle=`rgba(255,255,255,${flash})`;c.lineWidth=10;c.beginPath();c.moveTo(60,200);c.lineTo(60,50);c.lineTo(420,50);c.lineTo(420,200);c.stroke();}
  /* 공 */
  c.globalAlpha=bal;c.fillStyle='#fff';c.strokeStyle='#232a45';c.lineWidth=2;c.beginPath();c.arc(bx,by,br,0,7);c.fill();c.stroke();
  c.fillStyle='#232a45';c.beginPath();c.arc(bx,by,br*.35,0,7);c.fill();c.globalAlpha=1;
  /* 슈터 조준선 + 파워 게이지 */
  const shoot=duCanShoot();
  if(shoot||(!a&&st&&st.role==='kick'&&st.status==='playing'&&DU.sent)){
    const p=shoot?DU.aim:DU.sent,rx=duX(p.x),ry=duY(p.y),out=Math.abs(p.x)>1||p.y>1;
    c.strokeStyle=shoot?(out?'#ff6b6b':'#ffd84a'):'rgba(255,255,255,.75)';c.lineWidth=2.5;
    c.beginPath();c.arc(rx,ry,13,0,7);c.moveTo(rx-20,ry);c.lineTo(rx-6,ry);c.moveTo(rx+6,ry);c.lineTo(rx+20,ry);c.moveTo(rx,ry-20);c.lineTo(rx,ry-6);c.moveTo(rx,ry+6);c.lineTo(rx,ry+20);c.stroke();
    const gx0=452,gy0=60,gh=180,v=shoot?(DU.ph==='power'?DU.gv:0):DU.sent.p;
    c.fillStyle='rgba(0,0,0,.5)';c.fillRect(gx0-3,gy0-3,20,gh+6);
    c.fillStyle='rgba(60,200,110,.85)';c.fillRect(gx0,gy0+gh*(1-DU_SWEET[1]),14,gh*(DU_SWEET[1]-DU_SWEET[0]));
    if(v>0){c.fillStyle=v>=DU_SWEET[0]&&v<=DU_SWEET[1]?'#ffd84a':'#e2334d';c.fillRect(gx0,gy0+gh*(1-v),14,gh*v);}
    c.fillStyle='#fff';c.fillRect(gx0-6,gy0+gh*(1-v)-1.5,26,3);
    c.font="12px 'Noto Sans KR',sans-serif";c.textAlign='center';c.textBaseline='alphabetic';c.fillStyle='#fff';c.fillText('POWER',gx0+7,gy0-8);
  }
  if(txt){
    c.font="34px 'Black Han Sans','Noto Sans KR',sans-serif";c.textAlign='center';c.textBaseline='middle';
    c.lineWidth=6;c.strokeStyle='#232a45';c.strokeText(txt,240,262);c.fillStyle=col;c.fillText(txt,240,262);
  }
}
