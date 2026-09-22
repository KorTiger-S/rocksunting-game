'use strict';
/* ---------- 허브 ---------- */
let betV=1000;
const betMax=()=>Math.min(3000,S.money);
function renderHub(){
  renderDuelCard();
  $('#hMoney').textContent=fmt(S.money)+'원';$('#hDay').textContent=`${S.week}주차 ${DAYS[S.day]}요일`;
  $('#chat').innerHTML=`<b>${chatCur.n}</b>: ${chatCur.t}`;
  const f=S.fatigue||0;$('#fat').textContent='●'.repeat(f)+'○'.repeat(Math.max(0,3-f))+(f>=2?' (위험!)':'');
  $('#jobBtn').textContent=f>=2?'매점 알바 (+600원) ⚠쓰러질 위험':`매점 알바 (+600원)`;
  $('#note').textContent=S.news;$('#note').className='note'+(S.cleared?' win':'');
  $('#prog').style.width=clamp(S.money/1000000*100,0,100)+'%';$('#goalTxt').textContent=`${fmt(S.money)} / 1,000,000원 (승 ${S.wins} · 패 ${S.losses})`;
  betV=clamp(betV,1000,Math.max(1000,betMax()));
  $('#betV').textContent=fmt(betV)+'원';
  const can=S.money>=1000;
  $('#acceptBtn').disabled=!can;$('#bMinus').disabled=betV<=1000||!can;$('#bPlus').disabled=betV+100>betMax();$('#bBig').disabled=betV+500>betMax();
}
function toHub(){mode='hub';if(pendingCloud){const r=pendingCloud;pendingCloud=null;adoptCloud(r);}chatCur=randChat();C=null;K=null;$('#skip').hidden=true;$('#ovSet').hidden=true;showGame(false);renderHub();maybeLoan();}
function dayAction(msg,gain,job){
  if(gain)S.money+=gain;
  if(job)S.fatigue=(S.fatigue||0)+1;else S.fatigue=Math.max(0,(S.fatigue||0)-1);
  chatCur=randChat();
  const wkd=advanceDay();S.news=msg+' '+S.news;if(wkd)setTimeout(()=>sfx('bell'),300);
  if(job&&S.fatigue>=3){hospitalize();return;}
  if(job&&S.fatigue===2)S.news+=' 몸이 무겁다… 알바를 또 하면 쓰러질지도 모른다.';
  if(S.money>=1000000&&!S.cleared){S.cleared=true;S.news='🎉 100만 원 달성! (엔딩 애니메이션은 다음 업데이트에서 만나요)';sfx('bigwin');}
  save();renderHub();
}
const VISIT=[
 {n:'겨맘',t:'롹순팅! 괜찮아? 무리하지 말고 푹 쉬어~ (죽을 놓고 갔다)'},
 {n:'히통',t:'병원비 모자라면 빌려줄게. 이자는 10%… 퇴원 기념으로 9.9%.'},
 {n:'주멘',t:'이건 계획에 없었는데… 알바 스케줄부터 다시 짜자.'},
 {n:'머호',t:'세상은 어차피 다 5할이야. 쓰러질 확률도 5할이었던 거지~'},
 {n:'주스',t:'아픈 놈은 안 깨문다. 다 나으면 깨물어버린다!'},
 {n:'ㅈㄱ',t:'…(말없이 이상해씨 카드를 두고 갔다)'},
 {n:'씨붕',t:'내기에 나왔으면 판돈 크게 땄을 텐데… 아무튼 빨리 나아!'}
];
function hospitalize(){
  const before=S.money,fee=Math.min(8000,Math.max(2000,Math.round(S.money*.35/100)*100)),paid=Math.min(S.money,fee),short=fee-paid;
  S.money-=paid;const afterFee=S.money;S.fatigue=0;S.hosp=(S.hosp||0)+1;
  const dBefore=S.day,wk=S.week;advanceDay();const w2=S.week;advanceDay();
  const weekend=S.week>wk;const v=pick(VISIT);if(weekend)setTimeout(()=>sfx('bell'),700);
  S.news=`과로로 이틀 입원했다. 병원비 ${fmt(paid)}원이 나갔다.`+(weekend?` 주말이 지나 새 주가 시작됐다. (${S.week}주차 ${DAYS[S.day]}요일)`:` (${DAYS[S.day]}요일)`);
  const pages=[
    {img:'worn',sfx:'siren',title:'과로로 쓰러졌다…',text:'매점 알바를 쉬지 않고 이어서 하다가, 계산대 앞에서 그대로 쓰러지고 말았다.'},
    {img:'sad',title:'병원에서 눈을 떴다',who:v.n,text:v.t},
    {img:'frustrated',sfx:'deny',title:'병원비 정산',text:`병원비 ${fmt(fee)}원이 나갔다. (소지금 ${fmt(before)} → ${fmt(afterFee)}원)`+(short>0?` 모자란 ${fmt(short)}원은 병원에서 사정을 봐줬다.`:'')+` 이틀을 병원에서 보냈다.`+(weekend?' 그 사이 주말이 지나 새 주가 시작됐다.':'')+' 알바는 쉬엄쉬엄 하자.'}
  ];
  save();
  showStory(pages,()=>{chatCur=randChat();renderHub();maybeLoan();},'sad');
}
let STORY=null;
function showStory(pages,done,bgm){STORY={pages,i:0,done,bgm};renderStory();$('#story').hidden=false;}
function renderStory(){const p=STORY.pages[STORY.i];$('#stT').textContent=p.title;$('#stImg').src=p.src||IMGDATA[p.img||'base'];
  const sb=$('#stB');sb.hidden=!p.burp;sb.textContent=p.burp?pick(BURPS):'';if(p.burp)burp();else sfx(p.sfx||'page');
 $('#stN').textContent=p.who?`${p.who}:`:'';$('#stX').textContent=p.text;$('#stBtn').textContent=STORY.i>=STORY.pages.length-1?'확인':'다음';}
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
  if(!USER||mode!=='hub'||S.money>0||STORY||!$('#duel').hidden||!$('#wn').hidden||!$('#login').hidden||!$('#splash').hidden)return;
  const before=Math.max(0,S.money);
  S.money=LOAN;S.news='라털 선생님께 1만 원을 빌렸다. 이번엔 아껴 쓰자…';save();renderHub();
  showStory([
    {img:'sad',sfx:'deny',bgm:'sad',title:'소지금이 바닥났다…',text:'지갑이 텅 비었다. 주머니를 뒤집어 봐도 먼지뿐… 그때 복도 끝에서 라털 선생님이 다가왔다.'},
    {src:RATAL_IMG,bgm:'ratal',title:'라털 선생님',who:'라털',text:pick(RATAL_LINES),burp:true},
    {img:'happy',sfx:'coin',bgm:'ratal',title:'1만 원을 빌렸다',text:`소지금 ${fmt(before)}원 → ${fmt(LOAN)}원. 다음엔 아껴 쓰자!`}
  ],()=>{chatCur=randChat();renderHub();});
}
$('#bMinus').addEventListener('click',()=>{betV=Math.max(1000,betV-100);renderHub();});
$('#bPlus').addEventListener('click',()=>{betV=Math.min(betMax(),betV+100);renderHub();});
$('#bBig').addEventListener('click',()=>{betV=Math.min(betMax(),betV+500);renderHub();});
$('#acceptBtn').addEventListener('click',()=>{if(S.money>=1000)startMatch(betV);});
$('#passBtn').addEventListener('click',()=>dayAction('오늘은 조용히 지나갔다.',0,false));
$('#jobBtn').addEventListener('click',()=>dayAction('머호가 소개해 준 매점 심부름으로 600원을 벌었다.',600,true));
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
const BTN_SFX={jobBtn:'coin',passBtn:'swish',acceptBtn:'start',bMinus:'tick',bPlus:'tick',bBig:'tick',duBm:'tick',duBp:'tick',duBb:'tick',rankBtn:'page',stBtn:'none',sndBtn:'none',mute:'none',lgSnd:'none',bgmBtn:'none',bgmMute:'none',lgBgm:'none'};
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  const n=BTN_SFX[b.id]||'click';if(n!=='none')sfx(n);
},true);
const MSGS=['오늘도 학교에서 살아남자.','주스의 빵 값은 내가 지킨다.','롹!','쉬는 시간이 10분뿐이라니.','히통 이자가 10%였지…'];
$('#bigface').addEventListener('click',function(){this.src=IMGDATA[FACES[Math.floor(Math.random()*FACES.length)]];$('#bigmsg').textContent=MSGS[Math.floor(Math.random()*MSGS.length)];});
window.addEventListener('pagehide',()=>{save();});

