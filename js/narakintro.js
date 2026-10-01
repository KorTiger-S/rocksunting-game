'use strict';
/* ---------- '나락쓰레기장' 인트로: 회사 → 6시 퇴근 → 집안일 → 밤 9시 롤 접속 → 10시 친구들 로그인 ----------
   엔진은 jgintro.js(INTROS, jgPlay). 주인공 '나'는 롹순팅(표정 사진 IMGDATA)으로 그려요.
   게임 화면은 이름(리그오브레전드)만 글자로 쓰고, 로고·실제 화면은 따라 그리지 않았어요.
   친구 목록 이름은 NK_FRIENDS에서 바꿀 수 있어요. 음악: office(사무실) · match(퇴근·집안일) · night(밤 컴퓨터) */
const NK_FRIENDS=['호우','씨붕','주스','ㅈㄱ','현숭'];
const nkRock=(c,x,y,s,face,o,t)=>ltRock(c,x,y,s,face,o,t);
const nkTime=m=>{const h=Math.floor(m/60),mm=Math.floor(m%60);return `오후 ${h>12?h-12:h}:${String(mm).padStart(2,'0')}`;};   /* m: 0시부터 분 */
/* 벽시계. m: 0시부터 분 */
function nkClock(c,x,y,r,m){
  c.fillStyle='#fff';c.beginPath();c.arc(x,y,r,0,7);c.fill();c.lineWidth=Math.max(3,r*.12);c.strokeStyle='#232a45';c.stroke();
  c.lineWidth=2;for(let i=0;i<12;i++){const a=i/12*Math.PI*2;c.beginPath();c.moveTo(x+Math.sin(a)*r*.78,y-Math.cos(a)*r*.78);c.lineTo(x+Math.sin(a)*r*.9,y-Math.cos(a)*r*.9);c.stroke();}
  const ha=((m/60)%12)/12*Math.PI*2,ma=(m%60)/60*Math.PI*2;c.lineCap='round';
  c.lineWidth=Math.max(3,r*.1);c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.sin(ha)*r*.5,y-Math.cos(ha)*r*.5);c.stroke();
  c.strokeStyle='#e2334d';c.lineWidth=Math.max(2,r*.06);c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.sin(ma)*r*.78,y-Math.cos(ma)*r*.78);c.stroke();
  c.fillStyle='#232a45';c.beginPath();c.arc(x,y,r*.08,0,7);c.fill();
}
/* 사무실 배경. dusk 0(오후)~1(해 질 녘) */
function nkOffice(c,dusk){
  c.fillStyle='#dfe5ea';c.fillRect(0,0,W,330);c.fillStyle='#9aa3b0';c.fillRect(0,330,W,H-330);
  c.strokeStyle='rgba(0,0,0,.06)';c.lineWidth=2;for(let x=0;x<W;x+=60){c.beginPath();c.moveTo(x,330);c.lineTo(x,H);c.stroke();}
  const d=clamp(dusk,0,1),sky=`rgb(${Math.round(150+100*d)},${Math.round(205-60*d)},${Math.round(240-130*d)})`;
  c.fillStyle=sky;rr(c,580,50,170,120,4);c.fill();c.strokeStyle='#7d8796';c.lineWidth=6;c.stroke();
  c.beginPath();c.moveTo(665,50);c.lineTo(665,170);c.stroke();
  c.fillStyle='#b8c2cf';[[600,120,30,50],[640,100,22,70],[690,110,40,60]].forEach(b=>c.fillRect(b[0],b[1],b[2],b[3]));   /* 창밖 빌딩 */
  c.fillStyle='#c9ced6';c.fillRect(0,170,140,160);c.fillStyle='#b3bac4';c.fillRect(0,166,144,6);   /* 옆자리 칸막이 */
  c.fillStyle='#7a5a3a';rr(c,740,290,30,40,4);c.fill();c.fillStyle='#5aa469';c.beginPath();c.ellipse(755,270,26,34,0,0,7);c.fill();   /* 화분 */
}
function nkDesk(c,x0,x1,top){
  c.fillStyle='#a88f66';c.fillRect(x0+10,top+12,x1-x0-20,372-top-12);
  c.fillStyle='#c9b28a';rr(c,x0,top,x1-x0,14,3);c.fill();
}
/* 모니터: (cx, 아래 끝 by), 화면 그리기 fn(c,x,y,w,h) */
function nkMon(c,cx,by,w,h,fn){
  c.fillStyle='#3a4160';c.fillRect(cx-8,by-20,16,20);rr(c,cx-34,by-6,68,8,3);c.fill();
  const x=cx-w/2,y=by-20-h;
  c.fillStyle='#232a45';rr(c,x-8,y-8,w+16,h+16,8);c.fill();
  c.save();c.beginPath();c.rect(x,y,w,h);c.clip();fn(c,x,y,w,h);c.restore();
}
function nkSheet(c,x,y,w,h,t){   /* 엑셀 같은 표 */
  c.fillStyle='#fff';c.fillRect(x,y,w,h);c.fillStyle='#1f7a4c';c.fillRect(x,y,w,14);
  c.strokeStyle='#d5dae0';c.lineWidth=1;
  for(let yy=y+26;yy<y+h;yy+=12){c.beginPath();c.moveTo(x,yy);c.lineTo(x+w,yy);c.stroke();}
  for(let xx=x+30;xx<x+w;xx+=40){c.beginPath();c.moveTo(xx,y+14);c.lineTo(xx,y+h);c.stroke();}
  c.fillStyle='#9aa3b0';for(let r=0;r<8;r++)for(let k=0;k<4;k++)if((r*3+k)%4)c.fillRect(x+34+k*40,y+29+r*12,22+((r+k)%3)*5,5);
  const cr=Math.floor(t*2)%8;c.strokeStyle='#1f7a4c';c.lineWidth=2;c.strokeRect(x+30,y+26+cr*12,40,12);
}
function nkChair(c,x,spin){
  const k=Math.cos(spin||0);c.save();c.translate(x,0);c.scale(Math.max(.15,Math.abs(k)),1);
  c.fillStyle=k>0?'#2f3a56':'#232a45';rr(c,-36,222,72,96,12);c.fill();c.restore();
}
/* 집안일 소품 */
function nkTable(c,x,food){
  c.fillStyle='#8a6034';rr(c,x-90,300,180,12,3);c.fill();c.fillRect(x-80,312,10,60);c.fillRect(x+70,312,10,60);
  c.fillStyle='#fff';c.beginPath();c.ellipse(x-30,292,28,10,0,0,7);c.fill();c.fillStyle='#f4f6ef';c.beginPath();c.arc(x-30,292-6*food,22*Math.max(.15,food),Math.PI,0);c.fill();   /* 밥 */
  c.fillStyle='#d8743a';c.beginPath();c.ellipse(x+35,294,24,8,0,0,7);c.fill();c.fillStyle='#b5402a';c.beginPath();c.ellipse(x+35,290,18*Math.max(.1,food),5,0,0,7);c.fill();   /* 반찬 */
}
function nkVacuum(c,x,y,t){
  c.strokeStyle='#5a6378';c.lineWidth=5;c.beginPath();c.moveTo(x,y-90);c.lineTo(x+40,y-6);c.stroke();
  c.fillStyle='#e2334d';rr(c,x+22,y-14,46,14,4);c.fill();
  for(let i=0;i<4;i++){const q=(t*2+i/4)%1;c.fillStyle=`rgba(160,150,130,${(1-q)*.5})`;c.beginPath();c.arc(x+70+q*40,y-8-q*20,5+q*10,0,7);c.fill();}
}
function nkWasher(c,x,t,shake){
  const sx=Math.sin(t*40)*shake;c.save();c.translate(sx,0);
  c.fillStyle='#eef1f5';rr(c,x-60,240,120,132,10);c.fill();c.strokeStyle='#232a45';c.lineWidth=3;c.stroke();
  c.fillStyle='#9aa3b0';c.fillRect(x-50,252,60,10);c.fillStyle='#3b7de0';c.beginPath();c.arc(x+38,257,5,0,7);c.fill();
  c.fillStyle='#bfe6ff';c.beginPath();c.arc(x,318,38,0,7);c.fill();c.stroke();
  ['#e2334d','#ffd23f','#2f8f5b','#8a5ad8'].forEach((col,i)=>{const a=t*9+i*1.57;c.fillStyle=col;c.beginPath();c.ellipse(x+Math.cos(a)*18,318+Math.sin(a)*18,10,6,a,0,7);c.fill();});
  c.restore();
}
function nkFF(c,t){   /* 빨리감기 표시 */
  if(Math.floor(t*3)%2)return;
  c.fillStyle='rgba(20,24,44,.75)';rr(c,20,20,150,40,10);c.fill();TX(c,'▶▶ 빨리감기',95,40,18,'#ffd23f','center');
}
/* 게임 화면(로고 없이 이름만). fr: 친구별 접속 정도 0~1, clock: 분 */
function nkClient(c,x,y,w,h,o){
  const g=c.createLinearGradient(x,y,x,y+h);g.addColorStop(0,'#0a1428');g.addColorStop(1,'#010a13');c.fillStyle=g;c.fillRect(x,y,w,h);
  const s=w/800;c.save();c.translate(x,y);c.scale(s,s);
  c.fillStyle='rgba(200,170,110,.15)';c.fillRect(0,0,800,56);c.fillStyle='#c8aa6e';c.fillRect(0,56,800,2);
  TX(c,'리그오브레전드',24,28,24,'#c8aa6e');
  c.strokeStyle='#c8aa6e';c.lineWidth=2;rr(c,250,12,110,32,4);c.stroke();TX(c,'플레이',305,28,18,'#f0e6d2','center');
  TX(c,nkTime(o.clock),590,28,16,'#a09b8c','right');
  /* 가운데: 로비 */
  c.save();c.translate(370,250);c.rotate((o.t||0)*2);c.strokeStyle='rgba(200,170,110,.7)';c.lineWidth=5;c.beginPath();c.arc(0,0,40,0,Math.PI*1.4);c.stroke();c.restore();
  TX(c,o.msg||'',370,320,20,'#f0e6d2','center');
  /* 오른쪽: 친구 목록 */
  c.fillStyle='rgba(1,10,19,.85)';c.fillRect(600,58,200,422);c.fillStyle='#c8aa6e';c.fillRect(600,58,2,422);
  const on=o.fr.filter(v=>v>=1).length;
  TX(c,`친구 (${on}/${NK_FRIENDS.length})`,616,82,15,'#c8aa6e');
  NK_FRIENDS.forEach((n,i)=>{
    const v=clamp(o.fr[i],0,1),yy=118+i*56;
    if(v>0&&v<1){c.fillStyle=`rgba(10,200,185,${.35*(1-v)})`;c.fillRect(602,yy-24,198,48);}
    c.save();c.globalAlpha=.35+.65*v;bigHead(c,636,yy,18,CH[n]||{});c.restore();
    c.fillStyle=v>=1?'#0acf83':'#5b5a56';c.beginPath();c.arc(650,yy+13,6,0,7);c.fill();c.strokeStyle='#010a13';c.lineWidth=2;c.stroke();
    TX(c,n,666,yy-8,17,v>=1?'#f0e6d2':'#7a776f');
    c.font='13px "Noto Sans KR",sans-serif';c.fillStyle=v>=1?'#0acf83':'#5b5a56';c.textAlign='left';c.fillText(v>=1?'온라인 · 로비':'오프라인',666,yy+12);
  });
  c.restore();
}
/* 친구 로그인 알림이 뜨는 시각(장면 안 진행도 p) */
const NK_ON=NK_FRIENDS.map((_,i)=>.08+i*.13);

const NKS=[
  {d:5.2,bgm:'office',cap:'회사 사무실. 오늘도 모니터 앞에서 지루하게 일하는 중…',ev:[[.3,'typing'],[1.5,'typing'],[3.4,'typing']],
   draw(c,t,p){
    nkOffice(c,.2);nkClock(c,250,90,38,17*60+56+p*3);
    nkChair(c,260);nkRock(c,260,372,2.3,p<.5?'tired':'worn',{},t);
    nkDesk(c,150,660,300);
    nkMon(c,470,300,200,130,(c,x,y,w,h)=>nkSheet(c,x,y,w,h,t));
    c.fillStyle='#3a4160';rr(c,300,294,110,8,2);c.fill();   /* 키보드 */
    c.fillStyle='#fff';rr(c,560,286,40,10,2);c.fill();c.fillStyle='#8a6034';c.fillRect(612,276,18,20);   /* 서류·커피 */
    if(p>.45)jgBubble(c,230,150,'하아… 언제 끝나…',19);
  }},
  {d:4.8,bgm:'match',cap:'오후 6시 땡! 불이 나게 퇴근한다!',ev:[[1.25,'offwork'],[2.4,'whoosh']],
   draw(c,t,p){
    nkOffice(c,.6);
    const tm=17*60+59+clamp((p-.1)/.15,0,1);nkClock(c,250,90,38,tm);
    if(p>.26&&p<.5)TX(c,'6:00!',250,160,30,'#e2334d','center','#fff');
    const go=p>.5,q=jgEase((p-.5)/.4);
    nkChair(c,260,go?t*14:0);
    if(!go){const up=p>.26;nkRock(c,260,372-(up?Math.abs(Math.sin(t*10))*24:0),2.3,up?'excited':'worn',{arms:up?'up':undefined},t);}
    nkDesk(c,150,660,300);
    nkMon(c,470,300,200,130,(c,x,y,w,h)=>{c.fillStyle=go?'#111':'#fff';c.fillRect(x,y,w,h);if(!go)nkSheet(c,x,y,w,h,t);});
    if(go){
      const x=300+q*700;nkRock(c,x,372,2.3,'happy',{run:true},t);
      c.strokeStyle='rgba(35,42,69,.5)';c.lineWidth=4;for(let i=0;i<5;i++){const yy=250+i*25;c.beginPath();c.moveTo(x-80-i*14,yy);c.lineTo(x-200-i*20,yy);c.stroke();}
      for(let i=0;i<3;i++){const a=t*6+i*2;c.save();c.translate(420+i*70,200-((t*120+i*60)%160));c.rotate(a);c.fillStyle='#fff';c.fillRect(-12,-15,24,30);c.restore();}   /* 날리는 서류 */
      jgBubble(c,clamp(x,120,680),150,'퇴근이다~!!',22);
    }
  }},
  {d:6,bgm:'match',cap:'집에 와서 저녁을 후다닥 먹고, 청소와 빨래도 빛의 속도로 해치운다!',ev:[[.2,'chomp'],[.7,'chomp'],[1.2,'chomp'],[2.1,'vacuum'],[4.1,'washer']],
   draw(c,t,p){
    jgRoom(c,.25+p*.5);nkClock(c,300,95,34,18*60+30+p*140);
    const ph=Math.min(2,Math.floor(p*3)),f=p*3-ph;
    if(ph===0){
      nkRock(c,300,372,2.3,'happy',{},t);nkTable(c,330,1-f);
      c.strokeStyle='#8a6034';c.lineWidth=3;const b=Math.sin(t*30)*8;c.beginPath();c.moveTo(330,240+b);c.lineTo(305,290);c.moveTo(338,240+b);c.lineTo(312,290);c.stroke();   /* 젓가락 */
      TX(c,'냠냠냠!',300,150,28,'#e2334d','center','#fff');
    }else if(ph===1){
      const x=150+(Math.sin(t*7)*.5+.5)*400;nkRock(c,x,372,2.3,'resolve',{run:true},t);nkVacuum(c,x+20,372,t);
      TX(c,'위잉~',x,150,26,'#3b7de0','center','#fff');
    }else{
      nkWasher(c,560,t,4);nkRock(c,330,372,2.3,'excited',{arms:f>.5?'up':undefined},t);
      if(f<.5){c.fillStyle='#c9a26b';rr(c,330,300,80,40,8);c.fill();c.fillStyle='#e2334d';c.fillRect(345,292,20,12);c.fillStyle='#3b7de0';c.fillRect(372,290,22,14);}   /* 빨래 바구니 */
      else TX(c,'끝!',330,150,34,'#2f8f5b','center','#fff');
    }
    nkFF(c,t);
  }},
  {d:5.4,bgm:'night',cap:'밤 9시. 컴퓨터를 켜고 리그오브레전드를 실행!',ev:[[1.2,'click'],[1.4,'boot'],[3.2,'boot']],
   draw(c,t,p){
    jgRoom(c,1);nkClock(c,300,95,34,21*60+p*2);
    const on=p>.25,ld=p>.6;
    if(on){const g=c.createRadialGradient(550,215,10,550,215,320);g.addColorStop(0,'rgba(120,170,255,.35)');g.addColorStop(1,'rgba(120,170,255,0)');c.fillStyle=g;c.fillRect(0,0,W,H);}
    nkRock(c,370,372,2.3,on?'excited':'resolve',{arms:p>.15&&p<.25?'up':undefined},t);
    nkMon(c,550,292,190,124,(c,x,y,w,h)=>{
      if(!on){c.fillStyle='#0b0d18';c.fillRect(x,y,w,h);return;}
      if(!ld){c.fillStyle='#0a1428';c.fillRect(x,y,w,h);TX(c,'리그오브레전드',x+w/2,y+h/2-8,17,'#c8aa6e','center');
        c.fillStyle='rgba(200,170,110,.3)';c.fillRect(x+30,y+h-30,w-60,6);c.fillStyle='#c8aa6e';c.fillRect(x+30,y+h-30,(w-60)*clamp((p-.3)/.3,0,1),6);return;}
      nkClient(c,x,y,w,h,{clock:21*60,fr:NK_FRIENDS.map(()=>0),t,msg:''});
    });
    if(p>.65)jgBubble(c,330,150,'오늘도 달린다!',20);
  }},
  {d:5.4,bgm:'night',cap:'게임을 켜 놓고 친구들을 기다린다. 다들 언제 오려나…',ev:[[.4,'tick'],[1.4,'tick'],[2.4,'tick'],[3.4,'tick'],[4.4,'tick']],
   draw(c,t,p){
    nkClient(c,0,0,W,H,{clock:21*60+Math.floor(p*59),fr:NK_FRIENDS.map(()=>0),t,msg:'친구를 기다리는 중…'});
    c.fillStyle='rgba(1,10,19,.7)';rr(c,24,250,190,130,14);c.fill();
    faceImg(c,p<.6?'doubt':'tired',80,318,44);
    for(let i=0;i<3;i++){c.fillStyle='#f2c9a5';c.beginPath();c.arc(150+i*18,352-Math.abs(Math.sin(t*12+i))*8,7,0,7);c.fill();}   /* 손가락 톡톡 */
    jgBubble(c,150,215,'다들 언제 와…',18);
  }},
  {d:7,bgm:'night',cap:'밤 10시! 친구 목록에 하나둘씩 친구들이 로그인한다!',ev:NK_ON.map(q=>[q*7,'friendon']).concat([[5.5,'welcome']]),
   draw(c,t,p){
    const fr=NK_ON.map(q=>clamp((p-q)/.06,0,1)),n=fr.filter(v=>v>=1).length;
    nkClient(c,0,0,W,H,{clock:22*60,fr,t,msg:n?`${n}명 접속! 같이 할 사람~?`:'친구를 기다리는 중…'});
    const last=NK_ON.reduce((a,q,i)=>p>=q?i:a,-1);
    if(last>=0&&p-NK_ON[last]<.12){const a=Math.min(1,(p-NK_ON[last])/.03);c.save();c.globalAlpha=a;
      c.fillStyle='rgba(10,20,40,.95)';rr(c,170,70,260,44,8);c.fill();c.strokeStyle='#0acf83';c.lineWidth=2;c.stroke();
      TX(c,`${NK_FRIENDS[last]} 님이 로그인했습니다`,300,92,17,'#f0e6d2','center');c.restore();}
    c.fillStyle='rgba(1,10,19,.7)';rr(c,24,250,190,130,14);c.fill();
    faceImg(c,n>=3?'excited':n>=1?'happy':'doubt',80,318,44);
    if(n>=1)jgBubble(c,150,215,n>=NK_FRIENDS.length?'다 모였다! 가자!!':'왔다!!',18);
    if(p>.8){const a=jgEase((p-.8)/.12);c.save();c.globalAlpha=a;
      c.fillStyle='rgba(20,24,44,.92)';rr(c,170,140,460,96,16);c.fill();c.strokeStyle='#c8aa6e';c.lineWidth=3;c.stroke();
      TX(c,'나락쓰레기장',400,178,44,'#ffd23f','center','#232a45');
      TX(c,JG.done?'노래 시작!':'THE END',400,218,16,'#f4f6ef','center');c.restore();}
  }}
];
INTROS.narak={scenes:NKS,bgm:'night',btn:'🎬 퇴근하고 롤 켜는 이야기 보기'};
