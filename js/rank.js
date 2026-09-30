'use strict';
/* ---------- 랭킹 ---------- */
let rankMetric='money';
const RVAL={money:x=>fmt(x.v)+'원',wins:x=>`${x.wins||0}승 ${x.losses||0}패`,bestPts:x=>x.v+'점',pumpBest:x=>fmt(x.v||0)+'점'};
function localTop(metric){
  const out=[];
  lsKeys().filter(k=>k&&k.startsWith('rk:u:')).forEach(k=>{try{const r=JSON.parse(lsGet(k)),d=r.data||{};out.push({id:r.name,money:d.money||0,wins:d.wins||0,losses:d.losses||0,bestPts:d.bestPts||0,pumpBest:d.pumpBest||0,v:d[metric]||0});}catch(e){}});
  out.sort((a,b)=>b.v-a.v);return out.slice(0,10);
}
async function renderRank(){
  document.querySelectorAll('.rtabs [data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===rankMetric));
  $('#rkTab').innerHTML='<tr><td>불러오는 중…</td></tr>';
  let list=null,note='';
  if(cloudUrl()){try{const r=await api('top',{metric:rankMetric,limit:10});list=r.list.map(x=>Object.assign(x,{v:x[rankMetric]}));note='클라우드에 저장된 모든 플레이어 기준 상위 10명이에요.';}catch(e){note='클라우드에 연결할 수 없어 이 기기 기준으로 보여줘요.';}}
  if(!list){list=localTop(rankMetric);if(!note)note='이 기기에 저장된 ID 기준이에요. (클라우드에 연결하면 모든 플레이어가 함께 보여요)';}
  const me=USER?USER.id.toLowerCase():'';
  $('#rkTab').innerHTML=list.length?list.map((x,i)=>`<tr class="${String(x.id).toLowerCase()===me?'me':''}"><td>${i+1}위 ${String(x.id).replace(/[<>&]/g,'')}${x.cleared?' 👑':''}${rankBadges(x.badges)}</td><td>${RVAL[rankMetric](x)}</td></tr>`).join(''):'<tr><td>아직 기록이 없어요.</td></tr>';
  $('#rkNote').textContent=note;
}
/* 이름 옆 시즌 뱃지: 🏆1 = 시즌1 우승, 🥈2 = 시즌2 준우승. 누르면 무슨 뱃지인지 알려 줘요 */
const badgeText=b=>`시즌${b.number} ${b.rank===1?'우승':'준우승'}${b.gameName?' · '+b.gameName:''}`;
function rankBadges(list){
  return (list||[]).map(b=>{const t=badgeText(b).replace(/[<>&"]/g,'');return ` <span class="rbadge b${b.rank===1?1:2}" data-t="${t}" title="${t}" role="button" tabindex="0">${b.rank===1?'🏆':'🥈'}<small>${Number(b.number)||''}</small></span>`;}).join('');
}
$('#rkTab').addEventListener('click',e=>{const b=e.target.closest('.rbadge');if(b)toast(b.dataset.t);});
$('#rkTab').addEventListener('keydown',e=>{const b=e.target.closest('.rbadge');if(b&&(e.key==='Enter'||e.key===' ')){e.preventDefault();toast(b.dataset.t);}});
$('#rankBtn').addEventListener('click',()=>{$('#rank').hidden=false;renderSeason();renderRank();});

$('#rkClose').addEventListener('click',()=>{$('#rank').hidden=true;});
document.querySelectorAll('.rtabs [data-m]').forEach(b=>b.addEventListener('click',()=>{rankMetric=b.dataset.m;renderRank();}));

function toast(m,ms=2600){const t=$('#toast');t.innerHTML='';const d=document.createElement('div');d.textContent=m;t.appendChild(d);setTimeout(()=>{if(d.parentNode)d.remove();},ms);}

