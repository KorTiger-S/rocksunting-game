'use strict';
/* ---------- 허브 ---------- */
let betV=1000;
const betMax=()=>Math.min(3000,S.money);
let hubCard=null;   /* 허브에서 열어 둔 게임 상세 카드 id (null: 게임 목록). 게임이 끝나고 돌아오면 그 카드가 그대로 열려 있어요 */
function renderGameList(){
  $('#gameList').hidden=!!hubCard;
  document.querySelectorAll('.gdet').forEach(c=>c.hidden=c.id!==hubCard);
  const b=S.balls==null?BALL_MAX:S.balls,open=pgUnlocked();
  $('#glFree').textContent=`⚽ 남은 공 ${b}/${BALL_MAX} · 5킥 넣으면 판돈 2배`;
  $('#glPumpT').textContent=open?'호우와 소리새 헛다리짚기 훈련':'???';
  $('#glPump').textContent=open?`🎤 남은 마이크 ${S.mics==null?5:S.mics}/5 · 발판 리듬 게임`:'준비 중 · 관리자 번호로 입장';
  $('#glDuel').textContent=duOk()?'방 코드로 친구와 실시간 승부':'로그인하면 친구와 대결할 수 있어요';
}
function openHubCard(id){
  hubCard=id;renderGameList();
  const c=id?$('#'+id):$('#gameList');if(c.getBoundingClientRect().top<0)c.scrollIntoView({block:'start'});
}
document.querySelectorAll('.gopen').forEach(b=>b.addEventListener('click',()=>openHubCard(b.dataset.card)));
document.querySelectorAll('.gback').forEach(b=>b.addEventListener('click',()=>openHubCard(null)));
function renderHub(){
  renderDuelCard();renderPumpCard();renderShop();renderMyFace();
  $('#hMoney').textContent=fmt(S.money)+'원';$('#pfMoney').textContent=fmt(S.money)+'원';
  $('#chat').innerHTML=`<b>${chatCur.n}</b>: ${chatCur.t}`;
  $('#prog').style.width=clamp(S.money/1000000*100,0,100)+'%';$('#goalTxt').textContent=`${fmt(S.money)} / 1,000,000원 (승 ${S.wins} · 패 ${S.losses})`;
  betV=clamp(betV,1000,Math.max(1000,betMax()));
  $('#betV').textContent=fmt(betV)+'원';
  ballTick();renderBalls();
  const can=S.money>=1000&&S.balls>0;
  renderGameList();
  $('#acceptBtn').disabled=!can;$('#bMinus').disabled=betV<=1000||!can;$('#bPlus').disabled=betV+100>betMax();$('#bBig').disabled=betV+500>betMax();
}
/* ---------- 프리킥 도전 횟수: 축구공 5개, 도전할 때마다 1개 사라지고 30분마다 1개씩 다시 채워져요 ----------
   실제 시각(Date.now) 기준이라 앱을 꺼 둬도 시간은 흘러요. S.ballAt은 "다음 공이 채워지기 시작한 시각"(epoch 분)이고, 공이 가득 차 있을 땐 쓰지 않아요. */
const BALL_MAX=5,BALL_MIN=30;
const ballMin=()=>Math.floor(Date.now()/60000);
function ballTick(){   /* 지난 시간만큼 공을 채워요. 개수가 늘었으면 true */
  const now=ballMin();let b=S.balls==null?BALL_MAX:clamp(Math.floor(S.balls),0,BALL_MAX),up=false;
  if(b<BALL_MAX){
    let at=Math.min(S.ballAt>0?S.ballAt:now,now);   /* 기기 시계가 뒤로 가도 30분 넘게 기다리지 않게 */
    const gain=Math.floor((now-at)/BALL_MIN);
    if(gain>0){b=Math.min(BALL_MAX,b+gain);at+=gain*BALL_MIN;up=true;}
    S.ballAt=b>=BALL_MAX?0:at;
  }else S.ballAt=0;
  S.balls=b;return up;
}
function ballUse(){   /* 도전 시작할 때 1개 써요. 공이 없으면 false */
  ballTick();if(S.balls<=0)return false;
  if(S.balls>=BALL_MAX)S.ballAt=ballMin();   /* 가득 찬 상태에서 쓰면 이때부터 30분을 세요 */
  S.balls--;return true;
}
const ballWaitSec=()=>Math.max(0,Math.ceil(((S.ballAt+BALL_MIN)*60000-Date.now())/1000));
function renderBalls(){
  const b=S.balls==null?BALL_MAX:S.balls;
  $('#balls').setAttribute('aria-label',`프리킥 도전 횟수 ${b}/${BALL_MAX}`);
  [...$('#balls').children].forEach((el,i)=>el.classList.toggle('used',i>=b));
  const w=ballWaitSec(),t=`${Math.floor(w/60)}:${String(w%60).padStart(2,'0')}`;
  $('#ballNote').textContent=b>=BALL_MAX?'도전 횟수가 가득 찼어요!':b<=0?`축구공이 다 떨어졌어요. 다음 공까지 ${t}`:`다음 축구공까지 ${t} (30분마다 1개 충전)`;
}
setInterval(()=>{
  if(!USER||mode!=='hub')return;
  if(ballTick()){save();renderHub();sfx('ping');toast('⚽ 도전 횟수가 하나 충전됐어요!');}else renderBalls();
},1000);
function toHub(){mode='hub';if(pendingCloud){const r=pendingCloud;pendingCloud=null;adoptCloud(r);}chatCur=randChat();C=null;K=null;$('#skip').hidden=true;$('#ovSet').hidden=true;showGame(false);renderHub();maybeLoan();}
let STORY=null;
function showStory(pages,done,bgm){STORY={pages,i:0,done,bgm};renderStory();$('#story').hidden=false;}
function renderStory(){const p=STORY.pages[STORY.i];$('#stT').textContent=p.title;if(p.src){$('#stImg').removeAttribute('data-face');$('#stImg').src=p.src;}else setFace($('#stImg'),p.img||'base');
  const sb=$('#stB');sb.hidden=!p.burp;sb.textContent=p.burp?pick(BURPS):'';if(p.burp)burp();else sfx(p.sfx||'page');
 $('#stN').textContent=p.who?`${p.who}:`:'';$('#stX').textContent=p.text;$('#stBtn').textContent=STORY.i>=STORY.pages.length-1?'확인':'다음';
 $('#story').classList.toggle('danger',!!p.danger);$('#stImg').classList.toggle('angry',!!p.danger);}
$('#stBtn').addEventListener('click',()=>{if(!STORY)return;STORY.i++;if(STORY.i>=STORY.pages.length){$('#story').hidden=true;const d=STORY.done;STORY=null;d&&d();}else renderStory();});
/* ---------- 라털 선생님: 소지금이 0원 이하가 되면 1만 원을 빌려줘요 ----------
   대머리에 짧은 턱수염이 구레나룻까지 이어진 모습이에요. 돈을 빌려줄 때 말끝마다 "바우!" 하고 트림을 해요. */
const LOAN=10000;
const RATAL_IMG='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><clipPath id="hd"><ellipse cx="100" cy="88" rx="52" ry="60"/></clipPath></defs><rect width="200" height="200" fill="#f4f1ee"/><path d="M14 200Q20 150 100 146Q180 150 186 200Z" fill="#2f3a56"/><path d="M78 148L100 176L122 148Z" fill="#fff"/><path d="M94 152L106 152L110 196L100 202L90 196Z" fill="#c4372f"/><rect x="82" y="128" width="36" height="28" rx="6" fill="#e4b995"/><ellipse cx="47" cy="92" rx="8" ry="13" fill="#f1c9a5" stroke="#232a45" stroke-width="3"/><ellipse cx="153" cy="92" rx="8" ry="13" fill="#f1c9a5" stroke="#232a45" stroke-width="3"/><ellipse cx="100" cy="88" rx="52" ry="60" fill="#f1c9a5"/><ellipse cx="80" cy="44" rx="15" ry="7" fill="#fff" opacity=".55" transform="rotate(-25 80 44)"/><circle cx="72" cy="104" r="8" fill="#f2a7a0" opacity=".55"/><circle cx="128" cy="104" r="8" fill="#f2a7a0" opacity=".55"/><path d="M66 68Q78 61 90 68" stroke="#3b2f2a" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M110 68Q122 61 134 68" stroke="#3b2f2a" stroke-width="5" stroke-linecap="round" fill="none"/><ellipse cx="78" cy="82" rx="4.5" ry="5.5" fill="#232a45"/><ellipse cx="122" cy="82" rx="4.5" ry="5.5" fill="#232a45"/><circle cx="79.5" cy="80" r="1.6" fill="#fff"/><circle cx="123.5" cy="80" r="1.6" fill="#fff"/><path d="M100 84Q93 98 99 101Q104 102 107 100" stroke="#c99b7a" stroke-width="3" stroke-linecap="round" fill="none"/><g clip-path="url(#hd)"><path d="M40 80L58 60Q64 92 80 104Q100 98 120 104Q136 92 142 60L160 80L160 170L40 170Z" fill="#3b2f2a"/></g><path d="M74 108Q87 98 100 105Q113 98 126 108Q114 118 100 111Q86 118 74 108Z" fill="#2a201c"/><ellipse cx="100" cy="126" rx="11" ry="7" fill="#6b2a2a"/><path d="M92 128Q100 134 108 128Q100 124 92 128Z" fill="#d9667a"/><ellipse cx="100" cy="88" rx="52" ry="60" fill="none" stroke="#232a45" stroke-width="3"/></svg>');
const RATAL_LINES=[
  '돈이 바닥났다고? 쯧쯧… 선생님이 1만 원 빌려주마. 다음엔 아껴 쓰거라. 바우!',
  '허허, 또 빈털터리가 됐구나. 자, 1만 원이다. 이자는 열심히 공부하는 걸로 받으마. 바우!',
  '선생님도 월급날 전이라 빠듯하다만… 제자가 굶을 순 없지. 1만 원 가져가거라. 바우!'
];
const BURPS=['(꺼억~)','(끄으윽~)','(꺼어어억…)'];
function burp(){beep(150,.14,'sawtooth',.09);setTimeout(()=>beep(95,.32,'sawtooth',.1),120);setTimeout(()=>beep(70,.25,'square',.06),380);}
/* 허브에 있을 때 소지금이 0원 이하면 라털 선생님이 나타나요. 대결 화면·로그인·업데이트 팝업이 열려 있을 땐 기다려요. */
function maybeLoan(){
  if(!USER||mode!=='hub'||S.money>0||STORY||!$('#duel').hidden||!$('#wn').hidden||!$('#login').hidden||!$('#splash').hidden||!$('#pinChange').hidden||!$('#challengeInfo').hidden||!$('#profile').hidden)return;
  const before=Math.max(0,S.money);
  S.money=LOAN;save();renderHub();
  showStory([
    {img:'sad',sfx:'deny',bgm:'sad',title:'소지금이 바닥났다…',text:'지갑이 텅 비었다. 주머니를 뒤집어 봐도 먼지뿐… 그때 복도 끝에서 라털 선생님이 다가왔다.'},
    {src:RATAL_IMG,bgm:'ratal',title:'라털 선생님',who:'라털',text:pick(RATAL_LINES),burp:true},
    {img:'happy',sfx:'coin',bgm:'ratal',title:'1만 원을 빌렸다',text:`소지금 ${fmt(before)}원 → ${fmt(LOAN)}원. 다음엔 아껴 쓰자!`}
  ],()=>{chatCur=randChat();renderHub();});
}
$('#bMinus').addEventListener('click',()=>{betV=Math.max(1000,betV-100);renderHub();});
$('#bPlus').addEventListener('click',()=>{betV=Math.min(betMax(),betV+100);renderHub();});
$('#bBig').addEventListener('click',()=>{betV=Math.min(betMax(),betV+500);renderHub();});
function openChallengeInfo(){$('#chBetInfo').textContent=`이번 판돈: ${fmt(betV)}원 · 축구공 1개를 써요 (남은 공 ${S.balls}개)`;$('#challengeInfo').hidden=false;}
function closeChallengeInfo(){$('#challengeInfo').hidden=true;}
$('#acceptBtn').addEventListener('click',()=>{ballTick();if(S.money>=1000&&S.balls>0)openChallengeInfo();});
$('#chClose').addEventListener('click',closeChallengeInfo);
$('#chStart').addEventListener('click',()=>{
  closeChallengeInfo();
  if(S.money<1000)return;
  if(!ballUse()){sfx('deny');toast('축구공이 없어요. 공이 채워질 때까지 기다려 주세요.');renderHub();return;}
  startMatch(betV);   /* startMatch가 저장해요 */
});
$('#sBtn').addEventListener('click',toHub);
$('#skip').addEventListener('click',()=>{if(mode==='cut')pressed.SkipCut=true;});
$('#quit').addEventListener('click',askQuit);
/* 효과음/음악 켜기·끄기: 헤더(🔊 🎵), 로그인 화면, 게임 화면의 버튼이 같은 설정을 써요. 둘은 따로 기억돼요. */
function renderSound(){
  $('#sndBtn').textContent=muted?'🔇 효과음 꺼짐':'🔊 효과음';$('#mute').textContent=muted?'효과음 켜기':'효과음 끄기';$('#lgSnd').textContent=muted?'🔇 효과음 켜기':'🔊 효과음 끄기';
  const m=BGM.on;$('#bgmBtn').textContent=m?'🎵 음악':'🎵 음악 꺼짐';$('#bgmMute').textContent=m?'음악 끄기':'음악 켜기';$('#lgBgm').textContent=m?'🎵 음악 끄기':'🎵 음악 켜기';
}
function setMuted(m){muted=m;lsSet('rk:muted',m?'1':'0');renderSound();if(!m)sfx('click');}
function setBgm(on){BGM.on=on;lsSet('rk:bgm',on?'1':'0');renderSound();bgmSync();}
['#sndBtn','#mute','#lgSnd'].forEach(sel=>$(sel).addEventListener('click',()=>setMuted(!muted)));
['#bgmBtn','#bgmMute','#lgBgm'].forEach(sel=>$(sel).addEventListener('click',()=>setBgm(!BGM.on)));
renderSound();
/* 버튼을 누르는 소리: 기본은 '똑', 버튼마다 다른 소리는 여기에 (none: 그 버튼은 자기 소리를 따로 내요) */
const BTN_SFX={chStart:'start',pgStart:'start',bMinus:'tick',bPlus:'tick',bBig:'tick',duBm:'tick',duBp:'tick',duBb:'tick',pgSpdM:'tick',pgSpdP:'tick',pgOffM:'tick',pgOffP:'tick',rankBtn:'page',stBtn:'none',sndBtn:'none',mute:'none',lgSnd:'none',bgmBtn:'none',bgmMute:'none',lgBgm:'none'};   /* stBtn: 소리는 showStory()에서 직접 재생해요(중복 방지) */
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  const n=BTN_SFX[b.id]||(b.classList.contains('gopen')?'page':'click');if(n!=='none')sfx(n);   /* 게임 목록의 '게임하기'는 페이지 넘기는 소리 */
},true);
const MSGS=['오늘도 학교에서 살아남자.','주스의 빵 값은 내가 지킨다.','롹!','쉬는 시간이 10분뿐이라니.','히통 이자가 10%였지…'];
/* 프로필 아이콘을 누르면 표정이 바뀌면서, 소지금/뱃지/로그아웃 같은 정보를 한눈에 보는 팝업이 열려요 */
function openProfile(){$('#pfMoney').textContent=fmt(S.money)+'원';$('#profile').hidden=false;renderBadges();}
/* 시즌 뱃지: 마감된 시즌의 소지금 1등 = 우승, 2등 = 준우승 (서버 rk_badges가 시즌 스냅샷에서 계산해요). 프로필을 열 때마다 새로 받아요 */
let BADGES=null;   /* {id, list:[{number,gameName,rank}]} */
function drawBadges(list){
  const box=$('#pfBadges');box.innerHTML='';
  if(!list){const p=document.createElement('p');p.className='none';p.textContent='불러오는 중…';box.appendChild(p);return;}
  if(!list.length){const p=document.createElement('p');p.className='none';p.textContent=`아직 없어요. 시즌이 끝날 때 ${SEASON&&SEASON.metric==='pumpBest'?'펌프 최고점':'소지금'} 1·2등이 우승·준우승 뱃지를 받아요.`;box.appendChild(p);return;}
  list.forEach(b=>{
    const d=document.createElement('div'),s=document.createElement('small');
    d.className='badge b'+b.rank;d.textContent=`${b.rank===1?'🏆':'🥈'} 시즌${b.number} ${b.rank===1?'우승':'준우승'}`;
    s.textContent=b.gameName||'';d.appendChild(s);box.appendChild(d);
  });
}
function renderBadges(){
  $('#pfBadgeSec').hidden=!USER||!cloudUrl();if(!USER||!cloudUrl())return;
  const id=USER.id;drawBadges(BADGES&&BADGES.id===id?BADGES.list:null);
  api('badges',{id}).then(r=>{BADGES={id,list:r.list||[]};if(USER&&USER.id===id)drawBadges(BADGES.list);})
    .catch(()=>{if(!BADGES||BADGES.id!==id)$('#pfBadgeSec').hidden=true;});   /* 서버에 rk_badges가 없거나 오프라인이면 조용히 숨겨요 */
}
function closeProfile(){$('#profile').hidden=true;}
$('#bigface').addEventListener('click',function(){setFace(this,FACES[Math.floor(Math.random()*FACES.length)]);$('#bigmsg').textContent=MSGS[Math.floor(Math.random()*MSGS.length)];openProfile();});
$('#pfClose').addEventListener('click',closeProfile);
window.addEventListener('pagehide',()=>{save();});

