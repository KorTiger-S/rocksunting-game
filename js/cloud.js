'use strict';
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
  S=d;putLocal();renderHub();maybeLoan();
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

