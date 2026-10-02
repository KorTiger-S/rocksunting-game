'use strict';
/* ---------- 다른 플레이어 프로필 · 한줄 방명록 (v2.4.0~) ----------
   랭킹에서 이름이나 얼굴을 누르면 열려요. 서버 rk_profile(캐릭터·뱃지·이번 시즌·지난 시즌별 순위)과
   rk_gb_list / rk_gb_write / rk_gb_delete(방명록)를 써요. 공개 정보라 보기에는 비밀번호가 필요 없고,
   방명록은 로그인한 플레이어만 한 줄(50자) 남길 수 있어요. 쓴 사람과 프로필 주인은 글을 지울 수 있어요. */
const UP_METRIC={money:'소지금',pumpBest:'펌프 최고점'};
const UP_GB_ERR={too_fast:'조금 있다가 다시 남겨 주세요. (20초에 한 번)',too_long:'50자까지만 남길 수 있어요.',empty:'내용을 적어 주세요.',
  bad_pin:'비밀번호가 달라서 남기지 못했어요. 다시 로그인해 주세요.',locked:'비밀번호를 여러 번 틀려 잠시 잠겼어요.',
  no_user:'아직 클라우드에 저장되지 않은 ID예요. 한 판 하고 다시 남겨 주세요.',not_allowed:'쓴 사람이나 프로필 주인만 지울 수 있어요.'};
let UP=null;   /* 지금 열린 프로필 {id:소문자 ID, name:표시 ID} */
const upMe=()=>USER?USER.id.toLowerCase():'';
function upRow(tab,k,v){
  const tr=document.createElement('tr'),a=document.createElement('td'),b=document.createElement('td');
  a.textContent=k;b.textContent=v;tr.append(a,b);tab.appendChild(tr);return tr;
}
function upMsg(tab,t){tab.innerHTML='';const tr=document.createElement('tr'),td=document.createElement('td');td.textContent=t;tr.appendChild(td);tab.appendChild(tr);}
function upDate(s){const d=new Date(Date.parse(s)+KST_MS);return isNaN(d)?'':`${d.getUTCFullYear()}.${d.getUTCMonth()+1}.${d.getUTCDate()}`;}
function upAgo(s){
  const t=(Date.now()-Date.parse(s))/1000;if(!(t>=0))return '';
  if(t<60)return '방금';if(t<3600)return Math.floor(t/60)+'분 전';if(t<86400)return Math.floor(t/3600)+'시간 전';if(t<7*86400)return Math.floor(t/86400)+'일 전';
  return upDate(s);
}
/* 이번 시즌 표: 랭킹 목록에서 받은 값(x)을 먼저 보여 주고, 서버 프로필이 오면 순위까지 다시 그려요 */
function upNow(x){
  const tab=$('#upNow');tab.innerHTML='';
  const prac=/-practice$/.test(x.season||'');
  if(x.rank)upRow(tab,'순위',prac?'연습 기간':`${x.rank}위 (${UP_METRIC[x.metric]||'소지금'} 기준)`);
  upRow(tab,'소지금',prac?'∞ 무한 (연습)':fmt(x.money||0)+'원');
  if(PUMP_PUBLIC)upRow(tab,'펌프 최고점',fmt(x.pumpBest||0)+'점');
  upRow(tab,'프리킥 최고점',(x.bestPts||0)+'점');
  upRow(tab,'1:1 대결',`${x.wins||0}승 ${x.losses||0}패`);
}
function upHist(list){
  const tab=$('#upHist');tab.innerHTML='';
  if(!list.length){upMsg(tab,'아직 마감된 시즌 기록이 없어요.');return;}
  list.forEach(h=>{
    const v=h.metric==='pumpBest'?fmt(h.pumpBest)+'점':fmt(h.money)+'원',top=h.rank<=2&&(h.metric==='pumpBest'?h.pumpBest:h.money)>0;
    upRow(tab,`시즌${h.number} · ${h.gameName||''}`,`${top?(h.rank===1?'🏆 ':'🥈 '):''}${h.rank}위/${h.players}명 · ${v}`);
  });
}
function upBadges(list){$('#upBadgeSec').hidden=!(list&&list.length);if(list&&list.length)drawBadges(list,$('#upBadges'));}

function openUserProfile(name,x){
  x=x||{};name=String(name);
  const id=name.toLowerCase(),me=id===upMe();
  UP={id,name};
  $('#upT').textContent=name;$('#upT').className=nameCls(x.eq);
  const f=$('#upFace');f.alt=name+' 캐릭터';setBody(f,'base',x.eq||{});   /* 전신 (shop.js) */
  $('#upSub').textContent=me?'내 프로필이에요. 친구들이 남긴 방명록을 볼 수 있어요.':'';
  upBadges(x.badges);upNow(x);
  const cloud=!!cloudUrl();
  $('#upHistSec').hidden=$('#upGbSec').hidden=!cloud;
  if(!cloud){$('#upSub').textContent='클라우드에 연결하면 시즌 기록과 방명록을 볼 수 있어요.';$('#uprof').hidden=false;return;}
  upMsg($('#upHist'),'불러오는 중…');
  $('#upGbForm').hidden=!USER;$('#upGbNote').hidden=!!USER;$('#upGbNote').textContent='로그인하면 한 줄 남길 수 있어요.';
  $('#upGbIn').value='';$('#upGbIn').placeholder=me?'내 방명록에 한 줄 (50자까지)':`${name}에게 한 줄 (50자까지)`;
  $('#upGb').innerHTML='';
  $('#uprof').hidden=false;
  api('profile',{id:name}).then(r=>{
    if(!UP||UP.id!==id)return;
    $('#upT').className=nameCls(r.eq);setBody(f,f.dataset.body||'base',r.eq||{});
    const extra=[r.joinedAt?upDate(r.joinedAt)+' 가입':'',r.itemCount?`꾸미기 아이템 ${r.itemCount}개`:''].filter(Boolean).join(' · ');
    if(extra)$('#upSub').textContent=(me?'내 프로필 · ':'')+extra;
    upBadges(r.badges);upNow(r.now||{});upHist(r.history||[]);
  }).catch(e=>{if(UP&&UP.id===id)upMsg($('#upHist'),e.message==='no_user'?'아직 클라우드에 기록이 없는 플레이어예요.':'기록을 불러오지 못했어요.');});
  upGbLoad();
}
function closeUserProfile(){UP=null;$('#uprof').hidden=true;}

/* ---------- 한줄 방명록 ---------- */
function upGbDraw(list){
  const ul=$('#upGb');ul.innerHTML='';
  if(!list.length){const li=document.createElement('li');li.className='none';li.textContent='아직 방명록이 비어 있어요. 첫 글을 남겨 보세요!';ul.appendChild(li);return;}
  const me=upMe();
  list.forEach(g=>{
    const li=document.createElement('li'),hd=document.createElement('div'),im=document.createElement('img'),nm=document.createElement('button'),tm=document.createElement('small'),p=document.createElement('p');
    im.className='rava '+frameCls(g.eq);im.alt='';setFace(im,'base',g.eq||{});
    nm.type='button';nm.className='rname '+nameCls(g.eq);nm.textContent=g.author;nm.title='프로필 보기';
    nm.addEventListener('click',()=>openUserProfile(g.author,{eq:g.eq}));
    tm.textContent=upAgo(g.at);
    hd.className='gbhd';hd.append(im,nm,tm);
    if(me&&(String(g.author).toLowerCase()===me||UP.id===me)){
      const del=document.createElement('button');del.type='button';del.className='gbdel';del.textContent='✕';del.title='지우기';del.setAttribute('aria-label','이 글 지우기');
      del.addEventListener('click',()=>upGbDelete(g.no));hd.appendChild(del);
    }
    p.textContent=g.msg;   /* 글은 항상 textContent로 (HTML로 해석하지 않아요) */
    li.append(hd,p);ul.appendChild(li);
  });
}
function upGbLoad(){
  if(!UP)return;const id=UP.id;
  const ul=$('#upGb');ul.innerHTML='<li class="none">불러오는 중…</li>';
  api('gb_list',{id:UP.name}).then(r=>{if(UP&&UP.id===id)upGbDraw(r.list||[]);})
    .catch(()=>{if(UP&&UP.id===id)ul.innerHTML='<li class="none">방명록을 불러오지 못했어요.</li>';});
}
let upGbBusy=false;
async function upGbWrite(){
  if(!UP||!USER||upGbBusy)return;
  const inp=$('#upGbIn'),msg=inp.value.replace(/\s+/g,' ').trim();
  if(!msg){sfx('deny');toast(UP_GB_ERR.empty);inp.focus();return;}
  const id=UP.id;upGbBusy=true;$('#upGbGo').disabled=true;
  try{
    const r=await api('gb_write',{id:USER.id,pin:USER.pin,to:UP.name,msg});
    sfx('scribble');inp.value='';
    if(UP&&UP.id===id)upGbDraw(r.list||[]);
  }catch(e){sfx('deny');toast(UP_GB_ERR[e.message]||'연결이 불안정해서 남기지 못했어요. 잠시 뒤 다시 해 주세요.');}
  upGbBusy=false;$('#upGbGo').disabled=false;
}
async function upGbDelete(no){
  if(!UP||!USER||!confirm('이 글을 지울까요?'))return;
  const id=UP.id;
  try{const r=await api('gb_delete',{id:USER.id,pin:USER.pin,no});sfx('swish');if(UP&&UP.id===id)upGbDraw(r.list||[]);}
  catch(e){sfx('deny');toast(UP_GB_ERR[e.message]||'지우지 못했어요. 잠시 뒤 다시 해 주세요.');}
}
$('#upGbGo').addEventListener('click',upGbWrite);
$('#upGbIn').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();upGbWrite();}});   /* 한글 조합 중 Enter는 무시 */
$('#upFace').addEventListener('click',function(){setBody(this,FACES[Math.floor(Math.random()*FACES.length)],this._eq||{});sfx('tick');});   /* 얼굴을 누르면 표정이 바뀌어요 */
$('#upClose').addEventListener('click',closeUserProfile);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#uprof').hidden)closeUserProfile();});
