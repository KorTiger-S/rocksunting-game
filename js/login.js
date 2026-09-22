'use strict';
/* ---------- 로그인 ---------- */
let LG={id:'',pin:'',ph:'',local:null,offline:false};
function lgStep(s){
  [['choice','lgChoice'],['main','lgMain'],['busy','lgBusy'],['new','lgNew'],['off','lgOff']].forEach(a=>{$('#'+a[1]).hidden=a[0]!==s;});
}
function lgModeText(){$('#lgMode').textContent=cloudUrl()?'저장 방식: 클라우드(Supabase) + 이 기기':'저장 방식: 이 기기(브라우저)';}
function showLogin(){
  $('#login').hidden=false;lgStep('choice');lgModeText();$('#lgMsg').textContent='';$('#lgPin').value='';LG.pin='';LG.ph='';
  const last=lsGet('rk:last');const b=$('#lgResume');
  if(last&&ID_RE.test(last)){b.hidden=false;b.textContent=`${last} (으)로 계속하기`;b.dataset.id=last;}else b.hidden=true;
  if(!SP.on)setTimeout(()=>{try{$('#lgToLogin').focus();}catch(e){}},50);   /* 스플래시가 떠 있을 땐 스플래시가 끝날 때 포커스 */
}
function goLoginForm(){
  lgStep('main');
  setTimeout(()=>{try{($('#lgId').value?$('#lgPin'):$('#lgId')).focus();}catch(e){}},30);
}
function enterGuest(){
  USER={id:'Guest',guest:true};S=DEF();OFFLINE_BASE=null;pendingCloud=null;dirty=false;
  S.news='게스트로 시작했다. 이번 기록은 저장되지 않고 랭킹에도 오르지 않는다.';
  $('#login').hidden=true;mode='hub';
  renderHub();updateUserChip();setSync('idle');
  sfx('chime');toast('Guest로 시작해요. 기록은 저장되지 않아요.');
  maybeShowNotes(false);maybeLoan();
}
async function startLogin(raw,rawPin){
  let id=String(raw||'').trim();if(id.normalize)id=id.normalize('NFC');
  const pin=String(rawPin||'').trim();
  if(!ID_RE.test(id)){$('#lgMsg').textContent='ID는 2~12자, 한글·영문·숫자·_ 만 쓸 수 있어요.';return;}
  if(/^(guest|게스트)$/i.test(id)){$('#lgMsg').textContent='이 ID는 쓸 수 없어요. (Guest는 따로 시작할 수 있어요)';return;}
  if(!PIN_RE.test(pin)){$('#lgMsg').textContent='비밀번호는 숫자 4자리로 입력해 주세요.';return;}
  LG={id,pin,ph:pinHash(id,pin),local:readLocal(id),offline:false};
  lgStep('busy');$('#lgBusyTx').textContent='기록을 찾는 중…';
  let cloud=null;
  if(cloudUrl()){
    try{cloud=await api('load',{id,pin});setSeason(cloud.current);LG.season=cloud.exists?cloud.season:(cloud.current&&cloud.current.key);}
    catch(e){
      if(e.message==='bad_pin'){pinFail();return;}
      if(e.message==='locked'){pinFail('비밀번호를 여러 번 틀려서 5분 동안 잠겼어요. 잠시 후 다시 시도해 주세요.');return;}
      sfx('error');lgStep('off');return;
    }
  }
  finishLogin(cloud);
}
function pinFail(msg){sfx('error');lgStep('main');$('#lgMsg').textContent=msg||'ID 또는 비밀번호가 맞지 않아요.';$('#lgPin').value='';try{$('#lgPin').focus();}catch(e){}}
function finishLogin(cloud){
  const id=LG.id,cEx=cloud&&cloud.exists&&cloud.data;
  let local=LG.local,stale=false;
  if(local&&local.pin&&!cloud&&local.pin!==LG.ph){pinFail();return;}   /* 클라우드 확인을 못 했을 때는 이 기기의 저장값으로 확인 */
  if(local&&cEx&&(local.season||LEGACY_SEASON)!==cloud.season){local=null;stale=true;}   /* 이 기기의 기록이 지난 시즌 것이면 버려요 */
  if(!LG.season)LG.season=(local&&local.season)||(SEASON&&SEASON.key)||LEGACY_SEASON;
  if(!local&&!cEx){showNew(id);return;}
  const lAt=local?(local.updatedAt||0):0,cAt=cEx?(cloud.updatedAt||0):0;
  let data,name,at,news=null;
  if(cEx&&cAt>lAt){data=mergeData(cloud.data);name=cloud.name||id;at=cAt;news=stale?'새 시즌이 시작되어 모든 기록이 초기화되었다. 다시 1주차부터!':`기록을 불러왔다. ${data.week}주차 ${DAYS[data.day]}요일부터 이어서!`;}
  else{data=mergeData(local.data);name=local.name||id;at=lAt;}
  enter(name,data,at,news);
}
function showNew(id){
  lgStep('new');$('#lgNewTx').textContent=`"${id}" 은(는) 새 ID예요. 이 ID로 새로 시작할까요?`;
  const raw=lsGet(LEGACY_KEY),done=lsGet('rk:legacyDone');let leg=null;
  try{if(raw&&!done)leg=JSON.parse(raw);}catch(e){}
  LG.legacy=leg;$('#lgImport').hidden=!leg;$('#lgLegacy').hidden=!leg;
  if(leg)$('#lgLegacy').textContent=`이 기기에 이전에 하던 기록이 있어요. (소지금 ${fmt(leg.money||0)}원, ${leg.week||1}주차) 이 ID로 가져올 수 있어요.`;
}
function createUser(useLegacy){
  const id=LG.id;let data=DEF();
  if(useLegacy&&LG.legacy){data=mergeData(LG.legacy);data.news='이전 기록을 가져왔다. 이어서 시작!';lsSet('rk:legacyDone','1');}
  enter(id,data,0,null,true);
}
function enter(name,data,at,news,isNew){
  USER={id:name,pin:LG.pin,ph:LG.ph,season:LG.season||(SEASON&&SEASON.key)||LEGACY_SEASON};S=data;if(news)S.news=news;
  OFFLINE_BASE=(LG.offline&&cloudUrl())?(at||0):null;
  $('#login').hidden=true;mode='hub';
  save();renderHub();updateUserChip();setSync(cloudUrl()?'idle':'idle');
  sfx('welcome');toast(isNew?`${name} 님, 환영해요!`:`${name} 님, 다시 만나서 반가워요!`);
  maybeShowNotes(isNew);maybeLoan();
}
function updateUserChip(){$('#hUser').textContent=USER?(USER.guest?'👤 Guest (저장 안 됨)':`👤 ${USER.id}`):'';}
async function logout(){
  if(mode!=='hub')return;
  try{if(dirty)await cloudPush();}catch(e){}
  USER=null;S=DEF();OFFLINE_BASE=null;pendingCloud=null;dirty=false;updateUserChip();showLogin();
}
/* ---------- 업데이트 내역: 새 버전이 나온 뒤 처음 로그인할 때 한 번만 보여줘요 ---------- */
/* 버전을 올릴 때(APP_VERSION + package.json) 여기에 그 버전의 내역을 추가하세요. 내역이 없는 버전은 팝업이 안 떠요. */
const RELEASE_NOTES={
  '1.5.0':{sub:'체력·근력·컨디션·기분이 생겼어요!',items:[
    '💪 근력이 생겼어요. 헬스장에서 쇠질하기(1,500원)로 올릴 수 있고, 오래 쉬면 점점 떨어져요.',
    '🍖 체력이 생겼어요. 난지바베큐(2,000원)로 올릴 수 있고, 오래 쉬면 점점 떨어져요.',
    '⚡ 컨디션(매우나쁨~매우좋음)이 매일 랜덤으로 바뀌고, 프리킥 난이도에 영향을 줘요. 에너지드링크(700원)를 마시면 한 단계 좋아져요.',
    '😊 기분이 생겼어요. 계속 지면 기분이 나빠지고, 기분이 나쁘면 컨디션도 잘 안 좋아져요. 디델리 떡볶이(1,000원)를 사 먹으면 좋아져요.'
  ]},
  '1.4.0':{sub:'이제 소리가 나요! 🔊🎵',items:[
    '🔊 게임 전체에 효과음이 생겼어요. 버튼 누르는 소리, 돈이 들어오는 소리, 학교 종소리, 구급차 사이렌, 호루라기, 공 차는 소리, 골망, 환호와 탄식까지!',
    '🎵 배경음악도 생겼어요! 시작 화면, 쉬는 시간(허브), 프리킥 경기, 1:1 대결, 병원, 라털 선생님 이야기마다 다른 곡이 나와요.',
    '💬 대사가 한 글자씩 나올 때 말하는 사람마다 조금씩 다른 소리가 나요.',
    '🎚 효과음(🔊)과 음악(🎵)은 화면 위쪽 버튼(로그인 화면과 게임 화면에도 있어요)으로 따로 켜고 끌 수 있고, 설정은 기억돼요.'
  ]},
  '1.3.0':{sub:'용돈이 사라지고, 라털 선생님이 나타났어요!',items:[
    '🚫 주말마다 받던 부모님 용돈이 없어졌어요. 이제 소지금은 내가 직접 벌어야 해요!',
    '🧔 소지금이 0원이 되면 라털 선생님이 1만 원을 빌려줘요. 돈을 빌려줄 때마다 말끝에 "바우!" 하고 트림을 한대요.',
    '🏥 병원비가 모자라도 부모님이 내주지 않아요. 알바는 쉬엄쉬엄!'
  ]},
  '1.2.0':{sub:'1:1 대결에 판돈이 생겼어요!',items:[
    '🪙 1:1 페널티킥 대결에 판돈을 걸 수 있어요. 방장이 0~5,000원 사이로 정하고, 방을 만들고 참가하는 순간 소지금에서 빠져요.',
    '💰 이긴 사람이 판돈 2배를 가져가요. 대결 중에 나가거나 자리를 비우면 몰수패예요!',
    '↩ 아무도 안 들어온 방을 닫거나 방이 만료되면 판돈은 돌려받아요.',
    '👀 참가하기 전에 방장과 판돈을 먼저 보여 줘요.'
  ]},
  '1.1.0':{sub:'친구와 1:1로 붙어요!',items:[
    '⚽ 1:1 페널티킥 대결이 생겼어요. 방을 만들고 4자리 코드를 친구에게 알려 주면 바로 승부!',
    '🎯 피파 온라인처럼! 슈터는 골대 안을 조준하고 파워 게이지를 맞춰 차고, 골키퍼는 다이브 방향을 골라요. 번갈아 5번씩, 동점이면 서든데스!',
    '🚪 로그인한 사람끼리만 할 수 있고, 이번 대결은 판돈과 랭킹 기록이 없어요.'
  ]},
  '1.0.0':{sub:'시즌1 시작! 이렇게 바뀌었어요.',items:[
    '🔑 이제 ID와 숫자 4자리 비밀번호로 로그인해요. 처음 만든 비밀번호가 내 비밀번호예요.',
    '👤 로그인 없이 Guest로도 시작할 수 있어요. (기록은 저장되지 않아요)',
    '🏁 시즌제가 시작됐어요! 매달 1시즌, 시즌이 끝나면 랭킹이 기록되고 모두 처음부터 다시 시작해요. 시즌1은 9월 프리킥 축구!',
    '☁ 기록이 클라우드에 저장돼서 다른 기기에서도 이어서 할 수 있어요.',
    '🏫 시작 화면에 롹순팅이 등교하는 애니메이션이 생겼어요.'
  ]}
};
const seenKey=()=>'rk:seen:'+(USER&&!USER.guest?USER.id.toLowerCase():'guest');
function maybeShowNotes(isNew){
  const n=RELEASE_NOTES[APP_VERSION];if(!n||!USER)return;
  if(lsGet(seenKey())===APP_VERSION)return;
  if(isNew){lsSet(seenKey(),APP_VERSION);return;}   /* 처음 가입한 사람에게는 "바뀐 점"이 없어요 */
  $('#wnT').textContent='🎉 업데이트 v'+APP_VERSION;$('#wnSub').textContent=n.sub||'';
  const ul=$('#wnList');ul.textContent='';n.items.forEach(t=>{const li=document.createElement('li');li.textContent=t;ul.appendChild(li);});
  $('#wn').hidden=false;sfx('chime');setTimeout(()=>{try{$('#wnOk').focus();}catch(e){}},30);
}
function closeNotes(){$('#wn').hidden=true;if(USER)lsSet(seenKey(),APP_VERSION);maybeLoan();}
$('#wnOk').addEventListener('click',closeNotes);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#wn').hidden)closeNotes();});
const lgSubmit=()=>startLogin($('#lgId').value,$('#lgPin').value);
$('#lgGo').addEventListener('click',lgSubmit);
$('#lgId').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#lgPin').focus();}});
$('#lgPin').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lgSubmit();}});
$('#lgPin').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,4);});
$('#lgResume').addEventListener('click',e=>{$('#lgId').value=e.currentTarget.dataset.id;$('#lgPin').focus();});
$('#lgToLogin').addEventListener('click',goLoginForm);
$('#lgGuest').addEventListener('click',enterGuest);
$('#lgBackChoice').addEventListener('click',()=>{$('#lgMsg').textContent='';lgStep('choice');setTimeout(()=>{try{$('#lgToLogin').focus();}catch(e){}},30);});
$('#lgCreate').addEventListener('click',()=>createUser(false));
$('#lgImport').addEventListener('click',()=>createUser(true));
$('#lgBack1').addEventListener('click',()=>lgStep('main'));
$('#lgBack2').addEventListener('click',()=>lgStep('main'));
$('#lgRetry').addEventListener('click',()=>startLogin(LG.id,LG.pin));
$('#lgOffline').addEventListener('click',()=>{LG.offline=true;if(LG.local)finishLogin(null);else showNew(LG.id);});
$('#lgSetBtn').addEventListener('click',()=>{
  const s=$('#lgSet');s.hidden=!s.hidden;
  let c={};try{c=JSON.parse(lsGet('rk:cloud')||'{}')||{};}catch(e){}
  $('#lgUrl').value=c.url||'';$('#lgKey').value=c.key||'';
});
$('#lgUrlSave').addEventListener('click',async()=>{
  const u=$('#lgUrl').value.trim().replace(/\/+$/,''),k=$('#lgKey').value.trim(),m=$('#lgUrlMsg');
  if(!/^https:\/\/[A-Za-z0-9-]+\.supabase\.co$/.test(u)){m.textContent='https://프로젝트ID.supabase.co 형태의 주소를 넣어 주세요.';return;}
  if(k.length<20){m.textContent='anon(public) key를 넣어 주세요.';return;}
  lsSet('rk:cloud',JSON.stringify({url:u,key:k}));lgModeText();m.textContent='연결 테스트 중…';
  try{const r=await api('ping',{});m.textContent=`연결 성공! (백엔드 v${r.version})`;}
  catch(e){m.textContent='연결에 실패했어요. URL과 key를 확인하고, backend/schema.sql을 실행했는지 확인해 주세요.';}
});
$('#lgUrlClear').addEventListener('click',()=>{lsDel('rk:cloud');lgModeText();$('#lgUrl').value='';$('#lgKey').value='';$('#lgUrlMsg').textContent='연결을 해제했어요. 이 기기에만 저장돼요.';});
$('#outBtn').addEventListener('click',logout);

