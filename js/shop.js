'use strict';
/* ---------- 상점 · 롹순팅 꾸미기 (v2.1.0~) ----------
   아이템은 모두 소지금으로 사요. 산 아이템(S.items.own)과 장착한 아이템(S.items.eq)은 시즌이 끝나도 남아요
   (서버 rk_reset_players가 items만 남기고 초기화해요). 우승 기준이 소지금인 시즌이면 사는 만큼 순위도 내려가요.
   얼굴 그림(assets/faces/*.jpg, 150×190)은 표정 12장 모두 얼굴 위치가 같아서, 같은 150×190 좌표로 그린 아이템을 위에 겹쳐요.
     머리 윗부분 y≈12 · 이마 y≈55 · 눈 (45,90)·(102,90) · 입 (75,125) · 귀 x≈15·135
   - 모자·안경·얼굴 소품(hat/glass/acc): svg(150×190 좌표의 SVG 조각). 그림 아이템은 svg 대신 img에 150×190 투명 PNG 경로를 넣으면 돼요.
   - 테두리(frame): 프로필 아이콘·랭킹 얼굴의 테두리 CSS 클래스(css)
   - 이름 색(name): 랭킹·1:1 대결 이름의 CSS 클래스(css) */
const SHOP_SLOTS=[{id:'hat',name:'모자'},{id:'glass',name:'안경'},{id:'acc',name:'얼굴 소품'},{id:'frame',name:'테두리'},{id:'name',name:'이름 색'}];
const SHOP_ITEMS=[
  {id:'cap',slot:'hat',name:'빨간 야구모자',price:3000,desc:'운동장 필수템',
   svg:'<path d="M17 64C17 22 50 6 76 6s59 16 59 58z" fill="#d8362f" stroke="#232a45" stroke-width="3"/><path d="M40 12Q76 0 112 12" stroke="#a82420" stroke-width="3" fill="none"/><ellipse cx="76" cy="63" rx="64" ry="9" fill="#a82420" stroke="#232a45" stroke-width="3"/><circle cx="76" cy="7" r="4.5" fill="#a82420" stroke="#232a45" stroke-width="2"/><circle cx="76" cy="36" r="11" fill="#fff" stroke="#232a45" stroke-width="2"/><text x="76" y="41.5" font-size="15" font-weight="900" text-anchor="middle" fill="#d8362f" font-family="sans-serif">R</text>'},
  {id:'beanie',slot:'hat',name:'파란 비니',price:5000,desc:'겨울에도 킥 감 유지',
   svg:'<path d="M16 64C16 18 50 4 76 4s60 14 60 60z" fill="#3b6fd8" stroke="#232a45" stroke-width="3"/><rect x="12" y="48" width="128" height="20" rx="9" fill="#2c56b0" stroke="#232a45" stroke-width="3"/><path d="M28 51v14M44 51v14M60 51v14M76 51v14M92 51v14M108 51v14M124 51v14" stroke="#1d3f8a" stroke-width="3"/><circle cx="76" cy="6" r="10" fill="#fff" stroke="#232a45" stroke-width="2.5"/>'},
  {id:'phones',slot:'hat',name:'헤드폰',price:8000,desc:'소리새에서 쓰던 그거',
   svg:'<path d="M15 96C12 30 44 12 76 12s64 18 61 84" fill="none" stroke="#232a45" stroke-width="11" stroke-linecap="round"/><path d="M15 96C12 30 44 12 76 12s64 18 61 84" fill="none" stroke="#e2334d" stroke-width="5" stroke-linecap="round"/><rect x="1" y="76" width="22" height="38" rx="9" fill="#e2334d" stroke="#232a45" stroke-width="3"/><rect x="129" y="76" width="22" height="38" rx="9" fill="#e2334d" stroke="#232a45" stroke-width="3"/><rect x="7" y="84" width="10" height="22" rx="4" fill="#232a45"/><rect x="135" y="84" width="10" height="22" rx="4" fill="#232a45"/>'},
  {id:'crown',slot:'hat',name:'황금 왕관',price:30000,desc:'머대부고의 왕',
   svg:'<path d="M32 46L40 6l20 24L76 0l16 30 20-24 8 40z" fill="#f5c518" stroke="#8a6d00" stroke-width="3" stroke-linejoin="round"/><rect x="31" y="38" width="90" height="16" rx="4" fill="#e8a91c" stroke="#8a6d00" stroke-width="3"/><circle cx="56" cy="46" r="4.5" fill="#e2334d"/><circle cx="76" cy="46" r="5" fill="#3aa0ff"/><circle cx="96" cy="46" r="4.5" fill="#2f8f5b"/><circle cx="40" cy="7" r="4" fill="#fff4b0" stroke="#8a6d00" stroke-width="2"/><circle cx="76" cy="2" r="4" fill="#fff4b0" stroke="#8a6d00" stroke-width="2"/><circle cx="112" cy="7" r="4" fill="#fff4b0" stroke="#8a6d00" stroke-width="2"/>'},
  {id:'round',slot:'glass',name:'동그란 뿔테',price:2000,desc:'현숭 따라 하기',
   svg:'<circle cx="45" cy="91" r="18" fill="rgba(255,255,255,.18)" stroke="#3b2a20" stroke-width="4.5"/><circle cx="103" cy="91" r="18" fill="rgba(255,255,255,.18)" stroke="#3b2a20" stroke-width="4.5"/><path d="M63 89q11-7 22 0" fill="none" stroke="#3b2a20" stroke-width="4"/><path d="M27 88L14 84M121 88l13-4" stroke="#3b2a20" stroke-width="4" stroke-linecap="round"/>'},
  {id:'shades',slot:'glass',name:'선글라스',price:6000,desc:'판돈 올릴 때 표정 관리',
   svg:'<path d="M22 80h44q2 22-18 24q-24 0-26-24z" fill="#111" stroke="#232a45" stroke-width="3"/><path d="M84 80h44q-2 24-26 24q-20-2-18-24z" fill="#111" stroke="#232a45" stroke-width="3"/><path d="M66 83q9-5 18 0" fill="none" stroke="#232a45" stroke-width="4"/><path d="M22 81L12 78M128 81l10-3" stroke="#232a45" stroke-width="4" stroke-linecap="round"/><path d="M30 86l10-4M92 86l10-4" stroke="rgba(255,255,255,.55)" stroke-width="3" stroke-linecap="round"/>'},
  {id:'heart',slot:'glass',name:'하트 안경',price:10000,desc:'모두가 반한다',
   svg:'<path d="M45 108C22 94 22 74 34 72c6-1 10 3 11 7 1-4 5-8 11-7 12 2 12 22-11 36z" fill="rgba(255,77,141,.82)" stroke="#c2185b" stroke-width="3.5"/><path d="M103 108C80 94 80 74 92 72c6-1 10 3 11 7 1-4 5-8 11-7 12 2 12 22-11 36z" fill="rgba(255,77,141,.82)" stroke="#c2185b" stroke-width="3.5"/><path d="M62 84q12-7 24 0" fill="none" stroke="#c2185b" stroke-width="4"/>'},
  {id:'blush',slot:'acc',name:'볼터치',price:1000,desc:'발그레~',
   svg:'<ellipse cx="29" cy="116" rx="12" ry="6.5" fill="#ff7aa2" opacity=".55"/><ellipse cx="121" cy="116" rx="12" ry="6.5" fill="#ff7aa2" opacity=".55"/>'},
  {id:'bandage',slot:'acc',name:'반창고',price:1500,desc:'프리킥 영광의 상처',
   svg:'<g transform="rotate(-22 104 60)"><rect x="86" y="54" width="36" height="13" rx="6" fill="#f3c89a" stroke="#b9854f" stroke-width="2"/><rect x="98" y="54" width="12" height="13" fill="#e9b47c"/><circle cx="101" cy="58" r="1" fill="#b9854f"/><circle cx="107" cy="58" r="1" fill="#b9854f"/><circle cx="101" cy="63" r="1" fill="#b9854f"/><circle cx="107" cy="63" r="1" fill="#b9854f"/></g>'},
  {id:'star',slot:'acc',name:'별 스티커',price:3000,desc:'오늘의 스타',
   svg:'<path d="M118 104l3.5 7.5 8 1-6 5.5 1.6 8-7.1-4-7.1 4 1.6-8-6-5.5 8-1z" fill="#ffd23f" stroke="#e8a91c" stroke-width="2" stroke-linejoin="round"/><circle cx="33" cy="112" r="2.5" fill="#ffd23f"/><circle cx="26" cy="120" r="1.8" fill="#ffd23f"/>'},
  {id:'fgold',slot:'frame',name:'금테',price:5000,desc:'프로필 아이콘·랭킹 얼굴 테두리',css:'fr-gold'},
  {id:'frainbow',slot:'frame',name:'무지개 테두리',price:15000,desc:'프로필 아이콘·랭킹 얼굴 테두리',css:'fr-rainbow'},
  {id:'nred',slot:'name',name:'빨간 이름',price:5000,desc:'랭킹·1:1 대결에서 이름 색',css:'nm-red'},
  {id:'ngold',slot:'name',name:'황금 이름',price:15000,desc:'랭킹·1:1 대결에서 이름 색',css:'nm-gold'},
  {id:'nrainbow',slot:'name',name:'무지개 이름',price:25000,desc:'랭킹·1:1 대결에서 이름 색',css:'nm-rainbow'}
];
const SHOP_BY={};SHOP_ITEMS.forEach(it=>{SHOP_BY[it.id]=it;});
const DRESS_ORDER=['acc','glass','hat'];   /* 얼굴에 겹치는 순서(아래 → 위) */
const SHOP_KEEP=1000;                      /* 사고 나서도 이만큼은 남아야 해요(게임 한 판 판돈) */
const itemsOf=d=>{const it=d&&d.items;return{own:Array.isArray(it&&it.own)?it.own.filter(x=>SHOP_BY[x]):[],eq:(it&&it.eq&&typeof it.eq==='object')?it.eq:{}};};
const myEq=()=>itemsOf(S).eq;
/* eq에서 슬롯에 맞는 아이템만(잘못된 값은 무시) */
function eqItem(eq,slot){const it=SHOP_BY[eq&&eq[slot]];return it&&it.slot===slot?it:null;}
const frameCls=eq=>{const it=eqItem(eq,'frame');return it?it.css:'';};
const nameCls=eq=>{const it=eqItem(eq,'name');return it?it.css:'';};

/* ---------- 얼굴 위에 겹칠 아이템 그림 (아이템마다 150×190 Image 하나) ---------- */
const DRESS_IM={};
function dressIm(it){
  if(!DRESS_IM[it.id]){
    const im=new Image();im.onload=()=>shopRefreshFaces();
    im.src=it.img||('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 190" width="150" height="190">${it.svg}</svg>`));
    DRESS_IM[it.id]=im;
  }
  return DRESS_IM[it.id];
}
SHOP_ITEMS.forEach(it=>{if(it.svg||it.img)dressIm(it);});   /* 미리 불러 둬요 */
/* 캔버스에 얼굴을 그린 바로 뒤에 불러요. 얼굴을 그린 것과 같은 (원본 영역,) 대상 영역을 넘기면 딱 맞게 겹쳐요. */
function drawDress(c,eq,...rect){
  DRESS_ORDER.forEach(sl=>{const it=eqItem(eq,sl);if(!it)return;const im=dressIm(it);if(im.complete&&im.naturalWidth)c.drawImage(im,...rect);});
}

/* ---------- <img>에 쓸 합성 얼굴 (얼굴 + 아이템을 한 장으로) ---------- */
const AVA_CACHE={};let avaTainted=false;
const eqKey=eq=>DRESS_ORDER.map(sl=>(eqItem(eq,sl)||{}).id||'').join('.');
function avatarURL(face,eq){
  const base=IMGDATA[face]||IMGDATA.base,key=eqKey(eq);
  if(key==='..'||avaTainted)return base;
  const ck=face+'|'+key;if(AVA_CACHE[ck])return AVA_CACHE[ck];
  const im=IM[face]||IM.base;if(!im.complete||!im.naturalWidth){im.addEventListener('load',shopRefreshFaces,{once:true});return base;}
  const ims=DRESS_ORDER.map(sl=>eqItem(eq,sl)).filter(Boolean).map(dressIm);
  if(ims.some(x=>!x.complete||!x.naturalWidth))return base;   /* 아직 불러오는 중: 다 불러오면 shopRefreshFaces가 다시 그려요 */
  const cv=document.createElement('canvas');cv.width=im.naturalWidth;cv.height=im.naturalHeight;
  const c=cv.getContext('2d');c.drawImage(im,0,0);ims.forEach(x=>c.drawImage(x,0,0,cv.width,cv.width*190/150));   /* 아이템 그림은 150×190 기준, 위쪽을 맞춰요 */
  try{AVA_CACHE[ck]=cv.toDataURL('image/png');}catch(e){avaTainted=true;return base;}   /* file://로 열면 캔버스를 못 읽어서 아이템 없이 보여요 */
  return AVA_CACHE[ck];
}
/* 내 얼굴(<img>)을 표정 face로 바꿔요. eq를 안 넘기면 내 장착 아이템. */
function setFace(el,face,eq){
  if(!el)return;el.dataset.face=face;el._eq=eq||null;
  el.src=avatarURL(face,eq||myEq());
}
let faceRefreshT=0;
function shopRefreshFaces(){   /* 그림을 다 불러온 뒤 한 번에 다시 그려요 */
  clearTimeout(faceRefreshT);
  faceRefreshT=setTimeout(()=>{document.querySelectorAll('img[data-face]').forEach(el=>{el.src=avatarURL(el.dataset.face,el._eq||myEq());});},30);
}
/* 프로필 아이콘(헤더 얼굴) 테두리 */
function renderMyFace(){
  const el=$('#bigface');if(!el)return;
  el.classList.remove('fr-gold','fr-rainbow');const fc=frameCls(myEq());if(fc)el.classList.add(fc);
  setFace(el,el.dataset.face||'base');
}

/* ---------- 상점 화면 ---------- */
let shopSlot='hat',shopSel=null;
function shopHas(id){return itemsOf(S).own.includes(id);}
function shopTry(){   /* 지금 장착한 것 + 고른 아이템을 입혀 본 모습 */
  const eq=Object.assign({},myEq());const it=SHOP_BY[shopSel];if(it)eq[it.slot]=it.id;return eq;
}
(function buildShop(){
  const tabs=$('#shopTabs');if(!tabs)return;
  SHOP_SLOTS.forEach(s=>{const b=document.createElement('button');b.type='button';b.className='go ghost';b.dataset.slot=s.id;b.textContent=s.name;
    b.addEventListener('click',()=>{shopSlot=s.id;shopSel=null;renderShop();});tabs.appendChild(b);});
  $('#shopAct').addEventListener('click',shopAction);
  /* 헤더의 🛍 꾸미기 버튼: 홈 화면에서 상점 카드를 열어요 */
  $('#shopBtn').addEventListener('click',()=>{if(mode!=='hub'||!USER)return;shopSel=null;openHubCard('shopCard');renderShop();$('#shopCard').scrollIntoView({block:'start'});});
  $('#shopOff').addEventListener('click',()=>{const it=SHOP_BY[shopSel];if(!it)return;const d=itemsOf(S);delete d.eq[it.slot];S.items=d;save();sfx('swish');toast(`${it.name}을(를) 벗었어요.`);renderHub();});
})();
function shopAction(){
  const it=SHOP_BY[shopSel];if(!it)return;
  const d=itemsOf(S);
  if(!shopHas(it.id)){
    if(S.money-it.price<SHOP_KEEP){sfx('deny');toast(`사고 나서도 ${fmt(SHOP_KEEP)}원은 남아야 해요. (판돈용)`);return;}
    const before=S.money;S.money-=it.price;d.own.push(it.id);d.eq[it.slot]=it.id;S.items=d;
    save();sfx('coin');setTimeout(()=>sfx('sparkle'),120);
    toast(`🛍 ${it.name} 구매! 소지금 ${fmt(before)} → ${fmt(S.money)}원 (바로 장착했어요)`,3500);
  }else if(d.eq[it.slot]!==it.id){d.eq[it.slot]=it.id;S.items=d;save();sfx('chime');toast(`${it.name} 장착!`);}
  renderHub();
}
function renderShop(){
  if(!$('#shopGrid'))return;
  const d=itemsOf(S),eq=d.eq;
  document.querySelectorAll('#shopTabs [data-slot]').forEach(b=>b.classList.toggle('on',b.dataset.slot===shopSlot));
  const grid=$('#shopGrid');grid.textContent='';
  SHOP_ITEMS.filter(it=>it.slot===shopSlot).forEach(it=>{
    const b=document.createElement('button');b.type='button';b.className='shopit'+(it.id===shopSel?' sel':'');
    const own=d.own.includes(it.id),on=eq[it.slot]===it.id;
    if(it.slot==='name'){const s=document.createElement('span');s.className='shopnm '+it.css;s.textContent='롹순팅';b.appendChild(s);}
    else{const im=document.createElement('img');im.alt='';im.className='shopth '+(it.slot==='frame'?it.css:'');
      if(it.slot==='frame')setFace(im,'base',{});else setFace(im,'base',{[it.slot]:it.id});b.appendChild(im);}
    const t=document.createElement('b');t.textContent=it.name;b.appendChild(t);
    const p=document.createElement('small');p.textContent=on?'장착 중':own?'보유':fmt(it.price)+'원';if(on||own)p.className='own';b.appendChild(p);
    b.setAttribute('aria-label',`${it.name} · ${on?'장착 중':own?'보유':fmt(it.price)+'원'}`);
    b.addEventListener('click',()=>{shopSel=it.id;sfx('tick');renderShop();});
    grid.appendChild(b);
  });
  /* 미리보기: 고른 아이템을 입혀 본 모습 */
  const tryEq=shopTry(),ava=$('#shopAva');
  ava.classList.remove('fr-gold','fr-rainbow');const fc=frameCls(tryEq);if(fc)ava.classList.add(fc);
  setFace(ava,'happy',tryEq);
  const nm=$('#shopName');nm.className='shopname '+nameCls(tryEq);nm.textContent=USER?USER.id:'롹순팅';
  const it=SHOP_BY[shopSel],act=$('#shopAct'),off=$('#shopOff');
  $('#shopMoney').textContent=`소지금 ${fmt(S.money)}원 · 산 아이템은 시즌이 끝나도 남아요`;
  if(!it){$('#shopSelN').textContent='아이템을 골라 입혀 보세요';$('#shopSelD').textContent=SEASON&&SEASON.metric==='pumpBest'?'이번 시즌 우승은 헛다리짚기 훈련 최고점으로 겨뤄요. 마음껏 꾸며 보세요!':'사면 소지금이 줄어서 시즌 순위도 내려가요. 꾸밀래, 우승할래?';act.hidden=true;off.hidden=true;return;}
  $('#shopSelN').textContent=`${it.name} · ${fmt(it.price)}원`;$('#shopSelD').textContent=it.desc;
  const own=shopHas(it.id),on=eq[it.slot]===it.id;
  act.hidden=false;off.hidden=!on;
  act.textContent=on?'장착 중':own?'장착하기':`사기 (${fmt(it.price)}원)`;
  act.disabled=on||(!own&&S.money-it.price<SHOP_KEEP);
}
