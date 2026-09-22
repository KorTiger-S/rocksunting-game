'use strict';
/* ---------- draw helpers ---------- */
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function TX(c,s,x,y,size,col,al,stroke){
  c.font=size+'px "Black Han Sans","Noto Sans KR",sans-serif';c.textAlign=al||'left';c.textBaseline='middle';
  if(stroke){c.lineWidth=Math.max(4,size/6);c.strokeStyle=stroke;c.lineJoin='round';c.strokeText(s,x,y);}
  c.fillStyle=col||'#fff';c.fillText(s,x,y);
}
function hudBar(c,l,m,r){
  c.fillStyle='#2e5a4c';c.fillRect(0,0,W,46);c.fillStyle='#a9784a';c.fillRect(0,46,W,5);
  TX(c,l,16,24,20,'#f4f6ef');TX(c,m,W/2,24,20,'#f4f6ef','center');TX(c,r,W-16,24,20,'#f4f6ef','right');
}
function faceImg(c,name,cx,cy,r){
  const im=IM[name];if(!im||!im.complete||!im.naturalWidth)return;
  c.save();c.beginPath();c.arc(cx,cy,r,0,7);c.clip();
  const w=r*2.5,h=w*im.naturalHeight/im.naturalWidth;
  c.drawImage(im,cx-w/2,cy-h*.42,w,h);c.restore();
  c.lineWidth=Math.max(2,r*.07);c.strokeStyle='#232a45';c.beginPath();c.arc(cx,cy,r,0,7);c.stroke();
}
function wrapText(c,txt,maxW){
  const lines=[];let cur='';
  for(const ch of txt){const t=cur+ch;if(c.measureText(t).width>maxW&&cur){lines.push(cur);cur=ch;}else cur=t;}
  if(cur)lines.push(cur);return lines;
}
/* 등장인물 (모두 같은 학년, 같은 교복) */
const CH={
  rock:{name:'롹순팅'},
  주스:{name:'주스',coat:'#d23a30',vest:'#fff',hair:'#2b1d14'},
  주멘:{name:'주멘',hair:'#4a3222'},머호:{name:'머호',hair:'#8a5a2a'},ㅈㄱ:{name:'ㅈㄱ',hair:'#111'},
  씨붕:{name:'씨붕',hair:'#d9b34a'},현숭:{name:'현숭',hair:'#1f1a17',glasses:true},호우:{name:'호우',hair:'#5a3a22'},
  히통:{name:'히통',hair:'#3a2a20'},우룡:{name:'우룡',hair:'#1f1a17'},룡갈:{name:'룡갈',hair:'#6b4a2a'},겨맘:{name:'겨맘',hair:'#2a2320'}
};
function kid(c,x,y,s,o){
  o=o||{};c.save();c.translate(x,y);c.scale(o.flip?-s:s,s);
  const sw=Math.sin(o.ph||0)*5,bob=o.run?Math.abs(Math.cos(o.ph||0))*2.5:0;
  c.fillStyle='rgba(0,0,0,.18)';c.beginPath();c.ellipse(0,0,13,4,0,0,7);c.fill();
  c.lineCap='round';c.lineWidth=6;c.strokeStyle=o.pants||'#232a45';
  c.beginPath();c.moveTo(-5,-15);c.lineTo(-5+sw,-2);c.moveTo(5,-15);c.lineTo(5-sw,-2);c.stroke();
  c.fillStyle='#fff';c.beginPath();c.arc(-5+sw,-1,3.6,0,7);c.arc(5-sw,-1,3.6,0,7);c.fill();
  c.translate(0,-bob);
  c.lineWidth=5;c.strokeStyle=o.coat||'#232a45';
  c.beginPath();
  if(o.arms==='up'){c.moveTo(-11,-33);c.lineTo(-18,-52);c.moveTo(11,-33);c.lineTo(18,-52);}
  else if(o.arms==='cross'){c.moveTo(-11,-33);c.lineTo(4,-24);c.moveTo(11,-33);c.lineTo(-4,-24);}
  else if(o.arms==='frame'){c.moveTo(-11,-33);c.lineTo(12,-49);c.moveTo(11,-33);c.lineTo(25,-51);}
  else{c.moveTo(-11,-33);c.lineTo(-15,-20-sw*.6);c.moveTo(11,-33);c.lineTo(15,-20+sw*.6);}
  c.stroke();
  c.fillStyle=o.coat||'#232a45';rr(c,-11,-37,22,25,6);c.fill();
  c.fillStyle='#fff';c.beginPath();c.moveTo(-5,-37);c.lineTo(5,-37);c.lineTo(0,-30);c.closePath();c.fill();
  c.fillStyle=o.vest||'#6d1f31';c.beginPath();c.moveTo(-4,-30);c.lineTo(4,-30);c.lineTo(0,-20);c.closePath();c.fill();
  if(o.face)faceImg(c,o.face,0,-52,17);
  else{c.fillStyle=o.skin||'#f2c9a5';c.beginPath();c.arc(0,-52,15,0,7);c.fill();
    c.fillStyle=o.hair||'#2a2320';c.beginPath();c.arc(0,-55,15,Math.PI,0);c.fill();
    c.fillStyle='#222';c.fillRect(-6,-51,3,3);c.fillRect(3,-51,3,3);
    if(o.glasses){c.strokeStyle='#222';c.lineWidth=1.5;c.beginPath();c.arc(-5,-50,5,0,7);c.arc(5,-50,5,0,7);c.stroke();}}
  if(o.arms==='frame'){c.fillStyle='#f2c9a5';c.beginPath();c.arc(12,-49,4,0,7);c.arc(25,-51,4,0,7);c.fill();
    c.fillStyle='rgba(20,24,44,.45)';c.fillRect(12,-58,14,11);c.strokeStyle='#fff';c.lineWidth=2.6;c.strokeRect(12,-58,14,11);}
  c.restore();
}
function bigHead(c,x,y,r,o){
  o=o||{};c.save();c.translate(x,y);
  c.fillStyle=o.skin||'#f2c9a5';c.beginPath();c.arc(0,0,r,0,7);c.fill();
  c.fillStyle=o.hair||'#2a2320';c.beginPath();c.arc(0,-r*.1,r,Math.PI,0);c.fill();
  c.fillStyle='#222';c.beginPath();c.arc(-r*.35,r*.05,r*.09,0,7);c.arc(r*.35,r*.05,r*.09,0,7);c.fill();
  if(o.glasses){c.strokeStyle='#222';c.lineWidth=2;c.beginPath();c.arc(-r*.35,r*.05,r*.24,0,7);c.arc(r*.35,r*.05,r*.24,0,7);c.stroke();}
  if(!o.nomouth){c.strokeStyle='#222';c.lineWidth=2;c.beginPath();c.moveTo(-r*.2,r*.5);c.lineTo(r*.2,r*.5);c.stroke();}
  c.lineWidth=3;c.strokeStyle='#232a45';c.beginPath();c.arc(0,0,r,0,7);c.stroke();c.restore();
}

