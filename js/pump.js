'use strict';
/* ---------- 소리새 펌프 (시즌2 · v2.0.0~) ----------
   호우와 하는 5패널 리듬 내기예요. 오락실 펌프처럼 노트가 화면 아래에서 위로 올라오고, 위쪽 발판(↙ ↖ ● ↗ ↘)에 닿는 순간 맞춰 밟아요.
   - 곡·채보: pump-data.js (악보는 Web Audio로 합성, 채보는 악보에서 자동 생성)
   - 시계: 곡이 흐르는 AudioContext 시간(AC.currentTime)을 기준으로 삼아서, 화면·소리·판정이 어긋나지 않아요.
     탭이 가려지면 AudioContext가 멈추면서 게임도 같이 멈춰요.
   - 판돈은 시작할 때 미리 빼고 저장해요. (중간에 새로고침해서 되돌리는 부정행위 방지: 프리킥과 같아요)
   - 도전 횟수: 마이크 🎤 5개, 시작할 때마다 1개씩 쓰고 30분마다 1개 충전 (프리킥의 축구공과 같은 방식) */
const MIC_MAX=5,MIC_MIN=30;
const micMin=()=>Math.floor(Date.now()/60000);
function micTick(){   /* 지난 시간만큼 마이크를 채워요. 개수가 늘었으면 true */
  const now=micMin();let b=S.mics==null?MIC_MAX:clamp(Math.floor(S.mics),0,MIC_MAX),up=false;
  if(b<MIC_MAX){
    let at=Math.min(S.micAt>0?S.micAt:now,now);
    const gain=Math.floor((now-at)/MIC_MIN);
    if(gain>0){b=Math.min(MIC_MAX,b+gain);at+=gain*MIC_MIN;up=true;}
    S.micAt=b>=MIC_MAX?0:at;
  }else S.micAt=0;
  S.mics=b;return up;
}
function micUse(){
  if(isPractice())return true;   /* 연습 기간엔 마이크가 줄지 않아요 */
  micTick();if(S.mics<=0)return false;
  if(S.mics>=MIC_MAX)S.micAt=micMin();
  S.mics--;return true;
}
const micWaitSec=()=>Math.max(0,Math.ceil(((S.micAt+MIC_MIN)*60000-Date.now())/1000));
function renderMics(){
  const b=S.mics==null?MIC_MAX:S.mics;
  $('#mics').setAttribute('aria-label',`소리새 펌프 도전 횟수 ${b}/${MIC_MAX}`);
  [...$('#mics').children].forEach((el,i)=>el.classList.toggle('used',i>=b));
  const w=micWaitSec(),t=`${Math.floor(w/60)}:${String(w%60).padStart(2,'0')}`;
  $('#micNote').textContent=b>=MIC_MAX?'도전 횟수가 가득 찼어요!':b<=0?`마이크가 다 떨어졌어요. 다음 마이크까지 ${t}`:`다음 마이크까지 ${t} (30분마다 1개 충전)`;
}
setInterval(()=>{
  if(!pgUnlocked()||!USER||mode!=='hub')return;
  if(micTick()){save();renderHub();sfx('ping');toast('🎤 마이크가 하나 충전됐어요!');}else renderMics();
},1000);

/* ---------- 옵션 (이 기기에 기억) ---------- */
const PG_SPEEDS=[1,1.5,2,2.5,3];   /* 노트가 올라오는 속도 배율 */
let PGO={song:0,diff:0,spd:1,off:0};   /* diff: 0 쉬움 · 1 보통 · 2 어려움 · 3 매우 어려움 · off: 싱크 보정(ms). +면 노트가 늦게 내려와요 */
try{const o=JSON.parse(lsGet('rk:pump')||'null');if(o&&typeof o==='object')PGO=Object.assign(PGO,o);}catch(e){}
function pgOptFix(){
  PGO.song=clamp(Math.floor(+PGO.song)||0,0,PGSONGS.length-1);
  PGO.diff=clamp(Math.floor(+PGO.diff)||0,0,PG_DIFFS.length-1);
  PGO.spd=clamp(Math.floor(+PGO.spd)||0,0,PG_SPEEDS.length-1);
  PGO.off=clamp(Math.round((+PGO.off||0)/10)*10,-200,200);
}
pgOptFix();
const pgOptSave=()=>lsSet('rk:pump',JSON.stringify(PGO));
const PG_LIFE0=55;   /* 시작 게이지(%) */

/* ---------- 허브 카드: 곡 선택(0) → 난이도 선택(1, 난이도마다 판돈 고정) → 게임 설명 + 노래 시작(2) ---------- */
let pgStep=0;   /* 게임 목록에서 카드를 열면 0부터. 한 판 끝나고 돌아오면 2(같은 곡 바로 다시 하기) */
const pgBet=d=>PG_BET[d]||1000;   /* 난이도별 판돈(pump-data.js의 PG_BET) */
function pgGo(step){
  pgStep=step;renderPumpCard();
  const c=$('#pumpCard');if(c.getBoundingClientRect().top<0)c.scrollIntoView({block:'start'});   /* 긴 곡 목록 아래에서 눌렀어도 다음 단계의 맨 위부터 보여요 */
}
document.querySelectorAll('.gopen[data-card="pumpCard"]').forEach(b=>b.addEventListener('click',()=>{pgStep=0;renderPumpCard();}));
document.querySelectorAll('#pumpCard .pgprev').forEach(b=>b.addEventListener('click',()=>pgGo(+b.dataset.to)));
(function buildSongList(){
  const box=$('#pgSongs');
  PGSONGS.forEach((s,i)=>{
    const b=document.createElement('button');b.type='button';b.className='song';
    const d=document.createElement('div'),n=document.createElement('b'),sm=document.createElement('small'),st=document.createElement('span');
    n.textContent=s.name;sm.textContent=`${s.sub} · BPM ${s.bpm}`;st.className='stars';st.textContent='★ '+s.diffs.map(d=>d.stars).join(' · ');   /* 쉬움 · 보통 · 어려움 · 매우 어려움 별 개수 */
    d.appendChild(n);d.appendChild(sm);b.appendChild(d);b.appendChild(st);
    b.addEventListener('click',()=>{PGO.song=i;pgOptSave();pgGo(1);});
    box.appendChild(b);
  });
  /* 곡을 고른 다음 난이도를 골라요 */
  const dbox=$('#pgDiffs');
  PG_DIFFS.forEach((n,i)=>{
    const b=document.createElement('button');b.type='button';b.className='song';
    const t=document.createElement('b'),st=document.createElement('span');t.textContent=n;st.className='stars';
    b.appendChild(t);b.appendChild(st);
    b.addEventListener('click',()=>{if(S.money<pgBet(i)){sfx('deny');toast(`판돈 ${fmt(pgBet(i))}원이 필요해요.`);return;}PGO.diff=i;pgOptSave();pgGo(2);});
    dbox.appendChild(b);
  });
})();
function renderPumpCard(){
  const open=pgUnlocked();
  document.querySelector('.rtabs [data-m="pumpBest"]').hidden=!PUMP_PUBLIC;   /* 랭킹의 펌프 항목은 모두에게 공개하기 전까지 숨겨요(잠금을 푼 기기도) */
  $('#pgH2').firstChild.textContent=open?'호우와 소리새 헛다리짚기 훈련 ':'??? ';
  $('#pgLock').hidden=open;$('#pgOpen').hidden=!open;$('#pgRelock').hidden=PUMP_PUBLIC;
  if(!open)return;
  micTick();renderMics();pgOptFix();
  if(pgStep===2&&S.money<pgBet(PGO.diff))pgStep=1;   /* 돈이 모자라 이 난이도를 못 하게 되면 난이도 선택으로 돌아가요 */
  [0,1,2].forEach(i=>{$('#pgStep'+i).hidden=i!==pgStep;});
  [...$('#pgSongs').children].forEach((b,i)=>b.classList.toggle('sel',i===PGO.song));
  const sg=pgPick(PGO.song,PGO.diff),ch=pgChart(sg),bet=pgBet(PGO.diff);
  $('#pgDiffT').textContent=`「${sg.name}」 난이도를 골라요`;
  [...$('#pgDiffs').children].forEach((b,i)=>{
    const d=sg.diffs[i],poor=S.money<pgBet(i);
    b.classList.toggle('sel',i===PGO.diff);b.classList.toggle('poor',poor);b.setAttribute('aria-disabled',poor);
    b.lastChild.textContent=`★${d.stars} · 판돈 ${fmt(pgBet(i))}원`;   /* 돈이 모자라면 CSS(.poor)가 "소지금 부족" 줄을 붙여요 */
    b.setAttribute('aria-label',`${PG_DIFFS[i]} · 별 ${d.stars}개 · 판돈 ${fmt(pgBet(i))}원${poor?' · 소지금 부족':''}`);
  });
  $('#pgSumT').textContent=`${sg.name} · ${PG_DIFFS[PGO.diff]} ★${sg.stars}`;
  $('#pgSumB').textContent=`판돈 ${fmt(bet)}원`;
  $('#pgIntroBtn').hidden=!sg.intro;if(sg.intro)$('#pgIntroBtn').textContent=INTROS[sg.intro].btn;
  $('#pgInfo').textContent=`호우 목표 ${fmt(sg.target)}점 · 노트 ${ch.taps+ch.holds}개 · 약 ${sg.secs}초`;
  $('#pgSpdV').textContent='×'+PG_SPEEDS[PGO.spd];$('#pgSpdM').disabled=PGO.spd<=0;$('#pgSpdP').disabled=PGO.spd>=PG_SPEEDS.length-1;
  $('#pgOffV').textContent=(PGO.off>0?'+':'')+PGO.off+'ms';$('#pgOffM').disabled=PGO.off<=-200;$('#pgOffP').disabled=PGO.off>=200;
  $('#pgStart').disabled=!(S.money>=bet&&S.mics>0);
}
$('#pgSpdM').addEventListener('click',()=>{PGO.spd--;pgOptSave();renderPumpCard();});
$('#pgSpdP').addEventListener('click',()=>{PGO.spd++;pgOptSave();renderPumpCard();});
$('#pgOffM').addEventListener('click',()=>{PGO.off-=10;pgOptSave();renderPumpCard();});
$('#pgOffP').addEventListener('click',()=>{PGO.off+=10;pgOptSave();renderPumpCard();});
$('#pgStart').addEventListener('click',pumpStart);
function pgTryUnlock(){
  const v=$('#pgCode').value.trim(),m=$('#pgLockMsg');
  if(!PIN_RE.test(v)){m.textContent='숫자 4자리를 입력해 주세요.';sfx('error');return;}
  if(pinHash('rk-pump',v)!==PUMP_KEY){m.textContent='번호가 맞지 않아요.';$('#pgCode').value='';sfx('error');return;}
  lsSet('rk:pumpkey',PUMP_KEY);$('#pgCode').value='';m.textContent='';
  sfx('welcome');toast('🔓 시즌2 입장! (이 기기에 기억돼요)');renderHub();
}
$('#pgUnlock').addEventListener('click',pgTryUnlock);
$('#pgCode').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();pgTryUnlock();}});
$('#pgCode').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,4);$('#pgLockMsg').textContent='';});
$('#pgRelock').addEventListener('click',()=>{lsDel('rk:pumpkey');toast('다시 잠갔어요.');renderHub();});

/* ---------- 게임 상태 ---------- */
let PG=null,PGH=720,PGC=null;
const PGW=480,PGRY=120;   /* 캔버스 논리 크기(가로 480, 세로는 화면에 맞춰 바뀜) · 발판(판정선) y */
const PGX=[52,146,240,334,428];
const PGCOL=['#3aa0ff','#ff4d6d','#ffd23f','#ff4d6d','#3aa0ff'];
const PGANG=[Math.PI*1.25,Math.PI*1.75,0,Math.PI*.25,Math.PI*.75];   /* ↙ ↖ ● ↗ ↘ (위쪽 화살표를 돌려서 그려요) */
const PGJN=['PERFECT','GREAT','GOOD','BAD','MISS'],PGJC=['#ffe066','#7bed9f','#6ec8ff','#c9a0ff','#ff6b6b'];
const PGWT=[1,.8,.5,.2,0],PGLIFE=[1.5,1,0,-4,-8];   /* 판정별 점수 가중치, 게이지 변화 */
/* 발판 키: 발판(lane)마다 키 2칸. 설정 > 펌프 키 변경에서 바꾸고 이 기기에만 저장해요(rk:pgkeys). PGKEYS는 거기서 만든 {키 코드: 발판} 표 */
const PGKBIND_DEF=[['KeyZ','Numpad1'],['KeyQ','Numpad7'],['KeyS','Numpad5'],['KeyE','Numpad9'],['KeyC','Numpad3']];
let PGKBIND=PGKBIND_DEF.map(a=>a.slice()),PGKEYS={};
try{const o=JSON.parse(lsGet('rk:pgkeys')||'null');if(Array.isArray(o)&&o.length===5)PGKBIND=o.map(a=>[0,1].map(i=>Array.isArray(a)&&typeof a[i]==='string'&&a[i]?a[i]:''));}catch(e){}
function pgKeysApply(){
  PGKEYS={};PGKBIND.forEach((a,l)=>a.forEach(c=>{if(c&&PGKEYS[c]===undefined)PGKEYS[c]=l;}));
  const kn=l=>PGKBIND[l].filter(Boolean).map(pgKeyName).join(' / ')||'키 없음';
  const col=i=>{const c=PGKBIND.map(a=>a[i]);if(!c.every(Boolean))return '';const n=c.map(pgKeyName).join(' ').replace(/[<>&"]/g,'');
    return c.every(x=>/^Numpad\d$/.test(x))?'숫자패드 <b>'+n.replace(/Num /g,'')+'</b>':'<b>'+n+'</b>';};
  const t=$('#pgKeyTxt');if(t)t.innerHTML=[0,1].map(col).filter(Boolean).join(' 또는 ')||'<b>설정에서 정한 키</b>';
  document.querySelectorAll('#pgPad [data-l]').forEach(b=>{const l=+b.dataset.l;b.setAttribute('aria-label',PG_LANE_NAME[l]+' 발판 ('+kn(l)+')');});
}
const PG_LANE_NAME=['왼쪽 아래','왼쪽 위','가운데','오른쪽 위','오른쪽 아래'];
const PGK_SYM={Comma:',',Period:'.',Slash:'/',Semicolon:';',Quote:"'",BracketLeft:'[',BracketRight:']',Backslash:'\\',Minus:'-',Equal:'=',Backquote:'`',Space:'Space',
  ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',NumpadAdd:'Num +',NumpadSubtract:'Num -',NumpadMultiply:'Num *',NumpadDivide:'Num /',NumpadDecimal:'Num .',
  ShiftLeft:'왼쪽 Shift',ShiftRight:'오른쪽 Shift',CapsLock:'Caps Lock',IntlBackslash:'\\'};
function pgKeyName(c){
  if(!c)return '';if(PGK_SYM[c])return PGK_SYM[c];
  let m=/^Key([A-Z])$/.exec(c)||/^Digit(\d)$/.exec(c);if(m)return m[1];
  if((m=/^Numpad(\d)$/.exec(c)))return 'Num '+m[1];
  return c;
}
const pgKeysSave=()=>lsSet('rk:pgkeys',JSON.stringify(PGKBIND));
const pgClock=()=>AC?AC.currentTime:performance.now()/1000;   /* 소리를 예약하는 시계(스피커에서 실제로 들리는 것보다 앞서 있어요) */
/* 지금 스피커에서 실제로 들리는 곡의 위치(컨텍스트 시간).
   브라우저가 outputLatency를 0으로 잘못 알려 주는 경우가 많아서, 추측하지 않고 getOutputTimestamp()가 알려 주는
   "지금 나오고 있는 샘플"을 기준으로 삼아요. 이 시계로 노트 위치·판정을 계산하니 소리와 노트가 맞아요.
   값이 이상하거나 지원 안 하는 브라우저는 currentTime에서 알려진 지연만큼 뺀 값을 써요.
   ⚠ 휴대폰에서 오디오가 잠깐 멈췄다 돌아오면(공유창·앱 전환·오디오 끊김) 타임스탬프가 옛날 값에 멈춰 있는데,
     "그때부터 흐른 시간"을 더하면 곡 위치가 몇 초 앞으로 튀어요(카운트다운 없이 노트가 쏟아지고 F로 끝나던 버그).
     그래서 들리는 위치는 currentTime보다 앞설 수 없고 0.6초보다 더 뒤처질 수도 없게 확인해요. */
function pgHeard(){
  if(!AC)return performance.now()/1000;
  const cur=AC.currentTime;
  try{
    const ts=AC.getOutputTimestamp(),lag=cur-ts.contextTime;
    if(AC.state==='running'&&ts.contextTime>0&&ts.performanceTime>0&&lag>=0&&lag<.6){
      const h=ts.contextTime+(performance.now()-ts.performanceTime)/1000;
      if(h<=cur+.02&&h>=cur-.6)return h;
    }
  }catch(e){}
  return cur-clamp((AC.baseLatency||0)+(AC.outputLatency||0),0,.3);
}
const pgNow=()=>PG.paused?PG.frozen:PG.t0==null?-PG.lead:pgHeard()-PG.t0-PG.off;   /* 시작 시각을 잡기 전(오디오가 깨어나는 중)엔 카운트다운 직전에 머물러요 */
const touchy=()=>{try{return matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0||'ontouchstart' in window;}catch(e){return false;}};

function showPump(g){$('#hub').hidden=g;$('#pumpWrap').hidden=!g;document.body.classList.toggle('playing',g);document.documentElement.classList.toggle('pgplay',g);window.scrollTo(0,0);}
function pgNewGame(sg,bet,before){
  const ch=pgChart(sg),lanes=[[],[],[],[],[]];
  const notes=ch.notes.map(n=>({t:n.t,lane:n.lane,hold:n.hold,res:-1,hs:0}));   /* hs: 0 대기 · 1 누르는 중 · 2 성공 · 3 실패 */
  notes.forEach(n=>lanes[n.lane].push(n));
  lanes.forEach(a=>a.sort((x,y)=>x.t-y.t));
  return{sg,bet,before,notes,lanes,ptr:[0,0,0,0,0],hold:[null,null,null,null,null],held:[false,false,false,false,false],pressAt:[0,0,0,0,0],
    total:ch.total,endT:ch.end+1.2,cnt:[0,0,0,0,0],ok:0,ng:0,wsum:0,done:0,combo:0,maxCombo:0,life:PG_LIFE0,life0:PG_LIFE0,
    W:{perfect:.06,great:.10,good:.14,bad:.18},approach:sg.approach/PG_SPEEDS[PGO.spd],
    state:'count',paused:false,frozen:0,pauseAt:0,resumeAt:0,grace:0,pop:null,fx:[],missAt:0,comboAt:0,cd:99,go:false,err:0,settled:false,
    t0:0,off:0,step:0,nextT:0,timer:0,tg:null,ptrs:{}};
}
function pumpStart(introDone){   /* introDone===true: 인트로를 보고(또는 건너뛰고) 들어온 경우. 버튼 클릭 땐 이벤트 객체가 와요 */
  if(!pgUnlocked()||!USER||mode!=='hub'||JG.on)return;
  micTick();pgOptFix();
  const sg=pgPick(PGO.song,PGO.diff),bet=pgBet(PGO.diff);
  if(S.money<bet){sfx('deny');toast(`판돈 ${fmt(bet)}원이 필요해요.`);return;}
  if(sg.intro&&S.mics>0&&introDone!==true){jgPlay(sg.intro,()=>pumpStart(true));return;}   /* 인트로가 있는 곡은 매번 인트로부터 (건너뛰기 버튼·Esc로 바로 노래) */
  if(!micUse()){sfx('deny');toast('마이크가 없어요. 채워질 때까지 기다려 주세요.');renderHub();return;}
  const before=S.money;S.money-=bet;save();
  PG=pgNewGame(sg,bet,before);
  mode='pump';showPump(true);pgResize();
  $('#pgTitle').textContent=`호우와 소리새 펌프 · ${sg.name} (${PG_DIFFS[sg.diff]})`;
  $('#pgResult').hidden=true;$('#pgPause').hidden=true;
  pgBegin();
  const g=PG;
  (function loop(){
    if(PG!==g)return;
    requestAnimationFrame(loop);
    try{pgUpdate();pgDraw();g.err=0;}catch(e){console.error(e);if(++g.err>=5)pgAbort();}
  })();
}
function pgBegin(){
  const g=PG,a=actx();
  g.lead=Math.max(3.2,g.approach+1.2);
  g.off=PGO.off/1000;   /* 기기 지연은 pgHeard()가 알아서 반영해요. 여기는 사용자가 옵션에서 맞춘 싱크만 */
  g.t0=null;g.anchorCur=-1;   /* 시작 시각은 오디오 시계가 실제로 흐르는 걸 확인한 뒤에 잡아요(pgAnchor) */
  if(a){g.tg=a.createGain();g.tg.gain.value=1.8;g.tg.connect(MUSIC);g.timer=setInterval(pgSched,30);}
  pgAnchor(g);
}
/* 곡 시작 시각(t0) 잡기. 아이폰 사파리는 페이지를 나갔다 오면 AudioContext가 멈춰 있고, "노래 시작"을 눌러 깨우는 순간
   멈춰 있던 currentTime을 기준으로 시작 시각을 잡으면 깨어난 뒤 시계가 확 앞으로 가서 노트가 한꺼번에 지나가요
   (카운트다운 없이 게이지가 바로 0이 되던 버그). 그래서 시계가 "running"이고 실제로 흐르는 게 보인 다음에 잡아요. */
function pgAnchor(g){
  if(g.t0!=null)return true;
  if(AC){
    if(AC.state!=='running'){AC.resume().catch(()=>{});g.anchorCur=-1;return false;}
    const cur=AC.currentTime;
    if(g.anchorCur<0||cur<=g.anchorCur){g.anchorCur=cur;return false;}   /* 한 번 더 봐서 시계가 앞으로 갔을 때만 */
  }
  g.t0=pgClock()+g.lead;g.nextT=g.t0;g.lastNow=-g.lead;g.lastPn=performance.now();   /* 튀는 시계 안전장치가 첫 프레임부터 작동하게 */
  return true;
}
function pgSched(){   /* 곡의 다음 몇 칸을 미리 예약해 둬요 (배경음악과 같은 방식) */
  const g=PG;if(!g||!g.tg||g.paused||g.state==='end'||g.t0==null)return;
  const T=BGMT[g.sg.id];
  while(g.step<T.len&&g.nextT<AC.currentTime+.3){bstep(T,g.step,g.nextT,g.sg.spb,g.tg);g.step++;g.nextT+=g.sg.spb;}
}
function pgStopAudio(g){
  clearInterval(g.timer);
  const tg=g.tg;g.tg=null;if(!tg||!AC)return;
  if(AC.state==='running'){const t=AC.currentTime;try{tg.gain.cancelScheduledValues(t);tg.gain.setTargetAtTime(0,t,.2);}catch(e){}setTimeout(()=>{try{tg.disconnect();}catch(e){}},1500);}
  else{try{tg.disconnect();}catch(e){}AC.resume().catch(()=>{});}   /* 일시정지 중에 나갔다면 예약해 둔 소리가 새어 나오지 않게 끊고 시계를 되살려요 */
}

/* ---------- 입력 ---------- */
function pumpKeyDown(e){
  const g=PG;if(!g)return;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.code==='Escape'){e.preventDefault();if(!e.repeat)pgTogglePause();return;}
  if(e.code==='Enter'&&g.state==='end'&&!$('#pgResult').hidden){e.preventDefault();pgExit();return;}
  const l=PGKEYS[e.code];if(l===undefined)return;
  e.preventDefault();if(e.repeat)return;
  pgPress(l);
}
function pumpKeyUp(e){const l=PGKEYS[e.code];if(l!==undefined&&PG){e.preventDefault();pgRelease(l);}}
function pgPress(l){
  const g=PG;if(!g||g.paused||g.state==='end')return;
  g.held[l]=true;g.pressAt[l]=performance.now();sfx('stomp');
  if(g.state!=='play')return;
  const now=pgNow(),n=g.lanes[l][g.ptr[l]];
  if(!n)return;
  const d=now-n.t;
  if(d<-g.W.bad)return;   /* 아직 너무 일러요: 헛발은 벌점이 없어요 */
  const ad=Math.abs(d),k=ad<=g.W.perfect?0:ad<=g.W.great?1:ad<=g.W.good?2:3;
  g.ptr[l]++;n.res=k;
  if(n.hold){
    if(k<3){n.hs=1;g.hold[l]=n;}
    else{n.hs=3;g.ng++;g.done++;}   /* BAD로 시작한 롱노트는 끝을 기대할 수 없어요 */
  }
  pgJudge(k,l,d);
}
function pgRelease(l){if(PG)PG.held[l]=false;}
/* 발판 그림: 위쪽 화살표를 돌려서 겹화살표(테두리+안쪽 쉐브론)로, 가운데는 팔각 패드로 그려요 */
const PGKEYNAME=['Z','Q','S','E','C'],PGPADANG=[135+90,-45,0,45,135];   /* ↙ ↖ ● ↗ ↘ */
const PGPADS=[];
document.querySelectorAll('#pgPad [data-l]').forEach(b=>{
  const l=+b.dataset.l,col=['#2f9bff','#ff3d5a','#ffc82e','#ff3d5a','#2f9bff'][l];
  const oct=r=>[0,1,2,3,4,5,6,7].map(i=>{const a=Math.PI/8+i*Math.PI/4;return (Math.cos(a)*r).toFixed(1)+','+(Math.sin(a)*r).toFixed(1);}).join(' ');
  b.innerHTML=(l===2
    ?`<svg viewBox="-50 -50 100 100"><polygon points="${oct(46)}" fill="#0c0c0e" stroke="${col}" stroke-width="5" stroke-linejoin="round"/><polygon points="${oct(35)}" fill="none" stroke="${col}" stroke-width="2.5"/><polygon points="${oct(24)}" fill="#1a1608" stroke="${col}" stroke-width="3"/><circle r="7" fill="${col}"/></svg>`
    :`<svg viewBox="-50 -50 100 100"><g transform="rotate(${PGPADANG[l]})"><path d="M0-42L40 0H17V40H-17V0H-40Z" fill="#0c0c0e" stroke="${col}" stroke-width="5" stroke-linejoin="round"/><path d="M0-27L24-3H9V28H-9V-3H-24Z" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/><path d="M-9 14L0 6L9 14M-9 24L0 16L9 24" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`)
    +`<span class="k">${PGKEYNAME[l]}</span>`;
  PGPADS[l]=b;
});
/* 화면 아래 발판(모바일)·PC 옆 발판 클릭 + 캔버스 위쪽 발판을 마우스로 누르는 것도 지원해요 */
document.querySelectorAll('#pgPad [data-l]').forEach(b=>{
  const l=+b.dataset.l,up=()=>{pgRelease(l);b.classList.remove('on');};
  b.addEventListener('pointerdown',e=>{e.preventDefault();try{b.setPointerCapture(e.pointerId);}catch(_){}b.classList.add('on');pgPress(l);});
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>b.addEventListener(ev,up));
  b.addEventListener('contextmenu',e=>e.preventDefault());
});
function pgCvLane(e){
  const r=$('#pgCv').getBoundingClientRect(),x=(e.clientX-r.left)*PGW/r.width,y=(e.clientY-r.top)*PGH/r.height;
  if(y>PGRY+70)return -1;
  const l=Math.round((x-PGX[0])/94);return l>=0&&l<5?l:-1;
}
$('#pgCv').addEventListener('pointerdown',e=>{
  if(!PG)return;const l=pgCvLane(e);if(l<0)return;
  e.preventDefault();PG.ptrs[e.pointerId]=l;pgPress(l);
});
['pointerup','pointercancel'].forEach(ev=>$('#pgCv').addEventListener(ev,e=>{
  if(!PG)return;const l=PG.ptrs[e.pointerId];if(l===undefined)return;delete PG.ptrs[e.pointerId];pgRelease(l);
}));
$('#pgCv').addEventListener('contextmenu',e=>e.preventDefault());
/* touch-action을 제대로 안 지키는 브라우저(구형 iOS 사파리 등)를 위해 플레이 화면에서의 터치 스크롤·확대를 한 번 더 막아요 */
$('#pumpWrap').addEventListener('touchmove',e=>{if(PG&&e.cancelable)e.preventDefault();},{passive:false});
window.addEventListener('resize',()=>{if(PG)pgResize();});
function pgResize(){
  const cv=$('#pgCv');if($('#pumpWrap').hidden)return;
  const coarse=touchy(),pad=$('#pgPad'),row=$('#pgRow');
  const lay=coarse?'below':window.innerWidth>=860?'side':'none';   /* 발판: 모바일은 화면 아래, PC는 넓으면 옆(키 안내 겸용), 좁으면 숨김 */
  pad.hidden=lay==='none';row.classList.toggle('side',lay==='side');
  /* 아이폰 사파리는 아래 툴바가 화면 위에 떠 있어서(innerHeight에 툴바 자리까지 들어가요) 아래 발판을 가려요 → 그만큼 비워 둬요 */
  const vv=window.visualViewport,ios=/iP(hone|od|ad)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  let standalone=!!navigator.standalone;try{standalone=standalone||matchMedia('(display-mode: standalone)').matches;}catch(e){}
  const vh=Math.min(window.innerHeight,vv?vv.height:1e9)-(ios&&!standalone&&lay==='below'?60:0),top=$('#pumpWrap .gtop').offsetHeight+14;
  let w=Math.min(window.innerWidth-32-(lay==='side'?256:0),520);
  /* 화면이 낮은 폰(아이폰 SE·13 사파리 등)에서 아래 발판이 화면 밖으로 밀려나 ↙ ↘를 못 누르던 문제:
     발판 칸 높이를 76px에서 최소 54px까지 줄이고, 그래도 모자라면 플레이 화면 폭을 줄여서 발판까지 한 화면에 다 들어오게 해요 */
  if(lay==='below'){
    const minCanvas=Math.min(w,260)*480/PGW;   /* 플레이 화면을 이만큼은 남겨 둬요 */
    pad.style.setProperty('--pgrow',clamp(Math.floor((vh-top-minCanvas-14-14-40)/3),54,76)+'px');
  }else pad.style.removeProperty('--pgrow');
  const padH=lay==='below'?pad.offsetHeight+14:0,availH=vh-top-padH-40;
  PGH=Math.round(PGW*(availH-6)/(w-6));   /* 화면 높이에 맞춰 논리 세로 길이를 정해요 */
  if(PGH<480){PGH=480;w=Math.max(200,Math.floor((availH-6)*PGW/480+6));}   /* 최소 480은 지키고, 대신 폭을 줄여서 높이를 맞춰요 */
  PGH=Math.min(880,PGH);
  const sc=Math.min(2,window.devicePixelRatio||1);
  $('#pgStage').style.width=w+'px';
  cv.width=Math.round(PGW*sc);cv.height=Math.round(PGH*sc);
  PGC=cv.getContext('2d');PGC.setTransform(sc,0,0,sc,0,0);
}

/* ---------- 일시정지 ---------- */
function pgTogglePause(){
  const g=PG;if(!g||g.state==='end')return;
  if(g.paused&&g.resumeAt)return;   /* 이어하기 카운트다운 중 */
  if(g.paused)pgResume();else pgPause();
}
function pgPause(at){   /* at: 이 곡 위치로 되돌려서 멈춰요(화면이 멈췄던 동안 지나간 노트를 살리려고). 없으면 지금 위치 */
  const g=PG;if(!g||g.paused||g.state==='end')return;
  const nowV=pgNow(),back=at!=null&&g.t0!=null?Math.max(0,nowV-at):0;
  g.frozen=nowV-back;g.pauseAt=pgClock()-back;g.pauseAudio=g.t0==null?0:g.pauseAt-g.t0;g.paused=true;g.resumeAt=0;
  g.held=[false,false,false,false,false];
  /* AudioContext를 멈추면 이어하기 카운트다운 소리가 다시 깨워 버려서, 시계는 멈추지 않고 소리만 끊어요.
     이어할 때 멈춰 있던 시간만큼 시작 시각(t0)을 뒤로 밀어요. */
  if(g.tg){try{g.tg.disconnect();}catch(e){}g.tg=null;}
  $('#pgPause').hidden=false;
}
function pgResume(){
  const g=PG;if(!g||!g.paused||g.resumeAt)return;
  $('#pgPause').hidden=true;g.resumeAt=performance.now()+3000;g.cd=99;
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&PG&&mode==='pump')pgPause();});
window.addEventListener('blur',()=>{if(PG&&mode==='pump'){PG.held=[false,false,false,false,false];pgPause();}});
$('#pgPauseBtn').addEventListener('click',pgTogglePause);
$('#pgResume').addEventListener('click',pgResume);
$('#pgGiveUp').addEventListener('click',()=>{$('#pgPause').hidden=true;pgFinish(true,true);});

/* ---------- 판정 · 진행 ---------- */
function pgJudge(k,l,d){
  const g=PG;
  g.cnt[k]++;g.wsum+=PGWT[k];g.done++;
  if(k<=2){g.combo++;if(g.combo>g.maxCombo)g.maxCombo=g.combo;g.comboAt=performance.now();}
  else g.combo=0;
  g.life=clamp(g.life+PGLIFE[k],0,100);
  g.pop={k,at:performance.now(),d};g.fx.push({l,k,at:performance.now()});
  if(k===4){g.missAt=performance.now();sfx('pgmiss');}
  if(g.life<=0)pgFinish(true);
}
function pgUpdate(){
  const g=PG;if(!g)return;
  if(g.paused){
    if(g.resumeAt){
      const left=g.resumeAt-performance.now(),n=Math.ceil(left/1000);
      if(n!==g.cd&&n>0){g.cd=n;sfx('pgcount',n===1?880:660);}
      if(left<=0){
        g.resumeAt=0;g.paused=false;g.lastPn=0;
        if(g.t0!=null)g.t0+=pgClock()-g.pauseAt;   /* 시작 시각을 잡기 전에 멈췄다면 pgAnchor가 새로 잡아요 */
        if(AC){   /* 끊어 둔 곡을 지금 위치의 다음 칸부터 다시 예약해요 (시작 전이었다면 처음부터) */
          g.tg=AC.createGain();g.tg.gain.value=1.8;g.tg.connect(MUSIC);
          if(g.t0!=null){g.step=Math.max(0,Math.ceil(g.pauseAudio/g.sg.spb-1e-6));g.nextT=g.t0+g.step*g.sg.spb;}
          else g.step=0;
        }
        g.grace=g.frozen+1;   /* 롱노트를 누르던 중이었다면 다시 누를 시간을 줘요 */
      }
    }
    return;
  }
  if(g.state==='end')return;
  if(!pgAnchor(g))return;
  let now=pgNow();
  /* 안전장치: 곡 시계는 실제 시간보다 빨리 갈 수 없어요. 1초 넘게 앞으로 튀면(오디오 시계 오류) 그만큼 시작 시각과
     곡 예약 위치를 함께 뒤로 밀어서, 노트가 한꺼번에 지나가 MISS가 쏟아지지 않게 해요. (pgHeard의 보정 폭은 0.6초라 평소엔 안 걸려요)
     멈춰 있다 풀리는 건(시계가 덜 가는 쪽) 그대로 둬요. */
  const pn=performance.now();
  if(g.lastPn){const jump=(now-g.lastNow)-(pn-g.lastPn)/1000;if(jump>1){g.t0+=jump;g.nextT+=jump;now-=jump;}}
  /* 화면(자바스크립트)이 0.7초 넘게 멈췄다 돌아왔는데(제어 센터·알림·툴바 애니메이션·폰이 잠깐 버벅임) 곡은 계속 흘렀다면,
     그 사이 노트가 한꺼번에 MISS가 돼 게이지가 바로 0이 될 수 있어요 → 멈추기 직전 위치로 되돌려 자동 일시정지해요 */
  if(g.lastPn&&pn-g.lastPn>700&&now-g.lastNow>.5&&now>-.5){
    const at=g.lastNow;g.lastNow=now;g.lastPn=pn;
    pgPause(at);toast('화면이 잠깐 멈춰서 일시정지했어요. 이어하기를 누르면 3초 뒤에 계속해요.',3500);
    return;
  }
  g.lastNow=now;g.lastPn=pn;
  /* 카운트다운 중인데 곡 위치가 이미 0을 한참 넘었으면 시계가 잘못된 거예요 → 시작 시각을 다시 잡아요(노트가 한꺼번에 MISS 되지 않게) */
  if(g.state==='count'&&now>.5){
    g.t0=null;g.anchorCur=-1;g.step=0;
    if(g.tg&&AC){try{g.tg.disconnect();}catch(e){}g.tg=AC.createGain();g.tg.gain.value=1.8;g.tg.connect(MUSIC);}   /* 미리 예약해 둔 곡 소리도 버리고 처음부터 */
    return;
  }
  if(now<0){const n=Math.ceil(-now);if(n<=3&&n!==g.cd){g.cd=n;sfx('pgcount',n===1?880:660);}}
  else if(!g.go){g.go=true;sfx('pggo');}
  if(g.state==='count'&&now>=-g.W.bad)g.state='play';
  if(g.state!=='play')return;
  /* 지나가 버린 노트는 MISS */
  for(let l=0;l<5;l++){
    const a=g.lanes[l];
    while(g.state==='play'&&g.ptr[l]<a.length&&a[g.ptr[l]].t<now-g.W.bad){
      const n=a[g.ptr[l]++];n.res=4;
      if(n.hold){n.hs=3;g.ng++;g.done++;}
      pgJudge(4,l,0);
    }
  }
  /* 롱노트: 끝까지 누르고 있으면 성공, 도중에 떼면 실패 */
  for(let l=0;l<5&&g.state==='play';l++){
    const h=g.hold[l];if(!h)continue;
    const end=h.t+h.hold;
    if(now>=end||(!g.held[l]&&now>=end-.12)){
      g.hold[l]=null;h.hs=2;g.ok++;g.wsum+=1;g.done++;g.fx.push({l,k:0,at:performance.now()});sfx('pgok');
    }else if(!g.held[l]&&now>g.grace){
      g.hold[l]=null;h.hs=3;g.ng++;g.done++;g.combo=0;g.life=clamp(g.life-4,0,100);
      g.pop={k:4,at:performance.now(),d:0,txt:'NG'};g.missAt=performance.now();sfx('pgmiss');
      if(g.life<=0)pgFinish(true);
    }
  }
  if(g.state==='play'&&g.done>=g.total&&now>g.endT)pgFinish(false);
}
function pgScore(g){return g.total?Math.round(900000*g.wsum/g.total+100000*Math.min(1,g.maxCombo/g.total)):0;}
const pgGrade=s=>s>=950000?'S':s>=850000?'A':s>=700000?'B':s>=550000?'C':'D';
const HOU_WIN=['헉… 발이 내 목청보다 정확하잖아! 판돈 가져가~','오호, 음정은 밀당인데 박자는 네가 이겼네!','소리새 사장님한테 스카우트되겠는데?'];
const HOU_BIG=['이 정도면 반칙이야… 절대음감이 발에 있나 봐!','아니, 이게 사람 발이야? 메트로놈이야?'];
const HOU_LOSE=['내 노래엔 이 정도 리듬은 있어야지~ 판돈은 접수!','박자가 밀당 중이었나 봐. 내가 이긴 걸로 할게!','한 번 더 하면 이길 수 있을 걸? …아마도.'];
const HOU_FAIL=['어라, 게이지가 다 닳았네… 쉬엄쉬엄 하자.','숨 고르고 다시 오자. 노래방도 쉬어 가며 부르는 거야.'];
/* 곡이 끝났거나(실패 포함) 포기했을 때: 정산하고 결과 화면을 띄워요 */
function pgFinish(failed,quit){
  const g=PG;if(!g||g.state==='end')return;
  g.state='end';g.held=[false,false,false,false,false];pgStopAudio(g);
  const score=pgScore(g),grade=failed?'F':pgGrade(score),win=!failed&&score>=g.sg.target,bonus=Math.round(g.bet*.5/100)*100;
  const delta=win?2*g.bet+(grade==='S'?bonus:0):0;   /* 판돈은 시작할 때 이미 뺐으니, 이기면 판돈의 2배(+S랭크 보너스)만 더해요 */
  g.settled=true;g.score=score;g.grade=grade;g.win=win;
  S.money=Math.max(0,S.money+delta);
  if(!failed)S.pumpBest=Math.max(S.pumpBest||0,score);
  /* 호우를 이기면(목표 점수 이상) 이번 판에 쓴 마이크를 돌려받아요 */
  let micBack=false;
  if(win&&!isPractice()){const had=S.mics||0;S.mics=Math.min(MIC_MAX,had+1);if(S.mics>=MIC_MAX)S.micAt=0;micBack=S.mics>had;}
  S.plays=(S.plays||0)+1;
  if(S.money>=1000000&&!S.cleared){S.cleared=true;toast('🎉 100만 원 달성! (엔딩 애니메이션은 다음 업데이트에서 만나요)',5000);setTimeout(()=>sfx('bigwin'),1800);}
  save();
  cloudScore({bet:g.bet,goals:0,pts:Math.min(99999,Math.round(score/10)),result:`펌프 ${grade} ${win?'승':'패'}`,money:S.money});
  sfx(failed?'lose':grade==='S'?'bigwin':win?'win':'lose');
  if(micBack)setTimeout(()=>{toast('🎤 호우를 이겨서 마이크를 돌려받았어요!',3000);sfx('ping');},900);
  const c=g.cnt,allP=!failed&&c[1]+c[2]+c[3]+c[4]+g.ng===0,fc=!failed&&c[3]+c[4]+g.ng===0;
  const title=quit?'포기…':failed?'STAGE BREAK…':win&&grade==='S'?'완승! S 랭크':win?'내기 승리!':'호우에게 졌다…';
  const say=(quit||failed)?HOU_FAIL:win?(grade==='S'?HOU_BIG:HOU_WIN):HOU_LOSE;
  setTimeout(()=>{
    if(PG!==g)return;
    $('#pgRT').textContent=title;
    setFace($('#pgRImg'),failed?'panic':grade==='S'?'excited':win?'happy':'frustrated');
    $('#pgRG').textContent=grade;$('#pgRG').className='pggrade g'+grade;
    $('#pgRB').textContent=allP?'ALL PERFECT!':fc?'FULL COMBO!':'';
    const rows=[['점수',fmt(score)+'점'],['최대 콤보',g.maxCombo+' / '+g.total]].concat(PGJN.map((n,i)=>[n,c[i]]));
    if(g.ok+g.ng)rows.push(['롱노트',`성공 ${g.ok} · 실패 ${g.ng}`]);
    rows.push(['호우 목표',fmt(g.sg.target)+'점']);
    let h=rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
    h+=`<tr><td>판돈</td><td class="${win?'plus':'minus'}">${win?'+':'-'}${fmt(g.bet)}원</td></tr>`+(win&&grade==='S'?`<tr><td>S 랭크 보너스</td><td class="plus">+${fmt(bonus)}원</td></tr>`:'')+
       `<tr><td>소지금</td><td>${fmt(g.before)} → ${fmt(S.money)}원</td></tr>`;
    $('#pgRTab').innerHTML=h;
    const line=pick(say);$('#pgRSay').textContent='호우: '+line;
    g.share={title,grade,score,win,bonus:win&&grade==='S'?bonus:0,badge:allP?'ALL PERFECT!':fc?'FULL COMBO!':'',line,face:failed?'panic':grade==='S'?'excited':win?'happy':'frustrated'};
    pgShareMake(g);   /* 공유 이미지는 미리 만들어 둬요(버튼을 누른 순간 바로 공유창을 열어야 해서) */
    $('#pgResult').hidden=false;
  },failed?500:1500);
}
function pgAbort(){   /* 화면 그리기에서 오류가 반복되면 판돈을 돌려주고 허브로 */
  const g=PG;if(!g)return;
  if(!g.settled){S.money+=g.bet;save();}
  g.state='end';pgStopAudio(g);toast('오류가 나서 판돈을 돌려줬어요.');pgExit();
}
function pgExit(){
  const g=PG;if(!g)return;
  if(g.state!=='end'){g.state='end';pgStopAudio(g);}
  PG=null;$('#pgResult').hidden=true;$('#pgPause').hidden=true;
  showPump(false);toHub();
}
$('#pgRBack').addEventListener('click',pgExit);

/* ---------- 결과 공유 (이미지) ----------
   결과 화면을 세로 카드 이미지(PNG)로 그려서 휴대폰 공유창(Web Share API)을 열어요. 카카오톡을 고르면 사진으로 보내져요.
   공유창이 없는 브라우저(예: 일부 PC 브라우저)는 이미지 파일로 저장해요.
   (클립보드 이미지 복사는 기기·앱마다 붙여넣기가 안 되는 경우가 많아서 넣지 않았어요) */
const PGSH_W=720,PGSH_H=1120;
function pgShareMake(g){
  g.shareBlob=null;
  const png=cv=>new Promise((ok,no)=>cv.toBlob(b=>b?ok(b):no(new Error('toBlob')),'image/png'));
  /* 얼굴 사진을 못 쓰는 환경(파일로 직접 연 경우 등)에서는 캔버스를 내보낼 수 없어서, 얼굴 없이 다시 그려요 */
  g.shareP=pgShareDraw(g).then(png).catch(()=>pgShareDraw(g,true).then(png)).then(b=>(g.shareBlob=b));
  g.shareP.catch(e=>console.error(e));
}
async function pgShareDraw(g,noFace){
  const r=g.share,cv=document.createElement('canvas');cv.width=PGSH_W;cv.height=PGSH_H;
  const c=cv.getContext('2d'),W=PGSH_W,DISP="'Black Han Sans','Noto Sans KR',sans-serif",BODY="'Noto Sans KR',sans-serif";
  try{await document.fonts.load(`40px 'Black Han Sans'`);await document.fonts.load(`700 20px 'Noto Sans KR'`);}catch(e){}
  const im=new Image();if(!noFace){im.src=IMGDATA[r.face];try{await im.decode();}catch(e){}}
  const T=(t,x,y,size,col,align,font,weight)=>{c.font=`${weight||''} ${size}px ${font||DISP}`;c.fillStyle=col;c.textAlign=align||'left';c.textBaseline='middle';c.fillText(t,x,y);};
  const box=(x,y,w,h,rad,fill)=>{c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,rad);else c.rect(x,y,w,h);c.fillStyle=fill;c.fill();};
  /* 배경 */
  const bg=c.createLinearGradient(0,0,0,PGSH_H);bg.addColorStop(0,'#1c2350');bg.addColorStop(1,'#070a18');c.fillStyle=bg;c.fillRect(0,0,W,PGSH_H);
  c.fillStyle='rgba(255,255,255,.035)';for(let x=0;x<W;x+=24)c.fillRect(x,0,1,PGSH_H);for(let y=0;y<PGSH_H;y+=24)c.fillRect(0,y,W,1);
  c.fillStyle='#ffd23f';c.fillRect(0,0,W,8);
  /* 머리: 게임 이름 · 곡 */
  T('호우와 소리새 펌프',W/2,62,38,'#ffd23f','center');
  T('롹순팅 키우기 · 시즌2',W/2,102,18,'#9aa3c2','center',BODY,700);
  T(g.sg.name,W/2,170,46,'#fff','center');
  T(`${PG_DIFFS[g.sg.diff]} ★${g.sg.stars} · BPM ${g.sg.bpm}`,W/2,218,22,'#c9d3ff','center',BODY,700);
  /* 랭크 + 점수 */
  box(40,262,W-80,230,22,'rgba(255,255,255,.06)');
  const gc={S:'#ffd23f',A:'#7bed9f',B:'#6ec8ff',C:'#c9d3ff',D:'#9aa3c2',F:'#ff6b6b'}[r.grade]||'#fff';
  c.save();c.shadowColor=gc;c.shadowBlur=30;T(r.grade,190,382,190,gc,'center');c.restore();
  T('SCORE',480,318,20,'#9aa3c2','center',BODY,700);
  T(fmt(r.score),480,372,62,'#fff','center');
  T(`호우 목표 ${fmt(g.sg.target)}점`,480,420,18,r.score>=g.sg.target?'#7bed9f':'#9aa3c2','center',BODY,700);
  if(r.badge)T(r.badge,480,458,26,'#ff7aa2','center');
  /* 판정 */
  box(40,516,W-80,316,22,'rgba(255,255,255,.06)');
  const rows=PGJN.map((n,i)=>[n,String(g.cnt[i]),PGJC[i]]).concat([['MAX COMBO',`${g.maxCombo} / ${g.total}`,'#fff']]);
  if(g.ok+g.ng)rows.push(['롱노트',`성공 ${g.ok} · 실패 ${g.ng}`,'#c9d3ff']);
  const rh=Math.min(42,288/rows.length);
  rows.forEach((w,i)=>{const y=546+i*rh;T(w[0],80,y,24,w[2]);T(w[1],W-80,y,24,'#fff','right');});
  /* 내기 결과 */
  box(40,852,W-80,92,22,r.win?'rgba(61,220,132,.16)':'rgba(255,90,90,.16)');
  T(r.title,72,898,34,r.win?'#7bed9f':'#ff8a8a');
  T(`판돈 ${r.win?'+':'-'}${fmt(g.bet+r.bonus)}원`,W-72,898,30,r.win?'#7bed9f':'#ff8a8a','right');
  /* 호우 한마디 */
  c.save();c.beginPath();c.arc(96,1010,44,0,6.2832);c.clip();c.fillStyle='#f4f1ee';c.fillRect(52,966,88,88);
  if(im.naturalWidth){const s=Math.min(im.naturalWidth,im.naturalHeight);c.drawImage(im,(im.naturalWidth-s)/2,im.naturalHeight*.02,s,s,52,966,88,88);drawDress(c,myEq(),(im.naturalWidth-s)/2,im.naturalHeight*.02,s,s,52,966,88,88);}
  c.restore();c.beginPath();c.arc(96,1010,44,0,6.2832);c.lineWidth=4;c.strokeStyle='#e2334d';c.stroke();
  c.font=`700 21px ${BODY}`;const say='호우: '+r.line,lines=[];let cur='';
  for(const ch of say){if(c.measureText(cur+ch).width>W-220){lines.push(cur);cur=ch.trim()?ch:'';}else cur+=ch;}
  if(cur)lines.push(cur);
  lines.slice(0,3).forEach((l,i,a)=>T(l,164,1010+(i-(a.length-1)/2)*30,21,'#eef0f8','left',BODY,700));
  /* 바닥글 */
  const d=new Date(),ds=`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  T(`${USER?USER.id:''} · ${ds}`,40,PGSH_H-28,18,'#9aa3c2','left',BODY,700);
  T('kortiger-s.github.io/rocksunting-game',W-40,PGSH_H-28,16,'#6f789a','right',BODY,700);
  return cv;
}
const pgShareName=g=>`소리새펌프_${g.sg.name.replace(/\s+/g,'')}_${g.share.grade}.png`;
function pgShareSave(g,blob){   /* 공유창이 없는 브라우저: 파일로 저장 */
  const a=document.createElement('a'),u=URL.createObjectURL(blob);
  a.href=u;a.download=pgShareName(g);document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);
}
async function pgShareSend(){
  const g=PG;if(!g||!g.shareP)return;
  let blob=g.shareBlob;
  try{if(!blob)blob=await g.shareP;}catch(e){sfx('error');toast('이미지를 만들지 못했어요.');return;}
  const file=new File([blob],pgShareName(g),{type:'image/png'});
  if(navigator.canShare&&navigator.canShare({files:[file]})){
    try{
      await navigator.share({files:[file],title:'소리새 펌프 결과',text:`${USER?USER.id+'의 ':''}소리새 펌프 결과: ${g.sg.name}(${PG_DIFFS[g.sg.diff]}) ${g.share.grade} ${fmt(g.share.score)}점`});
      sfx('swish');
    }catch(e){if(e&&e.name!=='AbortError'){pgShareSave(g,blob);toast('공유창을 열지 못해서 이미지를 저장했어요. 카톡에서 사진으로 보내 주세요.');}}
    return;
  }
  pgShareSave(g,blob);sfx('coin');
  toast('이 기기에서는 공유창을 열 수 없어서 이미지를 저장했어요. 카톡에서 사진으로 보내 주세요.');
}
$('#pgRShare').addEventListener('click',pgShareSend);

/* ---------- 그리기 ---------- */
function pgNoteShape(c,lane,x,y,s){
  c.translate(x,y);c.beginPath();
  if(lane===2){c.arc(0,0,s*.8,0,6.2832);return;}
  c.rotate(PGANG[lane]);
  c.moveTo(0,-s);c.lineTo(s*.98,s*.02);c.lineTo(s*.46,s*.02);c.lineTo(s*.46,s*.92);c.lineTo(-s*.46,s*.92);c.lineTo(-s*.46,s*.02);c.lineTo(-s*.98,s*.02);c.closePath();
}
function pgDrawNote(c,lane,x,y,s,gray,alpha){
  c.save();c.globalAlpha=alpha;pgNoteShape(c,lane,x,y,s);
  c.fillStyle=gray?'#6f758c':PGCOL[lane];c.fill();c.lineWidth=3.5;c.strokeStyle=gray?'#2c3046':'#fff';c.lineJoin='round';c.stroke();c.restore();
  c.save();c.globalAlpha=alpha*.4;pgNoteShape(c,lane,x,y,s*.5);c.fillStyle='#fff';c.fill();c.restore();
}
function pgText(c,t,x,y,size,col,align,font){
  c.font=`${size}px ${font||"'Black Han Sans','Noto Sans KR',sans-serif"}`;c.textAlign=align||'center';c.textBaseline='middle';
  c.lineWidth=Math.max(3,size/8);c.strokeStyle='rgba(6,8,20,.85)';c.lineJoin='round';c.strokeText(t,x,y);c.fillStyle=col;c.fillText(t,x,y);
}
function pgDraw(){
  const g=PG,c=PGC;if(!g||!c)return;
  const now=pgNow(),H=PGH,perf=performance.now(),TR=H-PGRY-10,ap=g.approach;
  PGPADS.forEach((b,l)=>b.classList.toggle('on',g.held[l]));   /* 키보드로 눌러도 발판이 같이 눌려 보여요 */
  /* 배경: 박자에 맞춰 살짝 번쩍여요 */
  const bg=c.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#161c3d');bg.addColorStop(1,'#070a18');c.fillStyle=bg;c.fillRect(0,0,PGW,H);
  const q=now*g.sg.bpm/60,env=now>=0?Math.pow(1-(q-Math.floor(q)),2.5):0;
  c.fillStyle=`rgba(140,170,255,${.05*env})`;c.fillRect(0,0,PGW,H);
  for(let l=0;l<5;l++){
    const x=PGX[l]-44,press=g.held[l]?1:Math.max(0,1-(perf-g.pressAt[l])/220);
    c.fillStyle='rgba(255,255,255,.035)';c.fillRect(x,PGRY-46,88,H);
    if(press>0){const lg=c.createLinearGradient(0,PGRY,0,PGRY+260);lg.addColorStop(0,PGCOL[l]);lg.addColorStop(1,'rgba(0,0,0,0)');c.globalAlpha=.28*press;c.fillStyle=lg;c.fillRect(x,PGRY-46,88,306);c.globalAlpha=1;}
  }
  c.fillStyle='rgba(255,255,255,.08)';for(let i=0;i<=5;i++)c.fillRect(PGX[0]-47+i*94-(i===5?3:0),PGRY-46,2,H);
  /* 발판(판정선) */
  for(let l=0;l<5;l++){
    const press=g.held[l]?1:Math.max(0,1-(perf-g.pressAt[l])/220),s=34*(1+.09*env+.06*press);
    c.save();pgNoteShape(c,l,PGX[l],PGRY,s);
    c.fillStyle=`rgba(255,255,255,${.07+.5*press})`;c.fill();c.lineWidth=3.5;c.strokeStyle=PGCOL[l];c.globalAlpha=.55+.45*press;c.stroke();c.restore();
    if(g.hold[l]){c.save();c.globalAlpha=.5+.3*Math.sin(perf/60);pgNoteShape(c,l,PGX[l],PGRY,s*1.25);c.lineWidth=4;c.strokeStyle='#fff';c.stroke();c.restore();}
  }
  /* 노트: 롱노트 몸통 → 머리 순서로 그려서 화살표가 위에 오게 */
  const yOf=t=>PGRY+(t-now)/ap*TR;
  const vis=g.notes.filter(n=>{const y=yOf(n.t),y2=n.hold?yOf(n.t+n.hold):y;return y2>-50&&y<H+50&&(n.res<0||n.res===4||n.hs===1||n.hs===3);});
  vis.forEach(n=>{
    if(!n.hold)return;
    const gray=n.res===4||n.hs===3,yh=n.hs===1?Math.max(PGRY,yOf(n.t)):yOf(n.t),yt=yOf(n.t+n.hold);
    if(yt<=yh)return;
    c.save();c.globalAlpha=gray?.35:n.hs===1?1:.8;
    const lg=c.createLinearGradient(PGX[n.lane]-22,0,PGX[n.lane]+22,0);const col=gray?'#6f758c':PGCOL[n.lane];lg.addColorStop(0,col);lg.addColorStop(.5,'#fff');lg.addColorStop(1,col);
    c.fillStyle=lg;c.fillRect(PGX[n.lane]-22,yh,44,yt-yh);c.lineWidth=3;c.strokeStyle=gray?'#2c3046':'#fff';c.strokeRect(PGX[n.lane]-22,yh,44,yt-yh);c.restore();
  });
  vis.forEach(n=>{
    const gray=n.res===4||n.hs===3,y=n.hs===1?PGRY:yOf(n.t);
    pgDrawNote(c,n.lane,PGX[n.lane],y,32,gray,gray?.4:1);
  });
  /* 판정 이펙트 */
  g.fx=g.fx.filter(f=>perf-f.at<420);
  g.fx.forEach(f=>{
    const a=(perf-f.at)/420,x=PGX[f.l];
    c.save();c.globalAlpha=(1-a)*(f.k>=3?.5:.9);c.strokeStyle=PGJC[f.k];c.lineWidth=5*(1-a)+1;c.beginPath();c.arc(x,PGRY,34+a*70,0,6.2832);c.stroke();
    if(f.k===0){for(let i=0;i<8;i++){const an=i/8*6.2832+.4,r1=40+a*60,r2=r1+16*(1-a);c.beginPath();c.moveTo(x+Math.cos(an)*r1,PGRY+Math.sin(an)*r1);c.lineTo(x+Math.cos(an)*r2,PGRY+Math.sin(an)*r2);c.stroke();}}
    c.restore();
  });
  /* 판정 글자 + 콤보 */
  if(g.pop){
    const age=(perf-g.pop.at)/1000;
    if(age<.75){
      const sc=1+.4*Math.max(0,1-age*7),al=1-Math.max(0,(age-.45)/.3);
      c.save();c.globalAlpha=al;c.translate(PGW/2,PGRY+92);c.scale(sc,sc);pgText(c,g.pop.txt||PGJN[g.pop.k],0,0,30,PGJC[g.pop.k]);c.restore();
      if(g.pop.k>=1&&g.pop.k<=3&&Math.abs(g.pop.d)>.02){c.save();c.globalAlpha=al*.9;pgText(c,g.pop.d<0?'빠름':'느림',PGW/2,PGRY+122,14,g.pop.d<0?'#7fd4ff':'#ffb27f',null,"'Noto Sans KR',sans-serif");c.restore();}
    }
  }
  if(g.combo>=2){
    const age=(perf-g.comboAt)/1000,sc=1+.25*Math.max(0,1-age*8);
    c.save();c.globalAlpha=.92;c.translate(PGW/2,PGRY+178);c.scale(sc,sc);pgText(c,String(g.combo),0,0,46,'#fff');c.restore();
    pgText(c,'COMBO',PGW/2,PGRY+212,15,'#c9d3ff',null,"'Noto Sans KR',sans-serif");
  }
  /* HUD */
  c.fillStyle='rgba(6,8,20,.55)';c.fillRect(0,0,PGW,PGRY-36);
  c.fillStyle='rgba(255,255,255,.14)';c.fillRect(0,0,PGW,4);c.fillStyle='#ffd23f';c.fillRect(0,0,PGW*clamp(now/g.endT,0,1),4);
  const face=g.life<25?'panic':perf-g.missAt<900?'frustrated':g.combo>=30?'excited':g.combo>=10?'happy':'resolve',im=IM[face];
  c.save();c.beginPath();c.arc(38,42,27,0,6.2832);c.clip();
  if(im&&im.complete&&im.naturalWidth){const sz=54,sw=im.naturalWidth,sh=im.naturalHeight,s=Math.min(sw,sh);c.drawImage(im,(sw-s)/2,sh*.02,s,s,11,15,sz,sz);drawDress(c,myEq(),(sw-s)/2,sh*.02,s,s,11,15,sz,sz);}else{c.fillStyle='#f4f1ee';c.fillRect(11,15,54,54);}
  c.restore();c.beginPath();c.arc(38,42,27,0,6.2832);c.lineWidth=3;c.strokeStyle='#e2334d';c.stroke();
  pgText(c,`${g.sg.name} · ${PG_DIFFS[g.sg.diff]}`,76,22,15,'#dfe6ff','left',"'Noto Sans KR',sans-serif");
  pgText(c,String(pgScore(g)).padStart(7,'0'),PGW-14,38,32,'#fff','right');
  pgText(c,'호우 목표 '+fmt(g.sg.target),PGW-14,64,12,pgScore(g)>=g.sg.target?'#7bed9f':'#9aa3c2','right',"'Noto Sans KR',sans-serif");
  const lx=76,lw=PGW-lx-150;
  c.fillStyle='rgba(255,255,255,.16)';c.fillRect(lx,50,lw,12);
  const lf=g.life/100;c.fillStyle=g.life>50?'#3ddc84':g.life>25?'#ffd23f':'#ff5a5a';c.fillRect(lx,50,lw*lf,12);
  c.lineWidth=2;c.strokeStyle='#fff';c.strokeRect(lx,50,lw,12);
  pgText(c,'LIFE',lx,76,11,'#9aa3c2','left',"'Noto Sans KR',sans-serif");
  /* 카운트다운 / GO */
  if(now<0&&!g.paused){
    const n=Math.ceil(-now);
    pgText(c,g.sg.name,PGW/2,H*.42-70,28,'#fff');
    pgText(c,`${PG_DIFFS[g.sg.diff]} ★${g.sg.stars} · BPM ${g.sg.bpm} · 호우 목표 ${fmt(g.sg.target)}점`,PGW/2,H*.42-36,14,'#c9d3ff',null,"'Noto Sans KR',sans-serif");
    pgText(c,'Z  Q  S  E  C  (숫자패드 1 7 5 9 3) · Esc 일시정지',PGW/2,H*.5+110,13,'#9aa3c2',null,"'Noto Sans KR',sans-serif");
    if(n<=3){const fr=n+now,sc=1+.5*fr;c.save();c.globalAlpha=.4+.6*(1-fr);c.translate(PGW/2,H*.5);c.scale(sc,sc);pgText(c,String(n),0,0,96,'#ffd23f');c.restore();}
  }else if(now<.7&&!g.paused){c.save();c.globalAlpha=1-now/.7;pgText(c,'GO!',PGW/2,H*.5,80,'#7bed9f');c.restore();}
  if(g.paused){
    c.fillStyle='rgba(6,8,20,.55)';c.fillRect(0,0,PGW,H);
    if(g.resumeAt){const n=Math.max(1,Math.ceil((g.resumeAt-perf)/1000));pgText(c,String(n),PGW/2,H*.5,110,'#ffd23f');}
  }
}

/* ---------- 싱크 자동 측정 ----------
   일정한 간격(0.6초)의 딸깍 소리를 10번 들려주고, 사용자가 아무 발판 키/화면을 눌러서 박자를 맞추면
   "눌린 시각 - 딸깍이 들린 시각"의 중앙값을 싱크 옵션에 넣어요. (양수 = 평소 늦게 누르는 편 → 노트를 늦게 내려 줘요) */
let PGCAL=null;
const PGCAL_N=10,PGCAL_GAP=.6;
function pgCalStart(){
  const a=actx();if(!a||PGCAL||mode!=='hub'){if(!a)toast('이 브라우저는 소리를 지원하지 않아요.');return;}
  const c0=a.currentTime+1.2;
  PGCAL={c0,taps:[],done:false};
  for(let i=0;i<PGCAL_N;i++)tone(1400,.06,'square',.09,c0-a.currentTime+i*PGCAL_GAP);
  $('#pgCalMsg').textContent='딸깍 소리에 맞춰 Z Q S E C 아무 키(또는 화면)를 눌러 주세요.';$('#pgCalCnt').textContent='0 / '+PGCAL_N;
  $('#pgCalClose').textContent='취소';$('#pgCal').hidden=false;
  PGCAL.timer=setTimeout(pgCalEnd,(1.2+PGCAL_N*PGCAL_GAP+.6)*1000);
}
function pgCalTap(){
  const c=PGCAL;if(!c||c.done)return;
  const h=pgHeard()-c.c0,i=Math.round(h/PGCAL_GAP);
  if(i<0||i>=PGCAL_N||Math.abs(h-i*PGCAL_GAP)>.3)return;   /* 딸깍과 상관없는 눌림은 무시 */
  if(!c.taps.some(t=>t.i===i))c.taps.push({i,e:h-i*PGCAL_GAP});
  $('#pgCalCnt').textContent=c.taps.length+' / '+PGCAL_N;
}
function pgCalEnd(){
  const c=PGCAL;if(!c||c.done)return;c.done=true;clearTimeout(c.timer);
  const t=c.taps.filter(x=>x.i>=2).map(x=>x.e).sort((x,y)=>x-y);   /* 처음 두 번은 적응 시간이라 빼요 */
  if(t.length<5){$('#pgCalMsg').textContent='박자를 충분히 못 잡았어요. 딸깍 소리에 맞춰 다시 해 볼까요?';$('#pgCalClose').textContent='닫기';sfx('error');return;}
  const med=t.length%2?t[(t.length-1)/2]:(t[t.length/2-1]+t[t.length/2])/2;
  PGO.off=clamp(Math.round(med*1000/10)*10,-200,200);pgOptSave();renderPumpCard();
  $('#pgCalMsg').textContent=`측정 완료! 싱크를 ${PGO.off>0?'+':''}${PGO.off}ms로 맞췄어요. (${t.length}번 측정)`;$('#pgCalClose').textContent='확인';sfx('welcome');
}
function pgCalClose(){if(PGCAL){clearTimeout(PGCAL.timer);PGCAL=null;}$('#pgCal').hidden=true;}
$('#pgCalBtn').addEventListener('click',pgCalStart);
$('#pgCalClose').addEventListener('click',pgCalClose);
window.addEventListener('keydown',e=>{
  if(!PGCAL||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();pgCalClose();return;}
  if(PGKEYS[e.code]===undefined)return;
  e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)pgCalTap();
},true);
$('#pgCal').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;e.preventDefault();pgCalTap();});

/* ---------- 설정 > 펌프 키 변경 ----------
   배그 키 설정처럼 칸을 누르고 원하는 키를 누르면 바뀌어요. 다른 발판에 쓰던 키면 그쪽에서 빼 와요. */
const PGK_ROWS=[1,3,2,0,4],PGK_ARW=['↙','↖','●','↗','↘'];   /* 표는 숫자패드처럼 위 → 가운데 → 아래 순서 */
const PGK_BAN=/^(Escape|Tab|Enter|NumpadEnter|Backspace|Delete|NumLock|ContextMenu|(Control|Alt|Meta|OS)(Left|Right)?|F\d+)$/;
const PGK_PRESET={num:[['Numpad1',''],['Numpad7',''],['Numpad5',''],['Numpad9',''],['Numpad3','']],
  qe:[['KeyZ',''],['KeyQ',''],['KeyS',''],['KeyE',''],['KeyC','']],def:PGKBIND_DEF};
let PGKCAP=null;   /* 키를 기다리는 칸 {l, i} */
function pgKeyMsg(m,bad){const p=$('#pgKeyMsg');p.textContent=m;p.classList.toggle('bad',!!bad);}
function pgKeyRender(){
  const tb=$('#pgKeyTab tbody');tb.innerHTML='';
  PGK_ROWS.forEach(l=>{
    const tr=document.createElement('tr'),th=document.createElement('th');
    th.innerHTML=`<span class="karw" style="color:${PGCOL[l]}">${PGK_ARW[l]}</span> ${PG_LANE_NAME[l]}`;tr.appendChild(th);
    [0,1].forEach(i=>{
      const td=document.createElement('td'),b=document.createElement('button'),c=PGKBIND[l][i],w=PGKCAP&&PGKCAP.l===l&&PGKCAP.i===i;
      b.type='button';b.className='keyslot'+(w?' wait':'')+(c?'':' empty');b.textContent=w?'키를 누르세요…':c?pgKeyName(c):'—';
      b.setAttribute('aria-label',`${PG_LANE_NAME[l]} 발판 키 ${i+1}: ${c?pgKeyName(c):'없음'}. 누르고 새 키 입력`);
      b.addEventListener('click',()=>{PGKCAP=w?null:{l,i};pgKeyRender();if(PGKCAP)pgKeyMsg('새로 쓸 키를 누르세요. (Backspace: 칸 비우기 · Esc: 취소)');});
      td.appendChild(b);tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
  const none=PGKBIND.map((a,l)=>a.some(Boolean)?-1:l).filter(l=>l>=0);
  if(!PGKCAP)pgKeyMsg(none.length?`⚠ 키가 없는 발판: ${none.map(l=>PG_LANE_NAME[l]).join(', ')}`:'',none.length>0);
}
function pgKeySet(l,i,c){
  let moved=null;
  if(c)PGKBIND.forEach((a,l2)=>a.forEach((c2,i2)=>{if(c2===c&&!(l2===l&&i2===i)){a[i2]='';moved=l2;}}));
  PGKBIND[l][i]=c;PGKCAP=null;pgKeysSave();pgKeysApply();pgKeyRender();
  if(!c){sfx('swish');pgKeyMsg(`${PG_LANE_NAME[l]} 발판 키 ${i+1} 칸을 비웠어요.`);}
  else{sfx('stomp');pgKeyMsg(moved!=null&&moved!==l?`${pgKeyName(c)} 키를 ${PG_LANE_NAME[moved]} 발판에서 옮겨 왔어요.`:`${PG_LANE_NAME[l]} 발판 = ${pgKeyName(c)}`);}
}
function openSettings(){if(mode!=='hub')return;PGKCAP=null;pgKeyRender();$('#setDlg').hidden=false;}
function closeSettings(){PGKCAP=null;$('#setDlg').hidden=true;}
window.addEventListener('keydown',e=>{
  if($('#setDlg').hidden)return;
  if(!PGKCAP){if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeSettings();}return;}
  e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;
  const {l,i}=PGKCAP;
  if(e.code==='Escape'){PGKCAP=null;pgKeyRender();return;}
  if(e.code==='Backspace'||e.code==='Delete'){pgKeySet(l,i,'');return;}
  if(!e.code||PGK_BAN.test(e.code)){sfx('deny');pgKeyMsg(`${e.key||e.code} 키는 쓸 수 없어요. 다른 키를 눌러 주세요.`,true);return;}
  pgKeySet(l,i,e.code);
},true);
$('#setBtn').addEventListener('click',openSettings);
$('#pgKeyBtn').addEventListener('click',openSettings);
$('#setClose').addEventListener('click',closeSettings);
$('#setDlg').addEventListener('click',e=>{if(e.target.id==='setDlg')closeSettings();});
document.querySelectorAll('#setDlg [data-preset]').forEach(b=>b.addEventListener('click',()=>{
  PGKBIND=PGK_PRESET[b.dataset.preset].map(a=>a.slice());PGKCAP=null;pgKeysSave();pgKeysApply();pgKeyRender();
  sfx('chime');pgKeyMsg(b.dataset.preset==='def'?'처음 설정으로 돌렸어요. (Q E S Z C + 숫자패드)':`${b.textContent.trim()}(으)로 바꿨어요.`);
}));
pgKeysApply();
