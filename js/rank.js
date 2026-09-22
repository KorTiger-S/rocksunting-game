'use strict';
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

