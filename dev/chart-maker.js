'use strict';
/* ---------- 헛다리 레볼루션 채보 메이커 ----------
   노래를 들으며 게임과 같은 키로 플레이하면 채보가 녹음돼요. 녹음한 노트는 세 단계로 다듬어요.
     1) 내 싱크(게임의 싱크 측정값, ms)만큼 빼요.
     2) 한 번 녹음이 끝나면, 박자 칸에서 평균적으로 일찍/늦게 누른 만큼(중앙값) 빼요(자동 보정).
     3) 곡의 실제 박자 지도(beats: 8분음표 시각, 템포가 흔들리는 곡도 따라가요)의 16분/8분 칸에 붙여요.
   곡 데이터(MK_SONGS의 data): {beats: 8분음표 시각(ms), lyrics: [[음절, ms]], levels: 지금 게임 채보 [[ms, 발판, 롱노트ms]] × 4}
   저장한 파일 → node dev/apply_chart.js 파일.json 으로 js/pump-data.js의 PG_CHART에 들어가요('시각/발판[:롱노트]' 표기). */
const MK_SONGS=[{id:'pg13',name:'나락쓰레기장',file:'narak',audio:'../assets/music/narak.mp3',data:'../assets/music/narak.json'},
  {id:'pg14',name:'잘 해줘',file:'haejwo',audio:'../assets/music/haejwo.mp3',data:'../assets/music/haejwo.json'}];
const LV_NAMES=['쉬움','보통','어려움','매우 어려움'];
const COL=['#3aa0ff','#ff4d6d','#ffd23f','#ff4d6d','#3aa0ff'];
const ANG=[Math.PI*1.25,Math.PI*1.75,0,Math.PI*.25,Math.PI*.75];   /* ↙ ↖ ● ↗ ↘ */
const KEYDEF=[['KeyZ','Numpad1'],['KeyQ','Numpad7'],['KeyS','Numpad5'],['KeyE','Numpad9'],['KeyC','Numpad3']];
const HOLD_MIN=.3;     /* 이보다 오래 누르면 롱노트(곡 시간, 초) */
const PREROLL=2;       /* 녹음 전에 미리 들려주는 박 수 */
const $=s=>document.querySelector(s);
const lsGet=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmtT=t=>{t=Math.max(0,t);const m=Math.floor(t/60),s=t-m*60;return `${m}:${s<10?'0':''}${s.toFixed(1)}`;};

/* 발판 키: 게임 설정(rk:pgkeys)을 그대로 써요 */
let KEYS=KEYDEF;
try{const o=JSON.parse(lsGet('rk:pgkeys')||'null');if(Array.isArray(o)&&o.length===5)KEYS=o.map(a=>Array.isArray(a)?a.filter(x=>typeof x==='string'&&x):[]);}catch(e){}
const KEYMAP={};KEYS.forEach((a,l)=>a.forEach(c=>{if(KEYMAP[c]===undefined)KEYMAP[c]=l;}));
const keyName=c=>c.replace(/^Key/,'').replace(/^Digit/,'').replace(/^Numpad(\d)$/,'Num $1');

const M={song:null,data:null,buf:null,ac:null,out:null,dur:60,beats:[],slots:[],lyrics:[],
  lv:1,charts:[[],[],[],[]],pos:0,playing:false,src:null,startCtx:0,startPos:0,rate:1,
  rec:false,recFrom:0,eraseFrom:0,pass:[],held:[null,null,null,null,null],flash:[0,0,0,0,0],
  snap:16,off:0,pps:320,undo:[],redo:[],drag:null,sched:0,timer:0};
try{const o=JSON.parse(lsGet('rk:pump')||'null');if(o&&isFinite(+o.off))M.off=clamp(Math.round(+o.off),-200,200);}catch(e){}

/* ---------- 소리 ---------- */
function ac(){
  if(!M.ac){const C=window.AudioContext||window.webkitAudioContext;M.ac=new C();M.out=M.ac.createGain();M.out.gain.value=.9;M.out.connect(M.ac.destination);}
  if(M.ac.state==='suspended')M.ac.resume().catch(()=>{});
  return M.ac;
}
function beep(f,d,vol,when,type){
  const a=ac(),t=when||a.currentTime,o=a.createOscillator(),g=a.createGain();
  o.type=type||'square';o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g);g.connect(M.out);o.start(t);o.stop(t+d+.02);
}
/* 지금 스피커에서 들리는 순간의 오디오 시계(게임의 pgHeard와 같은 방식). perfMs = 키를 누른 순간(event.timeStamp) */
function heard(perfMs){
  const a=M.ac,now=performance.now(),p=perfMs==null?now:perfMs;
  try{
    const ts=a.getOutputTimestamp();
    if(a.state==='running'&&ts.contextTime>0&&ts.performanceTime>0){
      const h=ts.contextTime+(p-ts.performanceTime)/1000;
      if(h<=a.currentTime+.02+(p-now)/1000&&h>=a.currentTime-.6+(p-now)/1000)return h;
    }
  }catch(e){}
  return a.currentTime-clamp((a.baseLatency||0)+(a.outputLatency||0),0,.3)+(p-now)/1000;
}
const songPos=perfMs=>M.playing?M.startPos+(heard(perfMs)-M.startCtx)*M.rate:M.pos;
const ctxAt=t=>M.startCtx+(t-M.startPos)/M.rate;   /* 곡 위치 t가 나오도록 예약할 오디오 시계 */
function play(from){
  stopAudio();const a=ac();
  const s=a.createBufferSource();s.buffer=M.buf;s.playbackRate.value=M.rate;s.connect(M.out);
  const T=a.currentTime+.08;
  if(from<0)s.start(T-from/M.rate,0);else s.start(T,from);
  M.src=s;M.startCtx=T;M.startPos=from;M.playing=true;M.sched=from;
  s.onended=()=>{if(M.src===s&&M.playing){M.pos=M.dur;stop();}};
  M.timer=setInterval(schedule,25);ui();
}
function stopAudio(){if(M.src){try{M.src.onended=null;M.src.stop();}catch(e){}M.src=null;}clearInterval(M.timer);}
function stop(){
  if(M.rec)finishRec();
  if(M.playing)M.pos=clamp(songPos(),0,M.dur);
  M.playing=false;stopAudio();ui();
}
/* 노트 소리·메트로놈을 곡 시계에 맞춰 미리 예약해요 */
function schedule(){
  if(!M.playing)return;
  const a=M.ac,upto=M.startPos+(a.currentTime+.2-M.startCtx)*M.rate;
  if(upto<=M.sched)return;
  const from=M.sched;M.sched=upto;
  if($('#oClap').checked&&!M.rec){
    const seen=new Set();
    for(const n of chart())if(n.t>from&&n.t<=upto){
      const k=Math.round(n.t*1000);if(seen.has(k))continue;seen.add(k);
      const jump=chart().filter(x=>Math.abs(x.t-n.t)<.002).length>1;
      beep(jump?1900:1400,.05,.16,Math.max(a.currentTime,ctxAt(n.t)));
    }
  }
  if($('#oMetro').checked)M.beats.forEach((b,i)=>{if(i%2===0&&b>from&&b<=upto)beep(i%8===0?1050:780,.04,.1,Math.max(a.currentTime,ctxAt(b)),'sine');});
}

/* ---------- 박자 칸 ---------- */
function buildSlots(){
  const b=M.beats,s=[],step=b.length>1?(b[b.length-1]-b[0])/(b.length-1):.2;
  for(let t=b[0]-step/2;t>-.5;t-=step/2)s.unshift(t);
  for(let i=0;i<b.length;i++){s.push(b[i]);s.push(i+1<b.length?(b[i]+b[i+1])/2:b[i]+step/2);}
  for(let t=s[s.length-1]+step/2;t<M.dur+.5;t+=step/2)s.push(t);
  M.slots=s;
}
function nearest(arr,t){let lo=0,hi=arr.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(arr[m]<t)lo=m;else hi=m;}return Math.abs(arr[lo]-t)<=Math.abs(arr[hi]-t)?arr[lo]:arr[hi];}
const snapT=t=>M.snap===16?nearest(M.slots,t):M.snap===8?nearest(M.beats,t):Math.round(t*1000)/1000;
const slotLen=t=>{const i=M.slots.indexOf(nearest(M.slots,t));return M.slots[Math.min(M.slots.length-1,i+1)]-M.slots[i]||.1;};
const barOf=t=>{let i=0;while(i+1<M.beats.length&&M.beats[i+1]<=t)i++;return Math.floor(i/8)+1;};

/* ---------- 채보 ---------- */
const chart=()=>M.charts[M.lv];
function sortChart(c){c.sort((a,b)=>a.t-b.t||a.lane-b.lane);}
/* 같은 발판의 다음 노트와 겹치는 롱노트는 그 앞에서 끊어요(게임은 롱노트 중 같은 발판 노트를 못 밟아요) */
function fixHolds(c){
  sortChart(c);
  for(let i=0;i<c.length;i++){
    const n=c[i];if(!n.hold)continue;
    const nx=c.find((x,j)=>j>i&&x.lane===n.lane);
    if(nx&&n.t+n.hold>nx.t-.08){n.hold=Math.max(0,nx.t-.08-n.t);if(n.hold<.2)n.hold=0;}
  }
}
function snapshot(){return JSON.stringify({c:M.charts.map(c=>c.map(n=>[n.t,n.lane,n.hold])),l:M.lyrics});}
function restore(s){const o=JSON.parse(s);M.charts=o.c.map(c=>c.map(a=>({t:a[0],lane:a[1],hold:a[2]})));M.lyrics=o.l;}
function pushUndo(){M.undo.push(snapshot());if(M.undo.length>80)M.undo.shift();M.redo=[];}
function undo(){if(!M.undo.length)return;M.redo.push(snapshot());restore(M.undo.pop());changed('되돌렸어요.');}
function redo(){if(!M.redo.length)return;M.undo.push(snapshot());restore(M.redo.pop());changed('다시 했어요.');}
let saveT=0;
function changed(msg){
  if(msg)say(msg);ui();
  clearTimeout(saveT);saveT=setTimeout(()=>lsSet('rk:mk:'+M.song.id,JSON.stringify({saved:Date.now(),levels:exportLevels(),lyrics:exportLyrics()})),300);
}
const exportLevels=()=>M.charts.map(c=>{sortChart(c);return c.map(n=>[Math.round(n.t*1000),n.lane,Math.round(n.hold*1000)]);});
const exportLyrics=()=>M.lyrics.map(([s,t])=>[s,Math.round(t*1000)]);
const importLevels=lv=>{M.charts=[0,1,2,3].map(i=>(lv[i]||[]).map(a=>({t:a[0]/1000,lane:clamp(a[1]|0,0,4),hold:(a[2]||0)/1000})));M.charts.forEach(fixHolds);};
function addNote(t,lane,hold,extra){
  const c=chart();
  if(c.some(n=>n.lane===lane&&Math.abs(n.t-t)<.03))return null;   /* 같은 자리에 이미 있으면 그대로 */
  const n=Object.assign({t,lane,hold:hold||0},extra||{});c.push(n);return n;
}

/* ---------- 녹음 ---------- */
function startRec(){
  if(!M.buf)return;
  if(M.playing)stop();
  pushUndo();
  const bl=M.beats.length>1?(M.beats[1]-M.beats[0])*2:.4;   /* 한 박 길이 */
  M.rec=true;M.recFrom=M.pos;M.eraseFrom=M.pos;M.pass=[];M.held=[null,null,null,null,null];
  M.lrec=$('#oLyrRec').checked;M.lpass=[];
  M.lyrIdx=Math.max(0,M.lyrics.findIndex(([,t])=>t>=M.pos-.05));if(M.lyrIdx<0)M.lyrIdx=M.lyrics.length;
  play(M.pos-PREROLL*bl);
  say(M.lrec?`● 가사 녹음 중 · 「${(M.lyrics[M.lyrIdx]||['끝'])[0]}」부터, 음절마다 아무 발판 키나 눌러요. Enter = 끝`:`● 녹음 중 (${LV_NAMES[M.lv]}) · ${PREROLL}박 듣고 시작해요. Enter = 끝`);
}
function finishRec(){
  if(M.lrec)return finishLyricRec();
  const end=songPos();
  M.held.forEach((h,l)=>{if(h)release(l,null,end);});
  M.rec=false;
  const p=M.pass;
  let note='';
  if(p.length>=8&&$('#oAuto').checked){
    /* 박자 칸(16분)에서 평균적으로 얼마나 일찍/늦게 눌렀는지 → 그만큼 빼고 다시 칸에 맞춰요 */
    const d=p.map(n=>n.raw-nearest(M.slots,n.raw)).sort((a,b)=>a-b),med=d[d.length>>1];
    if(Math.abs(med)>=.008){
      const c=chart();
      p.sort((a,b)=>a.raw-b.raw).forEach((n,i)=>{
        n.t=i&&n.raw-p[i-1].raw<.04?p[i-1].t:snapT(n.raw-med);   /* 동시에 누른 키(점프)는 계속 같은 시각 */
        if(n.hold)n.hold=Math.max(slotLen(n.t),snapT(n.rawEnd-med)-n.t);
      });
      for(let i=c.length-1;i>=0;i--){const n=c[i];if(c.some((x,j)=>j<i&&x!==n&&x.lane===n.lane&&Math.abs(x.t-n.t)<.03))c.splice(i,1);}
      note=` 평균 ${Math.round(Math.abs(med)*1000)}ms ${med>0?'늦게':'일찍'} 눌러서 그만큼 보정했어요.`;
      if(Math.abs(med)>=.025)note+=` (자주 그렇다면 '내 싱크'를 ${med>0?'+':'−'}${Math.round(Math.abs(med)*1000/10)*10}ms 쪽으로 옮겨 보세요)`;
    }
  }
  p.forEach(n=>{delete n.raw;delete n.rawEnd;delete n.pass;});
  fixHolds(chart());
  changed(`녹음 끝: 노트 ${p.length}개.`+note);
}
function press(l,perfMs){
  M.flash[l]=performance.now();
  if(!M.rec||!M.playing){beep(220,.05,.12,null,'sine');return;}
  const raw=songPos(perfMs)-M.off/1000;
  if(raw<M.recFrom-.08){beep(220,.05,.08,null,'sine');return;}   /* 미리 듣는 구간 */
  beep(180,.06,.14,null,'sine');
  if(M.lrec){   /* 가사 녹음: 누를 때마다 다음 음절이 그 순간으로 */
    if(M.lpass.length&&raw-M.lpass[M.lpass.length-1].raw<.06)return;   /* 동시에 누른 키는 한 번으로 */
    if(M.lyrIdx<M.lyrics.length){M.lyrics[M.lyrIdx][1]=snapT(raw);M.lpass.push({i:M.lyrIdx,raw});M.lyrIdx++;orderLyrics(M.lyrIdx-1);}
    return;
  }
  /* 동시에 누른 키(40ms 안)는 같은 시각 = 점프 */
  const mate=M.pass.find(n=>Math.abs(n.raw-raw)<.04);
  const t=mate?mate.t:snapT(raw);
  if(M.held[l])release(l,perfMs);
  const n=addNote(t,l,0,{raw,pass:true});
  if(n){M.pass.push(n);M.held[l]={n,down:raw};}
}
function release(l,perfMs,atPos){
  const h=M.held[l];if(!h)return;M.held[l]=null;
  const up=(atPos!=null?atPos:songPos(perfMs))-M.off/1000;
  h.n.rawEnd=up;
  if(up-h.down>=HOLD_MIN)h.n.hold=Math.max(slotLen(h.n.t),snapT(up)-h.n.t);
}
/* 가사 음절은 항상 앞뒤 순서를 지켜요. i번을 기준으로 뒤 음절이 앞서면 한 칸씩 밀어요 */
function orderLyrics(i){
  const L=M.lyrics;
  for(let k=i+1;k<L.length;k++){if(L[k][1]<=L[k-1][1]+.04)L[k][1]=L[k-1][1]+slotLen(L[k-1][1]);else break;}
  for(let k=i-1;k>=0;k--){if(L[k][1]>=L[k+1][1]-.04)L[k][1]=L[k+1][1]-slotLen(L[k+1][1]);else break;}
}
function finishLyricRec(){
  M.rec=false;M.lrec=false;const p=M.lpass;let note='';
  if(p.length>=6&&$('#oAuto').checked){
    const d=p.map(x=>x.raw-nearest(M.slots,x.raw)).sort((a,b)=>a-b),med=d[d.length>>1];
    if(Math.abs(med)>=.008){p.forEach(x=>{M.lyrics[x.i][1]=snapT(x.raw-med);});note=` 평균 ${Math.round(Math.abs(med)*1000)}ms ${med>0?'늦게':'일찍'} 눌러서 그만큼 보정했어요.`;}
  }
  if(p.length)orderLyrics(p[0].i);p.forEach(x=>orderLyrics(x.i));
  changed(`가사 녹음 끝: ${p.length}음절을 맞췄어요.`+note);
}
/* 녹음하며 지나간 구간의 예전 노트는 지워요(덮어쓰기) */
function eraseBehind(){
  if(!M.rec||M.lrec||!$('#oOver').checked)return;
  const p=songPos()-.15;if(p<=M.eraseFrom)return;
  const c=chart();
  for(let i=c.length-1;i>=0;i--){const n=c[i];if(!n.pass&&n.t>=M.eraseFrom-.03&&n.t<p)c.splice(i,1);}
  M.eraseFrom=p;
}

/* ---------- 입력 ---------- */
window.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'&&e.target.type!=='checkbox'&&e.target.type!=='range')return;
  const l=KEYMAP[e.code];
  if(l!==undefined&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat)press(l,e.timeStamp);return;}
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyY'){e.preventDefault();redo();return;}
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyC'&&!getSelection().toString()){e.preventDefault();copyLevel();return;}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const bl=M.beats.length>1?(M.beats[1]-M.beats[0])*2:.4;
  if(e.code==='Space'){e.preventDefault();M.playing?stop():play(M.pos);}
  else if(e.code==='Enter'||e.code==='NumpadEnter'){e.preventDefault();M.rec?stop():startRec();}
  else if(e.code==='Home'){e.preventDefault();seek(0);}
  else if(e.code==='ArrowLeft'||e.code==='ArrowRight'){e.preventDefault();seek(M.pos+(e.code==='ArrowLeft'?-1:1)*bl*(e.shiftKey?4:1));}
  else if(/^Digit[1-4]$/.test(e.code)){setLv(+e.code.slice(5)-1);}
});
window.addEventListener('keyup',e=>{const l=KEYMAP[e.code];if(l!==undefined){e.preventDefault();release(l,e.timeStamp);}});
window.addEventListener('blur',()=>{M.held.forEach((h,l)=>{if(h)release(l);});});
document.querySelectorAll('#pads button').forEach(b=>{
  const l=+b.dataset.l;
  b.addEventListener('pointerdown',e=>{e.preventDefault();try{b.setPointerCapture(e.pointerId);}catch(_){}press(l,e.timeStamp);});
  ['pointerup','pointercancel'].forEach(ev=>b.addEventListener(ev,e=>release(l,e.timeStamp)));
});
function seek(t){
  t=clamp(t,0,M.dur);
  if(M.rec)stop();
  if(M.playing)play(t);else{M.pos=t;ui();}
}

/* ---------- 화면 ---------- */
const cv=$('#cv');let C=null,W=620,H=700,DPR=1;
const JY=110,LX=160,LW=84,lx=l=>LX+LW/2+l*LW;
const yOf=t=>JY+(t-M.pos)*M.pps;
function resize(){
  const st=$('#stage'),side=window.innerWidth>820;
  const cw=Math.min(620,window.innerWidth-32-(side?300:0)),ch=Math.max(360,window.innerHeight-(side?110:260));
  W=620;H=Math.round(W*ch/cw);DPR=Math.min(2,window.devicePixelRatio||1);
  cv.style.width=cw+'px';cv.style.height=ch+'px';cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);
  C=cv.getContext('2d');C.setTransform(cv.width/W,0,0,cv.height/H,0,0);
  st.style.width=cw+4+'px';
}
window.addEventListener('resize',resize);
function noteShape(c,l,x,y,s){
  c.save();c.translate(x,y);c.beginPath();
  if(l===2)c.arc(0,0,s*.8,0,6.2832);
  else{c.rotate(ANG[l]);c.moveTo(0,-s);c.lineTo(s*.98,s*.02);c.lineTo(s*.46,s*.02);c.lineTo(s*.46,s*.92);c.lineTo(-s*.46,s*.92);c.lineTo(-s*.46,s*.02);c.lineTo(-s*.98,s*.02);c.closePath();}
  c.restore();
}
function draw(){
  requestAnimationFrame(draw);
  if(!C)return;
  if(M.playing){M.pos=clamp(songPos(),-10,M.dur);eraseBehind();}
  const c=C,perf=performance.now(),t0=M.pos-JY/M.pps,t1=M.pos+(H-JY)/M.pps;
  c.fillStyle='#070a18';c.fillRect(0,0,W,H);
  for(let l=0;l<5;l++){c.fillStyle=l%2?'rgba(255,255,255,.035)':'rgba(255,255,255,.02)';c.fillRect(LX+l*LW,0,LW,H);}
  /* 박자선: 8분 흐리게, 박 조금 진하게, 마디 진하게 + 마디 번호 */
  M.beats.forEach((b,i)=>{
    if(b<t0||b>t1)return;const y=yOf(b);
    c.fillStyle=i%8===0?'rgba(255,210,63,.55)':i%2===0?'rgba(255,255,255,.18)':'rgba(255,255,255,.07)';
    c.fillRect(LX,y-(i%8===0?1:.5),LW*5,i%8===0?2:1);
    if(i%8===0){c.fillStyle='rgba(255,210,63,.8)';c.font='12px "Noto Sans KR",sans-serif';c.textAlign='right';c.textBaseline='middle';c.fillText(String(i/8+1),LX-6,y);}
  });
  /* 가사 */
  if($('#oLyr').checked){
    c.font='bold 16px "Noto Sans KR",sans-serif';c.textAlign='right';c.textBaseline='middle';
    M.lyrics.forEach(([s,t],i)=>{if(t<t0-.2||t>t1)return;const y=yOf(t),near=Math.abs(t-M.pos)<.12,drag=M.ldrag&&M.ldrag.i===i;
      if(drag){c.fillStyle='rgba(255,210,63,.18)';c.fillRect(LX-58,y-13,40,26);}
      c.fillStyle=drag?'#fff':near?'#ffd23f':'rgba(238,240,248,.75)';c.fillText(s,LX-28,y);
      c.fillStyle='rgba(255,210,63,.35)';c.fillRect(LX-22,y-.5,10,1);});
  }
  /* 녹음 시작 위치 */
  if(M.rec){const y=yOf(M.recFrom);c.strokeStyle='rgba(255,77,109,.8)';c.setLineDash([6,4]);c.lineWidth=2;c.beginPath();c.moveTo(LX,y);c.lineTo(LX+LW*5,y);c.stroke();c.setLineDash([]);}
  /* 판정선(발판) */
  for(let l=0;l<5;l++){
    const fl=Math.max(0,1-(perf-M.flash[l])/200)+(M.held[l]?1:0);
    noteShape(c,l,lx(l),JY,30);c.fillStyle=`rgba(255,255,255,${.06+.4*Math.min(1,fl)})`;c.fill();c.lineWidth=3;c.strokeStyle=COL[l];c.stroke();
  }
  /* 노트 */
  const ch=chart();
  for(const n of ch){
    const end=n.t+(n.hold||0)+(M.held[n.lane]&&M.held[n.lane].n===n?Math.max(0,M.pos-n.t):0);
    if(end<t0-.1||n.t>t1+.1)continue;
    const y=yOf(n.t),ye=yOf(end);
    if(ye>y+2){c.fillStyle=COL[n.lane];c.globalAlpha=.55;c.fillRect(lx(n.lane)-18,y,36,ye-y);c.globalAlpha=1;c.strokeStyle='#fff';c.lineWidth=2;c.strokeRect(lx(n.lane)-18,y,36,ye-y);}
  }
  for(const n of ch){
    if(n.t<t0-.1||n.t>t1+.1)continue;
    const y=yOf(n.t),jump=ch.some(x=>x!==n&&Math.abs(x.t-n.t)<.002);
    noteShape(c,n.lane,lx(n.lane),y,27);c.fillStyle=COL[n.lane];c.fill();c.lineWidth=3;c.strokeStyle=n.pass?'#ffd23f':jump?'#fff':'#e8ecff';c.stroke();
    if(jump){c.fillStyle='rgba(255,255,255,.55)';c.fillRect(LX+4,y-1,LW*5-8,2);}
  }
  /* 판정선 위치 표시 + 상태 */
  c.fillStyle='rgba(255,255,255,.5)';c.fillRect(LX,JY-1,LW*5,2);
  c.font='bold 14px "Noto Sans KR",sans-serif';c.textAlign='left';c.textBaseline='top';
  if(M.rec){
    c.fillStyle='#ff4d6d';c.fillText(M.lrec?'● 가사 녹음 · 다음 「'+((M.lyrics[M.lyrIdx]||['끝'])[0])+'」':'● REC '+LV_NAMES[M.lv],12,12);
    if(M.pos<M.recFrom){const bl=M.beats.length>1?(M.beats[1]-M.beats[0])*2:.4,n=Math.ceil((M.recFrom-M.pos)/bl);c.font='64px "Black Han Sans",sans-serif';c.textAlign='center';c.fillText(String(n),LX+LW*2.5,H*.45);}
  }else{c.fillStyle='#9aa3c2';c.fillText(LV_NAMES[M.lv]+' · 노트 '+ch.length,12,12);}
  if(!M.buf){c.fillStyle='#ffd23f';c.font='18px "Noto Sans KR",sans-serif';c.textAlign='center';c.fillText($('#load').textContent,W/2,H/2);}
  /* 화면 아래 정보(DOM) */
  if(perf-(draw.last||0)>100){draw.last=perf;$('#tNow').textContent=fmtT(M.pos);$('#tBar').textContent='마디 '+barOf(M.pos);if(!draw.seeking)$('#seek').value=Math.round(clamp(M.pos/M.dur,0,1)*1000);}
}

/* 마우스: 빈 곳 클릭 = 추가, 노트 클릭/우클릭 = 삭제, 노트를 아래로 끌기 = 롱노트 */
function hit(e){
  const r=cv.getBoundingClientRect(),x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;
  const l=Math.floor((x-LX)/LW);return {l:l>=0&&l<5?l:-1,x,y,t:M.pos+(y-JY)/M.pps};
}
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{
  if(!M.buf||M.rec)return;
  const h=hit(e);
  if(h.l<0&&$('#oLyr').checked&&h.x<LX-4){   /* 가사 글자를 위아래로 끌면 그 음절 시각이 바뀌어요(박자 칸에 자동으로 맞춰요) */
    const i=M.lyrics.findIndex(([,t])=>Math.abs(yOf(t)-h.y)<13);
    if(i>=0){e.preventDefault();pushUndo();M.ldrag={i,moved:false};try{cv.setPointerCapture(e.pointerId);}catch(_){}}
    return;
  }
  if(h.l<0)return;e.preventDefault();
  const c=chart(),n=c.find(x=>x.lane===h.l&&Math.abs(yOf(x.t)-h.y)<16);
  if(n){
    pushUndo();
    if(e.button===2){c.splice(c.indexOf(n),1);changed();return;}
    M.drag={n,y:h.y,moved:false};try{cv.setPointerCapture(e.pointerId);}catch(_){}
  }else{
    pushUndo();addNote(snapT(h.t),h.l,0);fixHolds(c);beep(1400,.04,.12);changed();
  }
});
cv.addEventListener('pointermove',e=>{
  if(M.ldrag){const h=hit(e),L=M.lyrics,i=M.ldrag.i;M.ldrag.moved=true;
    const lo=i?L[i-1][1]+.05:0,hi=i+1<L.length?L[i+1][1]-.05:M.dur;L[i][1]=clamp(M.snap?snapT(h.t):h.t,lo,hi);return;}
  const d=M.drag;if(!d)return;const h=hit(e);
  if(Math.abs(h.y-d.y)>8)d.moved=true;
  if(d.moved){const end=snapT(h.t);d.n.hold=end-d.n.t>=slotLen(d.n.t)*.9?end-d.n.t:0;ui();}
});
cv.addEventListener('pointerup',()=>{
  if(M.ldrag){const {i,moved}=M.ldrag;M.ldrag=null;if(moved)changed(`가사 「${M.lyrics[i][0]}」를 ${fmtT(M.lyrics[i][1])}로 옮겼어요.`);else M.undo.pop();return;}
  const d=M.drag;if(!d)return;M.drag=null;
  if(!d.moved){chart().splice(chart().indexOf(d.n),1);changed();}else{fixHolds(chart());changed();}
});
cv.addEventListener('wheel',e=>{
  e.preventDefault();
  if(e.ctrlKey){M.pps=clamp(M.pps*(e.deltaY<0?1.12:1/1.12),80,1400);return;}
  seek(M.pos+e.deltaY/M.pps);
},{passive:false});


/* ---------- 다른 난이도 만들기 ----------
   지금 난이도 채보를 기준으로 다른 난이도를 다시 만들어요.
   - 더 쉽게: 같은 시각 노트(점프)를 한 묶음으로 보고, 중요한 박부터(마디 첫 박 > 박 > 8분 > 16분, 가사 음절 자리 +) 남기며
     묶음 사이가 MK_GAP보다 가까운 건 빼요. 쉬움은 점프를 한 발로, 보통은 박 자리 점프만 남겨요. 발판은 원래 채보 그대로.
   - 더 어렵게: 원래 노트는 그대로 두고, 빈 틈을 8분(매우 어려움은 16분) 칸으로 채우고, 마디 첫 박에 점프를 더해요. */
const MK_GAP=[.5,.2,.13,.095];            /* 난이도별 노트 묶음 사이 최소 간격(초) */
const MK_FILL=[0,0,.38,.3];               /* 어려움부터: 이보다 빈 틈은 박자 칸으로 채워요 */
const MK_STEP=[0,0,.19,.19];              /* 채우는 노트 사이 간격(8분 ≈ 0.2초). 매우 어려움은 박마다 끝 16분도 더해요 */
const MK_HOLDMIN=[.55,.4,.3,.3];          /* 이보다 짧은 롱노트는 일반 노트로 */
function beatRank(t){
  let bi=-1,bd=1;M.beats.forEach((b,i)=>{const d=Math.abs(b-t);if(d<bd){bd=d;bi=i;}});
  let r=bd<.025?(bi%8===0?4:bi%2===0?3:2):1;
  if(M.lyrics.some(([,lt])=>Math.abs(lt-t)<.04))r+=.5;   /* 가사 음절 자리 */
  return r;
}
function regen(src,from,to){
  const ev=[];   /* 같은 시각 묶음 */
  [...src].sort((a,b)=>a.t-b.t).forEach(n=>{const e=ev[ev.length-1];if(e&&Math.abs(e.t-n.t)<.002)e.notes.push(n);else ev.push({t:n.t,notes:[n]});});
  ev.forEach(e=>{e.rank=beatRank(e.t);e.end=e.t+Math.max(...e.notes.map(n=>n.hold||0));});
  let keep;
  if(to<from){
    keep=[];
    [...ev].sort((a,b)=>b.rank-a.rank||a.t-b.t).forEach(e=>{if(keep.every(k=>Math.abs(k.t-e.t)>=MK_GAP[to]))keep.push(e);});
    keep.sort((a,b)=>a.t-b.t);
  }else keep=ev.slice();
  const out=[];
  keep.forEach(e=>{
    let ns=e.notes;
    if(ns.length>1&&(to===0||(to===1&&e.rank<3)))ns=[ns[0]];   /* 쉬움은 점프 없음, 보통은 박 자리 점프만 */
    ns.forEach(n=>out.push({t:n.t,lane:n.lane,hold:(n.hold||0)>=MK_HOLDMIN[to]?n.hold:0}));
  });
  if(to>from){
    const slots=to>=3?M.slots:M.beats,busy=t=>out.some(n=>n.hold&&t>n.t-.05&&t<n.t+n.hold+.1);
    const base=[...out].sort((a,b)=>a.t-b.t);let dir=1;
    for(let i=0;i+1<base.length;i++){
      const a=base[i],b=base[i+1],aEnd=a.t+(a.hold||0);
      if(b.t-aEnd<MK_FILL[to])continue;
      let last=aEnd,lane=a.lane;
      slots.forEach(t=>{
        const gallop=to>=3&&M.beats.some((bt,k)=>k%2===0&&bt-t>.07&&bt-t<.13);   /* 매우 어려움: 박 바로 앞 16분 → 따-닥 */
        if(t<=aEnd+MK_GAP[to]-.005||t>=b.t-MK_GAP[to]+.005||t-last<(gallop?MK_GAP[to]:MK_STEP[to])-.005||busy(t))return;
        /* 발판: 한 방향으로 걸어가다 끝에서 되돌아와요. 바로 앞 노트·곧 올 노트와 같은 발판은 피해요 */
        const prev=lane,avoid=b.t-t<.3?b.lane:-1;
        for(const k of [1,-1,2,-2]){const c=prev+dir*k;if(c>=0&&c<=4&&c!==avoid){lane=c;if(k<0)dir=-dir;break;}}
        out.push({t,lane,hold:0});last=t;
      });
    }
    M.beats.forEach((b,i)=>{   /* 마디 첫 박 점프 (어려움 2마디마다, 매우 어려움 매 마디) */
      if(i%(to>=3?8:16)!==0)return;
      const at=out.filter(n=>Math.abs(n.t-b)<.03);if(at.length!==1||at[0].hold||busy(b+.001))return;
      const l2=at[0].lane===2?0:4-at[0].lane;if(l2!==at[0].lane)out.push({t:at[0].t,lane:l2,hold:0});
    });
  }
  fixHolds(out);return out;
}

/* ---------- 버튼 ---------- */
function say(m,bad){const p=$('#msg');p.textContent=m||'';p.classList.toggle('bad',!!bad);}
function setLv(i){if(M.rec)stop();M.lv=i;genTargets();ui();}
function ui(){
  [...$('#lvs').children].forEach((b,i)=>{b.classList.toggle('on',i===M.lv);b.lastChild.textContent='노트 '+M.charts[i].length;});
  $('#bPlay').textContent=M.playing&&!M.rec?'⏸ 정지':'▶ 재생';
  $('#bRec').classList.toggle('on',M.rec);$('#bRec').textContent=M.rec?'■ 녹음 끝':'● 녹음';
  $('#stage').classList.toggle('rec',M.rec);
  $('#offV').textContent=(M.off>0?'+':'')+M.off+'ms';
  document.querySelectorAll('[data-rate]').forEach(b=>b.classList.toggle('on',+b.dataset.rate===M.rate));
  document.querySelectorAll('[data-snap]').forEach(b=>b.classList.toggle('on',+b.dataset.snap===M.snap));
  $('#bUndo').disabled=!M.undo.length;$('#bRedo').disabled=!M.redo.length;
}
LV_NAMES.forEach((n,i)=>{const b=document.createElement('button');b.innerHTML=`<span>${n}</span><small></small>`;b.addEventListener('click',()=>setLv(i));$('#lvs').appendChild(b);});
$('#bHome').addEventListener('click',()=>seek(0));
$('#bPlay').addEventListener('click',()=>{if(!M.buf)return;M.playing?stop():play(M.pos);});
$('#bRec').addEventListener('click',()=>{M.rec?stop():startRec();});
document.querySelectorAll('[data-rate]').forEach(b=>b.addEventListener('click',()=>{const was=M.playing&&!M.rec,p=songPos();M.rate=+b.dataset.rate;if(was)play(p);ui();}));
document.querySelectorAll('[data-snap]').forEach(b=>b.addEventListener('click',()=>{M.snap=+b.dataset.snap;ui();say(M.snap?`이제부터 찍는 노트를 ${M.snap}분음표 칸에 맞춰요.`:'칸에 맞추지 않고 누른 시각 그대로 찍어요.');}));
$('#offM').addEventListener('click',()=>{M.off=clamp(M.off-10,-200,200);ui();});
$('#offP').addEventListener('click',()=>{M.off=clamp(M.off+10,-200,200);ui();});
$('#zM').addEventListener('click',()=>{M.pps=clamp(M.pps/1.2,80,1400);});
$('#zP').addEventListener('click',()=>{M.pps=clamp(M.pps*1.2,80,1400);});
$('#bUndo').addEventListener('click',undo);$('#bRedo').addEventListener('click',redo);
$('#bClear').addEventListener('click',()=>{if(!chart().length)return;if(!confirm(`${LV_NAMES[M.lv]} 채보를 모두 지울까요? (되돌리기로 살릴 수 있어요)`))return;pushUndo();M.charts[M.lv]=[];changed(`${LV_NAMES[M.lv]} 채보를 비웠어요.`);});
/* 게임 채보: 운영 중인 게임(GitHub Pages)의 js/pump-data.js → 안 되면 이 폴더의 js/pump-data.js → 곡 데이터(json) 순서로 */
const LIVE_PUMP='https://kortiger-s.github.io/rocksunting-game/js/pump-data.js';
function parseChart(js,id){  // PG_CHART의 pg13:{dur:..,lv:[ '시각/발판[:롱노트] ...' × 4 ]}
  const m=js.match(new RegExp(id+':\\{dur:[\\d.]+,lv:\\[([\\s\\S]*?)\\]\\}'));if(!m)return null;
  const lv=(m[1].match(/'[^']*'/g)||[]).map(s=>s.slice(1,-1).trim().split(/\s+/).filter(Boolean).map(x=>{const r=x.match(/^(\d+)\/(\d)(?::(\d+))?$/);return r?[+r[1],+r[2],+(r[3]||0)]:null;}).filter(Boolean));
  return lv.length===4?lv:null;
}
async function gameLevels(id){
  for(const [url,where] of [[LIVE_PUMP+'?t='+Date.now(),'운영 중인 게임'],['../js/pump-data.js','이 폴더(js/pump-data.js)']]){
    try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(r.status);const lv=parseChart(await r.text(),id);if(lv)return {lv,where};}catch(e){console.warn(where,e);}
  }
  return {lv:M.data.levels||[],where:'곡 데이터(json)'};
}
$('#bBase').addEventListener('click',async()=>{if(!M.data)return;if(!confirm(`${LV_NAMES[M.lv]}를 지금 운영 중인 게임의 채보로 바꿀까요? (되돌리기로 살릴 수 있어요)`))return;
  const lvIdx=M.lv,song=M.song;say('게임 채보를 받아오는 중…');const {lv,where}=await gameLevels(song.id);if(M.song!==song)return;
  pushUndo();M.charts[lvIdx]=(lv[lvIdx]||[]).map(a=>({t:a[0]/1000,lane:a[1],hold:(a[2]||0)/1000}));fixHolds(M.charts[lvIdx]);
  changed(`${where}에서 ${LV_NAMES[lvIdx]} 채보를 불러왔어요 (노트 ${M.charts[lvIdx].length}개).`);});
const exportText=()=>JSON.stringify({song:M.song.id,name:M.song.name,file:M.song.file,from:M.lv,made:new Date().toISOString(),levels:exportLevels(),lyrics:exportLyrics()});
$('#bSave').addEventListener('click',()=>{
  const blob=new Blob([exportText()],{type:'application/json'}),a=document.createElement('a'),u=URL.createObjectURL(blob);
  a.href=u;a.download=`${M.song.file}-chart.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),3000);
  say(`${M.song.file}-chart.json 으로 저장했어요. node dev/apply_chart.js 로 게임에 넣어요.`);
});
$('#bCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(exportText());say('전체 채보(4개 난이도 + 가사)를 복사했어요. 그대로 붙여 넣어 전달하면 돼요.');}catch(e){say('복사하지 못했어요. 파일 저장을 써 주세요.',true);}});
/* 난이도 복사·붙여넣기: 메이커 안 클립보드(MCLIP)에 담고, 시스템 클립보드에도 글자로 넣어 둬요(다른 탭·브라우저에서도 붙여넣기) */
let MCLIP=null;
async function copyLevel(){
  sortChart(chart());
  MCLIP={kind:'rk-level',song:M.song.id,from:M.lv,notes:chart().map(n=>[Math.round(n.t*1000),n.lane,Math.round(n.hold*1000)])};
  try{await navigator.clipboard.writeText(JSON.stringify(MCLIP));}catch(e){}
  say(`${LV_NAMES[M.lv]} 채보(노트 ${MCLIP.notes.length}개)를 복사했어요. 다른 난이도로 바꾸고 📥 붙여넣기(Ctrl+V)를 누르세요.`);
}
async function pasteLevel(text){
  let clip=null;
  try{const o=JSON.parse(text!=null?text:await navigator.clipboard.readText());
    if(o&&o.kind==='rk-level'&&Array.isArray(o.notes))clip=o;
    else if(o&&Array.isArray(o.levels))clip={song:o.song,from:o.from!=null?o.from:M.lv,notes:o.levels[o.from!=null?o.from:M.lv]||[]};   /* 전체 복사한 것도 받아요 */
  }catch(e){}
  clip=clip||MCLIP;
  if(!clip||!clip.notes.length){say('붙여 넣을 채보가 없어요. 먼저 📋 이 난이도 복사를 눌러 주세요.',true);return;}
  if(clip.song&&clip.song!==M.song.id&&!confirm('다른 곡에서 복사한 채보예요. 그래도 붙여 넣을까요?'))return;
  if(chart().length&&!confirm(`${LV_NAMES[M.lv]} 채보(노트 ${chart().length}개)를 복사한 ${LV_NAMES[clip.from]||''} 채보(노트 ${clip.notes.length}개)로 바꿀까요? (되돌리기로 살릴 수 있어요)`))return;
  pushUndo();
  M.charts[M.lv]=clip.notes.map(a=>({t:a[0]/1000,lane:clamp(a[1]|0,0,4),hold:(a[2]||0)/1000}));fixHolds(chart());
  changed(`${LV_NAMES[clip.from]||'복사한'} 채보를 ${LV_NAMES[M.lv]}에 붙여 넣었어요 (노트 ${chart().length}개).`);
}
$('#bLvCopy').addEventListener('click',copyLevel);
$('#bLvPaste').addEventListener('click',()=>pasteLevel());
$('#bOpen').addEventListener('click',()=>$('#fOpen').click());
$('#fOpen').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const o=JSON.parse(await f.text());if(!o||!Array.isArray(o.levels))throw 0;if(o.song&&o.song!==M.song.id&&!confirm(`다른 곡(${o.name||o.song}) 파일이에요. 그래도 불러올까요?`))return;
    pushUndo();importLevels(o.levels);if(Array.isArray(o.lyrics)&&o.lyrics.length===M.lyrics.length)M.lyrics=o.lyrics.map(a=>[a[0],a[1]/1000]);changed(`${f.name}을(를) 불러왔어요.`);}catch(_){say('채보 파일이 아니에요.',true);}
});
$('#bLyrSnap').addEventListener('click',()=>{
  pushUndo();M.lyrics.forEach(a=>{a[1]=M.snap===8?nearest(M.beats,a[1]):nearest(M.slots,a[1]);});orderLyrics(0);
  changed(`가사 ${M.lyrics.length}음절을 ${M.snap===8?'8분':'16분'} 박자 칸에 맞췄어요.`);
});
$('#bLyrBase').addEventListener('click',()=>{if(!confirm('가사 위치를 처음 분석한 값으로 되돌릴까요? (되돌리기로 살릴 수 있어요)'))return;pushUndo();M.lyrics=(M.data.lyrics||[]).map(a=>[a[0],a[1]/1000]);changed('가사 위치를 처음 값으로 되돌렸어요.');});
function genTargets(){
  const box=$('#genTo');box.innerHTML='';
  LV_NAMES.forEach((n,i)=>{if(i===M.lv)return;const l=document.createElement('label');l.className='chk';l.innerHTML=`<input type="checkbox" value="${i}"> ${n}`;box.appendChild(l);});
  $('#genFrom').textContent=LV_NAMES[M.lv];
}
$('#bGen').addEventListener('click',()=>{
  const to=[...document.querySelectorAll('#genTo input:checked')].map(x=>+x.value);
  if(!chart().length){say('지금 난이도에 노트가 없어요. 먼저 채보를 만들어 주세요.',true);return;}
  if(!to.length){say('만들 난이도를 골라 주세요.',true);return;}
  if(!confirm(`${LV_NAMES[M.lv]} 채보로 ${to.map(i=>LV_NAMES[i]).join(', ')}을(를) 새로 만들까요? 그 난이도의 지금 채보는 바뀌어요. (되돌리기로 살릴 수 있어요)`))return;
  pushUndo();
  const r=to.map(i=>{const before=M.charts[i].length;M.charts[i]=regen(chart(),M.lv,i);return `${LV_NAMES[i]} ${before}→${M.charts[i].length}`;});
  changed(`만들었어요: ${r.join(' · ')}. 자동으로 만든 거라 한 번 들으며 다듬어 주세요.`);
});
const seekEl=$('#seek');
seekEl.addEventListener('input',()=>{draw.seeking=true;const t=+seekEl.value/1000*M.dur;if(!M.playing){M.pos=t;}});
seekEl.addEventListener('change',()=>{draw.seeking=false;seek(+seekEl.value/1000*M.dur);});
document.addEventListener('paste',e=>{if(e.target.tagName==='INPUT'&&e.target.type==='text')return;e.preventDefault();pasteLevel(e.clipboardData?e.clipboardData.getData('text'):null);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&M.playing)stop();});

/* ---------- 곡 불러오기 ---------- */
MK_SONGS.forEach((s,i)=>{const o=document.createElement('option');o.value=i;o.textContent=s.name;$('#songSel').appendChild(o);});
$('#songSel').addEventListener('change',e=>load(MK_SONGS[+e.target.value]));
async function load(song){
  stop();M.song=song;M.buf=null;$('#load').textContent='곡 불러오는 중…';
  try{
    const [data,ab]=await Promise.all([fetch(song.data).then(r=>{if(!r.ok)throw new Error(r.status);return r.json();}),fetch(song.audio).then(r=>{if(!r.ok)throw new Error(r.status);return r.arrayBuffer();})]);
    const buf=await new Promise((ok,no)=>{const p=ac().decodeAudioData(ab,ok,no);if(p&&p.then)p.then(ok,no);});
    M.data=data;M.buf=buf;M.dur=buf.duration;M.beats=data.beats.map(x=>x/1000);M.lyrics=(data.lyrics||[]).map(a=>[a[0],a[1]/1000]);buildSlots();
    let saved=null;try{saved=JSON.parse(lsGet('rk:mk:'+song.id)||'null');}catch(e){}
    if(saved&&Array.isArray(saved.lyrics)&&saved.lyrics.length===M.lyrics.length)M.lyrics=saved.lyrics.map(a=>[a[0],a[1]/1000]);
    if(saved&&Array.isArray(saved.levels)){importLevels(saved.levels);say(`이 브라우저에 저장해 둔 작업을 불러왔어요 (${new Date(saved.saved).toLocaleString()}).`);}
    else{importLevels(data.levels||[]);say('지금 게임 채보에서 시작해요. 비우고 새로 녹음해도 돼요.');}
    M.undo=[];M.redo=[];M.pos=0;
    $('#load').textContent=`${song.name} · ${fmtT(M.dur)} · 박자 ${M.beats.length/2|0}박`;$('#tDur').textContent=fmtT(M.dur);
  }catch(e){console.error(e);$('#load').textContent='곡을 불러오지 못했어요. 로컬 서버(npm run serve)로 열어 주세요.';say('곡을 불러오지 못했어요. index.html을 파일로 직접 열면(file://) 음원을 못 읽어요.',true);}
  ui();
}
$('#keyTxt').textContent=[0,1,2,3,4].map(l=>KEYS[l].map(keyName).join('/')).join('  ');
resize();genTargets();ui();requestAnimationFrame(draw);load(MK_SONGS[0]);
