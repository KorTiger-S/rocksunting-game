'use strict';
/* ---------- 물리 ---------- */
let K=null,M=null;
function integrate(st,dt,s,ys,wind){
  const g=9.8,vh=Math.hypot(st.vx,st.vz)||1;
  /* 공의 왼쪽을 차면(s<0) 궤적이 먼저 왼쪽으로 부풀었다가 조준한 곳으로 오른쪽으로 휘어져 들어가요(반대도 마찬가지).
     이것도 마그누스 힘이라 공 속도(vh)에 비례해요: 세게 찬 커브슛일수록 더 크게 휘고, 살짝 스친 슛은 덜 휘어요 */
  const rx=-st.vz/vh,rz=st.vx/vh,al=s*.5*vh;
  /* 마그누스 효과: 공 윗부분을 차면(ys>0, 톱스핀) 진행 방향으로 아래를 누르는 힘이 붙어 급강하하고,
     아랫부분을 차면(ys<0, 백스핀) 반대로 띄우는 힘이 붙어 붕 떠서 날아가요. 실제 회전-속도 마그누스 힘처럼
     공 속도(vh)에 비례해서, 세게 찰수록·회전을 많이 줄수록 이 효과가 더 뚜렷해져요 */
  const magnus=-ys*.15*vh;
  st.vx+=(rx*al+wind*K.right.x)*dt;st.vz+=(rz*al+wind*K.right.z)*dt;st.vy+=(magnus-g)*dt;
  st.x+=st.vx*dt;st.y+=st.vy*dt;st.z+=st.vz*dt;
  if(st.y<.11&&st.vy<0){st.y=.11;st.vy=-st.vy*.5;st.vx*=.8;st.vz*=.8;}
}
function flight(ball,v,s,ys,wind,wall,full){
  const st={x:ball.x,y:ball.y,z:ball.z,vx:v.vx,vy:v.vy,vz:v.vz};
  const path=full?[{t:0,x:st.x,y:st.y,z:st.z}]:null;
  const dt=1/120;let t=0,c=null,wh=null;
  for(let i=0;i<420;i++){
    const px=st.x,py=st.y,pz=st.z;
    integrate(st,dt,s,ys,wind);t+=dt;
    if(path)path.push({t,x:st.x,y:st.y,z:st.z});
    if(wall&&!wh){
      const sp=(px-ball.x)*K.dir.x+(pz-ball.z)*K.dir.z,sn=(st.x-ball.x)*K.dir.x+(st.z-ball.z)*K.dir.z;
      if(sp<9.15&&sn>=9.15){
        const a=(9.15-sp)/(sn-sp),yy=py+(st.y-py)*a;
        const lx=((px+(st.x-px)*a)-wall.cx)*K.right.x+((pz+(st.z-pz)*a)-wall.cz)*K.right.z;
        const tt=t-dt+dt*a;
        if(Math.abs(lx)<wall.half+.11&&yy<wall.h(tt)){wh={t:tt,lx,y:yy};break;}
      }
    }
    if(pz<0&&st.z>=0){const a=(0-pz)/(st.z-pz);c={t:t-dt+dt*a,x:px+(st.x-px)*a,y:py+(st.y-py)*a};break;}
    if(Math.abs(st.vx)+Math.abs(st.vz)<.5&&st.y<.2)break;
  }
  return{path,c,wh,st,t};
}
function solve(ball,tx,ty,s,ys){
  const g=9.8+ys*.15*26;   /* integrate()의 마그누스 항(vh≈26 기준)에 맞춘 초기 추정용 유효 중력이에요 */
  let gx=tx,gy=ty,v=null;
  for(let i=0;i<8;i++){
    const dx=gx-ball.x,dz=-ball.z,L=Math.hypot(dx,dz),T=L/26;
    v={vx:dx/L*26,vz:dz/L*26,vy:(gy-ball.y)/T+.5*g*T};
    const r=flight(ball,v,s,ys,0,null,false);
    if(!r.c)break;
    gx+=(tx-r.c.x)*.9;gy+=(ty-r.c.y)*.9;
  }
  return v;
}
/* 컨디션(0~4, 보통=2)이 좋을수록 골키퍼가 덜 정확하고 느리게 반응하고, 바람이 약해지고, 조준이 덜 흔들리고,
   파워 게이지의 초록 구간(정확한 타이밍)이 넓어져요. 대결(duel)은 서버 판정이라 영향 없어요. */
function applyCondition(k){
  const cd=(S.cond==null?2:S.cond)-2;
  k.kerr=Math.max(.5,(k.kerr||1)+cd*.12);
  k.kread=clamp((k.kread||.25)-cd*.04,.05,.6);
  k.rk=Math.max(.05,(k.rk||.25)+cd*.02);
  k.vk=Math.max(2,(k.vk||4)-cd*.15);
  k.wind=(k.wind||0)*(1-cd*.18);
  k.sweetHalf=clamp(.05+cd*.015,.02,.09);
  k.swAdd=Math.max(0,-cd*2.5);
}
const BET_LO=1000,BET_HI=3000;   /* 이 도전(vs 주스)의 판돈 범위. 최소면 골키퍼가 아예 안 움직이고, 최대면 평소보다 더 날렵해져요 */
function applyBet(k,bet){
  const t=clamp(((bet==null?BET_LO:bet)-BET_LO)/(BET_HI-BET_LO),0,1);
  k.vk=(k.vk||4)*t*1.3;
  k.rk=Math.max(.05,(k.rk||.25)*(1.5-.8*t));
}
/* 근력: 슛 파워(공 속도) 배율(0.8~1.2). 체력: 킥 제한시간 배율(0.8~1.2). 둘 다 0~100%를 그대로 선형 매핑해요. */
function applyStats(k){
  const str=clamp(S.str==null?25:S.str,0,100),stam=clamp(S.stam==null?25:S.stam,0,100);
  k.strMul=.8+str/100*.4;
  k.stamMul=.8+stam/100*.4;
}
function setupKick(i,ko){
  const k=ko||M.kicks[i];K=Object.assign({},k,{i});
  applyCondition(K);   /* 컨디션이 좋을수록 골키퍼(주스)가 살짝 무뎌져요 */
  applyBet(K,M&&M.bet);   /* 판돈이 클수록 골키퍼가 날렵해지고, 최소 판돈이면 아예 움직이지 않아요 */
  applyStats(K);   /* 근력이 높을수록 슛이 강해지고, 체력이 높을수록 킥 제한시간이 늘어나요 */
  K.ball={x:k.bx,y:.11,z:k.bz};
  const L=Math.hypot(k.bx,k.bz);K.L=L;
  K.dir={x:-k.bx/L,z:-k.bz/L};K.right={x:K.dir.z,z:-K.dir.x};
  K.cam={x:k.bx-K.dir.x*5.5,y:1.05,z:k.bz-K.dir.z*5.5};
  K.wallC={x:k.bx+K.dir.x*9.15,z:k.bz+K.dir.z*9.15};
  K.limit=(i===4?8:12)*K.stamMul;K.timer=K.limit;K.lastTick=99;
  K.ph='aim';K.t=0;K.pt=0;K.tip=k.tip;K.introT=0;
  if(k.pen){const g=M.goals||0;K.tip=g===2?'이 킥으로 승패가 갈린다!':g>=3?(g===3?'이미 승리! 넣으면 완승 보너스!':'이미 완승! 마지막 자존심 킥!'):'승리는 어렵지만… 끝까지 차 보자!';K.introT=2.0;}
  const p=proj(0,1.2,0);K.cur={x:p.sx,y:p.sy};K.sw={x:0,y:0};
  K.spin={x:0,y:0};K.p=0;K.armed=false;K.charging=false;K.s=0;K.ys=0;K.aim={tx:0,ty:1.2};
  K.react=[];K.face='resolve';K.flash=0;K.prevKey='';K.prevV=null;
  K.celeb=-1;K.fw=[];K.conf=[];K.fwT=0;K.emerg=false;K.shake=0;K.biteDone=false;
}
function proj(x,y,z){
  const dx=x-K.cam.x,dz=z-K.cam.z,f=dx*K.dir.x+dz*K.dir.z,r=dx*K.right.x+dz*K.right.z;
  return{sx:400+r/f*F,sy:HOR+(K.cam.y-y)/f*F,f};
}
function unproject(sx,sy){
  const u=(sx-400)/F,v=(HOR-sy)/F;
  const dxh=K.dir.x+u*K.right.x;let dzh=K.dir.z+u*K.right.z;if(dzh<.03)dzh=.03;
  const t=(0-K.cam.z)/dzh;
  return{x:K.cam.x+t*dxh,y:K.cam.y+t*v};
}
const wallObj=()=>K.wall?{cx:K.wallC.x,cz:K.wallC.z,half:K.wall*.27,h:t=>1.70+(K.jump?.30*Math.sin(Math.PI*clamp((t-.14)/.6,0,1)):0)}:null;
function sweetHalf(){return K&&K.sweetHalf!=null?K.sweetHalf:.05;}

/* ---------- 컷신 ---------- */
let C=null;
function playCut(cut,cb){C=cut;C.i=0;C.t=0;C.cb=cb;C.parts=[];mode='cut';$('#skip').hidden=false;$('#gCtrl').textContent='Space/클릭: 다음 대사';}
function endCut(){const cb=C.cb;C=null;$('#skip').hidden=true;cb&&cb();}
function updateCut(dt){
  C.t+=dt;
  if(pressed.SkipCut){endCut();return;}
  if(C.confetti&&Math.random()<.5)C.parts.push({x:rand(0,W),y:-10,vx:rand(-30,30),vy:rand(80,160),c:['#e2334d','#e8a91c','#2f8f5b','#3b7de0'][Math.floor(rand(0,4))],a:rand(0,6)});
  C.parts.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.a+=dt*6;});C.parts=C.parts.filter(p=>p.y<H+10);
  const L=C.lines[C.i],full=L.text.length;
  const ci=Math.min(full,Math.floor(C.t*40));   /* 글자가 나올 때마다 살짝 소리 (말하는 사람마다 높이가 달라요) */
  if(Math.floor(ci/3)!==Math.floor((C.lc||0)/3)&&ci<full&&L.text[ci]!==' ')sfx('blip',360+(((L.who||'').charCodeAt(0)||0)*7)%180);
  C.lc=ci;
  if(pressed.Space||pressed.Enter||mouse.click){
    if(C.t*40<full)C.t=full/40+.01;
    else{sfx('tick');C.i++;C.t=0;if(C.i>=C.lines.length){endCut();return;}}
  }
}
function skyField(c){
  const g=c.createLinearGradient(0,0,0,250);g.addColorStop(0,'#8fd0f0');g.addColorStop(1,'#dff3fb');c.fillStyle=g;c.fillRect(0,0,W,250);
  c.fillStyle='rgba(255,255,255,.85)';[[120,60,60],[420,90,80],[660,50,55]].forEach(a=>{c.beginPath();c.ellipse(a[0],a[1],a[2],a[2]*.35,0,0,7);c.fill();});
  building(c,0);
}
function building(c,off){
  c.fillStyle='#cbbfa9';c.fillRect(off-100,HOR-100,1000,100);
  c.fillStyle='#b5a891';c.fillRect(off-100,HOR-100,1000,8);
  for(let r=0;r<3;r++)for(let i=0;i<14;i++){c.fillStyle='#9fc9e0';c.fillRect(off-80+i*68,HOR-88+r*28,40,18);}
  c.fillStyle='#6d1f31';rr(c,off+310,HOR-135,180,32,6);c.fill();TX(c,'머대부속 고등학교',off+400,HOR-119,16,'#f4f6ef','center');
  c.fillStyle='#4f9a56';[[off+20,HOR+2],[off+140,HOR-4],[off+700,HOR],[off+820,HOR-6]].forEach(a=>{c.beginPath();c.arc(a[0],a[1]-18,26,0,7);c.fill();c.fillStyle='#7a5a3a';c.fillRect(a[0]-3,a[1]-4,6,16);c.fillStyle='#4f9a56';});
}
function bgHall(c){
  c.fillStyle='#dfe6da';c.fillRect(0,0,W,260);
  [60,300,540].forEach(x=>{c.fillStyle='#a9d6ee';rr(c,x,40,200,120,6);c.fill();c.strokeStyle='#8a6a43';c.lineWidth=6;c.stroke();c.beginPath();c.moveTo(x+100,40);c.lineTo(x+100,160);c.moveTo(x,100);c.lineTo(x+200,100);c.stroke();});
  c.fillStyle='#b9c4b3';c.fillRect(0,236,W,24);
  c.fillStyle='#c9a26b';c.fillRect(0,260,W,H-260);
  c.strokeStyle='rgba(0,0,0,.08)';c.lineWidth=2;for(let x=0;x<W;x+=90){c.beginPath();c.moveTo(x,260);c.lineTo(x-30,H);c.stroke();}
}
function bgField(c){
  skyField(c);
  const g=c.createLinearGradient(0,HOR,0,H);g.addColorStop(0,'#6bb56f');g.addColorStop(1,'#3f8f4e');c.fillStyle=g;c.fillRect(0,HOR,W,H-HOR);
  c.strokeStyle='rgba(255,255,255,.8)';c.lineWidth=3;c.strokeRect(630,HOR+10,130,44);
  c.beginPath();c.moveTo(0,HOR+70);c.lineTo(W,HOR+70);c.stroke();
}
function bgCanteen(c){
  c.fillStyle='#f3e6d0';c.fillRect(0,0,W,300);c.fillStyle='#c9a26b';c.fillRect(0,300,W,H-300);
  for(let i=0;i<10;i++){c.fillStyle=i%2?'#e2334d':'#fff';c.fillRect(i*80,30,80,46);}
  c.fillStyle='#6d1f31';rr(c,320,84,160,36,6);c.fill();TX(c,'매점',400,102,24,'#f4f6ef','center');
  c.fillStyle='#8a6034';rr(c,60,196,680,26,4);c.fill();c.fillStyle='#a9784a';c.fillRect(60,220,680,90);
  [[120,'#d9a441'],[200,'#c98a30'],[280,'#e8c9a0'],[360,'#d9a441'],[440,'#f2d0d8'],[520,'#c98a30']].forEach(a=>{c.fillStyle=a[1];c.beginPath();c.ellipse(a[0]+40,190,28,14,0,0,7);c.fill();});
  c.fillStyle='#232a45';rr(c,600,120,110,60,6);c.fill();TX(c,'크림빵 900원',655,150,15,'#f4f6ef','center');
}
function drawCut(c){
  if(C.bg==='hall')bgHall(c);else if(C.bg==='field')bgField(c);else bgCanteen(c);
  const L=C.lines[C.i];
  C.chars.forEach(ch=>{
    const o=CH[ch.id]||{},sp=L.who===ch.id;
    const bob=sp?Math.abs(Math.sin(C.t*10))*3:Math.sin(C.t*2+ch.x)*1.2;
    const opt=Object.assign({},o,{flip:ch.flip,arms:ch.arms});
    if(ch.id==='rock')opt.face=sp&&L.face?L.face:(ch.face||'base');
    kid(c,ch.x,ch.y-bob-(ch.lift||0),ch.s,opt);
    TX(c,o.name||'',ch.x,ch.y-bob-(ch.lift||0)-76*ch.s,Math.max(13,Math.round(9*ch.s)),'#fff','center','rgba(0,0,0,.6)');
    if(ch.item==='bread'){c.fillStyle='#d9a441';c.beginPath();c.ellipse(ch.x+26*ch.s,ch.y-30*ch.s,16,9,-.3,0,7);c.fill();c.strokeStyle='#8a5a1f';c.lineWidth=2;c.stroke();}
  });
  C.parts.forEach(p=>{c.save();c.translate(p.x,p.y);c.rotate(p.a);c.fillStyle=p.c;c.fillRect(-4,-2,8,4);c.restore();});
  c.fillStyle='rgba(20,24,44,.93)';rr(c,20,352,760,112,14);c.fill();c.strokeStyle='#f4f6ef';c.lineWidth=2;c.stroke();
  const who=L.who&&CH[L.who]?CH[L.who].name:'';
  if(who){c.fillStyle='#e2334d';rr(c,36,336,110,32,8);c.fill();TX(c,who,91,352,18,'#fff','center');}
  const px=84;
  if(L.who==='rock')faceImg(c,L.face||'base',px,410,40);
  else if(L.who)bigHead(c,px,410,38,CH[L.who]);
  else{c.fillStyle='#8a6a43';c.beginPath();c.arc(px,410,34,0,7);c.fill();TX(c,'…',px,410,32,'#fff','center');}
  c.font='20px "Noto Sans KR",sans-serif';c.textAlign='left';c.textBaseline='middle';c.fillStyle='#f4f6ef';
  const shown=L.text.slice(0,Math.floor(C.t*40));
  wrapText(c,shown,610).slice(0,3).forEach((ln,i)=>c.fillText(ln,140,385+i*28));
  if(C.t*40>=L.text.length&&Math.floor(C.t*2)%2===0)TX(c,'▶',750,446,18,'#e8c13a','center');
}
const pick=a=>a[Math.floor(Math.random()*a.length)];
const RK=(text,face)=>({who:'rock',face:face||'angry',text});
const INTRO_A=[
 bet=>({bg:'hall',chars:[{id:'rock',x:200,y:340,s:2.5},{id:'주스',x:560,y:340,s:2.5,arms:'cross'},{id:'씨붕',x:700,y:318,s:1.7},{id:'머호',x:80,y:318,s:1.7,flip:true}],lines:[
  {who:'주스',text:'롹순팅. 쉬는 시간에 킥 다섯 번 어때? 프리킥 네 번에 마지막은 페널티킥이다. 세 골 넣으면 네 승! 난 한 손가락만 써도 막아.'},
  {who:'씨붕',text:'야, 쫄았냐? 인마 그럴수록 세게 걸어야지! …아니, 딱히 걱정돼서 하는 말 아니거든.'},
  {who:'머호',text:'세상은 어차피 다 5할이야! 이길 수도 질 수도 있지~'},
  RK(`…롹. (판돈 ${fmt(bet)}원)`),
  {who:'주스',text:`${fmt(bet)}원이라. 좋아. 지면 깨물어버린다!`}]}),
 bet=>({bg:'hall',chars:[{id:'rock',x:190,y:340,s:2.5},{id:'주스',x:560,y:340,s:2.5,arms:'cross'},{id:'주멘',x:690,y:318,s:1.7},{id:'히통',x:80,y:318,s:1.7,flip:true}],lines:[
  {who:'주스',text:'롹순팅, 오늘 킥 한 판 하자. 한 손가락만 써서 막아 줄게. 깨물어버린다!'},
  {who:'주멘',text:'이 내기, 오늘 일정표에 이미 있었어. 전부 계획대로야.'},
  {who:'히통',text:'판돈 없으면 빌려줄게. 이자는 10%.'},
  RK(`…롹. (판돈 ${fmt(bet)}원)`),
  {who:'주스',text:`${fmt(bet)}원 접수. 후회하지 마라.`}]}),
 bet=>({bg:'hall',chars:[{id:'rock',x:190,y:340,s:2.5},{id:'주스',x:560,y:340,s:2.5,arms:'cross'},{id:'겨맘',x:690,y:318,s:1.7},{id:'ㅈㄱ',x:80,y:318,s:1.7,flip:true}],lines:[
  {who:'겨맘',text:'자세 봐봐, 내가 어제 알려준 킥 폼 그대로네? 다치지 말고 화이팅!'},
  {who:'주스',text:'축구는 내 자존심이야. 세 골이면 네 승. 한 손가락이면 충분하지만.'},
  {who:'ㅈㄱ',text:'…이건 파이리급 승부야.'},
  RK(`…롹. (판돈 ${fmt(bet)}원)`),
  {who:'주스',text:`${fmt(bet)}원. 좋아. 깨물어버린다!`}]}),
 bet=>({bg:'hall',chars:[{id:'rock',x:190,y:340,s:2.5},{id:'주스',x:560,y:340,s:2.5,arms:'cross'},{id:'현숭',x:690,y:318,s:1.7},{id:'호우',x:80,y:318,s:1.7,flip:true}],lines:[
  {who:'현숭',text:'진지하게 계산해봤는데, 5킥 중 3골이면 승리, 4골이면 완승이야. 근거는… 딱히 없어.'},
  {who:'호우',text:'킥도 노래처럼 박자가 중요해~ 골대가 골 때리게 만들어 봐, 응?'},
  {who:'주스',text:'설명 끝났으면 시작하자. 난 한 손가락이면 돼. 깨물어버린다!'},
  RK(`…롹. (판돈 ${fmt(bet)}원)`),
  {who:'주스',text:`${fmt(bet)}원 확인. 골대는 내가 지킨다.`}]})
];
const INTRO_B=[
 ()=>({bg:'field',chars:[{id:'rock',x:180,y:350,s:2.4,face:'resolve'},{id:'주스',x:660,y:300,s:1.6},{id:'겨맘',x:330,y:312,s:1.6},{id:'히통',x:470,y:318,s:1.6},{id:'주멘',x:560,y:312,s:1.5}],lines:[
  {who:'',text:'땡— 쉬는 시간 10분. 운동장으로 애들이 우르르 모여든다.'},
  {who:'겨맘',text:'허리 딱 세우고, 차는 발 무릎 방향만 신경 써! 그럼 무조건 들어가.'},
  {who:'히통',text:'지면 빌려줄게. 이자는 10%.'},
  {who:'주멘',text:'벽 위치도, 바람 방향도 다 계산해 뒀어. 전부 계획대로야.'},
  {who:'',text:'멀리서 ㅈㄱ가 포켓몬 카드를 만지작거리며 이쪽을 지켜보고 있다.'},
  {who:'주스',text:'벽은 우룡이랑 룡갈이 선다. 시작하자. 깨물어버린다!'}]}),
 ()=>({bg:'field',chars:[{id:'rock',x:180,y:350,s:2.4,face:'resolve'},{id:'주스',x:660,y:300,s:1.6},{id:'씨붕',x:330,y:312,s:1.6},{id:'우룡',x:450,y:318,s:1.6},{id:'룡갈',x:540,y:312,s:1.6},{id:'머호',x:250,y:300,s:1.4}],lines:[
  {who:'',text:'운동장 한가운데에 공이 놓였다. 구경꾼이 점점 늘어난다.'},
  {who:'씨붕',text:'인마, 떨지 말고 차. …아니 잘하라고 하는 소리지 딴 뜻 없어.'},
  {who:'머호',text:'세상은 어차피 다 5할이야. 부담 갖지 마~'},
  {who:'우룡',text:'이 벽 사업, 수익률 계산 끝났다. 우리가 막는다!'},
  {who:'룡갈',text:'오늘 벽 컨디션 최고다. 뚫어보시든가, 앙 기모띠!'},
  {who:'주스',text:'시작하자. 한 손가락이면 충분해.'}]}),
 ()=>({bg:'field',chars:[{id:'rock',x:180,y:350,s:2.4,face:'resolve'},{id:'주스',x:660,y:300,s:1.6},{id:'현숭',x:330,y:312,s:1.6},{id:'호우',x:450,y:318,s:1.6},{id:'겨맘',x:550,y:312,s:1.6}],lines:[
  {who:'',text:'땡— 종이 울리자 운동장이 시끌벅적해졌다.'},
  {who:'현숭',text:'진지하게 말하는데, 오늘 구름이 양 세 마리 모양이라 승률이 높아.'},
  {who:'호우',text:'긴장되면 노래를 불러~ 골대야 너 T야 F야, 왜 그렇게 냉정해!'},
  {who:'겨맘',text:'마지막 킥이지? 이럴 때일수록 호흡! 내가 국대급으로 알려줄게.'},
  {who:'',text:'마지막 킥은 페널티 스폿에서 찬다. 운명의 한 방이다.'},
  {who:'주스',text:'준비됐지? 깨물어버린다!'}]}),
 ()=>({bg:'field',chars:[{id:'rock',x:180,y:350,s:2.4,face:'resolve'},{id:'주스',x:660,y:300,s:1.6},{id:'ㅈㄱ',x:330,y:312,s:1.6},{id:'히통',x:450,y:318,s:1.6},{id:'주멘',x:550,y:312,s:1.6}],lines:[
  {who:'',text:'구경꾼들이 운동장 가장자리에 빙 둘러섰다.'},
  {who:'ㅈㄱ',text:'…이 경기, 전설 등급이야. (파이리 카드를 꺼낸다)'},
  {who:'히통',text:'돈이 모자라면 내 창구로 와. 이자는 10%.'},
  {who:'주멘',text:'A안, B안, C안 다 준비했어. 전부 계획대로야.'},
  {who:'주스',text:'시작하자! 한 손가락이면 돼.'}]})
];
const payLine=(big,bet,bonus)=>big?`…인정. 한 손가락으론 무리였네. 자존심 값으로 ${fmt(bonus)}원 더 얹어 줄게.`:`…한 손가락만 썼으면 막았는데! ${fmt(bet)}원, 가져가. 깨물어버린다!`;
const WIN_CUTS=[
 (big,bet,bonus)=>({bg:'field',confetti:true,chars:[{id:'rock',x:400,y:345,s:2.6,face:'excited',arms:'up',lift:22},{id:'주스',x:640,y:340,s:2.2,arms:'cross'},{id:'주멘',x:210,y:330,s:1.9,arms:'up'},{id:'씨붕',x:300,y:322,s:1.7,arms:'up'},{id:'겨맘',x:520,y:322,s:1.7,arms:'up'}],lines:[
  {who:'주멘',text:'롹순팅이 이기는 것까지 전부 계획대로였어. …아마도.'},
  {who:'겨맘',text:'거봐, 내가 알려준 자세 그대로 넣었잖아! 오늘 저녁은 내가 쏜다!'},
  {who:'주스',text:payLine(big,bet,bonus)}]}),
 (big,bet,bonus)=>({bg:'field',confetti:true,chars:[{id:'rock',x:400,y:345,s:2.6,face:'excited',arms:'up',lift:22},{id:'주스',x:640,y:340,s:2.2,arms:'cross'},{id:'씨붕',x:210,y:330,s:1.9,arms:'up'},{id:'머호',x:300,y:322,s:1.7,arms:'up'},{id:'히통',x:520,y:322,s:1.7}],lines:[
  {who:'씨붕',text:'거봐, 내가 될 줄 알았다니까! …아니, 몰랐어. 그냥 잘했다고, 인마.'},
  {who:'머호',text:'세상은 어차피 다 5할인데, 오늘은 롹순팅 쪽이 컸네!'},
  {who:'히통',text:'이자 없이 축하해 줄게. 오늘만이야.'},
  {who:'주스',text:payLine(big,bet,bonus)}]}),
 (big,bet,bonus)=>({bg:'field',confetti:true,chars:[{id:'rock',x:400,y:345,s:2.6,face:'excited',arms:'up',lift:22},{id:'주스',x:640,y:340,s:2.2,arms:'cross'},{id:'ㅈㄱ',x:210,y:330,s:1.9},{id:'현숭',x:300,y:322,s:1.7},{id:'호우',x:520,y:322,s:1.7,arms:'up'}],lines:[
  {who:'ㅈㄱ',text:'…메가진화급이었어.'},
  {who:'현숭',text:'진지하게 계산해봤는데, 이건 다 내 응원 덕분이야. 근거는 없어.'},
  {who:'호우',text:'축하해~ 오늘 골 소리는 완전 솔! 솔직히 대박이야.'},
  {who:'주스',text:payLine(big,bet,bonus)}]}),
 (big,bet,bonus)=>({bg:'field',confetti:true,chars:[{id:'rock',x:400,y:345,s:2.6,face:'excited',arms:'up',lift:22},{id:'주스',x:640,y:340,s:2.2,arms:'cross'},{id:'우룡',x:210,y:330,s:1.9},{id:'룡갈',x:300,y:322,s:1.7},{id:'겨맘',x:520,y:322,s:1.7,arms:'up'}],lines:[
  {who:'우룡',text:'벽 사업 적자다… 에라 모르겠다, 다음 판에 만회하지!'},
  {who:'룡갈',text:'헐, 뚫렸다! …근데 그 표정 보니까 앙 기모띠, 봐준다.'},
  {who:'겨맘',text:'롹순팅 최고~! 완전 국대급 킥이었어!'},
  {who:'주스',text:payLine(big,bet,bonus)}]})
];
const LOSE_CUTS=[
 ()=>({bg:'canteen',chars:[{id:'rock',x:250,y:340,s:2.5,face:'frustrated'},{id:'주스',x:570,y:340,s:2.5,item:'bread'},{id:'히통',x:410,y:262,s:1.5},{id:'머호',x:100,y:320,s:1.5}],lines:[
  {who:'주스',text:'잘 먹을게~ 크림빵으로. 하나 더 안 주면 깨물어버린다!'},
  RK('…롹.','frustrated'),
  {who:'히통',text:'주스 키퍼 재능있네.'},
  {who:'머호',text:'뭐, 세상은 어차피 다 5할이야! 다음엔 롹순팅이 이기겠지~'}]}),
 ()=>({bg:'canteen',chars:[{id:'rock',x:250,y:340,s:2.5,face:'frustrated'},{id:'주스',x:570,y:340,s:2.5,item:'bread'},{id:'주멘',x:410,y:262,s:1.5},{id:'씨붕',x:100,y:320,s:1.5}],lines:[
  {who:'주스',text:'한 손가락으로 막았지? 앙~!'},
  {who:'주멘',text:'주스 이제 키퍼만해라.'},
  {who:'주멘',text:'진로 계획도 이미 짜 뒀어. 키퍼 코스로.'},
  {who:'씨붕',text:'야, 그렇게 기죽어 있지 마! …아, 됐고. 다음엔 딴다니까.'},
  RK('…롹.','frustrated')]}),
 ()=>({bg:'canteen',chars:[{id:'rock',x:230,y:340,s:2.5,face:'frustrated'},{id:'주스',x:570,y:340,s:2.5,item:'bread'},{id:'겨맘',x:100,y:320,s:1.5},{id:'히통',x:410,y:262,s:1.5},{id:'주멘',x:690,y:320,s:1.5}],lines:[
  {who:'겨맘',text:'괜찮아, 다음엔 내가 폼 다시 봐줄게! 일단 이거 먹고 힘내~'},
  {who:'히통',text:'주스 키퍼 재능있네.'},
  {who:'주멘',text:'주스 이제 키퍼만해라.'},
  {who:'주스',text:'들었냐? 앙~!'}]}),
 ()=>({bg:'canteen',chars:[{id:'rock',x:230,y:340,s:2.5,face:'frustrated'},{id:'주스',x:570,y:340,s:2.5,item:'bread'},{id:'ㅈㄱ',x:100,y:320,s:1.5},{id:'현숭',x:410,y:262,s:1.5},{id:'우룡',x:690,y:320,s:1.5}],lines:[
  {who:'ㅈㄱ',text:'…고라파덕 같은 표정이야.'},
  {who:'현숭',text:'진지하게 분석했는데, 오늘 패배 원인은 100% 지구 자전 때문이야.'},
  {who:'우룡',text:'이 판은 손절이다… 에라 모르겠다, 주스나 스카우트하자.'},
  {who:'주스',text:'이제 키퍼만 해라? 좋지! 앙!'}]})
];
function introA(bet){return pick(INTRO_A)(bet);}
function introB(){return pick(INTRO_B)();}
function finalCut(win,big,bet,bonus){return win?pick(WIN_CUTS)(big,bet,bonus):pick(LOSE_CUTS)();}
const SPECT=[{n:'주멘',x:-8.5,z:-2},{n:'머호',x:-7.2,z:-3.5},{n:'히통',x:8.5,z:-2},{n:'겨맘',x:7.2,z:-3.5},{n:'ㅈㄱ',x:11.5,z:-6}];
const REACT={
 주멘:{goal:['계획대로다!','이 골도 일정표에 있었어.','A안 성공! 전부 계획대로야.'],save:['예상 범위 안이야.','B안으로 전환한다.','…변수 발생. 계획 수정!'],post:['골대 확률 3%였는데?!','오차 5센티야, 아깝다!','계획엔 없던 골대야…'],wall:['벽 튕김 확률까지 계산했어.','예상했던 결과야.','ㅋㅋㅋ 계획대로 벽.'],miss:['오차 범위 초과…','다음 킥 만회 계획을 짜자.','계획 재수립 중…']},
 머호:{goal:['미쳤다! 5할이 뒤집혔네~','세상은 5할이라더니 오늘은 롹순팅 쪽!','오~ 5할 중 좋은 쪽이 나왔다!'],save:['세상은 어차피 다 5할이야!','반반인데 저쪽이 나왔네~','그래도 5할은 5할이지.'],post:['아깝다~ 이것도 5할이야!','골대! 반대쪽 5할이 나왔네!'],wall:['세상은 어차피 다 5할이야!','벽 5할, 골 5할~'],miss:['세상은 5할이야!','다음 킥이 5할 남았잖아~','빗나갈 확률도 5할이었어!']},
 히통:{goal:['골이면 판돈 회수네. 이자는 10%.','롹순팅 신용등급 상승!','이건 돈 빌려도 되는 골!'],save:['주스 키퍼 재능있네.','지면 빌려줄게. 이자는 10%.','아~ 판돈이 내 창구로 올 텐데.'],post:['이자율 5%만큼 빗나갔네.','한 뼘 차이 아깝다!'],wall:['벽에 맞은 판돈은 이자로 간다.','내 이자 계산이 더 빠르다.'],miss:['이 킥은 대손처리네…','손실 10% 확정.','담보라도 잡고 차자.']},
 겨맘:{goal:['거봐, 그 자세가 정답이라니까!','완벽한 슛! 나도 그렇게 넣어~','국가대표급 킥이야, 진짜!'],save:['괜찮아~ 발끝 각도만 조금 더!','아깝다! 폼은 좋았어~','힘내, 다음 건 내가 봐줄게!'],post:['한 끗 차이! 소금 한 꼬집 부족한 느낌?','앗, 진짜 아까웠어~'],wall:['괜찮아, 저 벽은 나도 못 뚫어!','다치지 않았지? 다시 하자!'],miss:['괜찮아 괜찮아~ 밥부터 든든히 먹자!','자세 교정만 조금 하면 돼!','다음 킥 응원할게~']},
 ㅈㄱ:{goal:['피카피카!','…메가진화급.','…(파이리 카드를 번쩍 든다)'],save:['고라파덕…','…파이리가 불을 뿜었어야 했는데.','…(잠만보처럼 멍하니 본다)'],post:['…이상해씨급으로 아깝다.','…(꼬부기 카드를 만지작)'],wall:['…벽이 강철이야.','…롱스톤 같아.'],miss:['…이건 잠만보야.','…버터플처럼 날아갔네.']},
 우룡:{goal:['헉, 뚫렸다! …에라 모르겠다, 다음 판에 만회하지.','벽 사업 적자다…'],wall:['역시 내 벽 투자는 실패가 없어.','룡갈, 오늘 수익률 좋다!'],save:['주스가 다 했네. 난 숟가락만 얹었다.'],miss:['거봐, 승률 계산 끝났다니까.']},
 룡갈:{goal:['헐, 뚫렸다! 앙 기모띠, 그래도 인정.','콤비의 수치…! 근데 나쁘지 않네.'],wall:['막았다! 앙 기모띠~','거 봐, 내가 막는다고 했지.'],save:['주스가 다 했지, 난 구경만 했다.'],miss:['거 봐, 안 들어간다고 했지. 앙 기모띠!']},
 씨붕:{goal:['아 진짜 아깝게 놓쳤네! …아니 됐고, 판돈이나 계산하자.','인마 다음엔 더 세게 걸어야지!'],wall:['거봐 내가 뭐랬어. …그래도 잘 찼어, 인마.','내가 막았다! …아니 주스가.'],save:['아이씨, 아깝잖아! …괜찮아, 다음에 넣어.'],miss:['야 인마 정신 안 차려?! …됐고, 다음 거나 잘 차.']},
 현숭:{goal:['역시… 내 계산대로군. (계산 안 함)','진지하게 말하는데, 저건 우연이 아니야.'],wall:['벽의 밀도를 고려하면 합리적인 결과지.','통계적으로 예정된 결과였어. (안 그랬음)'],save:['음. 확률상 예상된 결과다. (예상 안 함)'],miss:['흠, 지구 자전 때문이야. 아마.']},
 호우:{goal:['골이 야옹~ 아니 골인~!','좋은 리듬이야! (박수)'],wall:['벽이 이겼다… 벽(壁)창호네.'],save:['아깝다! 오늘 주스가 완전 주스타야.'],miss:['빗나갔네. 오늘 리듬감이 좀 음이탈났나 봐.']}
};
const KEEPER={goal:['깨물어버린다!!','한 손가락만 썼으면…','내 자존심이…!'],save:['한 손가락이면 충분해','앙~! 못 지나가','내 자부심은 안 뚫려'],post:['아슬아슬! 골대가 도왔다!','한 손가락으로도 막았을 거야!'],wall:['벽이 막았네. 난 구경만 했다.'],miss:['골대 밖이잖아. 깨물어버린다!','한 손가락도 안 썼다.']};
/* 컨디션 매우나쁨(0)일 때 슛하려다 자빠질 확률과, 그때 친구들이 놀리는 대사 */
const TRIP_CHANCE=.3;
const TRIP_REACT={
 머호:['컨디션 매우나쁨에서 무리했네! 세상은 5할인데 오늘 그쪽 5할이었어 ㅋㅋ','거봐, 쉬라니까~'],
 씨붕:['거봐 내가 무리하지 말랬지?! …아, 됐고. 안 다쳤냐?','인마 진짜 놀랐잖아… 아니, 걱정했다고!'],
 히통:['부상 병원비는 이자 10%로 빌려줄게.','컨디션 관리도 신용등급이야.'],
 겨맘:['어머!! 괜찮아?! 내가 파스 붙여줄게, 얼른 와봐!','컨디션 관리도 실력이야. 오늘은 내가 밥해줄게.'],
 주멘:['컨디션 매우나쁨은 계획에 없었는데…','변수 발생. 다음엔 소리새부터 가서 노래하자.'],
 ㅈㄱ:['…잠만보처럼 쓰러졌어.','…(안타까운 표정으로 카드를 만지작)'],
 현숭:['진지하게 말하는데, 저건 지구 자전 때문이야.','컨디션 0에서 무리한 건… 웃기지만 안 웃겨.'],
 호우:['쿵. 낮은 도 소리가 났어. …괜찮냐는 말이야.'],
 주스:['자, 잘 쉬고 와. 몰수승은 내가 챙길게. 깨물어버린다!','컨디션 관리도 실력이야!']
};
const CHAT={
 주스:['오늘도 프리킥 받아줄게. 깨물어버린다!','한 손가락 스트레칭 중이야.','내 자존심은 골대 크기만 해.','나 없이는 이 학교 골대가 안 돌아가.','오늘은 두 손가락 정도 써줄게. 특별히.','크림빵 내기, 또 할래?','내가 막으면 그건 골키퍼고, 니가 넣으면 그건 운이야.','자존심 걸고 하는 승부는 재밌어.','쉬는 시간 10분, 내 무대야.','지면 깨물어버린다? 아니 이겨도 깨물어버린다!'],
 머호:['세상은 어차피 다 5할이야!','급식 맛있을 확률? 5할이야.','시험 찍기도 5할이지.','오늘 비 올 확률도 5할, 안 올 확률도 5할이야.','이기든 지든 결국 5할이야, 편하게 해.','숙제 검사 걸릴 확률? 그것도 5할.','5할이 아닌 건 세상에 없어.','오늘 기분? 좋을 확률 5할, 그냥 그럴 확률 5할.','인생 다 반반이야, 쫄지 마.','져도 다음엔 이길 확률이 5할이잖아.'],
 주멘:['이번 주 일정표 다 짜놨어. 전부 계획대로야.','수요일 3교시 매점 줄이 짧을 확률까지 계산해 놨어.','계획표에 없는 일은 없어… 없었어… 아마도.','A안이 실패하면 B안, C안까지 준비돼 있어.','오늘 일정, 분 단위로 짜놨는데 너 때문에 5분 밀렸어.','변수는 딱 질색이야. 그래도 대비는 해놨어.','이번 학기 목표는 이미 12월까지 계획했어.','즉흥적인 건 계획에 없어… 라고 적어놨어.','내일 날씨까지 계산에 넣었어.','계획표엔 네가 이길 확률도 적혀 있어. …비밀이야.'],
 씨붕:['야, 판돈 좀 세게 걸어봐. 쫄았냐?','…딱히 걱정돼서 물어본 거 아니거든. 밥은 먹었냐.','다치기만 해봐, 진짜 가만 안 둔다.','인마, 왜 이렇게 늦게 와. …기다린 거 아니거든.','오늘 컨디션 별로면 말을 해, 무리하지 말고.','됐고, 이기기나 해. …잘하면 칭찬은 안 해줄 거야.','야, 넘어질 뻔했잖아. 조심 좀 해라, 인마.','…뭘 그렇게 쳐다봐. 신경 쓰여서 그런 거 아니야.','지면 내가 대신 화낼 거야. 너 대신.','인마, 잘했으면 잘했다고 티 좀 내. …내가 대신 낸다.'],
 히통:['돈 빌려줄게. 이자는 10%.','이자는 복리가 아니라 단리야. 착하지?','지갑 얇아졌어? 내 창구는 언제나 열려 있어.','신용등급 관리, 어릴 때부터 하는 거야.','오늘 판돈도 내 장부에 다 적어놨어.','이자 안 받는 날은 내 생일뿐이야.','빚은 계획적으로 지는 거야. 나처럼.','돈 없다고 기죽지 마, 내가 있잖아. 이자는 있지만.','급전 필요하면 언제든 와. 심사는 빠르니까.','나한테 빌린 돈, 이자 계산은 내가 제일 빨라.'],
 겨맘:['어제 축구부랑 3대3 했는데 내가 다 넣었잖아~','오늘 저녁 뭐 해줄까? 내가 후딱 만들어줄게.','운동은 몸으로 먹는 밥이야~ 많이 뛰어!','오늘 육수부터 우려놨어, 맛있게 먹어~','아침 스트레칭은 필수야, 다치면 안 되잖아.','나 이번 대회 계주 대표로 뽑혔어~','단백질 챙겨 먹어야 슛도 세지는 거야!','오늘 반찬은 내가 직접 만든 거야, 맛있지?','체력 훈련은 내가 짜줄게, 믿고 따라와~','운동도 요리도 결국 정성이야~'],
 ㅈㄱ:['…어제 희귀 포켓몬 카드를 뽑았어.','…파이리가 제일 좋아.','…(말없이 이상해씨 카드를 내민다)','…오늘 급식은 고라파덕 색이었어.','…포켓몬 배지, 다음 달에 다 모아.','…(조용히 카드 뒷면을 확인한다)','…이 승부, 체육관 관장전 같아.','…파이리를 좋아하지만 티는 안 내.','…(말없이 고개만 끄덕인다)','…오늘따라 잠만보처럼 졸려.'],
 현숭:['어제 계산해봤는데 급식 줄은 정오 12시 3분이 골든타임이야.','…진지하게 말하는데, 오늘 구름은 양 세 마리 모양이었어.','통계적으로 나는 오늘 운이 좋아. 근거는 없어.','진지하게 분석했는데, 월요일은 항상 존재해.','오늘 급식 예측 정확도 100%였어. …메뉴판을 봤거든.','진지하게 말하는데, 저 구름은 나중에 비가 될 거야.','내 이론상 쉬는 시간은 항상 너무 짧아.','진지하게, 오늘 왼쪽 신발을 먼저 신었어. 의미는 없어.','데이터를 보면… 그냥 오늘 기분이 좋다는 뜻이야.','진지하게 조사했는데, 웃긴 얘기일수록 더 진지해져야 해.'],
 호우:['오늘 급식이 카레야? 나는 그냥 오늘이 카레있어!','쉬는 시간엔 흥얼흥얼~ 노래가 최고지.','아침 조회가 지루해서 도(道)를 아십니까 할 뻔했어.','체육 선생님이 화나면? 얼음! …땡이 아니라 정말 화나.','오늘 시험 망쳤어. 그래도 시(詩)는 안 망쳤지.','내가 라면을 좋아하는 이유? 그냥 면이야.','오늘 노래 연습했어, 음정은 아직 밀당 중이야.','수학 시간에 졸았어. 각도기 각 잡고 잤어.','체육복 세탁했는데 노래는 못 빨았어, 아직도 흥얼거려.','오늘 급식 반찬이 콩나물이야? 나 그거 콩글리시야.'],
 우룡:['이 학교 매점 상권 분석 끝냈다. 다음 타겟은 문구점.','투자는 타이밍이야. …근데 지금은 에라 모르겠다!','내 용돈은 이미 3배로 굴리고 있어.','이번 달 목표는 순이익 5천 원이다.','리스크 관리? 중요하지. 근데 에라 모르겠다.','친구도 자산이야, 너는 우량주다.','용돈 기입장, 초등학교 때부터 쓰고 있어.','이 판, 승산 계산 끝났다. …아니다, 에라 모르겠다!','경영의 기본은 타이밍이야. 지금은 내려놓을 타이밍.','오늘 매점 라면값이 올랐어. 시장 조사 필수다.'],
 룡갈:['오늘 컨디션 최고다. 앙 기모띠!','롹순팅, 오늘 킥 감 좋아 보이는데?','밥 먹었냐? 난 두 그릇 먹었다.','체육대회 때 내가 계주 1등 할 거다.','앙 기모띠! 오늘따라 기분이 좋네.','우룡이랑 나, 이번에도 벽 지킨다.','시원하게 한 골 넣어봐라!','져도 좋고 이겨도 좋다, 그냥 다 좋다. 앙 기모띠!','쉬는 시간 종 치면 제일 먼저 뛰어나간다, 나.','오늘 몸이 근질근질하다. 뭐라도 하자, 앙 기모띠!']
};
function randChat(){const n=pick(Object.keys(CHAT));return{n,t:pick(CHAT[n])};}
let chatCur=randChat();

/* ---------- 매치 흐름 ---------- */
let quitAsk=0;
function showGame(g){$('#hub').hidden=g;$('#gameWrap').hidden=!g;$('#pad').classList.toggle('on',g);document.body.classList.toggle('playing',g);window.scrollTo(0,0);}
function startMatch(bet){
  sfx('start');
  M={bet,goals:0,pts:0,res:[],before:S.money,kicks:buildKicks()};
  showGame(true);$('#ovSet').hidden=true;pressed={};mouse.click=false;
  playCut(introA(bet),()=>playCut(introB(),()=>startKick(0)));
}
function startKick(i){sfx('whistle');setupKick(i);M.k=i;mode='kick';pressed={};mouse.click=false;$('#gCtrl').textContent='조준 → 공 맞힐 위치 → 파워';}
function askQuit(){
  const now=performance.now();
  if(now-quitAsk<3000){forfeit();return;}
  quitAsk=now;toast('한 번 더 누르면 포기해요. 판돈은 잃어요.');
}
function forfeit(){
  if(mode==='hub'||mode==='settle')return;
  C=null;$('#skip').hidden=true;M.forfeit=true;M.goals=0;settle();
}
/* 컨디션 매우나쁨(0)에서 슛하려다 자빠지는 연출: 친구들이 놀리는 대사를 띄우고 부상으로 즉시 몰수패 처리해요 */
function startTrip(){
  K.ph='trip';K.t=0;K.face='panic';K.shake=.4;sfx('thud');
  const sp=SPECT.slice().sort(()=>Math.random()-.5).slice(0,2);
  sp.forEach(a=>{const l=TRIP_REACT[a.n];if(l)K.react.push({n:a.n,x:a.x,z:a.z,tx:pick(l),t:2.2});});
  const kl=TRIP_REACT['주스'];if(kl)K.react.push({n:'주스',x:0,z:0,tx:pick(kl),t:2.2});
  K.result={type:'trip',pts:0,title:'앗, 발이 꼬였다!',sub:'컨디션이 매우 나빠서 넘어지고 말았다… 부상으로 몰수패!',col:'#c4372f'};
}
function forfeitInjury(){
  if(mode==='hub'||mode==='settle')return;
  C=null;$('#skip').hidden=true;M.forfeit=true;M.injured=true;M.goals=0;settle();
}
function nextKick(){
  if(K.i>=4){
    const win=M.goals>=3,big=M.goals>=4,bonus=Math.round(M.bet*.5/100)*100;
    M.win=win;M.big=big;M.bonus=bonus;
    playCut(finalCut(win,big,M.bet,bonus),settle);
  }else startKick(K.i+1);
}
function settle(){
  mode='settle';
  const win=M.forfeit?false:M.goals>=3,big=!M.forfeit&&M.goals>=4,bonus=Math.round(M.bet*.5/100)*100;
  S.fatigue=Math.max(0,(S.fatigue||0)-1);
  const delta=win?M.bet+(big?bonus:0):-M.bet;
  const before=S.money;S.money=Math.max(0,S.money+delta);
  if(win){S.wins++;S.mood=clamp((S.mood==null?50:S.mood)+6,0,100);}   /* 이기면 기분이 조금 좋아져요 */
  else{S.losses++;S.mood=clamp((S.mood==null?50:S.mood)-6,0,100);}    /* 지면 기분이 조금 나빠져요 */
  S.bestPts=Math.max(S.bestPts||0,M.pts||0);S.plays=(S.plays||0)+1;
  const weekend=advanceDay();
  sfx(M.forfeit?'lose':big?'bigwin':win?'win':'lose');if(weekend)setTimeout(()=>sfx('bell'),1400);
  if(S.money>=1000000&&!S.cleared){S.cleared=true;S.news='🎉 100만 원 달성! (엔딩 애니메이션은 다음 업데이트에서 만나요)';setTimeout(()=>sfx('bigwin'),1800);}
  save();
  cloudScore({bet:M.bet,goals:M.goals,pts:M.pts,result:M.injured?'부상':M.forfeit?'포기':big?'완승':win?'승리':'패배',money:S.money,week:S.week});
  $('#sT').textContent=M.injured?'부상으로 기권…':M.forfeit?'포기…':big?'완승!':win?'승리!':'패배…';
  $('#sImg').src=IMGDATA[M.injured?'panic':big?'excited':win?'happy':'frustrated'];
  $('#sTab').innerHTML=`<tr><td>결과</td><td>${M.goals}골 / 5킥</td></tr><tr><td>점수</td><td>${M.pts}점</td></tr>`+
    `<tr><td>판돈</td><td class="${win?'plus':'minus'}">${win?'+':'-'}${fmt(M.bet)}원</td></tr>`+(big?`<tr><td>완승 보너스</td><td class="plus">+${fmt(bonus)}원</td></tr>`:'')+
    `<tr><td>소지금</td><td>${fmt(before)} → ${fmt(S.money)}원</td></tr>`;
  $('#sX').textContent=weekend?`주말이 지나 새 주가 시작됐다. (${S.week}주차 월요일)`:`내일은 ${DAYS[S.day]}요일.`;
  $('#ovSet').hidden=false;
}
function advanceDay(){
  S.day++;
  dayStats();
  if(S.day>=5){S.day=0;S.week++;S.news=`${S.week-1}주차가 끝났다. 주말이 지나 새 주가 시작됐다. (${S.week}주차 월요일)`;return true;}
  S.news=`${DAYS[S.day]}요일이 밝았다.`;return false;
}
/* 매일 한 번: 쇠질/바베큐를 오래 쉬면 근력·체력이 떨어지고, 컨디션이 새로 굴러요.
   쇠질하기·난지바베큐를 한 날은 gymGap/bbqGap을 -1로 미리 낮춰 둬서, 여기서 +1되면 0(오늘 했음)이 돼요. */
function dayStats(){
  S.gymGap=(S.gymGap==null?0:S.gymGap)+1;
  if(S.gymGap>=3)S.str=clamp((S.str==null?25:S.str)-4,0,100);
  S.bbqGap=(S.bbqGap==null?0:S.bbqGap)+1;
  if(S.bbqGap>=3)S.stam=clamp((S.stam==null?25:S.stam)-4,0,100);
  rollCondition();
}
/* 컨디션은 그날그날 랜덤이지만, 기분이 나쁘면(<30) 나쁜 쪽으로, 아주 좋으면(≥75) 좋은 쪽으로 살짝 쏠려요. */
function rollCondition(){
  const m=S.mood==null?50:S.mood,bias=m<30?-1:m>=75?1:0;
  S.cond=clamp(Math.round(2+gauss()*1.1+bias),0,4);
}

/* ---------- 킥 업데이트 ---------- */
function timeout(){
  K.ph='res';K.t=0;K.out='timeout';K.face='panic';
  const b0=K.ball;K.path=[{t:0,x:b0.x,y:b0.y,z:b0.z},{t:.6,x:b0.x,y:b0.y,z:b0.z}];K.dur=.6;K.tEvt=0;K.kd={rk:.25,tgt:0};K.info={};
  record({type:'timeout',pts:0,title:'시간 초과!',sub:'헛발질을 하고 말았다…',col:'#c4372f'});beep(110,.4,'sawtooth',.09);
}
function record(r){M.res[K.i]=r;M.pts+=r.pts;if(r.type==='goal')M.goals++;K.result=r;}
function spawnBurst(){
  const x=rand(110,690),y=rand(95,240),col=['#ff4d6d','#ffd166','#06d6a0','#4cc9f0','#f72585','#ffffff'][Math.floor(rand(0,6))],n=28;
  for(let i=0;i<n;i++){const a=i/n*6.283+rand(-.1,.1),v=rand(110,230);K.fw.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:rand(.8,1.3),c:col});}
  beep(rand(150,260),.18,'sawtooth',.04);
}
function updateKick(dt){
  K.t+=dt;
  if(K.shake>0)K.shake-=dt;
  if(K.celeb>=0){K.celeb+=dt;K.fwT-=dt;if(K.celeb<2.3&&K.fwT<=0){spawnBurst();K.fwT=.2;}}
  if(K.introT>0){K.introT-=dt;if(Math.floor(K.introT*1.7)!==Math.floor((K.introT+dt)*1.7))beep(70,.16,'sine',.14);if(K.introT<=0)K.t=0;return;}
  K.fw.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=110*dt;p.t-=dt;});K.fw=K.fw.filter(p=>p.t>0);
  K.conf.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.a+=dt*6;});K.conf=K.conf.filter(p=>p.y<H+10);
  if(K.ph==='aim'||K.ph==='spin'||K.ph==='power'){
    K.timer-=dt;
    if(K.timer<=0){timeout();return;}
    K.emerg=K.timer<3.2;
    if(K.emerg){const q=Math.ceil(K.timer*2);if(q!==K.lastTick){K.lastTick=q;beep(K.timer<1.5?950:700,.08,'square',.07);}}
  }else K.emerg=false;
  if(K.ph==='aim'){
    const A=3+K.i*2.5+(K.pen?4:0)+(K.swAdd||0);K.sw.x=Math.sin(K.t*1.9)*A;K.sw.y=Math.cos(K.t*2.6)*A*.7;
    if(mouse.mv){K.cur.x=mouse.x;K.cur.y=mouse.y;}
    const ax=(held.ArrowRight?1:0)-(held.ArrowLeft?1:0),ay=(held.ArrowDown?1:0)-(held.ArrowUp?1:0);
    K.cur.x=clamp(K.cur.x+ax*260*dt,40,760);K.cur.y=clamp(K.cur.y+ay*200*dt,70,400);
    K.face='resolve';
    if(pressed.Space||pressed.Enter||mouse.click){
      const t=unproject(K.cur.x+K.sw.x,K.cur.y+K.sw.y);
      K.aim={tx:clamp(t.x,-5.5,5.5),ty:clamp(t.y,.15,3.3)};
      K.ph='spin';K.t=0;K.spin={x:0,y:0};beep(520,.08,'triangle',.07);
    }
  }else if(K.ph==='spin'){
    const ax=(held.ArrowRight?1:0)-(held.ArrowLeft?1:0),ay=(held.ArrowDown?1:0)-(held.ArrowUp?1:0);
    K.spin.x=clamp(K.spin.x+ax*1.5*dt,-1,1);K.spin.y=clamp(K.spin.y+ay*1.5*dt,-1,1);
    if(mouse.mv&&mouse.x>520&&mouse.x<760&&mouse.y>110&&mouse.y<410){
      K.spin.x=clamp((mouse.x-640)/(88*.8),-1,1);K.spin.y=clamp((mouse.y-262)/(88*.8),-1,1);
    }
    K.face='resolve';
    if((pressed.Space||pressed.Enter||mouse.click)&&K.t>.15){
      if((S.cond==null?2:S.cond)===0&&Math.random()<TRIP_CHANCE){startTrip();return;}
      K.s=K.spin.x;K.ys=-K.spin.y;K.ph='power';K.t=0;K.p=0;K.armed=false;K.charging=false;beep(600,.08,'triangle',.07);
    }
  }else if(K.ph==='trip'){
    if(K.t>2.4||(K.t>1.2&&(pressed.Space||pressed.Enter||mouse.click)))forfeitInjury();
  }else if(K.ph==='power'){
    const down=held.Space||mouse.down;
    if(!K.armed){if(!down)K.armed=true;}
    else if(!K.charging){if(down)K.charging=true;}
    else{if(down){const pp=K.p;K.p=Math.min(1,K.p+dt*.7);if(Math.floor(K.p*12)!==Math.floor(pp*12))sfx('gauge',K.p);K.face=K.p>.6?'angry':'resolve';}else{fire();return;}}
  }else if(K.ph==='fly'){
    K.pt+=dt*(K.pt<K.tEvt?.55:.9);
    if(!K.evtDone&&K.pt>=K.tEvt){K.evtDone=true;onEvent();}
    if(K.pt>=K.dur){K.ph='res';K.t=0;showResult();}
  }else if(K.ph==='res'){
    const goal=K.result&&K.result.type==='goal',go=pressed.Space||pressed.Enter||mouse.click;
    if(goal){if(K.celeb>=2.6||(K.celeb>=2.0&&go))nextKick();}
    else{
      if(!K.biteDone&&K.t>=.85){K.biteDone=true;K.shake=.35;beep(180,.08,'square',.12);setTimeout(()=>beep(90,.18,'sawtooth',.12),70);}
      if(K.t>2.6||(K.t>1.8&&go))nextKick();
    }
  }
  K.react.forEach(r=>r.t-=dt);K.react=K.react.filter(r=>r.t>0);
  K.flash-=dt;
}
function keeperGuess(){const r=Math.random();return (r<.4?-2.6:r<.8?2.6:0)+gauss()*.25;}
function fire(){
  const v0=solve(K.ball,K.aim.tx,K.aim.ty,K.s,K.ys);
  const f=(.55+.6*K.p)*(K.strMul||1),v={vx:v0.vx*f,vy:v0.vy*f,vz:v0.vz*f};
  const fr=flight(K.ball,v,K.s,K.ys,K.wind,K.wall?wallObj():null,true);
  let out='short',info={};
  const sweet=Math.abs(K.p-.75)<=sweetHalf();
  if(fr.wh){out='wall';K.tEvt=fr.wh.t;}
  else if(fr.c){
    K.tEvt=fr.c.t;const x=fr.c.x,y=fr.c.y;info={x,y};
    const post=(Math.abs(Math.abs(x)-3.66)<.17&&y<2.6)||(Math.abs(y-2.44)<.17&&Math.abs(x)<3.75);
    if(post)out='post';
    else if(Math.abs(x)<3.55&&y<2.33&&y>.02){
      const xs=K.ball.x+v.vx/v.vz*(-K.ball.z);
      const pred=K.pen?(Math.random()<K.kread?x+gauss()*.4:keeperGuess()):xs+K.kread*(x-xs)+gauss()*K.kerr;
      const tgt=clamp(pred,-3,3);
      K.kd={rk:K.rk,tgt};
      const dive=Math.abs(tgt)>.7;
      const kx=Math.sign(tgt||1)*Math.min(Math.abs(tgt),K.vk*Math.max(0,fr.c.t-K.kd.rk));
      const saved=Math.abs(x-kx)<.95&&y<(dive?2.05:2.0);
      out=saved?'save':'goal';info.dx=x-kx;
    }else out=y>=2.44?'over':'wide';
  }else{out='short';K.tEvt=fr.t;}
  if(!K.kd){const xs=K.ball.x+v.vx/v.vz*(-K.ball.z);K.kd={rk:K.rk,tgt:K.pen?clamp(keeperGuess(),-3,3):clamp(xs+gauss()*K.kerr,-3,3)};if(out==='wall')K.kd.tgt=0;}
  extend(fr,out,info);
  K.fr=fr;K.path=fr.path;K.dur=fr.path[fr.path.length-1].t;K.out=out;K.info=info;K.sweet=sweet;
  K.ph='fly';K.pt=0;K.evtDone=false;K.face='surprise';
  sfx('kick');
}
function extend(fr,out,info){
  const st=fr.st,path=fr.path;let t=fr.t;
  if(out==='wall'){const va=st.vx*K.dir.x+st.vz*K.dir.z,lat=rand(-2,2);st.vx=-va*.3*K.dir.x+lat*K.right.x;st.vz=-va*.3*K.dir.z+lat*K.right.z;st.vy=rand(1.5,3);}
  else if(out==='save'){st.vx=(info.dx>=0?1:-1)*rand(1.5,4);st.vz=-Math.abs(st.vz)*.3;st.vy=rand(1.5,4);}
  else if(out==='post'){st.vz=-Math.abs(st.vz)*.45;st.vx*=.5;st.vy=rand(1,3);}
  const steps=Math.round((out==='goal'?1.4:out==='short'?.5:.9)*120);
  for(let i=0;i<steps;i++){
    integrate(st,1/120,out==='wall'||out==='save'||out==='post'?0:K.s,K.ys,0);
    if(out==='goal'&&st.z>1.9){st.z=1.9;st.vz=-st.vz*.12;st.vx*=.3;}
    t+=1/120;path.push({t,x:st.x,y:st.y,z:st.z});
  }
}
function onEvent(){
  const o=K.out,type=(o==='goal'||o==='save'||o==='post'||o==='wall')?o:'miss';
  const say=(n,x,z,tx)=>K.react.push({n,x,z,tx,t:1.9});
  const line=(n)=>{const b=REACT[n];const a=b&&(b[type]||b.miss);return a&&a.length?pick(a):null;};
  const sp=SPECT.slice().sort(()=>Math.random()-.5).slice(0,3);
  sp.forEach(a=>{const l=line(a.n);if(l)say(a.n,a.x,a.z,l);});
  if(K.wall){const wn=WALLNAMES[Math.floor(Math.random()*Math.min(K.wall,5))],l=line(wn);if(l)say(wn,0,0,l);}
  const kl=KEEPER[type];if(kl)say('주스',0,0,pick(kl));
  if(o==='goal'){
    cheer();sfx('net');K.flash=.5;K.face='excited';K.celeb=0;K.fwT=0;
    for(let i=0;i<70;i++)K.conf.push({x:rand(0,W),y:rand(-260,0),vx:rand(-40,40),vy:rand(100,200),a:rand(0,6),c:['#e2334d','#e8a91c','#2f8f5b','#3b7de0','#fff'][Math.floor(rand(0,5))]});
  }
  else if(o==='save'){
    sfx('thud');K.face='frustrated';
    if(Math.random()<.6){const who=sp[0];K.react=K.react.filter(r=>r.n!==who.n);say(who.n,who.x,who.z,Math.random()<.5?'주스 키퍼 재능있네':'주스 이제 키퍼만해라');}
  }
  else if(o==='post'){sfx('ping');K.face='surprise';}
  else if(o==='wall'){sfx('thud');K.face='panic';}
  else{sfx('whoosh');setTimeout(()=>sfx('aww'),250);K.face='frustrated';}
}
function showResult(){
  const o=K.out,i=K.info||{};let r;
  if(o==='goal'){
    let pts=100,tags=[];
    if(Math.abs(i.x)>2.6&&i.y>1.7){pts+=100;tags.push('톱코너');}
    if(Math.abs(K.s)>.35){pts+=50;tags.push('커브');}
    if(K.sweet){pts+=30;tags.push('스윗스팟');}
    r={type:'goal',pts,title:tags.includes('톱코너')?'톱코너 골!':'골!',sub:(tags.join(' · ')||'깔끔한 마무리')+` +${pts}점`,col:'#2f8f5b'};K.face='excited';
  }
  else if(o==='save')r={type:'save',pts:0,title:'선방!',sub:'주스가 한 손가락으로 막아냈다',col:'#c4372f'};
  else if(o==='post')r={type:'post',pts:20,title:'골대!',sub:'아깝다… +20점',col:'#e8a91c'};
  else if(o==='wall')r={type:'wall',pts:0,title:'벽에 막혔다!',sub:'넘기거나 휘어서 돌려 보자',col:'#c4372f'};
  else if(o==='over')r={type:'over',pts:0,title:'크로스바 위로…',sub:'파워가 너무 셌다',col:'#c4372f'};
  else if(o==='wide')r={type:'wide',pts:0,title:'빗나갔다…',sub:'골대를 벗어났다',col:'#c4372f'};
  else r={type:'short',pts:0,title:'힘이 부족했다…',sub:'파워를 더 채워 보자',col:'#c4372f'};
  record(r);
}

/* ---------- 필드 그리기 ---------- */
function line3(c,pts){
  c.beginPath();let pen=false;
  pts.forEach(p=>{const q=proj(p[0],0,p[1]);if(q.f<.5){pen=false;return;}if(pen)c.lineTo(q.sx,q.sy);else c.moveTo(q.sx,q.sy);pen=true;});
  c.stroke();
}
function person(c,x,z,hm,o,lift,name,label){
  const p=proj(x,0,z);if(p.f<1)return;
  const s=hm*F/p.f/69,ly=(lift||0)*F/p.f;
  kid(c,p.sx,p.sy-ly,s,o);
  if(label)TX(c,name,p.sx,p.sy-ly-78*s,clamp(s*10,11,18),'#fff','center','rgba(0,0,0,.55)');
}
function drawGoal(c){
  const P=(x,y,z)=>proj(x,y,z),lw=Math.max(3,.12*F/P(0,0,0).f);
  const back=[[-3.4,0,2],[3.4,0,2],[3.4,2.0,2],[-3.4,2.0,2]].map(a=>P(a[0],a[1],a[2]));
  c.fillStyle='rgba(255,255,255,.10)';c.beginPath();back.forEach((q,i)=>i?c.lineTo(q.sx,q.sy):c.moveTo(q.sx,q.sy));c.closePath();c.fill();
  c.strokeStyle='rgba(255,255,255,.45)';c.lineWidth=1;
  for(let x=-3.4;x<=3.41;x+=.68){const a=P(x,0,2),b=P(x,2.0,2);c.beginPath();c.moveTo(a.sx,a.sy);c.lineTo(b.sx,b.sy);c.stroke();}
  for(let y=0;y<=2.01;y+=.5){const a=P(-3.4,y,2),b=P(3.4,y,2);c.beginPath();c.moveTo(a.sx,a.sy);c.lineTo(b.sx,b.sy);c.stroke();}
  [[-3.66,0,0,-3.4,0,2],[3.66,0,0,3.4,0,2],[-3.66,2.44,0,-3.4,2.0,2],[3.66,2.44,0,3.4,2.0,2]].forEach(a=>{const p=P(a[0],a[1],a[2]),q=P(a[3],a[4],a[5]);c.beginPath();c.moveTo(p.sx,p.sy);c.lineTo(q.sx,q.sy);c.stroke();});
  const a=P(-3.66,0,0),b=P(-3.66,2.44,0),d=P(3.66,2.44,0),e=P(3.66,0,0);
  c.strokeStyle='#fff';c.lineWidth=lw;c.lineCap='round';c.beginPath();c.moveTo(a.sx,a.sy);c.lineTo(b.sx,b.sy);c.lineTo(d.sx,d.sy);c.lineTo(e.sx,e.sy);c.stroke();
  if(K.flash>0){c.fillStyle='rgba(255,255,255,'+K.flash*.5+')';c.fillRect(Math.min(b.sx,d.sx),Math.min(b.sy,d.sy),Math.abs(d.sx-b.sx),Math.abs(e.sy-b.sy));}
}
function drawFlag(c){
  const b=proj(6,0,.5),t=proj(6,2.6,.5);if(b.f<1)return;
  c.strokeStyle='#fff';c.lineWidth=3;c.beginPath();c.moveTo(b.sx,b.sy);c.lineTo(t.sx,t.sy);c.stroke();
  const d=Math.sign(K.wind)||1,len=14+Math.abs(K.wind)*11,fl=Math.sin(performance.now()/120)*3;
  const th=Math.abs(t.sy-b.sy)*.22;
  c.fillStyle='#e2334d';c.beginPath();c.moveTo(t.sx,t.sy);c.lineTo(t.sx+d*len,t.sy+th*.4+fl);c.lineTo(t.sx,t.sy+th);c.closePath();c.fill();
}
function keeperPos(t){
  const kd=K.kd||{rk:.25,tgt:0};if(K.ph==='aim'||K.ph==='spin'||K.ph==='power')return 0;
  return Math.sign(kd.tgt||1)*Math.min(Math.abs(kd.tgt),K.vk*Math.max(0,t-kd.rk));
}
function ballAt(pt){
  const i=clamp(Math.floor(pt*120),0,K.path.length-2),a=K.path[i],b=K.path[i+1],f=clamp(pt*120-i,0,1);
  return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,z:a.z+(b.z-a.z)*f};
}
function drawField(c){
  const th=Math.atan2(K.dir.x,K.dir.z);
  const g0=c.createLinearGradient(0,0,0,HOR);g0.addColorStop(0,'#8fd0f0');g0.addColorStop(1,'#dff3fb');c.fillStyle=g0;c.fillRect(0,0,W,HOR);
  c.fillStyle='rgba(255,255,255,.85)';[[120,80,60],[430,110,80],[680,70,55]].forEach(a=>{const x=(a[0]-th*300+1600)%1000-100;c.beginPath();c.ellipse(x,a[1],a[2],a[2]*.35,0,0,7);c.fill();});
  building(c,-th*500-100);
  const g=c.createLinearGradient(0,HOR,0,H);g.addColorStop(0,'#6bb56f');g.addColorStop(1,'#3f8f4e');c.fillStyle=g;c.fillRect(0,HOR,W,H-HOR);
  for(let f=4,i=0;f<90;f+=(f<20?3:8),i++){const f2=f+(f<20?3:8);if(i%2){const y1=HOR+K.cam.y/f*F,y2=HOR+K.cam.y/f2*F;c.fillStyle='rgba(255,255,255,.06)';c.fillRect(0,y2,W,y1-y2);}}
  c.strokeStyle='rgba(255,255,255,.85)';c.lineWidth=2;c.lineCap='butt';
  line3(c,[[-30,0],[30,0]]);line3(c,[[-9.16,0],[-9.16,-5.5],[9.16,-5.5],[9.16,0]]);line3(c,[[-20.16,0],[-20.16,-16.5],[20.16,-16.5],[20.16,0]]);
  const sp=proj(0,0,-11);if(sp.f>1){c.fillStyle='#fff';c.beginPath();c.ellipse(sp.sx,sp.sy,4,2,0,0,7);c.fill();}
  drawGoal(c);drawFlag(c);
  const items=[];
  const S4=SPECT;
  const rc=K.react;
  S4.forEach(a=>{const p=proj(a.x,0,a.z);items.push({f:p.f,fn:()=>{person(c,a.x,a.z,1.7,CH[a.n],0,a.n,true);
    const r=rc.find(q=>q.n===a.n);if(r){const q=proj(a.x,1.95,a.z);c.font='16px "Noto Sans KR",sans-serif';const w=c.measureText(r.tx).width+16;c.fillStyle='#fff';rr(c,q.sx-w/2,q.sy-20,w,24,8);c.fill();c.strokeStyle='#232a45';c.lineWidth=2;c.stroke();TX(c,r.tx,q.sx,q.sy-8,15,'#232a45','center');}}});});
  const kt=K.ph==='fly'?K.pt:0,tc=K.tEvt||1,kx=K.ph==='fly'?keeperPos(K.pt):0;
  {const kp=proj(kx,0,-.4);items.push({f:kp.f,fn:()=>{
    const s=1.85*F/kp.f/69;let lift=0,rot=0;
    if(K.ph==='fly'||K.ph==='res'){const kd=K.kd,tt=K.ph==='res'?K.dur:K.pt,q=clamp((tt-kd.rk)/Math.max(.2,tc-kd.rk),0,1);
      rot=Math.sign(kd.tgt||1)*q*1.15*Math.min(1,Math.abs(kd.tgt)/1.5);lift=Math.sin(q*Math.PI)*.4*Math.min(1,Math.abs(kd.tgt)/1.5)*F/kp.f;}
    const kx2=K.ph==='res'?keeperPos(K.dur):kx,kp2=proj(kx2,0,-.4);
    c.save();c.translate(kp2.sx,kp2.sy-34*s-lift);c.rotate(rot);
    kid(c,0,34*s,s,{coat:'#e8c13a',vest:'#e8c13a',hair:'#2b1d14',arms:K.ph==='fly'?'up':undefined});c.restore();
    if(K.ph==='aim'||K.ph==='spin')TX(c,'주스',kp2.sx,kp2.sy-78*s,clamp(s*10,11,18),'#fff','center','rgba(0,0,0,.55)');
    const kr=rc.find(q=>q.n==='주스');
    if(kr){c.font='16px "Noto Sans KR",sans-serif';const bw=c.measureText(kr.tx).width+18,by=kp2.sy-84*s-lift;c.fillStyle='#fff';rr(c,kp2.sx-bw/2,by-22,bw,26,8);c.fill();c.strokeStyle='#232a45';c.lineWidth=2;c.stroke();TX(c,kr.tx,kp2.sx,by-9,15,'#232a45','center');}
  }});}
  const wo=wallObj();
  for(let j=0;j<K.wall;j++){
    const off=(j-(K.wall-1)/2)*.54,wx=K.wallC.x+K.right.x*off,wz=K.wallC.z+K.right.z*off;
    const p=proj(wx,0,wz);
    items.push({f:p.f,fn:()=>{
      let lift=0;if(K.jump&&(K.ph==='fly'||K.ph==='res')){const tt=K.ph==='res'?K.dur:K.pt;lift=.30*Math.sin(Math.PI*clamp((tt-.14)/.6,0,1));}
      person(c,wx,wz,1.72,Object.assign({},CH[WALLNAMES[j%5]],{arms:'cross'}),lift,WALLNAMES[j%5],K.ph==='aim'||K.ph==='spin');
      const wr=rc.find(q=>q.n===WALLNAMES[j%5]);
      if(wr){const q=proj(wx,1.95+lift,wz);c.font='15px "Noto Sans KR",sans-serif';const w=c.measureText(wr.tx).width+16;c.fillStyle='#fff';rr(c,q.sx-w/2,q.sy-22-j*0,w,24,8);c.fill();c.strokeStyle='#232a45';c.lineWidth=2;c.stroke();TX(c,wr.tx,q.sx,q.sy-10,14,'#232a45','center');}}});
  }
  const bp=(K.ph==='fly'||K.ph==='res')?ballAt(K.ph==='res'?K.dur:K.pt):K.ball;
  const bq=proj(bp.x,bp.y,bp.z);
  items.push({f:bq.f-.01,fn:()=>{
    const sh=proj(bp.x,0,bp.z),rad=Math.max(3,.11*F/bq.f);
    c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(sh.sx,sh.sy,rad*1.1,rad*.35,0,0,7);c.fill();
    if(K.ph==='fly'){for(let k=1;k<7;k++){const q=ballAt(Math.max(0,K.pt-k*.03)),pq=proj(q.x,q.y,q.z);c.fillStyle='rgba(255,255,255,'+(0.25-k*.03)+')';c.beginPath();c.arc(pq.sx,pq.sy,Math.max(2,.11*F/pq.f),0,7);c.fill();}}
    c.fillStyle='#fff';c.strokeStyle='#222';c.lineWidth=2;c.beginPath();c.arc(bq.sx,bq.sy,rad,0,7);c.fill();c.stroke();
    c.fillStyle='#222';c.beginPath();c.arc(bq.sx,bq.sy,rad*.36,0,7);c.fill();}});
  items.sort((a,b)=>b.f-a.f).forEach(o=>o.fn());
  if(K.ph==='fly'&&K.pt<.16){
    const q=K.pt/.16,bx=bq.sx,by=bq.sy;c.save();c.translate(bx-95+q*80,by+50-q*38);c.rotate(-.5+q*.4);
    c.fillStyle='#fff';rr(c,-30,-12,64,26,12);c.fill();c.strokeStyle='#232a45';c.lineWidth=3;c.stroke();
    c.fillStyle='#3b7de0';c.fillRect(-16,-4,32,5);c.restore();
  }
}
function drawSpin(c){
  const cx=640,cy=262,R=88;
  c.fillStyle='rgba(255,255,255,.96)';rr(c,520,110,240,300,14);c.fill();c.strokeStyle='#232a45';c.lineWidth=3;c.stroke();
  TX(c,'공의 어디를 찰까?',640,130,20,'#232a45','center');
  c.fillStyle='#fff';c.strokeStyle='#232a45';c.lineWidth=4;c.beginPath();c.arc(cx,cy,R,0,7);c.fill();c.stroke();
  c.fillStyle='#232a45';c.beginPath();c.arc(cx,cy,R*.3,0,7);c.fill();
  for(let i=0;i<5;i++){const a=i/5*6.283;c.beginPath();c.arc(cx+Math.cos(a)*R*.75,cy+Math.sin(a)*R*.75,R*.14,0,7);c.fill();}
  c.strokeStyle='rgba(226,51,77,.35)';c.lineWidth=2;c.beginPath();c.moveTo(cx-R,cy);c.lineTo(cx+R,cy);c.moveTo(cx,cy-R);c.lineTo(cx,cy+R);c.stroke();
  const dx=cx+K.spin.x*R*.8,dy=cy+K.spin.y*R*.8;
  c.strokeStyle='#e2334d';c.lineWidth=8;c.beginPath();c.arc(dx,dy,13,0,7);c.stroke();c.fillStyle='#fff';c.beginPath();c.arc(dx,dy,4,0,7);c.fill();
  TX(c,'위: 넘겨 차기 (급강하)',640,152,14,'#232a45','center');
  TX(c,'← 왼쪽으로 휨',575,370,13,'#5d6580','center');TX(c,'오른쪽으로 휨 →',705,370,13,'#5d6580','center');
  TX(c,'아래: 낮고 빠르게',640,386,14,'#232a45','center');
  TX(c,'방향키/마우스 · 클릭/Space 확정',640,402,12,'#5d6580','center');
  // 예상 궤적
  const wind=0,v=solve(K.ball,K.aim.tx,K.aim.ty,K.spin.x,-K.spin.y),fr=flight(K.ball,v,K.spin.x,-K.spin.y,wind,null,true);
  fr.path.forEach((p,i)=>{if(i%5||i>fr.path.length-2)return;const q=proj(p.x,p.y,p.z);if(q.f<.5)return;c.fillStyle='rgba(255,255,255,.9)';c.strokeStyle='rgba(35,42,69,.6)';c.lineWidth=1;c.beginPath();c.arc(q.sx,q.sy,3,0,7);c.fill();c.stroke();});
}
function drawCeleb(c){
  const t=K.celeb,hop=Math.abs(Math.sin(t*8))*46,fl=Math.floor(t*4)%2===0;
  c.fillStyle='rgba(255,230,120,.25)';c.beginPath();c.ellipse(175,H-4,110,22,0,0,7);c.fill();
  kid(c,175,H-6-hop,3,{face:'excited',arms:'up',flip:fl});
  const words=['롹!','롹롹!','만세!'],w=words[Math.floor(t*3)%3];
  TX(c,w,175+(fl?-80:80),H-215-hop*.3,46*(1+.1*Math.sin(t*16)),'#fff','center','#e2334d');
}
function drawBite(c){
  const t=K.t,gy=H-6,rs=2.6,sh=(t>.85&&t<1.5)?Math.sin(t*70)*5:0,rx=180+sh;
  const hy=gy-52*rs;
  c.fillStyle='rgba(0,0,0,.15)';c.beginPath();c.ellipse(230,H-4,150,20,0,0,7);c.fill();
  kid(c,rx,gy,rs,{face:t<.55?'frustrated':t<1.7?'panic':'sad'});
  const run=clamp(t/.55,0,1),ease=1-Math.pow(1-run,3),lunge=clamp((t-.55)/.3,0,1);
  let jx=880+(400-880)*ease+(268-400)*lunge*lunge;
  if(t>.85)jx=268+(t<1.5?Math.sin(t*30)*2.5:0);
  kid(c,jx,gy,rs,Object.assign({},CH['주스'],{flip:true,run:t<.55,ph:t*22}));
  bigHead(c,jx,hy,46,Object.assign({},CH['주스'],{nomouth:true}));
  c.strokeStyle='#222';c.lineWidth=5;c.lineCap='round';
  c.beginPath();c.moveTo(jx-34,hy-20);c.lineTo(jx-8,hy-8);c.moveTo(jx+34,hy-20);c.lineTo(jx+8,hy-8);c.stroke();
  const open=t<.55?0:t<.85?lunge:t<.95?1-(t-.85)/.1:(t<1.5?0:Math.max(0,Math.sin((t-1.5)*8))*.6),mo=Math.max(open,.08);
  const mx=jx-30,my=hy+16;
  c.fillStyle='#4a0f14';c.beginPath();c.ellipse(mx,my,12+14*mo,5+24*mo,0,0,7);c.fill();
  c.fillStyle='#fff';
  [[-1],[1]].forEach(a=>{const s=a[0];c.beginPath();c.moveTo(mx-8,my+s*(5+24*mo)*.95);c.lineTo(mx+8,my+s*(5+24*mo)*.95);c.lineTo(mx,my+s*(5+24*mo)*.45);c.closePath();c.fill();});
  if(t>.9){c.strokeStyle='#c4372f';c.lineWidth=3;c.beginPath();c.arc(rx+38,hy-4,6,-1.3,1.3);c.moveTo(rx+40,hy+14);c.arc(rx+40,hy+18,5,-1.3,1.3);c.stroke();}
  if(t>.85&&t<1.15){const a=1-(t-.85)/.3;c.strokeStyle='rgba(255,220,80,'+a+')';c.lineWidth=4;for(let i=0;i<8;i++){const an=i/8*6.283;c.beginPath();c.moveTo(jx-44+Math.cos(an)*22,my+Math.sin(an)*22);c.lineTo(jx-44+Math.cos(an)*44,my+Math.sin(an)*44);c.stroke();}}
  if(t>.85)TX(c,'앙!',jx-64,hy-86,76*(1+.12*Math.sin(t*20)),'#fff','center','#e2334d');
  if(t>.2){const msg=t<1.3?'깨물어버린다!':'한 손가락이면 충분하다니까~';c.font='16px "Noto Sans KR",sans-serif';const bw=c.measureText(msg).width+22,bx=jx+70,by=hy-96;
    c.fillStyle='#fff';rr(c,bx-bw/2,by-16,bw,32,10);c.fill();c.strokeStyle='#232a45';c.lineWidth=2;c.stroke();TX(c,msg,bx,by,16,'#232a45','center');}
}
function drawEmerg(c){
  const p=.5+.5*Math.sin(performance.now()/80),n=Math.max(1,Math.ceil(K.timer));
  const g=c.createRadialGradient(W/2,H/2,H*.32,W/2,H/2,W*.62);g.addColorStop(0,'rgba(226,51,77,0)');g.addColorStop(1,'rgba(226,51,77,'+(.28+.34*p)+')');
  c.fillStyle=g;c.fillRect(0,52,W,H-52);
  c.save();c.translate(W/2,118);const sc=1+.18*p;c.scale(sc,sc);TX(c,String(n),0,0,76,'#fff','center','#e2334d');c.restore();
  TX(c,'종이 곧 울린다!',W/2,166,24,'#fff','center','#e2334d');
}
function drawParticles(c){
  K.conf.forEach(p=>{c.save();c.translate(p.x,p.y);c.rotate(p.a);c.fillStyle=p.c;c.fillRect(-4,-2,8,4);c.restore();});
  K.fw.forEach(p=>{const a=Math.min(1,p.t*1.5);c.globalAlpha=a;c.strokeStyle=p.c;c.lineWidth=2;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-p.vx*.04,p.y-p.vy*.04);c.stroke();c.fillStyle=p.c;c.beginPath();c.arc(p.x,p.y,2.6,0,7);c.fill();});
  c.globalAlpha=1;
}
function drawKick(c){
  c.save();if(K.shake>0)c.translate(rand(-5,5),rand(-4,4));drawField(c);c.restore();
  hudBar(c,'주스 vs 롹순팅',`${K.i+1}/5킥 · ${K.label}`,`판돈 ${fmt(M.bet)}원`);
  for(let i=0;i<5;i++){const r=M.res[i],x=26+i*30;
    c.fillStyle=r?(r.type==='goal'?'#2f8f5b':r.type==='post'?'#e8a91c':'#e2334d'):'#dfe4ee';c.beginPath();c.arc(x,68,11,0,7);c.fill();
    c.lineWidth=i===K.i?4:2;c.strokeStyle=i===K.i?'#fff':'#232a45';c.stroke();if(r&&r.type==='goal')TX(c,'✓',x,69,14,'#fff','center');}
  TX(c,`점수 ${M.pts}`,180,68,18,'#fff','left','rgba(0,0,0,.5)');
  if(K.ph==='aim'||K.ph==='spin'||K.ph==='power'){
    c.fillStyle='rgba(0,0,0,.35)';rr(c,W/2-150,60,300,12,6);c.fill();
    c.fillStyle=K.emerg?(Math.floor(performance.now()/120)%2?'#fff':'#e2334d'):'#e8a91c';rr(c,W/2-150,60,300*clamp(K.timer/K.limit,0,1),12,6);c.fill();
    TX(c,Math.ceil(K.timer)+'초',W/2+192,66,16,K.emerg?'#ffb3bd':'#fff','left','rgba(0,0,0,.5)');
  }
  TX(c,'바람: 깃발을 봐',W-16,68,16,'#fff','right','rgba(0,0,0,.5)');
  if(K.ph==='aim'){
    const x=K.cur.x+K.sw.x,y=K.cur.y+K.sw.y;
    c.strokeStyle='#e2334d';c.lineWidth=6;c.beginPath();c.arc(x,y,17,0,7);c.stroke();
    c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.arc(x,y,17,0,7);c.stroke();
    c.strokeStyle='#e2334d';c.lineWidth=3;c.beginPath();c.moveTo(x-28,y);c.lineTo(x-12,y);c.moveTo(x+12,y);c.lineTo(x+28,y);c.moveTo(x,y-28);c.lineTo(x,y-12);c.moveTo(x,y+12);c.lineTo(x,y+28);c.stroke();
    TX(c,'조준: 마우스/방향키 · 클릭/Space로 확정',W/2,H-24,18,'#fff','center','rgba(0,0,0,.6)');
    if(K.t<3.5)TX(c,K.tip,W/2,H-52,17,'#ffe066','center','rgba(0,0,0,.6)');
  }
  if(K.ph==='spin')drawSpin(c);
  if(K.ph==='power'){
    const x0=200,x1=600,y0=414;
    c.fillStyle='rgba(20,24,44,.85)';rr(c,x0-10,y0-30,x1-x0+20,64,12);c.fill();
    c.fillStyle='#dfe4ee';rr(c,x0,y0,x1-x0,22,8);c.fill();
    const sw=sweetHalf();c.fillStyle='#2f8f5b';c.fillRect(x0+(x1-x0)*(.75-sw),y0,(x1-x0)*sw*2,22);
    c.fillStyle='#e2334d';rr(c,x0,y0,(x1-x0)*K.p,22,8);c.fill();
    c.strokeStyle='#232a45';c.lineWidth=3;rr(c,x0,y0,x1-x0,22,8);c.stroke();
    TX(c,K.charging?'초록 구간에서 떼!':'Space를 꾹 누르세요 (마우스 누르고 있기도 가능)',W/2,y0-14,16,'#fff','center');
  }
  if(K.ph==='res'||K.ph==='trip'||(K.ph==='fly'&&K.pt>=K.tEvt&&K.result)){
    if(K.result){const q=(K.ph==='res'||K.ph==='trip')?Math.min(1,K.t*5):1;c.save();c.translate(W/2,205);c.scale(.6+.4*q,.6+.4*q);TX(c,K.result.title,0,0,54,'#fff','center',K.result.col);TX(c,K.result.sub,0,48,22,'#fff','center','rgba(0,0,0,.6)');c.restore();}
  }
  if(K.pen&&(K.ph==='aim'||K.ph==='spin'||K.ph==='power')&&K.introT<=0){const g=c.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,W*.66);g.addColorStop(0,'rgba(10,13,27,0)');g.addColorStop(1,'rgba(10,13,27,.5)');c.fillStyle=g;c.fillRect(0,52,W,H-52);}
  if(K.emerg&&(K.ph==='aim'||K.ph==='spin'||K.ph==='power'))drawEmerg(c);
  if(K.introT>0){
    const p=.5+.5*Math.sin(performance.now()/110);
    c.fillStyle='rgba(10,13,27,.72)';c.fillRect(0,52,W,H-52);
    c.fillStyle='#000';c.fillRect(0,52,W,34);c.fillRect(0,H-34,W,34);
    c.save();c.translate(W/2+rand(-2,2),200+rand(-2,2));const sc=1+.05*p;c.scale(sc,sc);TX(c,'운명의 페널티킥',0,0,68,'#fff','center','#e2334d');c.restore();
    TX(c,'마지막 한 방 · 11m',W/2,262,24,'#ffd166','center','rgba(0,0,0,.7)');
    TX(c,K.tip,W/2,306,22,'#fff','center','rgba(0,0,0,.7)');
  }
  const isGoal=K.result&&K.result.type==='goal',celebOn=K.celeb>=0&&K.celeb<3.2,biteOn=K.ph==='res'&&!isGoal;
  if(celebOn)drawCeleb(c);
  if(biteOn)drawBite(c);
  drawParticles(c);
  const fc=K.ph==='res'&&K.result?(K.result.type==='goal'?'excited':K.result.type==='post'?'surprise':K.result.type==='wall'?'panic':'frustrated'):K.face;
  if(!celebOn&&!biteOn){c.fillStyle='rgba(20,24,44,.6)';c.beginPath();c.arc(58,H-58,50,0,7);c.fill();
  faceImg(c,fc,58,H-58,44);c.strokeStyle='#e2334d';c.lineWidth=5;c.beginPath();c.arc(58,H-58,48,0,7);c.stroke();}
  if(K.ph==='res'&&(isGoal?K.celeb>=2.0:K.t>1.8))TX(c,'Space: 다음',W-16,H-24,16,'#fff','right','rgba(0,0,0,.6)');
  if(K.ph==='trip'&&K.t>1.2)TX(c,'Space: 다음',W-16,H-24,16,'#fff','right','rgba(0,0,0,.6)');
}

