'use strict';
/* ---------- save ---------- */
const LEGACY_KEY='rocksunting-freekick-v1';
const DEF=()=>({fatigue:0,hosp:0,bestPts:0,plays:0,money:10000,day:0,week:1,wins:0,losses:0,cleared:false,
  str:25,stam:25,mood:50,cond:1,gymGap:0,bbqGap:0,   /* 근력·체력·기분(0~100), 컨디션(0~4=매우나쁨~매우좋음). 신규 가입은 허약하게 시작 */
  news:'월요일 아침, 오늘도 학교에서 살아남자.'});
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
function mergeData(d){const b=DEF();return Object.assign(b,d||{});}
function readLocal(id){try{const r=lsGet(ukey(id));return r?JSON.parse(r):null;}catch(e){return null;}}
function cloudData(){return{money:S.money,day:S.day,week:S.week,fatigue:S.fatigue||0,hosp:S.hosp||0,wins:S.wins,losses:S.losses,bestPts:S.bestPts||0,plays:S.plays||0,cleared:!!S.cleared,
  str:S.str==null?25:S.str,stam:S.stam==null?25:S.stam,mood:S.mood==null?50:S.mood,cond:S.cond==null?1:S.cond,gymGap:S.gymGap||0,bbqGap:S.bbqGap||0};}
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

