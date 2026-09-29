'use strict';
/* ---------- 곡 인트로 애니메이션 (엔진 + 'ㅈㄱ의 카드 모험' 이야기) ----------
   소리새 펌프에서 인트로가 있는 곡(PGSONGS의 intro)을 이 기기에서 처음 시작할 때 노래 전에 보여줘요(pumpStart).
   곡을 고르면 나오는 '🎬 … 이야기 보기' 버튼으로 언제든 다시 볼 수 있어요.
   인트로는 INTROS[키] = {scenes, bgm, btn}. 장면마다 길이(d)·자막(cap)·효과음 시각(ev)·그리기(draw)·음악(bgm, 없으면 인트로의 bgm)이 있어요.
   화면을 누르거나 Enter/Space면 다음 장면, 건너뛰기 버튼이나 Esc면 바로 끝나요. 음악은 wantBgm()이 jgBgm()으로 골라요.
   다른 곡 인트로: 'ㅈㄱ의 카드 모험'은 이 파일, '등굣길 뜀박질'은 lateintro.js
   파이리·카드·뽑기 기계·친구들 그림은 모두 이 파일에서 도형으로 직접 그려요. */
const JG={on:false,t:0,i:0,raf:0,last:0,done:null,set:null,ctx:$('#jgCv').getContext('2d')};
const JG_CH=Object.assign({},CH['ㅈㄱ']);
const JG_LAB=Object.assign({},JG_CH,{coat:'#f4f6ef',vest:'#3b7de0',glasses:true});   /* 연구복(흰 가운) 입은 박사 ㅈㄱ */

/* 불꽃 도마뱀(파이리). (x,y)는 발밑 가운데, 키는 약 55×s */
function jgMon(c,x,y,s,t,o){
  o=o||{};c.save();c.translate(x,y);c.scale(o.flip?-s:s,s);
  const b=Math.abs(Math.sin(t*6))*(o.hop||0);
  c.fillStyle='rgba(0,0,0,.18)';c.beginPath();c.ellipse(0,0,16,4,0,0,7);c.fill();
  c.translate(0,-b);
  c.strokeStyle='#f08a2c';c.lineWidth=7;c.lineCap='round';c.beginPath();c.moveTo(-8,-10);c.quadraticCurveTo(-26,-8,-28,-26);c.stroke();
  const f=1+Math.sin(t*18)*.12+Math.sin(t*7)*.08;
  c.save();c.translate(-28,-30);c.scale(f,f);
  c.fillStyle='#ff5a1f';c.beginPath();c.moveTo(0,-16);c.quadraticCurveTo(9,-4,6,4);c.quadraticCurveTo(0,9,-6,4);c.quadraticCurveTo(-9,-4,0,-16);c.fill();
  c.fillStyle='#ffd23f';c.beginPath();c.moveTo(0,-8);c.quadraticCurveTo(5,0,3,4);c.quadraticCurveTo(0,6,-3,4);c.quadraticCurveTo(-5,0,0,-8);c.fill();
  c.restore();
  c.fillStyle='#f08a2c';rr(c,-11,-8,8,8,3);c.fill();rr(c,3,-8,8,8,3);c.fill();
  c.beginPath();c.ellipse(0,-18,13,15,0,0,7);c.fill();
  c.fillStyle='#ffe0a0';c.beginPath();c.ellipse(1,-15,8,10,0,0,7);c.fill();
  c.fillStyle='#f08a2c';c.beginPath();c.ellipse(-12,-22,3.5,6,.6,0,7);c.fill();c.beginPath();c.ellipse(13,-22,3.5,6,-.6,0,7);c.fill();
  c.beginPath();c.ellipse(1,-40,15,13,0,0,7);c.fill();
  c.fillStyle='#232a45';c.beginPath();c.ellipse(-5,-42,2.8,4,0,0,7);c.fill();c.beginPath();c.ellipse(7,-42,2.8,4,0,0,7);c.fill();
  c.fillStyle='#fff';c.beginPath();c.arc(-4.2,-43.5,1.1,0,7);c.fill();c.beginPath();c.arc(7.8,-43.5,1.1,0,7);c.fill();
  c.strokeStyle='#8a3a12';c.lineWidth=1.6;c.beginPath();c.arc(1,-36,4,.2,Math.PI-.2);c.stroke();
  c.fillStyle='rgba(255,120,120,.55)';c.beginPath();c.arc(-9,-36,2.6,0,7);c.fill();c.beginPath();c.arc(11,-36,2.6,0,7);c.fill();
  c.restore();
}
function jgStar(c,x,y,r,col){
  c.fillStyle=col;c.beginPath();
  for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,q=i%2?r*.45:r;c.lineTo(x+Math.cos(a)*q,y+Math.sin(a)*q);}
  c.closePath();c.fill();
}
function jgHeart(c,x,y,r,a){
  c.save();c.globalAlpha=a==null?1:a;c.fillStyle='#ff5d8f';c.beginPath();c.moveTo(x,y+r*.9);
  c.bezierCurveTo(x-r*1.4,y-r*.2,x-r*.6,y-r*1.2,x,y-r*.4);c.bezierCurveTo(x+r*.6,y-r*1.2,x+r*1.4,y-r*.2,x,y+r*.9);c.fill();c.restore();
}
/* 카드. flip 0=뒷면 … 1=앞면(가운데에서 뒤집혀요) */
function jgCard(c,x,y,s,flip,t){
  const k=Math.cos(clamp(flip,0,1)*Math.PI);
  c.save();c.translate(x,y);c.scale(s*Math.max(.03,Math.abs(k)),s);
  c.lineWidth=2.5;c.strokeStyle='#232a45';
  if(k>0){
    c.fillStyle='#3b5bdb';rr(c,-30,-42,60,84,6);c.fill();c.stroke();
    c.strokeStyle='#fff';c.lineWidth=2;rr(c,-24,-36,48,72,4);c.stroke();
    jgStar(c,0,0,16,'#ffd23f');
  }else{
    c.fillStyle='#f5c518';rr(c,-30,-42,60,84,6);c.fill();c.stroke();
    c.fillStyle='#fff3d6';rr(c,-25,-37,50,74,4);c.fill();
    c.font='bold 8px "Noto Sans KR",sans-serif';c.textBaseline='middle';c.fillStyle='#232a45';c.textAlign='left';c.fillText('파이리',-23,-31);
    c.textAlign='right';c.fillStyle='#e2334d';c.fillText('HP40',23,-31);
    const g=c.createLinearGradient(0,-25,0,8);g.addColorStop(0,'#ffd08a');g.addColorStop(1,'#ff8a3d');c.fillStyle=g;rr(c,-22,-25,44,33,3);c.fill();
    c.save();c.beginPath();rr(c,-22,-25,44,33,3);c.clip();jgMon(c,4,6,.55,t);c.restore();
    c.fillStyle='rgba(35,42,69,.35)';c.fillRect(-20,14,40,2.5);c.fillRect(-20,21,30,2.5);c.fillRect(-20,28,36,2.5);
  }
  c.restore();
}
function jgGacha(c,x,y,turn){
  c.lineWidth=4;c.strokeStyle='#232a45';
  c.fillStyle='#e2334d';rr(c,x-60,y-190,120,190,12);c.fill();c.stroke();
  c.fillStyle='#bfe6ff';rr(c,x-46,y-176,92,74,8);c.fill();c.stroke();
  [['#3b5bdb',-26,-150,.3],['#f5c518',2,-142,-.2],['#2f8f5b',26,-152,.4],['#8a5ad8',-12,-120,-.5],['#ff8a3d',18,-118,.2]].forEach(a=>{c.save();c.translate(x+a[1],y+a[2]);c.rotate(a[3]);c.fillStyle=a[0];rr(c,-9,-12,18,24,3);c.fill();c.restore();});
  TX(c,'랜덤 카드',x,y-84,17,'#fff','center','#232a45');
  c.save();c.translate(x-22,y-48);c.rotate(turn*Math.PI*2);c.fillStyle='#f4f6ef';c.beginPath();c.arc(0,0,15,0,7);c.fill();c.stroke();c.fillStyle='#232a45';c.fillRect(-12,-3,24,6);c.restore();
  c.fillStyle='#232a45';rr(c,x+8,y-40,42,12,3);c.fill();
  TX(c,'500원',x+29,y-60,13,'#fff','center');
}
/* ㅈㄱ의 방. night 0(낮)~1(밤) */
function jgRoom(c,night){
  c.fillStyle='#f3e6d0';c.fillRect(0,0,W,330);c.fillStyle='#c9a26b';c.fillRect(0,330,W,H-330);
  c.strokeStyle='rgba(0,0,0,.08)';c.lineWidth=2;for(let x=0;x<W;x+=80){c.beginPath();c.moveTo(x,330);c.lineTo(x-20,H);c.stroke();}
  const n=clamp(night,0,1),sky=`rgb(${Math.round(143-110*n)},${Math.round(208-170*n)},${Math.round(240-150*n)})`;
  c.fillStyle=sky;rr(c,560,60,160,110,6);c.fill();c.strokeStyle='#8a6a43';c.lineWidth=6;c.stroke();
  c.beginPath();c.moveTo(640,60);c.lineTo(640,170);c.stroke();
  if(n<.5){c.fillStyle='#ffd23f';c.beginPath();c.arc(600,100,16,0,7);c.fill();}
  else{c.fillStyle='#f4f6ef';c.beginPath();c.arc(685,95,14,0,7);c.fill();c.fillStyle=sky;c.beginPath();c.arc(692,90,12,0,7);c.fill();
    [[590,82],[610,130],[700,140],[670,72]].forEach(a=>jgStar(c,a[0],a[1],3,'#fff'));}
  c.fillStyle='#8a6034';rr(c,420,290,260,16,4);c.fill();c.fillStyle='#a9784a';c.fillRect(440,306,14,60);c.fillRect(646,306,14,60);
  c.fillStyle='#6d8fc9';rr(c,470,266,50,24,3);c.fill();c.fillStyle='#e8a91c';rr(c,600,258,40,32,3);c.fill();   /* 책·연필꽂이 */
  if(n>0)c.fillStyle=`rgba(10,14,40,${(n*.6).toFixed(3)})`,c.fillRect(0,0,W,H);
}
function jgLab(c){
  c.fillStyle='#eef3f8';c.fillRect(0,0,W,330);c.fillStyle='#cfd8e3';c.fillRect(0,330,W,H-330);
  c.fillStyle='#8a6034';[100,170,240].forEach(y=>c.fillRect(40,y,240,8));
  const cols=['#e2334d','#3b7de0','#2f8f5b','#e8a91c','#8a5ad8','#ff8a3d'];
  [100,170,240].forEach((y,r)=>{for(let i=0;i<9;i++){c.fillStyle=cols[(i+r*2)%6];c.fillRect(48+i*26,y-44+((i*7+r)%3)*4,20,44-((i*7+r)%3)*4);}});
  c.fillStyle='#fff';rr(c,470,50,220,120,8);c.fill();c.strokeStyle='#232a45';c.lineWidth=3;c.stroke();
  TX(c,'포켓몬 연구소',580,78,20,'#232a45','center');
  c.strokeStyle='#3b7de0';c.lineWidth=2;c.beginPath();c.moveTo(495,150);c.lineTo(540,120);c.lineTo(580,135);c.lineTo(630,100);c.lineTo(665,112);c.stroke();
}
/* 새로 지은 작은 친구들(여러 포켓몬들) */
function jgBuddy(c,x,y,s,t,kind){
  const col={leaf:'#7cc47f',drop:'#6ab7ff',puff:'#ffb3d1',rock:'#b99a74'}[kind];
  c.save();c.translate(x,y-Math.abs(Math.sin(t*5+x))*8*s);c.scale(s,s);
  c.fillStyle='rgba(0,0,0,.15)';c.beginPath();c.ellipse(0,0,14,4,0,0,7);c.fill();
  c.fillStyle=col;c.beginPath();c.ellipse(0,-15,16,15,0,0,7);c.fill();
  if(kind==='leaf'){c.fillStyle='#2f8f5b';c.beginPath();c.ellipse(-5,-34,5,9,-.6,0,7);c.fill();c.beginPath();c.ellipse(5,-34,5,9,.6,0,7);c.fill();}
  else if(kind==='drop'){c.fillStyle='#3b7de0';c.beginPath();c.moveTo(0,-42);c.quadraticCurveTo(7,-32,0,-28);c.quadraticCurveTo(-7,-32,0,-42);c.fill();}
  else if(kind==='puff'){c.strokeStyle='#d9669a';c.lineWidth=2;c.beginPath();c.arc(0,-30,4,0,Math.PI*1.5);c.stroke();}
  else{c.fillStyle='#8a6d4c';c.beginPath();c.moveTo(-10,-27);c.lineTo(-4,-34);c.lineTo(0,-28);c.closePath();c.fill();}
  c.fillStyle='#232a45';c.beginPath();c.arc(-5,-17,2.2,0,7);c.fill();c.beginPath();c.arc(5,-17,2.2,0,7);c.fill();
  c.strokeStyle='#232a45';c.lineWidth=1.4;c.beginPath();c.arc(0,-12,3,.2,Math.PI-.2);c.stroke();
  c.restore();
}
function jgBubble(c,x,y,txt,size){
  c.font=`${size||18}px "Noto Sans KR",sans-serif`;const w=c.measureText(txt).width+24;
  c.fillStyle='#fff';rr(c,x-w/2,y-20,w,40,12);c.fill();c.strokeStyle='#232a45';c.lineWidth=2.5;c.stroke();
  c.beginPath();c.moveTo(x-8,y+19);c.lineTo(x-14,y+32);c.lineTo(x+4,y+19);c.closePath();c.fill();
  c.textAlign='center';c.textBaseline='middle';c.fillStyle='#232a45';c.fillText(txt,x,y);
}
function jgCap(c,txt,t){
  c.fillStyle='rgba(20,24,44,.9)';rr(c,24,392,752,72,14);c.fill();c.strokeStyle='#f4f6ef';c.lineWidth=2;c.stroke();
  c.font='21px "Noto Sans KR",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#f4f6ef';
  const lines=wrapText(c,txt,700).slice(0,2);let left=Math.floor(t*28);
  lines.forEach((ln,i)=>{const s=ln.slice(0,Math.max(0,left));left-=ln.length;
    c.textAlign='left';c.fillText(s,400-c.measureText(ln).width/2,428+(i-(lines.length-1)/2)*28);});
}
const jgKid=(c,x,y,s,o,t)=>kid(c,x,y,s,Object.assign({},o&&o.lab?JG_LAB:JG_CH,o||{},{ph:t*11}));
const jgEase=p=>p<0?0:p>1?1:p*p*(3-2*p);

const JGS=[
  {d:4.6,cap:'매점 앞 랜덤 카드 뽑기 기계. ㅈㄱ는 용돈 500원을 넣고 손잡이를 돌렸다.',ev:[[.3,'coin'],[1.3,'tick'],[1.6,'tick'],[1.9,'tick'],[2.6,'ping']],
   draw(c,t,p){
    bgCanteen(c);jgGacha(c,600,352,jgEase((p-.25)/.3));
    const got=p>.85;jgKid(c,420,372,2.4,{arms:got?'up':undefined},0);
    if(p>.55){const q=jgEase((p-.55)/.3);jgCard(c,629+(420-629)*q,318+(150-318)*q,.9+.3*q,0,t);
      if(got)for(let i=0;i<5;i++){const a=t*3+i*1.26;jgStar(c,420+Math.cos(a)*62,150+Math.sin(a)*62,5,'#ffd23f');}}
  }},
  {d:4.6,cap:'두근… 두근… 반짝! 나온 건 바로 파이리 카드!',ev:[[.4,'tick'],[.9,'tick'],[1.4,'tick'],[2.3,'sparkle']],
   draw(c,t,p){
    c.fillStyle='#1b1f3b';c.fillRect(0,0,W,H);
    c.save();c.translate(400,200);c.rotate(t*.4);c.fillStyle='rgba(255,210,63,.13)';
    for(let i=0;i<12;i++){c.rotate(Math.PI/6);c.beginPath();c.moveTo(0,0);c.lineTo(-40,-520);c.lineTo(40,-520);c.closePath();c.fill();}c.restore();
    const fl=jgEase((p-.35)/.2),beat=p<.35?1+Math.abs(Math.sin(t*Math.PI*2))*.05:1;
    jgCard(c,400,200,2.2*beat,fl,t);
    if(fl>=1){for(let i=0;i<9;i++){const tw=Math.max(0,Math.sin(t*5+i*2));jgStar(c,400+Math.cos(i*.7)*(150+i*8),200+Math.sin(i*1.3)*130,4+tw*7,'#fff');}
      TX(c,'★ 파이리 카드 ★',400,40,34,'#ffd23f','center','#232a45');}
  }},
  {d:5.6,cap:'ㅈㄱ는 매일매일 파이리 카드에게 인사하고, 누구보다 소중히 아꼈다.',ev:[[0,'page'],[1.4,'page'],[2.8,'page'],[4.2,'page']],
   draw(c,t,p){
    const d=Math.min(3,Math.floor(p*4)),fr=p*4-d;
    jgRoom(c,.5-.5*Math.cos(fr*Math.PI*2));
    c.fillStyle='#fff';rr(c,110,70,90,100,6);c.fill();c.strokeStyle='#232a45';c.lineWidth=3;c.stroke();
    c.fillStyle='#e2334d';c.fillRect(110,70,90,24);TX(c,'달력',155,82,14,'#fff','center');
    TX(c,['월','화','수','목'][d],155,132,40,'#232a45','center');
    jgCard(c,560,258,.8,1,t);
    jgKid(c,330,372,2.3,{},0);
    jgBubble(c,380,150,['안녕, 파이리!','오늘도 멋지다!','잘 자, 파이리.','내일 또 봐!'][d]);
  }},
  {d:4.6,cap:'그러던 어느 날 밤… 책상 위의 카드가 환하게 빛나기 시작했다.',ev:[[.3,'chime'],[2.2,'sparkle'],[3.3,'whoosh'],[3.9,'ping']],
   draw(c,t,p){
    jgRoom(c,1);
    const r=30+jgEase(p)*420,g=c.createRadialGradient(560,258,4,560,258,r);
    g.addColorStop(0,'rgba(255,240,180,.95)');g.addColorStop(.4,'rgba(255,170,60,.45)');g.addColorStop(1,'rgba(255,170,60,0)');
    c.fillStyle=g;c.fillRect(0,0,W,H);
    jgKid(c,250,372,2.3,{},0);
    if(p>.4)jgBubble(c,290,150,'…어?');
    jgCard(c,560,258,.8+.1*Math.sin(t*8),1,t);
    for(let i=0;i<14;i++){const q=(t*.6+i*.13)%1;jgStar(c,560+Math.sin(i*2.1+t)*60*q,258-q*200,2+3*(1-q),`rgba(255,230,140,${(1-q).toFixed(2)})`);}
    if(p>.8){c.fillStyle=`rgba(255,255,255,${jgEase((p-.8)/.2).toFixed(3)})`;c.fillRect(0,0,W,H);}
  }},
  {d:4.8,cap:'"파이~!" 카드 속 파이리가 진짜로 나타났다!',ev:[[.9,'chirp'],[1.6,'chime'],[2.6,'chirp']],
   draw(c,t,p){
    jgRoom(c,.15);
    jgMon(c,480,372,1.9,t,{hop:p>.15?7:0,flip:true});
    const up=p>.3;jgKid(c,270,372,2.3,{arms:up?'up':undefined},0);
    if(up)TX(c,'!',270,190-Math.abs(Math.sin(t*8))*10,54,'#e2334d','center','#fff');
    if(p>.18)jgBubble(c,520,230,'파이~!',22);
    if(p<.2){c.fillStyle=`rgba(255,255,255,${(1-p/.2).toFixed(3)})`;c.fillRect(0,0,W,H);}
  }},
  {d:6,cap:'둘은 운동장을 뛰놀고, 꼬리 불꽃에 마시멜로도 구워 먹으며 행복한 시간을 보냈다.',ev:[[.2,'whoosh'],[1.5,'chirp'],[3.4,'chime'],[4.6,'pgok']],
   draw(c,t,p){
    bgField(c);c.fillStyle='rgba(255,140,60,.22)';c.fillRect(0,0,W,H);
    if(p<.5){const q=p/.5,x=-80+640*q;
      jgKid(c,x,372,2.2,{run:true},t);jgMon(c,x+110,372,1.6,t,{hop:9});
    }else{
      jgKid(c,300,372,2.3,{},0);jgMon(c,490,372,1.8,t);   /* 꼬리 불꽃이 ㅈㄱ 쪽을 향해요 */
      c.strokeStyle='#8a5a2a';c.lineWidth=4;c.beginPath();c.moveTo(335,326);c.lineTo(432,296);c.stroke();
      c.fillStyle='#fff8ee';rr(c,428,284,20,16,5);c.fill();c.strokeStyle='#d9b89a';c.lineWidth=2;c.stroke();
      for(let i=0;i<5;i++){const q=(t*.35+i*.2)%1;jgHeart(c,400+Math.sin(i*1.9+t*2)*40,300-q*170,9+i%2*3,1-q);}
    }
  }},
  {d:5,cap:'그 후로 ㅈㄱ는 포켓몬에 대해 밤낮없이 연구했고…',ev:[[.3,'page'],[1.3,'page'],[2.3,'page'],[3.3,'page'],[4.1,'ping']],
   draw(c,t,p){
    jgLab(c);
    c.fillStyle='#8a6034';rr(c,420,290,280,16,4);c.fill();c.fillStyle='#a9784a';c.fillRect(440,306,14,60);c.fillRect(666,306,14,60);
    const n=1+Math.floor(p*7),bc=['#e2334d','#3b7de0','#2f8f5b','#e8a91c','#8a5ad8','#ff8a3d','#232a45'];
    for(let i=0;i<n;i++){c.fillStyle=bc[i%7];rr(c,450+(i%2)*6,276-i*14,90,13,2);c.fill();}
    c.fillStyle='#fff';rr(c,580,262,70,26,2);c.fill();c.strokeStyle='#9aa3c2';c.lineWidth=1;for(let k=0;k<3;k++){c.beginPath();c.moveTo(586,270+k*6);c.lineTo(644,270+k*6);c.stroke();}
    jgKid(c,300,372,2.3,{lab:true},0);
    jgMon(c,600,372,1.5,t,{flip:true});
    if(p>.8){c.fillStyle='#ffd23f';c.beginPath();c.arc(300,160,18,0,7);c.fill();c.fillStyle='#9aa3c2';c.fillRect(293,176,14,10);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;c.strokeStyle='#ffd23f';c.lineWidth=3;c.beginPath();c.moveTo(300+Math.cos(a)*26,160+Math.sin(a)*26);c.lineTo(300+Math.cos(a)*36,160+Math.sin(a)*36);c.stroke();}}
  }},
  {d:6.6,cap:'마침내 포켓몬 박사가 된 ㅈㄱ는 여러 포켓몬들과 행복하게 지냈답니다.',ev:[[.2,'welcome'],[1.5,'chirp'],[3.8,'win']],
   draw(c,t,p){
    bgField(c);
    jgBuddy(c,150,380,1.5,t,'leaf');jgBuddy(c,245,388,1.3,t,'drop');jgBuddy(c,610,386,1.3,t,'puff');jgBuddy(c,705,378,1.5,t,'rock');
    jgKid(c,390,372,2.4,{lab:true,arms:p>.55?'up':undefined},0);
    jgMon(c,505,372,1.7,t,{hop:6,flip:true});
    TX(c,'포켓몬 박사 ㅈㄱ',390,168,20,'#fff','center','#232a45');
    for(let i=0;i<6;i++){const q=(t*.3+i*.17)%1;jgHeart(c,120+i*110,330-q*200,8,1-q);}
    if(p>.55){const a=jgEase((p-.55)/.15);c.save();c.globalAlpha=a;
      c.fillStyle='rgba(20,24,44,.9)';rr(c,200,30,400,86,16);c.fill();c.strokeStyle='#ffd23f';c.lineWidth=3;c.stroke();
      TX(c,'ㅈㄱ의 카드 모험',400,64,40,'#ffd23f','center','#232a45');
      TX(c,JG.done?'노래 시작!':'THE END',400,100,16,'#f4f6ef','center');c.restore();}
  }}
];
const INTROS={jg:{scenes:JGS,bgm:'jg',btn:'🎬 ㅈㄱ와 파이리 이야기 보기'}};
function jgBgm(){const sc=JG.set.scenes[JG.i];return (sc&&sc.bgm)||JG.set.bgm;}
function jgFrame(now){
  if(!JG.on)return;
  JG.raf=requestAnimationFrame(jgFrame);
  const dt=Math.min(.05,(now-JG.last)/1000),t0=JG.t;JG.last=now;JG.t+=dt;
  const sc=JG.set.scenes[JG.i];
  (sc.ev||[]).forEach(e=>{if(e[0]>=t0&&e[0]<JG.t){if(typeof e[1]==='function')e[1]();else sfx(e[1]);}});   /* 효과음 이름 또는 함수(예: 라털의 burp) */
  if(JG.t>=sc.d){jgNext(false);return;}
  const c=JG.ctx;
  try{c.save();sc.draw(c,JG.t,JG.t/sc.d);c.restore();jgCap(c,sc.cap,JG.t);}catch(e){console.error(e);}
}
function jgNext(tap){
  if(tap)sfx('tick');
  JG.i++;JG.t=0;if(JG.i>=JG.set.scenes.length)jgEnd();
}
/* key: INTROS의 키. done: 인트로가 끝나거나 건너뛰면 부를 함수(노래 시작). 없으면 다시 보기라 닫기만 해요 */
function jgPlay(key,done){
  if(JG.on||!INTROS[key])return;
  JG.on=true;JG.set=INTROS[key];JG.i=0;JG.t=0;JG.done=done||null;JG.last=performance.now();
  $('#jgSkip').textContent=done?'건너뛰고 노래 시작 ▶▶':'닫기 ✕';
  $('#jgIntro').hidden=false;
  try{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)JG.i=JG.set.scenes.length-1;}catch(e){}
  JG.raf=requestAnimationFrame(jgFrame);bgmSync();
}
function jgEnd(){
  if(!JG.on)return;
  JG.on=false;cancelAnimationFrame(JG.raf);$('#jgIntro').hidden=true;bgmSync();
  const d=JG.done;JG.done=null;d&&d();
}
$('#jgIntro').addEventListener('pointerdown',e=>{if(e.target.closest('#jgSkip'))return;if(JG.on)jgNext(true);});
$('#jgSkip').addEventListener('click',e=>{e.stopPropagation();jgEnd();});
window.addEventListener('keydown',e=>{
  if(!JG.on)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();jgEnd();}
  else if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();e.stopPropagation();jgNext(true);}
},true);
$('#pgIntroBtn').addEventListener('click',()=>{const sg=pgPick(PGO.song,PGO.diff);if(sg.intro)jgPlay(sg.intro);});
