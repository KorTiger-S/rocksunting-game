'use strict';
/* ---------- 랭킹 ---------- */
let rankMetric='money',RANK_LIST=[];
/* 이번 시즌의 우승 기준(서버 rk_config season.metric). 랭킹을 열 때마다 이 탭부터 보여줘요 */
const seasonMetric=()=>SEASON&&SEASON.metric==='pumpBest'&&PUMP_PUBLIC?'pumpBest':'money';
const RVAL={money:x=>fmt(x.v)+'원',wins:x=>`${x.wins||0}승 ${x.losses||0}패`,bestPts:x=>x.v+'점',pumpBest:x=>fmt(x.v||0)+'점'};
function localTop(metric){
  const out=[];
  lsKeys().filter(k=>k&&k.startsWith('rk:u:')).forEach(k=>{try{const r=JSON.parse(lsGet(k)),d=r.data||{};out.push({id:r.name,money:d.money||0,wins:d.wins||0,losses:d.losses||0,bestPts:d.bestPts||0,pumpBest:d.pumpBest||0,v:d[metric]||0,eq:itemsOf(d).eq});}catch(e){}});
  out.sort((a,b)=>b.v-a.v);return out.slice(0,10);
}
async function renderRank(){
  document.querySelectorAll('.rtabs [data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===rankMetric));
  $('#rkTab').innerHTML='<tr><td>불러오는 중…</td></tr>';
  let list=null,note='';
  if(cloudUrl()){try{const r=await api('top',{metric:rankMetric,limit:10});list=r.list.map(x=>Object.assign(x,{v:x[rankMetric]}));note='클라우드에 저장된 모든 플레이어 기준 상위 10명이에요.';}catch(e){note='클라우드에 연결할 수 없어 이 기기 기준으로 보여줘요.';}}
  if(!list){list=localTop(rankMetric);if(!note)note='이 기기에 저장된 ID 기준이에요. (클라우드에 연결하면 모든 플레이어가 함께 보여요)';}
  const me=USER?USER.id.toLowerCase():'';
  $('#rkTab').innerHTML=list.length?list.map((x,i)=>`<tr class="${String(x.id).toLowerCase()===me?'me':''}"><td>${i+1}위 <img class="rava ${frameCls(x.eq)}" data-i="${i}" alt=""> <button type="button" class="rname ${nameCls(x.eq)}" data-i="${i}" title="프로필 보기">${String(x.id).replace(/[<>&"]/g,'')}</button>${x.cleared?' 👑':''}${rankBadges(x.badges)}</td><td>${RVAL[rankMetric](x)}</td></tr>`).join(''):'<tr><td>아직 기록이 없어요.</td></tr>';
  RANK_LIST=list;
  document.querySelectorAll('#rkTab img.rava').forEach(im=>setFace(im,'base',(list[+im.dataset.i]||{}).eq||{}));   /* 각자 장착한 아이템을 입힌 얼굴 (shop.js) */
  $('#rkNote').textContent=note;
  rkShareMake(list,rankMetric,!!cloudUrl()&&!/연결할 수 없어/.test(note));
}
/* 이름 옆 시즌 뱃지: 🏆1 = 시즌1 우승, 🥈2 = 시즌2 준우승. 누르면 무슨 뱃지인지 알려 줘요 */
const badgeText=b=>`시즌${b.number} ${b.rank===1?'우승':'준우승'}${b.gameName?' · '+b.gameName:''}`;
function rankBadges(list){
  return (list||[]).map(b=>{const t=badgeText(b).replace(/[<>&"]/g,'');return ` <span class="rbadge b${b.rank===1?1:2}" data-t="${t}" title="${t}" role="button" tabindex="0">${b.rank===1?'🏆':'🥈'}<small>${Number(b.number)||''}</small></span>`;}).join('');
}
$('#rkTab').addEventListener('click',e=>{const b=e.target.closest('.rbadge');if(b){toast(b.dataset.t);return;}
  const n=e.target.closest('.rname,img.rava');if(n){const x=RANK_LIST[+n.dataset.i];if(x)openUserProfile(x.id,x);}});   /* 이름·얼굴을 누르면 그 사람 프로필 (uprof.js) */
$('#rkTab').addEventListener('keydown',e=>{const b=e.target.closest('.rbadge');if(b&&(e.key==='Enter'||e.key===' ')){e.preventDefault();toast(b.dataset.t);}});
$('#rankBtn').addEventListener('click',()=>{rankMetric=seasonMetric();$('#rank').hidden=false;renderSeason();renderRank();});

$('#rkClose').addEventListener('click',()=>{$('#rank').hidden=true;});
document.querySelectorAll('.rtabs [data-m]').forEach(b=>b.addEventListener('click',()=>{rankMetric=b.dataset.m;renderRank();}));

/* ---------- 랭킹 공유 (이미지) ----------
   헛다리 레볼루션 결과 공유처럼, 지금 보고 있는 랭킹 탭을 세로 카드 이미지(PNG)로 그려서 휴대폰 공유창을 열어요.
   공유창은 버튼을 누른 순간 바로 열어야 해서, 랭킹을 불러오면 이미지를 미리 만들어 둬요. */
const RK_NAME={money:'소지금',pumpBest:'헛다리 레볼루션 최고점',bestPts:'프리킥 최고점',wins:'승패'};
const RKSH_W=720;
let RK_SHARE=null;
function rkShareMake(list,metric,cloud){
  const sh={list:list.slice(0,10),metric,cloud,blob:null};RK_SHARE=sh;
  const png=cv=>new Promise((ok,no)=>cv.toBlob(b=>b?ok(b):no(new Error('toBlob')),'image/png'));
  /* 얼굴 그림을 못 쓰는 환경(파일로 직접 연 경우 등)에서는 캔버스를 내보낼 수 없어서, 얼굴 없이 다시 그려요 */
  sh.p=rkShareDraw(sh).then(png).catch(()=>rkShareDraw(sh,true).then(png)).then(b=>(sh.blob=b));
  sh.p.catch(e=>console.error(e));
}
async function rkShareDraw(sh,noFace){
  const list=sh.list,RH=78,TOP=300,H=TOP+Math.max(list.length,1)*RH+110,W=RKSH_W;
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const c=cv.getContext('2d'),DISP="'Black Han Sans','Noto Sans KR',sans-serif",BODY="'Noto Sans KR',sans-serif";
  try{await document.fonts.load(`40px 'Black Han Sans'`);await document.fonts.load(`700 20px 'Noto Sans KR'`);}catch(e){}
  const ims=await Promise.all(list.map(async x=>{if(noFace)return null;const im=new Image();im.src=avatarURL('base',x.eq||{});try{await im.decode();return im;}catch(e){return null;}}));
  const T=(t,x,y,size,col,align,font,weight)=>{c.font=`${weight||''} ${size}px ${font||DISP}`;c.fillStyle=col;c.textAlign=align||'left';c.textBaseline='middle';c.fillText(t,x,y);};
  const box=(x,y,w,h,rad,fill)=>{c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,rad);else c.rect(x,y,w,h);c.fillStyle=fill;c.fill();};
  /* 배경 */
  const bg=c.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#1c2350');bg.addColorStop(1,'#070a18');c.fillStyle=bg;c.fillRect(0,0,W,H);
  c.fillStyle='rgba(255,255,255,.035)';for(let x=0;x<W;x+=24)c.fillRect(x,0,1,H);for(let y=0;y<H;y+=24)c.fillRect(0,y,W,1);
  c.fillStyle='#ffd23f';c.fillRect(0,0,W,8);
  /* 머리: 게임 이름 · 시즌 · 기준 */
  T('🏆 롹순팅 랭킹',W/2,70,44,'#ffd23f','center');
  T(SEASON&&cloudUrl()?`롹순팅 키우기 · 시즌${SEASON.number}${SEASON.gameName?' · '+SEASON.gameName:''}`:'롹순팅 키우기',W/2,118,20,'#9aa3c2','center',BODY,700);
  T(`${RK_NAME[sh.metric]||''} TOP ${list.length||10}`,W/2,190,46,'#fff','center');
  T(sh.cloud?'모든 플레이어 기준':'이 기기에 저장된 ID 기준',W/2,240,20,'#c9d3ff','center',BODY,700);
  /* 순위 */
  const me=USER?USER.id.toLowerCase():'',MEDAL=['#ffd23f','#dfe3ea','#e0a46a'];
  if(!list.length)T('아직 기록이 없어요.',W/2,TOP+RH/2,26,'#9aa3c2','center',BODY,700);
  list.forEach((x,i)=>{
    const y=TOP+i*RH,cy=y+RH/2-5,mine=String(x.id).toLowerCase()===me;
    box(40,y,W-80,RH-10,18,mine?'rgba(226,51,77,.28)':i<3?'rgba(255,255,255,.09)':'rgba(255,255,255,.05)');
    T(`${i+1}`,92,cy,i<3?38:30,MEDAL[i]||'#9aa3c2','center');
    /* 얼굴(장착 아이템을 입힌 모습) */
    c.save();c.beginPath();c.arc(162,cy,27,0,6.2832);c.clip();c.fillStyle='#f4f1ee';c.fillRect(135,cy-27,54,54);
    const im=ims[i];if(im&&im.naturalWidth){const s=Math.min(im.naturalWidth,im.naturalHeight);c.drawImage(im,(im.naturalWidth-s)/2,im.naturalHeight*.02,s,s,135,cy-27,54,54);}
    c.restore();c.beginPath();c.arc(162,cy,27,0,6.2832);c.lineWidth=3;c.strokeStyle=mine?'#e2334d':MEDAL[i]||'#4b5480';c.stroke();
    /* 이름 + 시즌 뱃지 (값과 겹치지 않게 줄여요) */
    const val=RVAL[sh.metric](x),badge=(x.badges||[]).map(b=>`${b.rank===1?'🏆':'🥈'}${Number(b.number)||''}`).join(' ')+(x.cleared?' 👑':'');
    c.font=`28px ${DISP}`;const valW=c.measureText(val).width;
    c.font=`700 20px ${BODY}`;const badgeW=badge?c.measureText(' '+badge).width:0;
    c.font=`700 26px ${BODY}`;const room=W-72-valW-24-206-badgeW;
    let name=String(x.id);
    if(c.measureText(name).width>room){while(name.length>1&&c.measureText(name+'…').width>room)name=name.slice(0,-1);name+='…';}
    T(name,206,cy,26,mine?'#ffd0d7':'#fff','left',BODY,700);
    if(badge)T(badge,206+c.measureText(name+' ').width,cy,20,'#ffd966','left',BODY,700);
    T(val,W-72,cy,28,i<3?MEDAL[i]:'#eef0f8','right');
  });
  /* 바닥글 */
  const d=new Date(),p2=n=>String(n).padStart(2,'0'),ds=`${d.getFullYear()}.${p2(d.getMonth()+1)}.${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  T(`${USER?USER.id+' · ':''}${ds}`,W/2,H-64,18,'#9aa3c2','center',BODY,700);   /* ID가 길어도 주소와 안 겹치게 두 줄로 */
  T('kortiger-s.github.io/rocksunting-game',W/2,H-36,16,'#6f789a','center',BODY,700);
  return cv;
}
/* 이미지를 휴대폰 공유창으로 보내요. 공유창이 없거나 못 열면 파일로 저장해요. (헛다리 레볼루션 결과 공유도 같이 써요) */
function saveImageFile(blob,name){
  const a=document.createElement('a'),u=URL.createObjectURL(blob);
  a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);
}
async function shareImageFile(blob,name,title,text){
  const file=new File([blob],name,{type:'image/png'});
  if(navigator.canShare&&navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file],title,text});sfx('swish');}
    catch(e){if(e&&e.name!=='AbortError'){saveImageFile(blob,name);toast('공유창을 열지 못해서 이미지를 저장했어요. 카톡에서 사진으로 보내 주세요.');}}
    return;
  }
  saveImageFile(blob,name);sfx('coin');
  toast('이 기기에서는 공유창을 열 수 없어서 이미지를 저장했어요. 카톡에서 사진으로 보내 주세요.');
}
$('#rkShare').addEventListener('click',async()=>{
  const sh=RK_SHARE;if(!sh)return;
  let blob=sh.blob;
  try{if(!blob)blob=await sh.p;}catch(e){sfx('error');toast('이미지를 만들지 못했어요.');return;}
  const me=USER?USER.id.toLowerCase():'',my=sh.list.findIndex(x=>String(x.id).toLowerCase()===me);
  const d=new Date(),ds=`${d.getMonth()+1}${String(d.getDate()).padStart(2,'0')}`;
  shareImageFile(blob,`롹순팅랭킹_${(RK_NAME[sh.metric]||'').replace(/\s+/g,'')}_${ds}.png`,'롹순팅 랭킹',
    `롹순팅 키우기 ${RK_NAME[sh.metric]||''} 랭킹${my>=0?` · ${USER.id} ${my+1}위`:''}`);
});

function toast(m,ms=2600){const t=$('#toast');t.innerHTML='';const d=document.createElement('div');d.textContent=m;t.appendChild(d);setTimeout(()=>{if(d.parentNode)d.remove();},ms);}

