'use strict';
/* ---------- '등굣길 뜀박질' 인트로: 지각 · 두발 검사 · 담 넘기 ----------
   엔진은 jgintro.js(INTROS, jgPlay). 롹순팅은 표정 그림(IMGDATA), 라털 선생님은 hub.js의 RATAL_IMG 초상화를 써요.
   두발 규정: 여학생 단발은 귀밑 3cm, 남학생 반삭발은 3cm를 넘으면 안 돼요. */
const LT_RATAL=new Image();LT_RATAL.src=RATAL_IMG;
const LT_RULE=new Image();LT_RULE.src='assets/intro/hair-rule.png';   /* 라털 선생님이 든 두발 규정 종이(실제 사진). 단일 파일 빌드에선 data URI로 바뀌어요 */
const LT_RULE_AT=[1.1,2.1];   /* 정문 장면에서 규정 종이 사진을 화면 가득 띄우는 구간(초) */
const LT_SSI=Object.assign({},CH['씨붕']),LT_JUS=Object.assign({},CH['주스']);
const ltRock=(c,x,y,s,face,o,t)=>kid(c,x,y,s,Object.assign({face},o||{},{ph:o&&o.run?(t||0)*12:0}));   /* 다리는 뛸 때만 움직여요 */
/* 머리 둘레에 그림을 덧그릴 때 쓰는 머리 중심·반지름 (kid()의 머리는 발밑에서 52×s 위, 반지름 15×s) */
const ltHead=(x,y,s)=>({hx:x,hy:y-52*s,r:15*s});
function ltImgHead(c,img,x,y,s){
  if(!img.complete||!img.naturalWidth)return;
  const {hx,hy}=ltHead(x,y,s),r=18*s;
  c.save();c.beginPath();c.arc(hx,hy,r,0,7);c.clip();c.drawImage(img,hx-r*1.35,hy-r*1.2,r*2.7,r*2.7);c.restore();
  c.lineWidth=2;c.strokeStyle='#232a45';c.beginPath();c.arc(hx,hy,r,0,7);c.stroke();
}
/* 여학생: 앞머리를 일자로 자른 짧은 단발(귀밑 3cm) */
function ltGirl(c,x,y,s,t){
  kid(c,x,y,s,{hair:'#1c1a1a',coat:'#232a45',vest:'#6d1f31',ph:t});
  const {hx,hy,r}=ltHead(x,y,s);c.fillStyle='#1c1a1a';
  c.beginPath();c.arc(hx,hy-r*.05,r*1.12,Math.PI,0);c.lineTo(hx+r*1.12,hy+r*.72);c.lineTo(hx+r*.72,hy+r*.72);c.lineTo(hx+r*.72,hy-r*.3);
  c.lineTo(hx-r*.72,hy-r*.3);c.lineTo(hx-r*.72,hy+r*.72);c.lineTo(hx-r*1.12,hy+r*.72);c.closePath();c.fill();
}
/* 남학생: 아주 짧은 반삭발(3cm) */
function ltBoy(c,x,y,s,t){
  kid(c,x,y,s,{hair:'#5b5b5b',ph:t});
  const {hx,hy,r}=ltHead(x,y,s);c.fillStyle='rgba(40,40,40,.35)';
  for(let i=0;i<14;i++){const a=Math.PI+i/13*Math.PI;c.fillRect(hx+Math.cos(a)*r*.9-1,hy-r*.2+Math.sin(a)*r*.9-1,2,2);}
}
/* 자: 세로로 대고 눈금 + 3cm 표시 */
function ltRuler(c,x,y0,y1){
  c.fillStyle='#ffd23f';rr(c,x-6,y0,12,y1-y0,2);c.fill();c.strokeStyle='#8a6a10';c.lineWidth=1.5;c.stroke();
  for(let y=y0+4,i=0;y<y1;y+=5,i++){c.beginPath();c.moveTo(x-6,y);c.lineTo(x-(i%2?2:0),y);c.stroke();}
}
function ltSweat(c,x,y,t,n){
  for(let i=0;i<(n||3);i++){const q=(t*1.6+i/(n||3))%1;c.save();c.globalAlpha=1-q;c.fillStyle='#6ab7ff';
    const px=x+(i%2?1:-1)*(10+q*30),py=y-q*20+q*q*40;c.beginPath();c.moveTo(px,py-6);c.quadraticCurveTo(px+4,py,px,py+3);c.quadraticCurveTo(px-4,py,px,py-6);c.fill();c.restore();}
}
function ltStreet(c,off){
  const g=c.createLinearGradient(0,0,0,300);g.addColorStop(0,'#9fd6f5');g.addColorStop(1,'#e6f6fd');c.fillStyle=g;c.fillRect(0,0,W,300);
  const cols=['#e8b7a0','#c9d7a8','#f2d9a2','#b8c9e0','#e0b7c9'];
  for(let i=-1;i<7;i++){const x=((i*170-off)%1190+1190)%1190-170,h=110+(i*37%3)*25;
    c.fillStyle=cols[(i+10)%5];c.fillRect(x,300-h,140,h);c.fillStyle='#8a5a3a';c.beginPath();c.moveTo(x-10,300-h);c.lineTo(x+70,300-h-40);c.lineTo(x+150,300-h);c.closePath();c.fill();
    c.fillStyle='#9fc9e0';c.fillRect(x+20,300-h+25,32,26);c.fillRect(x+88,300-h+25,32,26);}
  c.fillStyle='#b9b4a8';c.fillRect(0,300,W,40);c.fillStyle='#6b6b6b';c.fillRect(0,340,W,H-340);
  c.fillStyle='#e8e2d0';for(let x=-((off*1.2)%120);x<W;x+=120)c.fillRect(x,405,60,6);
}
function ltWall(c,x0,x1,top){
  c.fillStyle='#b5654b';c.fillRect(x0,top,x1-x0,372-top);
  c.strokeStyle='rgba(60,25,15,.35)';c.lineWidth=2;
  for(let y=top,r=0;y<372;y+=22,r++){c.beginPath();c.moveTo(x0,y);c.lineTo(x1,y);c.stroke();
    for(let x=x0+(r%2?22:0);x<x1;x+=44){c.beginPath();c.moveTo(x,y);c.lineTo(x,Math.min(372,y+22));c.stroke();}}
  c.fillStyle='#8f8f8f';c.fillRect(x0-6,top-10,x1-x0+12,12);
}
const LTS=[
  {d:4.2,bgm:'match',cap:'아침에 눈을 떠 보니… 등교 시간이 한참 지나 있었다!',ev:[[0,'alarm'],[1.6,'alarm']],
   draw(c,t,p){
    jgRoom(c,0);
    c.fillStyle='#6d8fc9';rr(c,60,300,230,60,8);c.fill();c.fillStyle='#fff';rr(c,70,286,70,26,8);c.fill();c.fillStyle='#e8b7a0';rr(c,140,292,150,40,10);c.fill();
    const sh=Math.sin(t*50)*3;c.save();c.translate(700+sh,270);
    c.fillStyle='#e2334d';c.beginPath();c.arc(0,0,26,0,7);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(0,0,20,0,7);c.fill();
    c.strokeStyle='#232a45';c.lineWidth=3;c.beginPath();c.moveTo(0,0);c.lineTo(0,-14);c.moveTo(0,0);c.lineTo(12,6);c.stroke();
    c.fillStyle='#e2334d';c.beginPath();c.arc(-18,-24,8,0,7);c.arc(18,-24,8,0,7);c.fill();c.restore();
    TX(c,'8:50',700,222,22,'#e2334d','center','#fff');
    const up=p>.35;ltRock(c,380,372,2.4,up?'panic':'surprise',{arms:up?'up':undefined});
    if(up)jgBubble(c,430,150,'으악!! 지각이다!!',22);
  }},
  {d:4.4,bgm:'match',cap:'땀을 뻘뻘 흘리며 머대부고로 달렸다. 같이 지각한 씨붕도 함께!',ev:[[.2,'whoosh'],[2.2,'whoosh']],
   draw(c,t,p){
    ltStreet(c,t*260);
    kid(c,300,380,2.2,Object.assign({},LT_SSI,{run:true,ph:t*11}));ltSweat(c,300,380-52*2.2,t,3);
    ltRock(c,470,380,2.3,'panic',{run:true},t);ltSweat(c,470,380-52*2.3,t+.3,4);
  }},
  {d:4.8,bgm:'match',cap:'씨붕: "먼저 가… 난 걸음이 느려…"',ev:[[1.8,'whoosh']],
   draw(c,t,p){
    ltStreet(c,300);
    kid(c,260,380,2.2,Object.assign({},LT_SSI,{arms:undefined}));ltSweat(c,260,380-52*2.2,t,2);
    jgBubble(c,270,170,'먼저 가… 난 걸음이 느려…',19);
    const q=jgEase((p-.4)/.6);ltRock(c,470+q*420,380,2.3,q>0?'resolve':'worn',{run:q>0},t);
  }},
  {d:7.4,bgm:'ratal',cap:'정문에 도착하니 학생들이 줄지어 서 있었다. 라털 선생님이 규정 종이를 들고, 자로 머리 길이를 재고 있었다!',ev:[[.3,'whistle'],[1.1,'page'],[2.6,'tick'],[3.6,()=>burp()]],
   draw(c,t,p){
    bgField(c);
    c.fillStyle='#8f8f8f';c.fillRect(40,150,40,222);c.fillRect(720,150,40,222);c.fillStyle='#6d1f31';rr(c,30,130,60,26,4);c.fill();rr(c,710,130,60,26,4);c.fill();
    TX(c,'정문',60,143,14,'#f4f6ef','center');TX(c,'정문',740,143,14,'#f4f6ef','center');
    ltBoy(c,150,372,1.9,0);ltGirl(c,240,372,1.9,0);ltBoy(c,330,372,1.9,0);
    ltGirl(c,470,372,2.1,0);
    const {hx,hy,r}=ltHead(470,372,2.1);ltRuler(c,hx+r*1.35,hy-r*1.1,hy+r*1.25);
    c.strokeStyle='#e2334d';c.lineWidth=2;c.setLineDash([4,3]);c.beginPath();c.moveTo(hx+r*.7,hy+r*.72);c.lineTo(hx+r*1.35,hy+r*.72);c.stroke();c.setLineDash([]);
    TX(c,'귀밑 3cm',hx+r*1.35,hy-r*1.1-16,15,'#e2334d','center','#fff');
    kid(c,650,372,2.4,{coat:'#2f3a56',vest:'#c4372f',ph:0});ltImgHead(c,LT_RATAL,650,372,2.4);
    c.strokeStyle='#2f3a56';c.lineWidth=12;c.lineCap='round';c.beginPath();c.moveTo(650-11*2.4,372-33*2.4);c.lineTo(hx+r*1.35+10,hy+r*.1);c.stroke();   /* 자를 댄 팔 */
    c.fillStyle='#f2c9a5';c.beginPath();c.arc(hx+r*1.35+10,hy+r*.1,8,0,7);c.fill();
    TX(c,'라털',650,372-76*2.4,17,'#fff','center','rgba(0,0,0,.6)');
    c.save();c.translate(686,296);c.rotate(.12);c.fillStyle='#fff';rr(c,-16,-22,32,44,2);c.fill();c.strokeStyle='#232a45';c.lineWidth=2;c.stroke();   /* 손에 든 규정 종이 */
    c.fillStyle='#232a45';c.fillRect(-10,-16,20,3);c.fillStyle='#9aa3c2';c.fillRect(-10,-8,20,10);c.fillRect(-10,6,20,10);c.restore();
    c.fillStyle='#f2c9a5';c.beginPath();c.arc(678,318,7,0,7);c.fill();
    if(p>.35)jgBubble(c,590,110,'귀밑 3cm! 반삭발도 3cm! 넘으면 이발소행이다. 바우!',17);
    if(t>=LT_RULE_AT[0]&&t<LT_RULE_AT[1]&&LT_RULE.complete&&LT_RULE.naturalWidth){   /* 규정 종이를 약 1초 크게 보여줘요 */
      const q=t-LT_RULE_AT[0],a=Math.min(1,q/.12,(LT_RULE_AT[1]-t)/.12),z=.9+.1*jgEase(q/.25),h=340*z,w=h*LT_RULE.naturalWidth/LT_RULE.naturalHeight;
      c.save();c.globalAlpha=a;c.fillStyle='rgba(10,13,27,.7)';c.fillRect(0,0,W,H);
      c.fillStyle='#fff';rr(c,400-w/2-8,200-h/2-8,w+16,h+16,6);c.fill();
      c.drawImage(LT_RULE,400-w/2,200-h/2,w,h);c.restore();
    }
  }},
  {d:4.2,bgm:'sad',cap:'아차… 오늘이 두발 검사 날이었지. 까맣게 잊고 있었다. 하아…',ev:[[.4,'aww']],
   draw(c,t,p){
    const g=c.createRadialGradient(400,210,40,400,210,460);g.addColorStop(0,'#4a5a8a');g.addColorStop(1,'#1b1f3b');c.fillStyle=g;c.fillRect(0,0,W,H);
    faceImg(c,'sad',400,200,120);
    ltSweat(c,520,110,t*.5,1);
    c.save();c.globalAlpha=clamp((p-.2)*3,0,1);jgBubble(c,610,300,'하아…',26);c.restore();
    c.strokeStyle='rgba(255,255,255,.5)';c.lineWidth=3;for(let i=0;i<3;i++){const q=(t*.6+i/3)%1;c.beginPath();c.arc(260-q*40,300-q*30,8+q*16,0,Math.PI);c.stroke();}
  }},
  {d:5.2,bgm:'match',cap:'학교 뒷문 쪽으로 돌아가 넘어갈 만한 담을 찾았다. 슬금슬금… 영차!',ev:[[1.9,'kick'],[3.6,'whoosh']],
   draw(c,t,p){
    const g=c.createLinearGradient(0,0,0,300);g.addColorStop(0,'#9fd6f5');g.addColorStop(1,'#e6f6fd');c.fillStyle=g;c.fillRect(0,0,W,300);
    c.fillStyle='#cbbfa9';c.fillRect(0,90,W,90);for(let i=0;i<12;i++){c.fillStyle='#9fc9e0';c.fillRect(20+i*68,105,40,18);c.fillRect(20+i*68,140,40,18);}
    c.fillStyle='#6bb56f';c.fillRect(0,300,W,H-300);
    let x,y,arms,behind=false;
    if(p<.35){x=120+jgEase(p/.35)*260;y=372;}
    else if(p<.65){const q=jgEase((p-.35)/.3);x=380+q*20;y=372-q*182;arms='up';}
    else{const q=jgEase((p-.65)/.35);x=400+q*120;y=190+q*182;arms='up';behind=q>.3;}
    if(behind){ltRock(c,x,y,2.2,'excited',{arms},t);ltWall(c,300,W,210);}
    else{ltWall(c,300,W,210);ltRock(c,x,y,2.2,p<.35?'doubt':'resolve',{arms,run:p<.35},t);}
    c.fillStyle='#f4f6ef';rr(c,560,262,150,34,4);c.fill();c.strokeStyle='#6d1f31';c.lineWidth=3;c.stroke();TX(c,'머대부고 뒷담',635,280,17,'#6d1f31','center');
  }},
  {d:4.4,bgm:'match',cap:'담을 넘는 데 성공! …그런데 담 안쪽에서 기다리던 주스가 앙! 하고 물었다!',ev:[[.5,'thud'],[2.1,'chomp'],[2.2,'deny']],
   draw(c,t,p){
    const bite=p>.47,sh=bite&&p<.6?Math.sin(t*70)*6:0;c.save();c.translate(sh,0);
    bgField(c);ltWall(c,0,180,150);
    const land=jgEase(p/.12);ltRock(c,330,190+land*182,2.3,bite?'panic':'happy',{arms:bite?'up':undefined},t);
    const q=jgEase((p-.3)/.17);kid(c,690-q*260,372,2.3,Object.assign({},LT_JUS,{arms:q<1?undefined:'up',run:q>0&&q<1,ph:t*12}));
    if(bite){TX(c,'앙!',400,150,70,'#e2334d','center','#fff');
      c.strokeStyle='#e2334d';c.lineWidth=3;for(let i=0;i<4;i++){c.beginPath();c.moveTo(356+i*6,300);c.lineTo(358+i*6,308);c.stroke();}}
    c.restore();
  }},
  {d:5.4,bgm:'match',cap:'주스: "내가 왜 빌런이야…" (볼멘소리)',ev:[[.3,'pgmiss'],[3.4,'win']],
   draw(c,t,p){
    bgField(c);ltWall(c,0,180,150);
    ltRock(c,300,372,2.3,'frustrated',{},t);
    c.strokeStyle='#e2334d';c.lineWidth=3;for(let i=0;i<4;i++){c.beginPath();c.moveTo(326+i*6,330);c.lineTo(328+i*6,338);c.stroke();}
    kid(c,500,372,2.3,Object.assign({},LT_JUS,{arms:'cross'}));
    jgBubble(c,520,170,'내가 왜 빌런이야…',22);
    if(p>.6){const a=jgEase((p-.6)/.15);c.save();c.globalAlpha=a;
      c.fillStyle='rgba(20,24,44,.9)';rr(c,200,30,400,86,16);c.fill();c.strokeStyle='#ffd23f';c.lineWidth=3;c.stroke();
      TX(c,'등굣길 뜀박질',400,64,40,'#ffd23f','center','#232a45');
      TX(c,JG.done?'노래 시작!':'THE END',400,100,16,'#f4f6ef','center');c.restore();}
  }}
];
INTROS.late={scenes:LTS,bgm:'match',btn:'🎬 지각생 롹순팅 이야기 보기'};
