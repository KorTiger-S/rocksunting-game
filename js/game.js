(function(){
'use strict';
const W=800,H=480,F=900,HOR=205;
/* 화면에 보이는 게임 버전. package.json의 version과 같게 맞춰 주세요 (build.js가 다르면 알려 줘요)
   버전 규칙  v메이저.마이너.패치  (v1.0.0에서 시작)
   - 메이저: 시즌이 바뀌면서 새 게임이 추가됐을 때
   - 마이너: 기능이 바뀌거나 굵직한 수정을 했을 때
   - 패치  : 자잘한 버그 수정 */
const APP_VERSION='1.1.0';
/* 캐릭터 표정 이미지 (assets/faces/*.jpg). 새 이미지를 추가하려면 여기에 경로를 등록하세요. */
const IMGDATA={
  "base": "assets/faces/base.jpg",
  "angry": "assets/faces/angry.jpg",
  "surprise": "assets/faces/surprise.jpg",
  "panic": "assets/faces/panic.jpg",
  "happy": "assets/faces/happy.jpg",
  "sad": "assets/faces/sad.jpg",
  "tired": "assets/faces/tired.jpg",
  "doubt": "assets/faces/doubt.jpg",
  "resolve": "assets/faces/resolve.jpg",
  "excited": "assets/faces/excited.jpg",
  "frustrated": "assets/faces/frustrated.jpg",
  "worn": "assets/faces/worn.jpg"
};
const IM={};
Object.keys(IMGDATA).forEach(k=>{const i=new Image();i.src=IMGDATA[k];IM[k]=i;});
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const fmt=n=>Math.floor(n).toLocaleString('ko-KR');
const FACES=['base','angry','surprise','panic','happy','sad','tired','doubt','resolve','excited','frustrated','worn'];
const DAYS=['월','화','수','목','금'];
function gauss(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*v);}

/* ---------- save ---------- */
const LEGACY_KEY='rocksunting-freekick-v1';
const DEF=()=>({fatigue:0,hosp:0,bestPts:0,plays:0,money:10000,day:0,week:1,up:{shoes:0,snack:0,sneak:0},wins:0,losses:0,cleared:false,news:'월요일 아침, 부모님이 용돈 1만 원을 주셨다.'});
const MEM={};
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return MEM[k]===undefined?null:MEM[k];}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){MEM[k]=v;}}
function lsDel(k){try{localStorage.removeItem(k);}catch(e){delete MEM[k];}}
function lsKeys(){const a=[];try{for(let i=0;i<localStorage.length;i++)a.push(localStorage.key(i));}catch(e){Object.keys(MEM).forEach(k=>a.push(k));}return a;}
const ID_RE=/^[0-9A-Za-z_가-힣ㄱ-ㅎㅏ-ㅣ]{2,12}$/;
const ukey=id=>'rk:u:'+id.toLowerCase();
let USER=null,S=DEF(),OFFLINE_BASE=null,pendingCloud=null;
/* ---------- 시즌 (매달 1시즌 · 마감하면 서버가 랭킹 보고서를 남기고 모든 기록을 초기화해요) ---------- */
const LEGACY_SEASON='2026-09';   /* 시즌 기능이 생기기 전에 저장된 기록은 시즌1(2026-09)로 봐요 */
let SEASON=null;                  /* {key,number,game,gameName,startedAt,endsAt} */
try{SEASON=JSON.parse(lsGet('rk:season')||'null');}catch(e){}
const KST_MS=9*3600e3,DAY_MS=864e5;
function setSeason(s){if(!s||!s.key)return;SEASON=s;lsSet('rk:season',JSON.stringify(s));renderSeason();}
function renderSeason(){
  const chip=$('#hSeason'),rk=$('#rkSeason');
  if(!SEASON||!cloudUrl()){chip.hidden=true;rk.textContent='';return;}
  const end=Date.parse(SEASON.endsAt),lastDay=new Date(end-1000+KST_MS);
  const left=Math.floor((end-1000+KST_MS)/DAY_MS)-Math.floor((Date.now()+KST_MS)/DAY_MS);
  const until=`${lastDay.getUTCMonth()+1}/${lastDay.getUTCDate()}까지`;
  const dtxt=left>0?`D-${left}`:left===0?'오늘 마감':'마감 임박';
  chip.hidden=false;chip.textContent=`🏁 시즌${SEASON.number} · ${until} (${dtxt})`;
  rk.textContent=`시즌${SEASON.number} · ${SEASON.gameName} · ${until} 진행 (마감 시 기록 초기화)`;
}
function mergeData(d){const b=DEF();const o=Object.assign(b,d||{});o.up=Object.assign(DEF().up,(d&&d.up)||{});return o;}
function readLocal(id){try{const r=lsGet(ukey(id));return r?JSON.parse(r):null;}catch(e){return null;}}
function cloudData(){return{money:S.money,day:S.day,week:S.week,fatigue:S.fatigue||0,hosp:S.hosp||0,wins:S.wins,losses:S.losses,bestPts:S.bestPts||0,plays:S.plays||0,cleared:!!S.cleared,up:S.up};}
const PIN_RE=/^\d{4}$/;
function pinHash(id,pin){  /* 이 기기에 저장해 두는 확인용 값 (서버에는 PIN 자체를 보내고 서버가 따로 해시해요) */
  const s=id.toLowerCase()+':'+pin;let h1=0xdeadbeef,h2=0x41c6ce57;
  for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (4294967296*(2097151&h2)+(h1>>>0)).toString(36);
}
function putLocal(){lsSet(ukey(USER.id),JSON.stringify({name:USER.id,pin:USER.ph,season:USER.season,updatedAt:S.updatedAt,data:S}));}
function save(){
  if(!USER||USER.guest)return;   /* Guest는 저장하지 않아요 */
  S.updatedAt=Date.now();
  putLocal();
  lsSet('rk:last',USER.id);
  cloudSoon();
}

/* ---------- 클라우드 (Supabase) ---------- */
const CLOUD_DEFAULT={url:'https://arvoervppgbcihzguncs.supabase.co',key:'sb_publishable_v-7w6idb5W_3Yn2DBt3Q7A_p4dYAFv7'};   /* Supabase Project URL과 공개용(publishable/anon) key. 이 값이 있으면 모든 플레이어가 자동으로 연결돼요 */
function cloudCfg(){
  try{const q=new URLSearchParams(location.search),u=q.get('api'),k=q.get('key');if(u&&k)return{url:u.trim(),key:k.trim()};}catch(e){}
  try{const s=JSON.parse(lsGet('rk:cloud')||'null');if(s&&s.url&&s.key)return{url:String(s.url).trim(),key:String(s.key).trim()};}catch(e){}
  return{url:String(CLOUD_DEFAULT.url||'').trim(),key:String(CLOUD_DEFAULT.key||'').trim()};
}
function cloudUrl(){const c=cloudCfg();return c.url&&c.key?c.url:'';}
const SYNC={state:'idle'};
function syncText(){
  if(USER&&USER.guest)return '👤 Guest — 기록이 저장되지 않아요';
  if(!cloudUrl())return '💾 이 기기(브라우저)에만 저장돼요';
  return {busy:'☁ 저장 중…',ok:'☁ 클라우드에 저장됨',err:'⚠ 오프라인 — 나중에 다시 저장해요',idle:'☁ 클라우드 연결됨'}[SYNC.state]||'☁ 클라우드 연결됨';
}
function setSync(s){SYNC.state=s;const el=document.getElementById('syncInfo');if(el)el.textContent=syncText();}
async function api(action,params){   /* backend/schema.sql 의 rk_<action> 함수를 호출 */
  const c=cloudCfg();if(!c.url||!c.key)throw new Error('nocloud');
  const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),9000);
  try{
    const res=await fetch(c.url.replace(/\/+$/,'')+'/rest/v1/rpc/rk_'+action,{method:'POST',body:JSON.stringify({p:params||{}}),headers:{'Content-Type':'application/json',apikey:c.key},signal:ctl.signal});
    const j=await res.json();
    if(!j||!j.ok)throw new Error((j&&(j.error||j.message))||'bad_response');
    return j;
  }finally{clearTimeout(to);}
}
let pushT=null,pushBusy=false,dirty=false;
function cloudSoon(){if(!cloudUrl()||!USER)return;dirty=true;clearTimeout(pushT);pushT=setTimeout(cloudPush,900);}
function adoptCloud(r){
  if(mode!=='hub'){pendingCloud=r;return;}
  const d=mergeData(r.data),newSeason=!!(r.season&&r.season!==USER.season);
  d.news=newSeason?'새 시즌이 시작되어 모든 기록이 초기화되었다. 다시 1주차부터!':'다른 기기에서 저장한 최신 기록을 불러왔다.';d.updatedAt=r.updatedAt;
  if(r.season)USER.season=r.season;
  S=d;putLocal();renderHub();
}
async function cloudPush(){
  if(!USER||USER.guest||!cloudUrl()||pushBusy||!dirty)return;
  pushBusy=true;dirty=false;setSync('busy');
  try{
    if(OFFLINE_BASE!==null){
      const r0=await api('load',{id:USER.id,pin:USER.pin});
      const base=OFFLINE_BASE;OFFLINE_BASE=null;
      if(r0.exists&&((r0.updatedAt||0)>base||(r0.season&&r0.season!==USER.season))&&r0.data){adoptCloud(r0);toast('오프라인 동안 서버에 더 새로운 기록이 생겨서 그 기록을 불러왔어요.');setSync('ok');pushBusy=false;return;}
    }
    const was=USER.season;
    const r=await api('save',{id:USER.id,pin:USER.pin,season:USER.season||LEGACY_SEASON,updatedAt:S.updatedAt,data:cloudData()});
    if(r.conflict&&r.data){adoptCloud(r);toast(r.season&&r.season!==was?'새 시즌이 시작되어 기록이 초기화됐어요.':'다른 기기의 더 최신 기록을 불러왔어요.');}
    setSync('ok');
  }catch(e){
    if(e.message==='bad_pin'||e.message==='locked'){setSync('err');toast('클라우드에 등록된 비밀번호와 달라서 저장하지 못했어요. 로그아웃 후 다시 로그인해 주세요.');}
    else{dirty=true;setSync('err');}
  }
  pushBusy=false;
}
setInterval(()=>{if(dirty)cloudPush();},20000);
document.addEventListener('visibilitychange',()=>{if(document.hidden){save();cloudPush();}});
function cloudScore(r){if(!cloudUrl()||!USER||USER.guest)return;api('score',Object.assign({id:USER.id,pin:USER.pin},r)).catch(()=>{});}

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
  toast('Guest로 시작해요. 기록은 저장되지 않아요.');
  maybeShowNotes(false);
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
      lgStep('off');return;
    }
  }
  finishLogin(cloud);
}
function pinFail(msg){lgStep('main');$('#lgMsg').textContent=msg||'ID 또는 비밀번호가 맞지 않아요.';$('#lgPin').value='';try{$('#lgPin').focus();}catch(e){}}
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
  toast(isNew?`${name} 님, 환영해요!`:`${name} 님, 다시 만나서 반가워요!`);
  maybeShowNotes(isNew);
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
  $('#wn').hidden=false;setTimeout(()=>{try{$('#wnOk').focus();}catch(e){}},30);
}
function closeNotes(){$('#wn').hidden=true;if(USER)lsSet(seenKey(),APP_VERSION);}
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

/* ---------- 랭킹 ---------- */
let rankMetric='money';
const RVAL={money:v=>fmt(v)+'원',wins:v=>v+'승',bestPts:v=>v+'점'};
function localTop(metric){
  const out=[];
  lsKeys().filter(k=>k&&k.startsWith('rk:u:')).forEach(k=>{try{const r=JSON.parse(lsGet(k)),d=r.data||{};out.push({id:r.name,money:d.money||0,wins:d.wins||0,bestPts:d.bestPts||0,week:d.week||1,v:d[metric]||0});}catch(e){}});
  out.sort((a,b)=>b.v-a.v);return out.slice(0,10);
}
async function renderRank(){
  document.querySelectorAll('.rtabs [data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===rankMetric));
  $('#rkTab').innerHTML='<tr><td>불러오는 중…</td></tr>';
  let list=null,note='';
  if(cloudUrl()){try{const r=await api('top',{metric:rankMetric,limit:10});list=r.list.map(x=>Object.assign(x,{v:x[rankMetric]}));note='클라우드에 저장된 모든 플레이어 기준 상위 10명이에요.';}catch(e){note='클라우드에 연결할 수 없어 이 기기 기준으로 보여줘요.';}}
  if(!list){list=localTop(rankMetric);if(!note)note='이 기기에 저장된 ID 기준이에요. (클라우드에 연결하면 모든 플레이어가 함께 보여요)';}
  const me=USER?USER.id.toLowerCase():'';
  $('#rkTab').innerHTML=list.length?list.map((x,i)=>`<tr class="${String(x.id).toLowerCase()===me?'me':''}"><td>${i+1}위 ${String(x.id).replace(/[<>&]/g,'')}${x.cleared?' 👑':''}</td><td>${RVAL[rankMetric](x.v)}</td></tr>`).join(''):'<tr><td>아직 기록이 없어요.</td></tr>';
  $('#rkNote').textContent=note;
}
$('#rankBtn').addEventListener('click',()=>{$('#rank').hidden=false;renderSeason();renderRank();});

$('#rkClose').addEventListener('click',()=>{$('#rank').hidden=true;});
document.querySelectorAll('.rtabs [data-m]').forEach(b=>b.addEventListener('click',()=>{rankMetric=b.dataset.m;renderRank();}));

function toast(m){const t=$('#toast');t.innerHTML='';const d=document.createElement('div');d.textContent=m;t.appendChild(d);setTimeout(()=>{if(d.parentNode)d.remove();},2600);}

/* ---------- audio ---------- */
let AC=null,muted=false;
function beep(f,d,type,vol){
  if(muted)return;
  try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();
    const o=AC.createOscillator(),g=AC.createGain(),n=AC.currentTime;
    o.type=type||'square';o.frequency.value=f;g.gain.setValueAtTime(vol||.06,n);
    g.gain.exponentialRampToValueAtTime(.0001,n+(d||.12));o.connect(g);g.connect(AC.destination);o.start(n);o.stop(n+(d||.12));}catch(e){}
}
function cheer(){for(let i=0;i<6;i++)setTimeout(()=>beep(300+Math.random()*500,.12,'sawtooth',.025),i*60);}

/* ---------- input ---------- */
const held={};let pressed={};const mouse={x:W/2,y:H/2,click:false,down:false,mv:false};
const KMAP={KeyW:'ArrowUp',KeyA:'ArrowLeft',KeyS:'ArrowDown',KeyD:'ArrowRight'};
let mode='hub';
function setKey(code,down){if(down&&!held[code])pressed[code]=true;held[code]=down;}
window.addEventListener('keydown',e=>{
  let code=e.code;
  if(mode==='cut'&&code==='KeyS'){pressed.SkipCut=true;e.preventDefault();return;}
  code=KMAP[code]||code;
  if(mode!=='hub'&&(code.startsWith('Arrow')||code==='Space'))e.preventDefault();
  if(mode!=='hub'&&code==='Escape'){askQuit();return;}
  if(!e.repeat)setKey(code,true);else held[code]=true;
});
window.addEventListener('keyup',e=>{held[KMAP[e.code]||e.code]=false;});
window.addEventListener('blur',()=>{Object.keys(held).forEach(k=>held[k]=false);mouse.down=false;});
const cv=$('#cv'),ctx=cv.getContext('2d');
['#pad','#cv','.stagewrap'].forEach(s=>{const el=document.querySelector(s);if(el){el.addEventListener('contextmenu',e=>e.preventDefault());el.addEventListener('selectstart',e=>e.preventDefault());}});
document.querySelectorAll('#pad button').forEach(b=>{b.addEventListener('contextmenu',e=>e.preventDefault());b.addEventListener('touchstart',e=>e.preventDefault(),{passive:false});});
function mpos(e){const r=cv.getBoundingClientRect();mouse.x=(e.clientX-r.left)*W/r.width;mouse.y=(e.clientY-r.top)*H/r.height;}
cv.addEventListener('pointermove',e=>{mpos(e);mouse.mv=true;});
cv.addEventListener('pointerdown',e=>{mpos(e);mouse.click=true;mouse.down=true;mouse.mv=true;});
window.addEventListener('pointerup',()=>{mouse.down=false;});
document.querySelectorAll('#pad [data-k]').forEach(b=>{
  const k=b.dataset.k;
  b.addEventListener('pointerdown',e=>{e.preventDefault();setKey(k,true);});
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,()=>{held[k]=false;}));
});

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

/* ---------- 프리킥 설정 ---------- */
const SPOTS=[
 {label:'정면 13m',bx:0,bz:-13,wall:3},
 {label:'왼쪽 각도 14m',bx:-7,bz:-12,wall:3},
 {label:'오른쪽 각도 14m',bx:7,bz:-12,wall:3},
 {label:'정면 16m',bx:0,bz:-16,wall:4},
 {label:'왼쪽 각도 17m',bx:-10,bz:-14,wall:4},
 {label:'오른쪽 각도 17m',bx:10,bz:-14,wall:4},
 {label:'정면 20m',bx:2,bz:-20,wall:4},
 {label:'왼쪽 먼 각도 22m',bx:-12,bz:-18.5,wall:4},
 {label:'오른쪽 먼 각도 24m',bx:13,bz:-20,wall:5},
 {label:'정면 27m',bx:0,bz:-27,wall:5}
];
const PEN={label:'운명의 페널티킥 11m',bx:0,bz:-11,wall:0,pen:true};
const DIFF=[
 {vk:4.0,kerr:1.5,kread:.15,rk:.30},{vk:4.6,kerr:1.2,kread:.25,rk:.26},
 {vk:5.0,kerr:1.1,kread:.30,rk:.24},{vk:5.4,kerr:1.0,kread:.40,rk:.22},
 {vk:7.2,kerr:.8,kread:.35,rk:.06}
];
const dist0=s=>Math.hypot(s.bx,s.bz);
function buildKicks(){
  const tiers=[[0,1,2],[2,3,4],[4,5,6],[6,7,8,9]],picks=[];let last=0;
  tiers.forEach(tr=>{
    let opts=tr.filter(i=>!picks.includes(i)&&dist0(SPOTS[i])>last+.5);
    if(!opts.length)opts=tr.filter(i=>!picks.includes(i));
    const i=opts[Math.floor(Math.random()*opts.length)];picks.push(i);last=dist0(SPOTS[i]);
  });
  const out=picks.map((si,idx)=>{
    const sp=SPOTS[si];
    const wind=idx>=2&&Math.random()<.6?Math.round((Math.random()<.5?-1:1)*rand(1.0,2.0)*10)/10:0;
    const tip=idx===0?'연습용 킥이에요. 벽은 점프하지 않아요.':wind?'바람이 불어요. 깃발을 봐요.':dist0(sp)>=22?'먼 거리예요. 파워 조절이 중요해요.':'벽이 점프해요. 넘기거나 휘어서 돌려요.';
    return Object.assign({},sp,DIFF[idx],{jump:idx>0,wind,tip,spot:si});
  });
  out.push(Object.assign({},PEN,DIFF[4],{jump:false,wind:0,tip:''}));
  return out;
}
const WALLNAMES=['우룡','룡갈','씨붕','현숭','호우'];
const UPS=[
 {id:'shoes',n:'운동화',d:l=>`파워 게이지의 초록 구간이 넓어져요 (Lv.${l})`,cost:[3000,4000,5000]},
 {id:'snack',n:'간식',d:l=>`킥마다 제한 시간 +${(l+1)*2}초로 (지금 +${l*2}초)`,cost:[2000,3000,4000]},
 {id:'sneak',n:'눈치',d:l=>l?'바람 세기 표시와 바람이 반영된 예상 궤적':'바람 세기 표시, 예상 궤적에 바람 반영',cost:[2500]}
];
const UPMAX={shoes:3,snack:3,sneak:1};

/* ---------- 물리 ---------- */
let K=null,M=null;
function integrate(st,dt,s,ys,wind){
  const g=9.8*(1+.25*ys),vh=Math.hypot(st.vx,st.vz)||1;
  const rx=st.vz/vh,rz=-st.vx/vh,al=s*13;
  st.vx+=(rx*al+wind*K.right.x)*dt;st.vz+=(rz*al+wind*K.right.z)*dt;st.vy-=g*dt;
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
  const g=9.8*(1+.25*ys);let gx=tx,gy=ty,v=null;
  for(let i=0;i<8;i++){
    const dx=gx-ball.x,dz=-ball.z,L=Math.hypot(dx,dz),T=L/26;
    v={vx:dx/L*26,vz:dz/L*26,vy:(gy-ball.y)/T+.5*g*T};
    const r=flight(ball,v,s,ys,0,null,false);
    if(!r.c)break;
    gx+=(tx-r.c.x)*.9;gy+=(ty-r.c.y)*.9;
  }
  return v;
}
function setupKick(i,ko){
  const k=ko||M.kicks[i];K=Object.assign({},k,{i});
  K.ball={x:k.bx,y:.11,z:k.bz};
  const L=Math.hypot(k.bx,k.bz);K.L=L;
  K.dir={x:-k.bx/L,z:-k.bz/L};K.right={x:K.dir.z,z:-K.dir.x};
  K.cam={x:k.bx-K.dir.x*5.5,y:1.05,z:k.bz-K.dir.z*5.5};
  K.wallC={x:k.bx+K.dir.x*9.15,z:k.bz+K.dir.z*9.15};
  K.limit=(i===4?8:12)+2*S.up.snack;K.timer=K.limit;K.lastTick=99;
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
function sweetHalf(){return .05+.015*S.up.shoes;}

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
  if(pressed.Space||pressed.Enter||mouse.click){
    if(C.t*40<full)C.t=full/40+.01;
    else{C.i++;C.t=0;if(C.i>=C.lines.length){endCut();return;}}
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
  {who:'씨붕',text:'오오, 내기다! 판돈 더 걸어! 더!'},
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
  {who:'겨맘',text:'둘 다 다치지 않게 조심해~ 롹순팅 파이팅!'},
  {who:'주스',text:'축구는 내 자존심이야. 세 골이면 네 승. 한 손가락이면 충분하지만.'},
  {who:'ㅈㄱ',text:'…이건 피카츄급 승부야.'},
  RK(`…롹. (판돈 ${fmt(bet)}원)`),
  {who:'주스',text:`${fmt(bet)}원. 좋아. 깨물어버린다!`}]}),
 bet=>({bg:'hall',chars:[{id:'rock',x:190,y:340,s:2.5},{id:'주스',x:560,y:340,s:2.5,arms:'cross'},{id:'현숭',x:690,y:318,s:1.7},{id:'호우',x:80,y:318,s:1.7,flip:true}],lines:[
  {who:'현숭',text:'룰 정리해 줄게. 5킥 중 3골이면 롹순팅 승, 4골이면 완승이야.'},
  {who:'호우',text:'킥 소리에 박자를 맞춰 봐. 리듬이 중요해.'},
  {who:'주스',text:'설명 끝났으면 시작하자. 난 한 손가락이면 돼. 깨물어버린다!'},
  RK(`…롹. (판돈 ${fmt(bet)}원)`),
  {who:'주스',text:`${fmt(bet)}원 확인. 골대는 내가 지킨다.`}]})
];
const INTRO_B=[
 ()=>({bg:'field',chars:[{id:'rock',x:180,y:350,s:2.4,face:'resolve'},{id:'주스',x:660,y:300,s:1.6},{id:'겨맘',x:330,y:312,s:1.6},{id:'히통',x:470,y:318,s:1.6},{id:'주멘',x:560,y:312,s:1.5}],lines:[
  {who:'',text:'땡— 쉬는 시간 10분. 운동장으로 애들이 우르르 모여든다.'},
  {who:'겨맘',text:'롹순팅 파이팅~!'},
  {who:'히통',text:'지면 빌려줄게. 이자는 10%.'},
  {who:'주멘',text:'벽 위치도, 바람 방향도 다 계산해 뒀어. 전부 계획대로야.'},
  {who:'',text:'멀리서 ㅈㄱ가 포켓몬 카드를 만지작거리며 이쪽을 지켜보고 있다.'},
  {who:'주스',text:'벽은 우룡이랑 룡갈이 선다. 시작하자. 깨물어버린다!'}]}),
 ()=>({bg:'field',chars:[{id:'rock',x:180,y:350,s:2.4,face:'resolve'},{id:'주스',x:660,y:300,s:1.6},{id:'씨붕',x:330,y:312,s:1.6},{id:'우룡',x:450,y:318,s:1.6},{id:'룡갈',x:540,y:312,s:1.6},{id:'머호',x:250,y:300,s:1.4}],lines:[
  {who:'',text:'운동장 한가운데에 공이 놓였다. 구경꾼이 점점 늘어난다.'},
  {who:'씨붕',text:'이번 판 크다! 내가 옆에서 판돈 더 키운다?'},
  {who:'머호',text:'세상은 어차피 다 5할이야. 부담 갖지 마~'},
  {who:'우룡',text:'벽은 우리 콤비가 선다!'},
  {who:'룡갈',text:'콤비니까 뚫기 어려울걸?'},
  {who:'주스',text:'시작하자. 한 손가락이면 충분해.'}]}),
 ()=>({bg:'field',chars:[{id:'rock',x:180,y:350,s:2.4,face:'resolve'},{id:'주스',x:660,y:300,s:1.6},{id:'현숭',x:330,y:312,s:1.6},{id:'호우',x:450,y:318,s:1.6},{id:'겨맘',x:550,y:312,s:1.6}],lines:[
  {who:'',text:'땡— 종이 울리자 운동장이 시끌벅적해졌다.'},
  {who:'현숭',text:'오늘 바람은 초속 2미터쯤일 거야. 참고해.'},
  {who:'호우',text:'킥 소리 좋다. 오늘 컨디션 괜찮아 보여.'},
  {who:'겨맘',text:'롹순팅 화이팅!'},
  {who:'',text:'마지막 킥은 페널티 스폿에서 찬다. 운명의 한 방이다.'},
  {who:'주스',text:'준비됐지? 깨물어버린다!'}]}),
 ()=>({bg:'field',chars:[{id:'rock',x:180,y:350,s:2.4,face:'resolve'},{id:'주스',x:660,y:300,s:1.6},{id:'ㅈㄱ',x:330,y:312,s:1.6},{id:'히통',x:450,y:318,s:1.6},{id:'주멘',x:550,y:312,s:1.6}],lines:[
  {who:'',text:'구경꾼들이 운동장 가장자리에 빙 둘러섰다.'},
  {who:'ㅈㄱ',text:'…이 경기, 전설 등급이야. (피카츄 카드를 꺼낸다)'},
  {who:'히통',text:'돈이 모자라면 내 창구로 와. 이자는 10%.'},
  {who:'주멘',text:'A안, B안, C안 다 준비했어. 전부 계획대로야.'},
  {who:'주스',text:'시작하자! 한 손가락이면 돼.'}]})
];
const payLine=(big,bet,bonus)=>big?`…인정. 한 손가락으론 무리였네. 자존심 값으로 ${fmt(bonus)}원 더 얹어 줄게.`:`…한 손가락만 썼으면 막았는데! ${fmt(bet)}원, 가져가. 깨물어버린다!`;
const WIN_CUTS=[
 (big,bet,bonus)=>({bg:'field',confetti:true,chars:[{id:'rock',x:400,y:345,s:2.6,face:'excited',arms:'up',lift:22},{id:'주스',x:640,y:340,s:2.2,arms:'cross'},{id:'주멘',x:210,y:330,s:1.9,arms:'up'},{id:'씨붕',x:300,y:322,s:1.7,arms:'up'},{id:'겨맘',x:520,y:322,s:1.7,arms:'up'}],lines:[
  {who:'주멘',text:'롹순팅이 이기는 것까지 전부 계획대로였어. …아마도.'},
  {who:'겨맘',text:'축하해~!'},
  {who:'주스',text:payLine(big,bet,bonus)}]}),
 (big,bet,bonus)=>({bg:'field',confetti:true,chars:[{id:'rock',x:400,y:345,s:2.6,face:'excited',arms:'up',lift:22},{id:'주스',x:640,y:340,s:2.2,arms:'cross'},{id:'씨붕',x:210,y:330,s:1.9,arms:'up'},{id:'머호',x:300,y:322,s:1.7,arms:'up'},{id:'히통',x:520,y:322,s:1.7}],lines:[
  {who:'씨붕',text:'봤지?! 내가 롹순팅한테 걸었어! (걸지 않았음)'},
  {who:'머호',text:'세상은 어차피 다 5할인데, 오늘은 롹순팅 쪽이 컸네!'},
  {who:'히통',text:'이자 없이 축하해 줄게. 오늘만이야.'},
  {who:'주스',text:payLine(big,bet,bonus)}]}),
 (big,bet,bonus)=>({bg:'field',confetti:true,chars:[{id:'rock',x:400,y:345,s:2.6,face:'excited',arms:'up',lift:22},{id:'주스',x:640,y:340,s:2.2,arms:'cross'},{id:'ㅈㄱ',x:210,y:330,s:1.9},{id:'현숭',x:300,y:322,s:1.7},{id:'호우',x:520,y:322,s:1.7,arms:'up'}],lines:[
  {who:'ㅈㄱ',text:'…메가진화급이었어.'},
  {who:'현숭',text:'통계상 낮은 확률인데… 대단해.'},
  {who:'호우',text:'킥 소리가 화음이었어. 축하해.'},
  {who:'주스',text:payLine(big,bet,bonus)}]}),
 (big,bet,bonus)=>({bg:'field',confetti:true,chars:[{id:'rock',x:400,y:345,s:2.6,face:'excited',arms:'up',lift:22},{id:'주스',x:640,y:340,s:2.2,arms:'cross'},{id:'우룡',x:210,y:330,s:1.9},{id:'룡갈',x:300,y:322,s:1.7},{id:'겨맘',x:520,y:322,s:1.7,arms:'up'}],lines:[
  {who:'우룡',text:'우리 콤비 벽이 뚫렸어…!'},
  {who:'룡갈',text:'체육대회 때 복수하자, 우룡!'},
  {who:'겨맘',text:'롹순팅 최고~! 진짜 멋졌어!'},
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
  {who:'씨붕',text:'판돈 두 배로 갔어야 재밌었는데!'},
  RK('…롹.','frustrated')]}),
 ()=>({bg:'canteen',chars:[{id:'rock',x:230,y:340,s:2.5,face:'frustrated'},{id:'주스',x:570,y:340,s:2.5,item:'bread'},{id:'겨맘',x:100,y:320,s:1.5},{id:'히통',x:410,y:262,s:1.5},{id:'주멘',x:690,y:320,s:1.5}],lines:[
  {who:'겨맘',text:'롹순팅 괜찮아? 다음엔 꼭 이길 거야!'},
  {who:'히통',text:'주스 키퍼 재능있네.'},
  {who:'주멘',text:'주스 이제 키퍼만해라.'},
  {who:'주스',text:'들었냐? 앙~!'}]}),
 ()=>({bg:'canteen',chars:[{id:'rock',x:230,y:340,s:2.5,face:'frustrated'},{id:'주스',x:570,y:340,s:2.5,item:'bread'},{id:'ㅈㄱ',x:100,y:320,s:1.5},{id:'현숭',x:410,y:262,s:1.5},{id:'우룡',x:690,y:320,s:1.5}],lines:[
  {who:'ㅈㄱ',text:'…고라파덕 같은 표정이야.'},
  {who:'현숭',text:'주스 키퍼 재능있네. 선방률이 높았어.'},
  {who:'우룡',text:'주스 이제 키퍼만해라.'},
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
 겨맘:{goal:['꺄악~ 롹순팅 최고!','축하해! 너무 잘했어~','와아~ 나 눈물 나!'],save:['괜찮아~ 다음엔 꼭 들어가!','아깝다! 그래도 잘했어~','힘내 롹순팅!'],post:['앗! 골대! 진짜 아까웠어~','한 뼘만 더!'],wall:['괜찮아, 벽이 너무 컸어~','다치지 않았지? 다시 하자!'],miss:['괜찮아 괜찮아~','실수해도 멋졌어!','다음 킥 응원할게~']},
 ㅈㄱ:{goal:['피카피카!','…메가진화급.','…(피카츄 카드를 번쩍 든다)'],save:['고라파덕…','…파이리가 불을 뿜었어야 했는데.','…(잠만보처럼 멍하니 본다)'],post:['…이상해씨급으로 아깝다.','…(꼬부기 카드를 만지작)'],wall:['…벽이 강철이야.','…롱스톤 같아.'],miss:['…이건 잠만보야.','…버터플처럼 날아갔네.']},
 우룡:{goal:['헉, 뚫렸다!','룡갈! 우리 벽이!'],wall:['룡갈, 방어 성공!','콤비 만세!'],save:['주스 대박!'],miss:['우린 끄떡없어!']},
 룡갈:{goal:['우룡, 우리 뚫렸어!','콤비의 수치…!'],wall:['콤비 방어 성공!','우룡, 나이스!'],save:['역시 주스!'],miss:['우리가 막을 필요도 없었네!']},
 씨붕:{goal:['이 골에 판돈 더 걸걸!','헉! 판돈 키울걸!'],wall:['내가 막았다! 판돈 더 걸어!','벽이 이겼다!'],save:['주스한테 걸걸 그랬나?','판돈 두 배!'],miss:['판돈 더 걸어! 더!']},
 현숭:{goal:['통계상 낮은 확률인데…','풍속을 계산했는데도?'],wall:['벽 높이를 생각하면 당연해.','풍속 고려하면 예상대로야.'],save:['역시 확률대로야.','선방률 상승 중.'],miss:['각도가 3도 어긋났어.']},
 호우:{goal:['킥 소리가 화음이었어.','좋은 리듬이야!'],wall:['쿵. 낮은 도 소리네.'],save:['…불협화음.','박자가 반 박자 늦었어.'],miss:['음이 빗나갔네.']}
};
const KEEPER={goal:['깨물어버린다!!','한 손가락만 썼으면…','내 자존심이…!'],save:['한 손가락이면 충분해','앙~! 못 지나가','내 자부심은 안 뚫려'],post:['아슬아슬! 골대가 도왔다!','한 손가락으로도 막았을 거야!'],wall:['벽이 막았네. 난 구경만 했다.'],miss:['골대 밖이잖아. 깨물어버린다!','한 손가락도 안 썼다.']};
const CHAT={
 주스:['오늘도 프리킥 받아줄게. 깨물어버린다!','한 손가락 스트레칭 중이야.','내 자존심은 골대 크기만 해.'],
 머호:['세상은 어차피 다 5할이야!','급식 맛있을 확률? 5할이야.','시험 찍기도 5할이지.'],
 주멘:['이번 주 일정표 다 짜놨어. 전부 계획대로야.','수요일 3교시 매점 줄이 짧을 확률까지 계산해 놨어.','계획표에 없는 일은 없어… 없었어… 아마도.'],
 씨붕:['판돈 더 걸어! 재미는 판돈 크기에 비례해!','나 어제 10만 원 딸 뻔했어. (뻔했음)','내가 큰손이라고 소문 좀 내줘.'],
 히통:['돈 빌려줄게. 이자는 10%.','이자는 복리가 아니라 단리야. 착하지?','지갑 얇아졌어? 내 창구는 언제나 열려 있어.'],
 겨맘:['롹순팅 오늘도 파이팅~!','밥은 먹었어? 힘내야지!','무리하지 말고, 쉬는 시간엔 쉬어~'],
 ㅈㄱ:['…어제 희귀 포켓몬 카드를 뽑았어.','…피카츄가 제일 좋아.','…(말없이 이상해씨 카드를 내민다)'],
 현숭:['시험 범위 다시 확인해 봤어?','오늘 바람은 초속 2미터쯤일 거야.'],
 호우:['오늘 쉬는 시간 종소리가 반음 높았어.','피아노 소리를 들으면 마음이 편해져.'],
 우룡:['룡갈이랑 체육대회 준비 중!','콤비가 있으면 뭐든 반으로 줄어!'],
 룡갈:['우룡이랑 나는 콤비!','체육대회에선 우리가 이긴다.']
};
function randChat(){const n=pick(Object.keys(CHAT));return{n,t:pick(CHAT[n])};}
let chatCur=randChat();

/* ---------- 매치 흐름 ---------- */
let quitAsk=0;
function showGame(g){$('#hub').hidden=g;$('#gameWrap').hidden=!g;$('#pad').classList.toggle('on',g);document.body.classList.toggle('playing',g);window.scrollTo(0,0);}
function startMatch(bet){
  M={bet,goals:0,pts:0,res:[],before:S.money,kicks:buildKicks()};
  showGame(true);$('#ovSet').hidden=true;pressed={};mouse.click=false;
  playCut(introA(bet),()=>playCut(introB(),()=>startKick(0)));
}
function startKick(i){setupKick(i);M.k=i;mode='kick';pressed={};mouse.click=false;$('#gCtrl').textContent='조준 → 공 맞힐 위치 → 파워';}
function askQuit(){
  const now=performance.now();
  if(now-quitAsk<3000){forfeit();return;}
  quitAsk=now;toast('한 번 더 누르면 포기해요. 판돈은 잃어요.');
}
function forfeit(){
  if(mode==='hub'||mode==='settle')return;
  C=null;$('#skip').hidden=true;M.forfeit=true;M.goals=0;settle();
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
  if(win)S.wins++;else S.losses++;
  S.bestPts=Math.max(S.bestPts||0,M.pts||0);S.plays=(S.plays||0)+1;
  const weekend=advanceDay();
  if(S.money>=1000000&&!S.cleared){S.cleared=true;S.news='🎉 100만 원 달성! (엔딩 애니메이션은 다음 업데이트에서 만나요)';}
  save();
  cloudScore({bet:M.bet,goals:M.goals,pts:M.pts,result:M.forfeit?'포기':big?'완승':win?'승리':'패배',money:S.money,week:S.week});
  $('#sT').textContent=M.forfeit?'포기…':big?'완승!':win?'승리!':'패배…';
  $('#sImg').src=IMGDATA[big?'excited':win?'happy':'frustrated'];
  $('#sTab').innerHTML=`<tr><td>결과</td><td>${M.goals}골 / 5킥</td></tr><tr><td>점수</td><td>${M.pts}점</td></tr>`+
    `<tr><td>판돈</td><td class="${win?'plus':'minus'}">${win?'+':'-'}${fmt(M.bet)}원</td></tr>`+(big?`<tr><td>완승 보너스</td><td class="plus">+${fmt(bonus)}원</td></tr>`:'')+
    `<tr><td>소지금</td><td>${fmt(before)} → ${fmt(S.money)}원</td></tr>`;
  $('#sX').textContent=weekend?`주말이 됐다. 부모님이 용돈 1만 원을 주셨다! (${S.week}주차 월요일)`:`내일은 ${DAYS[S.day]}요일.`;
  $('#ovSet').hidden=false;
}
function advanceDay(){
  S.day++;
  if(S.day>=5){S.day=0;S.week++;S.money+=10000;S.news=`${S.week-1}주차가 끝났다. 주말에 부모님이 용돈 1만 원을 주셨다. (${S.week}주차 월요일)`;return true;}
  S.news=`${DAYS[S.day]}요일이 밝았다.`;return false;
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
    const A=3+K.i*2.5+(K.pen?4:0);K.sw.x=Math.sin(K.t*1.9)*A;K.sw.y=Math.cos(K.t*2.6)*A*.7;
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
      K.s=K.spin.x;K.ys=-K.spin.y;K.ph='power';K.t=0;K.p=0;K.armed=false;K.charging=false;beep(600,.08,'triangle',.07);
    }
  }else if(K.ph==='power'){
    const down=held.Space||mouse.down;
    if(!K.armed){if(!down)K.armed=true;}
    else if(!K.charging){if(down)K.charging=true;}
    else{if(down){K.p=Math.min(1,K.p+dt*.7);K.face=K.p>.6?'angry':'resolve';}else{fire();return;}}
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
  const f=.55+.6*K.p,v={vx:v0.vx*f,vy:v0.vy*f,vz:v0.vz*f};
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
  beep(140,.14,'triangle',.12);
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
    cheer();K.flash=.5;K.face='excited';K.celeb=0;K.fwT=0;
    for(let i=0;i<70;i++)K.conf.push({x:rand(0,W),y:rand(-260,0),vx:rand(-40,40),vy:rand(100,200),a:rand(0,6),c:['#e2334d','#e8a91c','#2f8f5b','#3b7de0','#fff'][Math.floor(rand(0,5))]});
  }
  else if(o==='save'){
    beep(120,.2,'sawtooth',.1);K.face='frustrated';
    if(Math.random()<.6){const who=sp[0];K.react=K.react.filter(r=>r.n!==who.n);say(who.n,who.x,who.z,Math.random()<.5?'주스 키퍼 재능있네':'주스 이제 키퍼만해라');}
  }
  else if(o==='post'){beep(1200,.3,'sine',.1);K.face='surprise';}
  else if(o==='wall'){beep(90,.2,'sawtooth',.1);K.face='panic';}
  else K.face='frustrated';
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
  const wind=S.up.sneak>0?K.wind:0,v=solve(K.ball,K.aim.tx,K.aim.ty,K.spin.x,-K.spin.y),fr=flight(K.ball,v,K.spin.x,-K.spin.y,wind,null,true);
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
  const wt=S.up.sneak>0?`바람 ${K.wind===0?'없음':(K.wind>0?'→ ':'← ')+(Math.abs(K.wind)*2).toFixed(1)+'m/s'}`:'바람: 깃발을 봐';
  TX(c,wt,W-16,68,16,'#fff','right','rgba(0,0,0,.5)');
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
  if(K.ph==='res'||(K.ph==='fly'&&K.pt>=K.tEvt&&K.result)){
    if(K.result){const q=K.ph==='res'?Math.min(1,K.t*5):1;c.save();c.translate(W/2,205);c.scale(.6+.4*q,.6+.4*q);TX(c,K.result.title,0,0,54,'#fff','center',K.result.col);TX(c,K.result.sub,0,48,22,'#fff','center','rgba(0,0,0,.6)');c.restore();}
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
}

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
  $('#ups').innerHTML=UPS.map(u=>{const lv=S.up[u.id],mx=lv>=UPMAX[u.id],p=u.cost[lv];
    return `<div class="row"><div><h3>${u.n} <small>Lv.${lv}</small></h3><p>${mx?'최대 레벨':u.d(lv)}</p></div><button class="go alt" data-up="${u.id}" ${mx||S.money<p?'disabled':''}>${mx?'MAX':fmt(p)+'원'}</button></div>`;}).join('');
}
function toHub(){mode='hub';if(pendingCloud){const r=pendingCloud;pendingCloud=null;adoptCloud(r);}chatCur=randChat();C=null;K=null;$('#skip').hidden=true;$('#ovSet').hidden=true;showGame(false);renderHub();}
function dayAction(msg,gain,job){
  if(gain)S.money+=gain;
  if(job)S.fatigue=(S.fatigue||0)+1;else S.fatigue=Math.max(0,(S.fatigue||0)-1);
  chatCur=randChat();
  advanceDay();S.news=msg+' '+S.news;
  if(job&&S.fatigue>=3){hospitalize();return;}
  if(job&&S.fatigue===2)S.news+=' 몸이 무겁다… 알바를 또 하면 쓰러질지도 모른다.';
  if(S.money>=1000000&&!S.cleared){S.cleared=true;S.news='🎉 100만 원 달성! (엔딩 애니메이션은 다음 업데이트에서 만나요)';}
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
  const weekend=S.week>wk;const v=pick(VISIT);
  S.news=`과로로 이틀 입원했다. 병원비 ${fmt(paid)}원이 나갔다.`+(weekend?` 주말이 지나 부모님이 용돈 1만 원을 주셨다. (${S.week}주차 ${DAYS[S.day]}요일)`:` (${DAYS[S.day]}요일)`);
  const pages=[
    {img:'worn',title:'과로로 쓰러졌다…',text:'매점 알바를 쉬지 않고 이어서 하다가, 계산대 앞에서 그대로 쓰러지고 말았다.'},
    {img:'sad',title:'병원에서 눈을 떴다',who:v.n,text:v.t},
    {img:'frustrated',title:'병원비 정산',text:`병원비 ${fmt(fee)}원이 나갔다. (소지금 ${fmt(before)} → ${fmt(afterFee)}원)`+(short>0?` 모자란 ${fmt(short)}원은 부모님이 내주셨다. 잔소리 한 바가지…`:'')+` 이틀을 병원에서 보냈다.`+(weekend?' 그 사이 주말이 지나 용돈 1만 원이 들어왔다.':'')+' 알바는 쉬엄쉬엄 하자.'}
  ];
  save();
  showStory(pages,()=>{chatCur=randChat();renderHub();});
}
let STORY=null;
function showStory(pages,done){STORY={pages,i:0,done};renderStory();$('#story').hidden=false;}
function renderStory(){const p=STORY.pages[STORY.i];$('#stT').textContent=p.title;$('#stImg').src=IMGDATA[p.img||'base'];$('#stN').textContent=p.who?`${p.who}:`:'';$('#stX').textContent=p.text;$('#stBtn').textContent=STORY.i>=STORY.pages.length-1?'확인':'다음';}
$('#stBtn').addEventListener('click',()=>{if(!STORY)return;STORY.i++;if(STORY.i>=STORY.pages.length){$('#story').hidden=true;const d=STORY.done;STORY=null;d&&d();}else renderStory();});
$('#bMinus').addEventListener('click',()=>{betV=Math.max(1000,betV-100);renderHub();});
$('#bPlus').addEventListener('click',()=>{betV=Math.min(betMax(),betV+100);renderHub();});
$('#bBig').addEventListener('click',()=>{betV=Math.min(betMax(),betV+500);renderHub();});
$('#acceptBtn').addEventListener('click',()=>{if(S.money>=1000)startMatch(betV);});
$('#passBtn').addEventListener('click',()=>dayAction('오늘은 조용히 지나갔다.',0,false));
$('#jobBtn').addEventListener('click',()=>dayAction('머호가 소개해 준 매점 심부름으로 600원을 벌었다.',600,true));
$('#ups').addEventListener('click',e=>{
  const b=e.target.closest('[data-up]');if(!b||b.disabled)return;
  const u=UPS.find(x=>x.id===b.dataset.up),lv=S.up[u.id],p=u.cost[lv];
  if(lv>=UPMAX[u.id]||S.money<p)return;S.money-=p;S.up[u.id]++;save();renderHub();
});
$('#sBtn').addEventListener('click',toHub);
$('#skip').addEventListener('click',()=>{if(mode==='cut')pressed.SkipCut=true;});
$('#quit').addEventListener('click',askQuit);
$('#mute').addEventListener('click',function(){muted=!muted;this.textContent=muted?'소리 켜기':'소리 끄기';});
const MSGS=['오늘도 학교에서 살아남자.','주스의 빵 값은 내가 지킨다.','롹!','쉬는 시간이 10분뿐이라니.','히통 이자가 10%였지…'];
$('#bigface').addEventListener('click',function(){this.src=IMGDATA[FACES[Math.floor(Math.random()*FACES.length)]];$('#bigmsg').textContent=MSGS[Math.floor(Math.random()*MSGS.length)];});
window.addEventListener('pagehide',()=>{save();});

/* ---------- 스플래시: 롹순팅 등교 애니메이션 + Press Enter ---------- */
const SP={on:false,t:0,raf:0,last:0,ctx:$('#spCv').getContext('2d')};
const SP_WALK=4.6,SP_END=5.2;   /* 걷기 끝(초), 문으로 들어간 뒤 Press Enter가 나오는 시점(초) */
function spDraw(c,t){
  skyField(c);
  c.fillStyle='#6bb56f';c.fillRect(0,HOR,W,46);
  c.fillStyle='#d8d0bd';c.fillRect(0,HOR+46,W,H-HOR-46);
  c.fillStyle='rgba(0,0,0,.08)';c.fillRect(0,HOR+46,W,4);
  c.fillStyle='#e6dfcd';c.beginPath();c.moveTo(372,HOR);c.lineTo(428,HOR);c.lineTo(600,H);c.lineTo(200,H);c.closePath();c.fill();
  c.fillStyle='#6d1f31';rr(c,372,HOR-58,56,58,4);c.fill();
  c.fillStyle='#e8a91c';c.beginPath();c.arc(418,HOR-28,3,0,7);c.fill();
  c.fillStyle='#b5a891';c.fillRect(366,HOR,68,6);
  TX(c,'롹순팅 키우기',W/2,38,50,'#fff','center','#6d1f31');
  TX(c,'v'+APP_VERSION,W/2,H-16,16,'#fff','center','rgba(35,42,69,.85)');
  const p1=clamp(t/2.4,0,1),p2=clamp((t-2.4)/(SP_WALK-2.4),0,1);
  let x,y,s,face;
  if(t<2.4){x=-40+440*p1;y=H-46;s=2.6;face='tired';}
  else{x=400;y=(H-46)+(HOR+4-(H-46))*p2;s=2.6-1.2*p2;face='resolve';}
  if(t<SP_END){
    c.save();c.globalAlpha=t<SP_WALK?1:clamp(1-(t-SP_WALK)/(SP_END-SP_WALK),0,1);
    kid(c,x,y,s,{face,run:t<SP_WALK,ph:t*11});
    c.restore();
  }
  if(t>=SP_END){
    const a=.7+.3*Math.sin((t-SP_END)*4.5);
    c.save();c.globalAlpha=clamp((t-SP_END)*3,0,1)*a;
    TX(c,'Press ENTER',W/2,H-90,44,'#fff','center','#232a45');c.restore();
    c.save();c.globalAlpha=clamp((t-SP_END)*3,0,1);TX(c,'(화면을 눌러도 돼요)',W/2,H-48,18,'#fff','center','rgba(35,42,69,.8)');c.restore();
  }
}
function spFrame(now){
  if(!SP.on)return;
  SP.raf=requestAnimationFrame(spFrame);
  const dt=Math.min(.05,(now-SP.last)/1000);SP.last=now;SP.t+=dt;
  try{spDraw(SP.ctx,SP.t);}catch(e){console.error(e);}
}
function showSplash(){
  SP.on=true;SP.t=0;SP.last=performance.now();$('#splash').hidden=false;
  try{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)SP.t=SP_END;}catch(e){}
  SP.raf=requestAnimationFrame(spFrame);
}
function spNext(){
  if(!SP.on)return;
  if(SP.t<SP_END){SP.t=SP_END;return;}   /* 걷는 중에 누르면 바로 Press ENTER 화면으로 */
  SP.on=false;cancelAnimationFrame(SP.raf);$('#splash').hidden=true;
  setTimeout(()=>{try{$('#lgToLogin').focus();}catch(e){}},30);
}
window.addEventListener('keydown',e=>{if(SP.on&&(e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();spNext();}},true);
$('#splash').addEventListener('pointerdown',spNext);

/* ---------- 메인 루프 ---------- */
let last=performance.now(),errN=0;
function recover(){
  toast('오류가 나서 다음 장면으로 넘어갈게요.');
  try{
    if(mode==='cut'&&C){endCut();return;}
    if(mode==='kick'&&K){if(!M.res[K.i])M.res[K.i]={type:'error',pts:0,title:'',sub:''};nextKick();return;}
    if(mode==='settle'){toHub();}
  }catch(e){console.error(e);toHub();}
}
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000);last=now;
  try{
    if(mode==='cut'&&C){updateCut(dt);if(C)drawCut(ctx);}
    else if(mode==='kick'||mode==='settle'){if(mode==='kick')updateKick(dt);if(K)drawKick(ctx);}
    errN=0;
  }catch(e){console.error(e);if(++errN>=5){errN=0;recover();}}
  pressed={};mouse.click=false;mouse.mv=false;
}
/* ---------- 1:1 페널티킥 대결 (backend/schema.sql 의 rk_duel_*) ----------
   피파 온라인 방식: 슈터는 골대 안을 자유롭게 조준하고 파워 게이지를 맞춰 차요. 골키퍼는 다이브 방향을 골라요.
   판정은 전부 서버가 해요. 브라우저는 선택을 보내고, 결과를 받아 애니메이션만 보여줘요.
   골대 좌표: x -1(왼쪽 골포스트)~1(오른쪽), y 0(바닥)~1(크로스바). 밖으로 나가면 빗나가요. */
const DU={code:null,st:null,shown:0,anim:null,open:false,poll:0,raf:0,last:0,left:0,leftAt:0,pickedRound:-1,pickIdx:-1,fail:0,ctx:null,lastMsg:'',msgBase:'',
  aim:{x:0,y:.55},ph:'aim',gt:0,gv:0,sent:null,round:-1};
const duOk=()=>!!(USER&&!USER.guest&&cloudUrl());
const DU_ERR={bad_pin:'비밀번호가 맞지 않아요.',locked:'비밀번호를 여러 번 틀려서 잠겼어요. 잠시 후 다시 시도해 주세요.',no_room:'그런 코드의 방이 없어요.',full:'이미 시작한 방이에요.',closed:'이미 끝난 방이에요.',busy:'이미 참여 중인 대결이 있어요. "방 만들기"를 누르면 그 방으로 돌아가요.',no_user:'클라우드에 등록된 ID가 아니에요. 잠시 후 다시 시도해 주세요.',not_member:'이 방의 참가자가 아니에요.'};
const DU_ZN=['위 왼쪽','위 가운데','위 오른쪽','아래 왼쪽','아래 가운데','아래 오른쪽'];
const DU_SWEET=[.72,.88];   /* 게이지 초록 구간 (서버는 파워 0.8에서 오차가 가장 작아요) */
const DU_RES={goal:'GOAL!',saved:'SAVE!',post:'POST!',miss:'빗나갔다!'};
const duEsc=s=>String(s==null?'':s).replace(/[<>&"]/g,'');
const duX=n=>240+180*n,duY=n=>200-150*n,duNx=x=>(x-240)/180,duNy=y=>(200-y)/150;
function renderDuelCard(){
  const ok=duOk();$('#duMake').disabled=!ok;$('#duJoin').disabled=!ok;$('#duCode').disabled=!ok;
  $('#duNote').textContent=ok?'':(USER&&USER.guest?'Guest는 대결할 수 없어요. 로그인해 주세요.':'클라우드에 연결되어 있어야 대결할 수 있어요.');
}
const duCall=(a,x)=>api('duel_'+a,Object.assign({id:USER.id,pin:USER.pin,code:DU.code},x));
async function duEnter(action,code){
  if(!duOk())return;
  $('#duMake').disabled=true;$('#duJoin').disabled=true;$('#duNote').textContent='';
  DU.code=code||null;
  let err='';
  try{duStart(await duCall(action));}
  catch(e){DU.code=null;err=DU_ERR[e.message]||'연결에 실패했어요. 잠시 후 다시 시도해 주세요.';}
  renderDuelCard();
  if(err)$('#duNote').textContent=err;
}
$('#duMake').addEventListener('click',()=>duEnter('create'));
$('#duJoin').addEventListener('click',()=>{
  const c=$('#duCode').value.trim().toUpperCase();
  if(!/^[A-Z2-9]{4}$/.test(c)){$('#duNote').textContent='코드는 영문/숫자 4자리예요.';return;}
  duEnter('join',c);
});
$('#duCode').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#duJoin').click();}});
function duStart(st){
  DU.code=st.code;DU.st=st;DU.shown=st.hist.length;DU.anim=null;DU.pickedRound=-1;DU.pickIdx=-1;DU.fail=0;DU.open=true;
  DU.round=-1;DU.sent=null;
  DU.left=st.left;DU.leftAt=performance.now();
  $('#duel').hidden=false;
  try{document.activeElement.blur();}catch(e){}   /* Space가 포커스된 버튼을 누르지 않게 */
  if(!DU.ctx)DU.ctx=$('#duCv').getContext('2d');
  cancelAnimationFrame(DU.raf);DU.last=performance.now();DU.raf=requestAnimationFrame(duFrame);
  duRender();duPoll();
}
function duPoll(){
  clearTimeout(DU.poll);if(!DU.open)return;
  DU.poll=setTimeout(async()=>{
    try{duGot(await duCall('state'));DU.fail=0;}catch(e){duErr(e);}
    duPoll();
  },1600);
}
function duGot(st){
  if(!DU.open)return;
  if(DU.st&&st.hist.length<DU.st.hist.length)return;   /* 늦게 도착한 옛 응답은 무시 */
  DU.st=st;DU.left=st.left;DU.leftAt=performance.now();duRender();
}
function duErr(e){
  const m=e&&e.message;
  if(m==='no_room'||m==='not_member'||m==='closed'||m==='bad_pin'||m==='locked'||m==='no_user'){toast(DU_ERR[m]||'대결이 끝났어요.');duClose(false);return;}
  if(++DU.fail>=2)$('#duMsg').textContent='연결이 불안정해요. 다시 시도하는 중…';
}
function duClose(leave){
  const code=DU.code,st=DU.st;
  DU.open=false;clearTimeout(DU.poll);cancelAnimationFrame(DU.raf);$('#duel').hidden=true;
  if(leave&&code&&st&&st.status!=='done')api('duel_leave',{id:USER.id,pin:USER.pin,code}).catch(()=>{});
  DU.code=null;DU.st=null;DU.anim=null;
}
$('#duLeave').addEventListener('click',()=>{
  const st=DU.st;if(!st)return;
  if(st.status==='playing'&&!confirm('지금 나가면 몰수패예요. 나갈까요?'))return;
  duClose(true);
});
$('#duCopy').addEventListener('click',()=>{
  const c=DU.code||'';
  try{navigator.clipboard.writeText(c).then(()=>toast('코드를 복사했어요.'),()=>toast('코드: '+c));}catch(e){toast('코드: '+c);}
});
const duZ=$('#duZones'),duCv=$('#duCv');
for(let i=0;i<6;i++){const b=document.createElement('button');b.type='button';b.textContent=String(i+1);b.setAttribute('aria-label','다이브: '+DU_ZN[i]);b.addEventListener('click',()=>duPick(i));duZ.appendChild(b);}
/* 지금 내가 할 수 있는 행동: 슈터(kick) 또는 골키퍼(keep). 결과 애니메이션 중이거나 이미 제출했으면 없어요. */
function duCan(role){const st=DU.st;return !!(DU.open&&st&&st.status==='playing'&&!DU.anim&&DU.shown===st.hist.length&&st.role===role&&!st.mine&&DU.pickedRound!==st.round);}
const duCanShoot=()=>duCan('kick'),duCanPick=()=>duCan('keep');
/* 슈터: 1) 조준(마우스/방향키) → 클릭/Space로 확정 2) 게이지가 초록 구간일 때 다시 클릭/Space → 발사 */
function duAct(){
  if(!duCanShoot())return;
  if(DU.ph==='aim'){DU.ph='power';DU.gt=0;DU.gv=0;duRender();return;}
  if(DU.ph==='power')duShoot(Math.round(DU.gv*1000)/1000);
}
async function duShoot(pw){
  const st=DU.st,a={x:Math.round(DU.aim.x*1000)/1000,y:Math.round(DU.aim.y*1000)/1000};
  DU.pickedRound=st.round;DU.sent={x:a.x,y:a.y,p:pw};duRender();
  try{duGot(await duCall('pick',{round:st.round,ax:a.x,ay:a.y,pw}));DU.fail=0;}
  catch(e){DU.pickedRound=-1;DU.sent=null;DU.ph='aim';duErr(e);duRender();}
}
/* 골키퍼: 다이브할 칸 고르기 */
async function duPick(i){
  if(!duCanPick())return;
  const st=DU.st;DU.pickedRound=st.round;DU.pickIdx=i;duRender();
  try{duGot(await duCall('pick',{round:st.round,pick:i}));DU.fail=0;}
  catch(e){DU.pickedRound=-1;DU.pickIdx=-1;duErr(e);duRender();}
}
function duPos(e){const r=duCv.getBoundingClientRect();return{x:(e.clientX-r.left)*480/r.width,y:(e.clientY-r.top)*300/r.height};}
function duSetAim(e){const p=duPos(e);DU.aim.x=clamp(duNx(p.x),-1.2,1.2);DU.aim.y=clamp(duNy(p.y),0,1.25);}
duCv.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&duCanShoot()&&DU.ph==='aim')duSetAim(e);});
duCv.addEventListener('pointerdown',e=>{if(duCanShoot()&&DU.ph==='aim')duSetAim(e);});
duCv.addEventListener('click',duAct);
window.addEventListener('keydown',e=>{
  if(!DU.open||e.ctrlKey||e.metaKey||e.altKey)return;
  if(/^[1-6]$/.test(e.key)){if(!e.repeat)duPick(+e.key-1);return;}
  if(e.code==='Space'||e.key==='Enter'){if(duCanShoot()){e.preventDefault();if(!e.repeat)duAct();}}
  else if(e.code.startsWith('Arrow')&&duCanShoot())e.preventDefault();
});
function duSide(el,name,me,hist,side,goals){
  const ks=hist.filter(h=>h.k===side).map(h=>h.r==='goal'?'●':'✕');
  while(ks.length<5)ks.push('○');
  el.className='dside'+(me?' me':'');
  el.innerHTML=`<b>${duEsc(name)}${me?' (나)':''}</b><span class="n">${goals}</span><div class="dots" aria-label="${ks.join(' ')}">${ks.join(' ')}</div>`;
}
function duRender(){
  const st=DU.st;if(!st||!DU.open)return;
  const wait=st.status==='waiting';
  $('#duWait').hidden=!wait;$('#duPlay').hidden=wait;
  $('#duCodeBig').textContent=st.code;
  $('#duT').textContent=wait?'상대를 기다리는 중':'1:1 페널티킥 대결';
  if(wait){$('#duLeave').textContent='방 닫기';return;}
  if(DU.round!==st.round){DU.round=st.round;DU.ph='aim';DU.gt=0;DU.gv=0;DU.sent=null;}   /* 새 킥이 시작되면 조준부터 */
  if(!DU.anim&&DU.shown<st.hist.length){DU.anim={h:st.hist[DU.shown],t:0};DU.shown++;}
  const hs=st.hist.slice(0,DU.shown);
  let hg=0,gg=0;hs.forEach(h=>{if(h.r==='goal'){if(h.k==='host')hg++;else gg++;}});
  duSide($('#duS0'),st.host,st.me==='host',hs,'host',hg);
  duSide($('#duS1'),st.guest,st.me==='guest',hs,'guest',gg);
  const live=!DU.anim&&DU.shown===st.hist.length;
  const done=live&&st.status==='done';
  $('#duLeave').textContent=done?'닫기':'포기하고 나가기';
  $('#duRound').textContent=done?'경기 종료':DU.shown<10?`${Math.floor(DU.shown/2)+1}번째 킥 / 5`:'서든데스';
  const canK=duCanPick();
  duZ.style.display=st.role==='keep'&&!done?'':'none';   /* 다이브 칸은 골키퍼일 때만. 슈터는 캔버스에서 직접 조준해요 */
  [...duZ.children].forEach((b,i)=>{b.disabled=!canK;b.classList.toggle('sel',DU.pickedRound===st.round&&DU.pickIdx===i&&!DU.anim);});
  duCv.style.cursor=duCanShoot()&&DU.ph==='aim'?'crosshair':'default';
  $('#duTip').hidden=done;
  $('#duTip').textContent=st.role==='kick'?'마우스(또는 방향키)로 조준 → 클릭/Space로 확정 → 게이지가 초록 구간일 때 다시 클릭! 골대 밖은 빗나가요.':'다이브할 방향을 고르세요. 칸을 누르거나 숫자키 1~6 (위쪽 1·2·3, 아래쪽 4·5·6)';
  let msg='';
  if(done){
    const w=st.winner,mine=st.me;
    if(w==='draw')msg='🤝 무승부예요.';
    else if(w===mine)msg=st.reason==='left'?'🏆 상대가 나가서 승리했어요!':'🏆 승리! 축하해요!';
    else msg=st.reason==='left'?'😢 자리를 비워서 패배했어요.':'😢 아쉽게 패배했어요.';
    msg+=`  (${hg} : ${gg})`;
  }else if(live){
    if(duCanShoot())msg=DU.ph==='aim'?'🎯 슛할 곳을 조준하세요!':'⚡ 초록 구간에서 클릭!';
    else if(canK)msg='🧤 다이브할 곳을 고르세요!';
    else msg=st.mine||DU.pickedRound===st.round?(st.role==='kick'?'슛! 골키퍼를 기다리는 중…':'선택 완료! 상대를 기다리는 중…'):'잠시만요…';
  }
  DU.msgBase=msg;
  DU.lastMsg=null;duTick();   /* null: 화면 문구를 반드시 다시 그리게 */
}
function duTick(){   /* 남은 시간 표시만 가볍게 갱신 */
  const st=DU.st;if(!st||st.status!=='playing'||DU.anim||DU.shown!==st.hist.length){if(DU.lastMsg!==DU.msgBase){$('#duMsg').textContent=DU.msgBase||'';DU.lastMsg=DU.msgBase;}return;}
  const s=Math.max(0,Math.ceil(DU.left-(performance.now()-DU.leftAt)/1000));
  const t=(DU.msgBase||'')+(s>0?`  (${s}초)`:'');
  if(t!==DU.lastMsg){$('#duMsg').textContent=t;DU.lastMsg=t;}
}
const duZone=i=>({x:duX(((i%3)-1)*.667),y:duY(i<3?.75:.25)});   /* 다이브 칸의 중심 (서버 판정과 같은 좌표) */
const duEase=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
const DU_END=2.4;
function duFrame(now){
  if(!DU.open)return;
  DU.raf=requestAnimationFrame(duFrame);
  const dt=Math.min(.05,(now-DU.last)/1000);DU.last=now;
  if(DU.anim){DU.anim.t+=dt;if(DU.anim.t>=DU_END){DU.anim=null;duRender();}}
  else if(duCanShoot()){
    if(DU.ph==='aim'){   /* 방향키 조준 */
      const dx=(held.ArrowRight?1:0)-(held.ArrowLeft?1:0),dy=(held.ArrowUp?1:0)-(held.ArrowDown?1:0);
      if(dx||dy){DU.aim.x=clamp(DU.aim.x+dx*dt*1.1,-1.2,1.2);DU.aim.y=clamp(DU.aim.y+dy*dt*.9,0,1.25);}
    }else if(DU.ph==='power'){DU.gt+=dt;const x=(DU.gt*.9)%2;DU.gv=x<1?x:2-x;}   /* 0→1→0 왕복 */
  }
  try{duDraw(DU.ctx,DU.anim);}catch(e){console.error(e);}
  duTick();
}
function duPlayer(c,x,y,swing){   /* 슈터 (발끝 기준 위치) */
  c.save();c.translate(x,y);
  c.fillStyle='#232a45';c.fillRect(-8,-14,7,14);
  c.fillStyle='#e2334d';c.fillRect(-9,-38,18,25);
  c.fillStyle='#f1c9a5';c.beginPath();c.arc(0,-46,9,0,7);c.fill();c.strokeStyle='#232a45';c.lineWidth=2;c.stroke();
  c.save();c.translate(3,-14);c.rotate(-.6+1.5*swing);c.fillStyle='#232a45';c.fillRect(-4,0,8,16);c.restore();
  c.restore();
}
function duDraw(c,a){
  const st=DU.st;
  c.fillStyle='#5aa864';c.fillRect(0,0,480,300);
  c.fillStyle='rgba(255,255,255,.07)';for(let i=0;i<8;i++)if(i%2)c.fillRect(0,i*38,480,38);
  c.fillStyle='#2b4a3a';c.fillRect(60,50,360,150);   /* 골대 안쪽 */
  c.strokeStyle='rgba(255,255,255,.3)';c.lineWidth=1;c.beginPath();
  for(let x=60;x<=420;x+=20){c.moveTo(x,50);c.lineTo(x,200);}for(let y=50;y<=200;y+=20){c.moveTo(60,y);c.lineTo(420,y);}c.stroke();
  c.strokeStyle='#fff';c.lineWidth=6;c.lineJoin='round';c.beginPath();c.moveTo(60,200);c.lineTo(60,50);c.lineTo(420,50);c.lineTo(420,200);c.stroke();
  c.strokeStyle='rgba(255,255,255,.8)';c.lineWidth=3;c.beginPath();c.moveTo(0,200);c.lineTo(480,200);c.stroke();
  let kx=240,ky=170,rot=0,bx=240,by=265,br=11,bal=1,txt='',col='#fff',swing=0,flash=0;
  if(a){
    const h=a.h,t=a.t,gx=duX(h.fx),gy=duY(h.fy);
    const tz=h.r==='saved'?{x:gx,y:gy}:duZone(h.gp);   /* 막을 땐 공이 있는 곳까지 몸을 던지고, 아니면 고른 칸으로 */
    swing=duEase(t/.3);
    const kt=duEase((t-.3)/.45);kx=240+(tz.x-240)*kt;ky=170+(tz.y-170)*kt;rot=(tz.x-240)/120*.9*kt;
    const bt=duEase((t-.35)/.5);bx=240+(gx-240)*bt;by=265+(gy-265)*bt;br=11-4*bt;
    if(t>.85){
      const d=t-.85;
      if(h.r==='saved'){by+=d*d*90;bx+=d*(tz.x>240?-30:tz.x<240?30:0);bal=Math.max(0,1-d*.6);}
      else if(h.r==='post'){bx+=(gx>=240?-1:1)*d*70;by+=d*d*60;flash=Math.max(0,1-d*3);}
      else if(h.r==='miss'){if(Math.abs(h.fx)>1.06)bx+=Math.sign(h.fx)*d*140;else by-=d*120;br=Math.max(3,br-d*4);}
    }
    if(t>.95){txt=DU_RES[h.r]||'';col=h.r==='goal'?'#ffd84a':h.r==='saved'?'#7fd6ff':h.r==='post'?'#ffb35c':'#ff8a8a';}
  }
  duPlayer(c,212,292,a?swing:0);
  /* 골키퍼 */
  c.save();c.translate(kx,ky);c.rotate(rot);
  c.fillStyle='#e8a91c';c.fillRect(-14,-18,28,44);c.fillStyle='#232a45';c.fillRect(-11,26,9,14);c.fillRect(2,26,9,14);
  c.strokeStyle='#e8a91c';c.lineWidth=7;c.lineCap='round';c.beginPath();c.moveTo(-14,-12);c.lineTo(-28,-30);c.moveTo(14,-12);c.lineTo(28,-30);c.stroke();
  c.fillStyle='#fff';c.beginPath();c.arc(-28,-32,6,0,7);c.arc(28,-32,6,0,7);c.fill();
  c.fillStyle='#f1c9a5';c.beginPath();c.arc(0,-30,12,0,7);c.fill();c.strokeStyle='#232a45';c.lineWidth=2;c.stroke();
  c.restore();
  if(flash>0){c.strokeStyle=`rgba(255,255,255,${flash})`;c.lineWidth=10;c.beginPath();c.moveTo(60,200);c.lineTo(60,50);c.lineTo(420,50);c.lineTo(420,200);c.stroke();}
  /* 공 */
  c.globalAlpha=bal;c.fillStyle='#fff';c.strokeStyle='#232a45';c.lineWidth=2;c.beginPath();c.arc(bx,by,br,0,7);c.fill();c.stroke();
  c.fillStyle='#232a45';c.beginPath();c.arc(bx,by,br*.35,0,7);c.fill();c.globalAlpha=1;
  /* 슈터 조준선 + 파워 게이지 */
  const shoot=duCanShoot();
  if(shoot||(!a&&st&&st.role==='kick'&&st.status==='playing'&&DU.sent)){
    const p=shoot?DU.aim:DU.sent,rx=duX(p.x),ry=duY(p.y),out=Math.abs(p.x)>1||p.y>1;
    c.strokeStyle=shoot?(out?'#ff6b6b':'#ffd84a'):'rgba(255,255,255,.75)';c.lineWidth=2.5;
    c.beginPath();c.arc(rx,ry,13,0,7);c.moveTo(rx-20,ry);c.lineTo(rx-6,ry);c.moveTo(rx+6,ry);c.lineTo(rx+20,ry);c.moveTo(rx,ry-20);c.lineTo(rx,ry-6);c.moveTo(rx,ry+6);c.lineTo(rx,ry+20);c.stroke();
    const gx0=452,gy0=60,gh=180,v=shoot?(DU.ph==='power'?DU.gv:0):DU.sent.p;
    c.fillStyle='rgba(0,0,0,.5)';c.fillRect(gx0-3,gy0-3,20,gh+6);
    c.fillStyle='rgba(60,200,110,.85)';c.fillRect(gx0,gy0+gh*(1-DU_SWEET[1]),14,gh*(DU_SWEET[1]-DU_SWEET[0]));
    if(v>0){c.fillStyle=v>=DU_SWEET[0]&&v<=DU_SWEET[1]?'#ffd84a':'#e2334d';c.fillRect(gx0,gy0+gh*(1-v),14,gh*v);}
    c.fillStyle='#fff';c.fillRect(gx0-6,gy0+gh*(1-v)-1.5,26,3);
    c.font="12px 'Noto Sans KR',sans-serif";c.textAlign='center';c.textBaseline='alphabetic';c.fillStyle='#fff';c.fillText('POWER',gx0+7,gy0-8);
  }
  if(txt){
    c.font="34px 'Black Han Sans','Noto Sans KR',sans-serif";c.textAlign='center';c.textBaseline='middle';
    c.lineWidth=6;c.strokeStyle='#232a45';c.strokeText(txt,240,262);c.fillStyle=col;c.fillText(txt,240,262);
  }
}
$('#bigface').src=IMGDATA.base;
$('#verTip').textContent='(v'+APP_VERSION+')';
renderHub();setSync('idle');renderSeason();
if(cloudUrl())api('season_get').then(r=>setSeason(r.season)).catch(()=>{});
showLogin();showSplash();requestAnimationFrame(frame);
window.__dbg={du:DU,sp:SP,getS:()=>S,getUser:()=>USER,startLogin,cloudUrl,api,logout,startKick,SPOTS,PEN,DIFF,buildKicks,dayAction,hospitalize,forceFire:(ki,aim,s,ys,p,ko)=>{if(!M)M={bet:1000,goals:0,pts:0,res:[]};if(!M.kicks)M.kicks=buildKicks();setupKick(ki,ko);K.aim=aim;K.s=s;K.ys=ys;K.p=p;fire();return{out:K.out,info:K.info};},startMatch,held,mouse,setKey,solve,flight,proj,unproject,setupKick,getK:()=>K,getM:()=>M,getMode:()=>mode,getS:()=>S,pressedRef:()=>pressed,skipCut:()=>{pressed.SkipCut=true;}};
})();
