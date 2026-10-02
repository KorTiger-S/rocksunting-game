'use strict';
/* ---------- 상점 · 롹순팅 꾸미기 (v2.1.0~) ----------
   아이템은 모두 소지금으로 사요. 산 아이템(S.items.own)과 장착한 아이템(S.items.eq)은 시즌이 끝나도 남아요
   (서버 rk_reset_players가 items만 남기고 초기화해요). 우승 기준이 소지금인 시즌이면 사는 만큼 순위도 내려가요.
   얼굴 그림(assets/faces/*.jpg, 150×190)은 표정 12장 모두 얼굴 위치가 같아서, 같은 150×190 좌표로 그린 아이템을 위에 겹쳐요.
     머리 윗부분 y≈12 · 이마 y≈55 · 눈 (45,90)·(102,90) · 입 (75,125) · 귀 x≈15·135
   - 모자·안경·얼굴 소품(hat/glass/acc): svg(150×190 좌표의 SVG 조각). 그림 아이템은 svg 대신 img에 150×190 투명 PNG 경로를 넣으면 돼요.
   - 테두리(frame): 프로필 아이콘·랭킹 얼굴의 테두리 CSS 클래스(css)
   - 이름 색(name): 랭킹·1:1 대결 이름의 CSS 클래스(css)
   전신(v2.5.0~): 얼굴 그림 아래에 몸을 붙인 150×380 좌표예요. 머리는 y 0~190(얼굴 그림 그대로), 몸은 어깨 y≈172 · 허리 y≈270 · 발 y≈368.
     손 (14,261)·(136,261) · 다리 왼쪽 x 38~72 · 오른쪽 x 78~112 · 몸통 x 28~122
   - 상의·하의·신발·가방(top/bottom/shoes/bag): svg(150×380 좌표). 가방처럼 몸 뒤로 가는 부분은 back에 따로 그려요.
     color(+상의는 vest)는 게임 화면의 작은 롹순팅에 입히는 대표 색이에요. */
const SHOP_SLOTS=[{id:'hat',name:'모자'},{id:'glass',name:'안경'},{id:'acc',name:'얼굴 소품'},{id:'top',name:'상의'},{id:'bottom',name:'하의'},{id:'shoes',name:'신발'},{id:'bag',name:'가방'},{id:'frame',name:'테두리'},{id:'name',name:'이름 색'}];
/* 전신 그림에서 같이 쓰는 모양 (150×380 좌표): 긴소매·반소매 상의 윤곽, 긴바지, 왼쪽·오른쪽 신발, 윤곽선 */
const BD={
  long:'M14 192Q20 176 52 172Q75 184 98 172Q130 176 136 192L144 252L128 255L120 214L122 276H28L30 214L22 255L6 252Z',
  short:'M14 192Q20 176 52 172Q75 184 98 172Q130 176 136 192L142 222L124 226L120 214L122 276H28L30 214L26 226L8 222Z',
  pants:'M30 268H120L118 352H80L75 292L70 352H32Z',
  shoeL:'M32 350H70V362Q70 368 64 368H26Q20 368 22 362Q24 354 32 350Z',
  shoeR:'M80 350H118Q126 354 128 362Q130 368 124 368H86Q80 368 80 362Z',
  ln:'stroke="#232a45" stroke-width="3" stroke-linejoin="round"'
};
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
  {id:'nrainbow',slot:'name',name:'무지개 이름',price:25000,desc:'랭킹·1:1 대결에서 이름 색',css:'nm-rainbow'},
  /* ---------- 전신 (150×380 좌표) ---------- */
  {id:'jersey',slot:'top',name:'축구부 유니폼',price:4000,color:'#e2334d',vest:'#fff',desc:'등번호 10번, 에이스의 상징',
   svg:`<path d="${BD.short}" fill="#e2334d" ${BD.ln}/><path d="M56 173Q75 188 94 173" fill="none" stroke="#fff" stroke-width="4"/><path d="M11 214l16 4M139 214l-16 4" stroke="#fff" stroke-width="4"/><text x="75" y="254" font-size="34" font-weight="900" text-anchor="middle" fill="#fff" stroke="#232a45" stroke-width="1.5" font-family="sans-serif">10</text>`},
  {id:'hoodie',slot:'top',name:'회색 후드티',price:6000,color:'#9aa3ad',vest:'#7d8792',desc:'쉬는 시간 국룰',
   svg:`<path d="${BD.long}" fill="#9aa3ad" ${BD.ln}/><path d="M42 176Q75 200 108 176Q100 166 75 168Q50 166 42 176z" fill="#7d8792" ${BD.ln}/><path d="M68 186v24M82 186v24" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M48 238h54l-6 30H54z" fill="#8a939e" stroke="#232a45" stroke-width="2.5"/><path d="M6 246l16 3M144 246l-16 3" stroke="#232a45" stroke-width="2"/>`},
  {id:'hawaii',slot:'top',name:'하와이안 셔츠',price:9000,color:'#1aa39a',vest:'#ffd23f',desc:'방학 기분 미리 내기',
   svg:`<path d="${BD.short}" fill="#1aa39a" ${BD.ln}/><path d="M56 173L75 200L94 173Q75 168 56 173z" fill="#f8dcc8" stroke="#232a45" stroke-width="2"/><path d="M52 172l10 34 13-6M98 172l-10 34-13-6" fill="none" stroke="#232a45" stroke-width="2.5"/><path d="M75 200v76" stroke="#232a45" stroke-width="2"/><g fill="#ffd23f" stroke="#c98a00" stroke-width="1"><circle cx="44" cy="226" r="6"/><circle cx="104" cy="214" r="6"/><circle cx="96" cy="258" r="6"/><circle cx="20" cy="204" r="4.5"/></g><g fill="#ff7aa2"><circle cx="56" cy="252" r="5"/><circle cx="110" cy="240" r="4.5"/><circle cx="130" cy="200" r="4.5"/><circle cx="40" cy="198" r="4"/></g><g fill="#2f8f5b"><circle cx="50" cy="232" r="3"/><circle cx="100" cy="222" r="3"/></g>`},
  {id:'leather',slot:'top',name:'가죽 재킷',price:20000,color:'#26262c',vest:'#f4f4f4',desc:'롹스타 순팅',
   svg:`<path d="${BD.long}" fill="#26262c" ${BD.ln}/><path d="M56 173Q75 186 94 173L90 276H60z" fill="#f4f4f4" stroke="#232a45" stroke-width="2"/><path d="M52 172l14 40-8 4-16-36zM98 172l-14 40 8 4 16-36z" fill="#3a3a44" stroke="#232a45" stroke-width="2"/><path d="M60 214l-2 62M90 214l2 62" stroke="#b9b9c4" stroke-width="2.5" stroke-dasharray="3 3"/><path d="M6 246l16 3M144 246l-16 3" stroke="#55555f" stroke-width="3"/><circle cx="44" cy="200" r="2.5" fill="#d0d0d8"/><circle cx="106" cy="200" r="2.5" fill="#d0d0d8"/>`},
  {id:'shorts',slot:'bottom',name:'축구부 반바지',price:2000,color:'#f4f4f4',desc:'다리가 시원해요',
   svg:`<path d="M30 268H120L121 308H80L75 292L70 308H29z" fill="#fff" ${BD.ln}/><path d="M33 270v36M117 270v36" stroke="#e2334d" stroke-width="5"/><path d="M38 340h34v12H38zM78 340h34v12H78z" fill="#e2334d" stroke="#232a45" stroke-width="2"/>`},
  {id:'jeans',slot:'bottom',name:'청바지',price:5000,color:'#3d6db5',desc:'어디에나 어울리는 기본템',
   svg:`<path d="${BD.pants}" fill="#3d6db5" ${BD.ln}/><path d="M30 268h90v8H30z" fill="#5a3a22" stroke="#232a45" stroke-width="2"/><rect x="70" y="269" width="10" height="6" fill="#e8c35a"/><path d="M38 280q10 10 22 0M90 280q10 10 22 0M54 296l-2 54M96 296l2 54" fill="none" stroke="#2a4f8a" stroke-width="2"/>`},
  {id:'track',slot:'bottom',name:'삼선 트레이닝 바지',price:4000,color:'#1f2433',desc:'체육 시간 필수',
   svg:`<path d="${BD.pants}" fill="#1f2433" ${BD.ln}/><path d="M35 270l1 82M40 270l1 82M45 270l1 82M115 270l-1 82M110 270l-1 82M105 270l-1 82" stroke="#fff" stroke-width="2.2"/>`},
  {id:'cargo',slot:'bottom',name:'카고 바지',price:8000,color:'#8a7f55',desc:'주머니가 많아서 빵도 들어가요',
   svg:`<path d="${BD.pants}" fill="#8a7f55" ${BD.ln}/><rect x="34" y="298" width="18" height="20" rx="2" fill="#7a704a" stroke="#232a45" stroke-width="2"/><rect x="98" y="298" width="18" height="20" rx="2" fill="#7a704a" stroke="#232a45" stroke-width="2"/><path d="M34 304h18M98 304h18" stroke="#232a45" stroke-width="1.5"/>`},
  {id:'cleats',slot:'shoes',name:'축구화',price:3000,color:'#1b1b1f',desc:'프리킥 정확도 +0 (기분은 +100)',
   svg:`<path d="${BD.shoeL}" fill="#1b1b1f" ${BD.ln}/><path d="${BD.shoeR}" fill="#1b1b1f" ${BD.ln}/><path d="M34 357q14-6 30 0M86 357q14-6 30 0" fill="none" stroke="#e2334d" stroke-width="3"/><path d="M28 369v4M40 369v4M54 369v4M66 369v4M84 369v4M96 369v4M110 369v4M122 369v4" stroke="#232a45" stroke-width="3"/>`},
  {id:'redkicks',slot:'shoes',name:'빨간 운동화',price:5000,color:'#e2334d',desc:'뜀박질 속도 +0 (마음만은 +100)',
   svg:`<path d="${BD.shoeL}" fill="#e2334d" ${BD.ln}/><path d="${BD.shoeR}" fill="#e2334d" ${BD.ln}/><path d="M22 363h48M80 363h48" stroke="#fff" stroke-width="4"/><path d="M42 352l6 4M48 351l6 4M90 352l6 4M96 351l6 4" stroke="#fff" stroke-width="2"/>`},
  {id:'goldkicks',slot:'shoes',name:'황금 운동화',price:25000,color:'#f5c518',desc:'걸을 때마다 반짝',
   svg:`<path d="${BD.shoeL}" fill="#f5c518" stroke="#8a6d00" stroke-width="3" stroke-linejoin="round"/><path d="${BD.shoeR}" fill="#f5c518" stroke="#8a6d00" stroke-width="3" stroke-linejoin="round"/><path d="M22 363h48M80 363h48" stroke="#e8a91c" stroke-width="4"/><path d="M14 346l3 5 5 2-5 2-3 5-3-5-5-2 5-2zM136 344l3 5 5 2-5 2-3 5-3-5-5-2 5-2z" fill="#fff4b0"/>`},
  {id:'backpack',slot:'bag',name:'책가방',price:3000,desc:'교과서는 사물함에 두고 다녀요',
   back:'<path d="M26 186Q24 160 50 158H100Q126 160 124 186V262H26z" fill="#3b6fd8" stroke="#232a45" stroke-width="3"/><path d="M50 158q25-10 50 0" fill="none" stroke="#2c56b0" stroke-width="4"/>',
   svg:'<path d="M44 176l4 92M106 176l-4 92" stroke="#232a45" stroke-width="9" stroke-linecap="round"/><path d="M44 176l4 92M106 176l-4 92" stroke="#3b6fd8" stroke-width="5" stroke-linecap="round"/><rect x="40" y="232" width="12" height="8" rx="2" fill="#c9d3e6" stroke="#232a45" stroke-width="1.5"/><rect x="98" y="232" width="12" height="8" rx="2" fill="#c9d3e6" stroke="#232a45" stroke-width="1.5"/>'},
  {id:'cross',slot:'bag',name:'크로스백',price:5000,desc:'용돈 지갑 넣는 곳',
   svg:'<path d="M42 176L114 254" stroke="#232a45" stroke-width="8" stroke-linecap="round"/><path d="M42 176L114 254" stroke="#8b5a2b" stroke-width="4.5" stroke-linecap="round"/><rect x="100" y="244" width="36" height="30" rx="6" fill="#a0522d" stroke="#232a45" stroke-width="3"/><path d="M100 254q18 10 36 0" fill="#8b4513" stroke="#232a45" stroke-width="2.5"/><circle cx="118" cy="259" r="2.5" fill="#e8c35a"/>'},
  {id:'guitar',slot:'bag',name:'기타 케이스',price:12000,desc:'소리새 무대 가는 길',
   back:'<g transform="translate(6 40) rotate(-28 75 230)"><path d="M62 96h26v74q22 6 22 38 0 22-14 34 20 10 20 40 0 40-41 40s-41-40-41-40q0-30 20-40-14-12-14-34 0-32 22-38z" fill="#2b2b33" stroke="#232a45" stroke-width="3"/><path d="M75 100v240" stroke="#55555f" stroke-width="2"/></g>',
   svg:'<path d="M110 176L38 258" stroke="#232a45" stroke-width="7" stroke-linecap="round"/><path d="M110 176L38 258" stroke="#e2334d" stroke-width="3.5" stroke-linecap="round"/>'}
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
const BODY_SLOTS=['top','bottom','shoes','bag'],BODY_H=380;   /* 전신 아이템 슬롯 · 전신 그림 높이(150 기준) */
const isBodySlot=sl=>BODY_SLOTS.includes(sl);
function svgIm(svg,h){
  const im=new Image();im.onload=()=>shopRefreshFaces();
  im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 ${h}" width="150" height="${h}">${svg}</svg>`);
  return im;
}
function dressIm(it,part){   /* part: 'back'이면 몸 뒤로 가는 부분 */
  const k=it.id+(part?':'+part:'');
  if(!DRESS_IM[k]){
    if(it.img&&!part){const im=new Image();im.onload=()=>shopRefreshFaces();im.src=it.img;DRESS_IM[k]=im;}
    else DRESS_IM[k]=svgIm(part?it[part]:it.svg,isBodySlot(it.slot)?BODY_H:190);
  }
  return DRESS_IM[k];
}
SHOP_ITEMS.forEach(it=>{if(it.svg||it.img)dressIm(it);if(it.back)dressIm(it,'back');});   /* 미리 불러 둬요 */
/* 캔버스에 얼굴을 그린 바로 뒤에 불러요. 얼굴을 그린 것과 같은 (원본 영역,) 대상 영역을 넘기면 딱 맞게 겹쳐요. */
function drawDress(c,eq,...rect){
  DRESS_ORDER.forEach(sl=>{const it=eqItem(eq,sl);if(!it)return;const im=dressIm(it);if(im.complete&&im.naturalWidth)c.drawImage(im,...rect);});
}

/* ---------- 전신: 얼굴 그림 아래에 몸을 붙여요 (150×380 좌표) ----------
   기본 차림은 머대부고 교복(남색 재킷 · 회색 바지 · 흰 운동화). 상의·하의·신발 아이템을 사면 그 자리를 바꿔 입어요. */
const SKIN='#f8dcc8';
const BODY_BASE={
  neck:`<path d="M61 140H89V184H61z" fill="${SKIN}"/><path d="M61 146V180M89 146V180" stroke="#232a45" stroke-width="2.5"/>`,
  skin:`<g fill="${SKIN}" stroke="#232a45" stroke-width="2.5" stroke-linejoin="round"><path d="M16 194L6 252L22 255L30 214z"/><path d="M134 194L144 252L128 255L120 214z"/><circle cx="14" cy="261" r="7.5"/><circle cx="136" cy="261" r="7.5"/><path d="M38 276H72L70 352H40z"/><path d="M78 276H112L110 352H80z"/></g>`,
  top:`<path d="${BD.long}" fill="#2d3550" ${BD.ln}/><path d="M56 173L75 200L94 173Q75 168 56 173z" fill="#fff" stroke="#232a45" stroke-width="2"/><path d="M72 182h6l3 26-6 7-6-7z" fill="#c0392b" stroke="#232a45" stroke-width="1.5"/><path d="M75 215v61" stroke="#1b2033" stroke-width="2"/><circle cx="80" cy="234" r="2.2" fill="#e8c35a"/><circle cx="80" cy="254" r="2.2" fill="#e8c35a"/><path d="M6 246l16 3M144 246l-16 3" stroke="#e8c35a" stroke-width="2"/>`,
  bottom:`<path d="${BD.pants}" fill="#5b6170" ${BD.ln}/><path d="M75 270v22" stroke="#232a45" stroke-width="2"/>`,
  shoes:`<path d="${BD.shoeL}" fill="#fff" ${BD.ln}/><path d="${BD.shoeR}" fill="#fff" ${BD.ln}/><path d="M22 363h48M80 363h48" stroke="#232a45" stroke-width="2"/>`
};
const BODY_IM={};Object.keys(BODY_BASE).forEach(k=>{BODY_IM[k]=svgIm(BODY_BASE[k],BODY_H);});
const ready=im=>im&&im.complete&&im.naturalWidth;
/* 몸에 그릴 순서(아래 → 위): 가방 뒤쪽 → 목 → [머리] → 피부(팔·손·다리) → 신발 → 하의 → 상의 → 가방 앞쪽(끈) */
function bodyLayers(eq){
  const at=sl=>eqItem(eq,sl),back=[],front=[BODY_IM.skin],bag=at('bag');
  if(bag&&bag.back)back.push(dressIm(bag,'back'));
  back.push(BODY_IM.neck);
  ['shoes','bottom','top'].forEach(sl=>{const it=at(sl);front.push(it?dressIm(it):BODY_IM[sl]);});
  if(bag&&(bag.svg||bag.img))front.push(dressIm(bag));
  return {back,front};
}
/* 얼굴 그림에서 머리만 오려 내는 선: 턱(y≈150) 아래의 원래 교복 어깨는 버리고, 목·몸은 새로 그려요 */
const HEAD_CLIP=[[0,0],[150,0],[150,124],[128,136],[106,148],[90,152],[60,152],[44,148],[22,136],[0,124]];
const BODY_CACHE={};
function bodyURL(face,eq){
  const base=IMGDATA[face]||IMGDATA.base;if(avaTainted)return base;
  const ck=face+'|'+eqKey(eq)+'|'+BODY_SLOTS.map(sl=>(eqItem(eq,sl)||{}).id||'').join('.');
  if(BODY_CACHE[ck])return BODY_CACHE[ck];
  const im=IM[face]||IM.base;if(!ready(im)){im.addEventListener('load',shopRefreshFaces,{once:true});return '';}
  const head=DRESS_ORDER.map(sl=>eqItem(eq,sl)).filter(Boolean).map(it=>dressIm(it)),L=bodyLayers(eq);
  if(head.concat(L.back,L.front).some(x=>!ready(x)))return '';   /* 아직 불러오는 중: 다 불러오면 shopRefreshFaces가 다시 그려요 */
  const S2=2,cv=document.createElement('canvas');cv.width=150*S2;cv.height=BODY_H*S2;
  const c=cv.getContext('2d'),full=x=>c.drawImage(x,0,0,150*S2,BODY_H*S2);
  L.back.forEach(full);
  c.save();c.beginPath();HEAD_CLIP.forEach(([x,y],i)=>c[i?'lineTo':'moveTo'](x*S2,y*S2));c.closePath();c.clip();
  c.drawImage(im,0,0,150*S2,190*S2);                       /* 머리: 얼굴 그림에서 턱까지만 */
  c.restore();
  head.forEach(x=>c.drawImage(x,0,0,150*S2,190*S2));      /* 모자·안경·얼굴 소품 */
  L.front.forEach(full);
  try{BODY_CACHE[ck]=cv.toDataURL('image/png');}catch(e){avaTainted=true;return base;}
  return BODY_CACHE[ck];
}
/* 게임 화면의 작은 롹순팅(render.js kid)에 입힐 색: 상의(coat·vest)·하의(pants)·신발(shoe). 안 입은 곳은 교복 그대로 */
function myWear(){
  const eq=myEq(),t=eqItem(eq,'top'),b=eqItem(eq,'bottom'),f=eqItem(eq,'shoes'),o={};
  if(t&&t.color){o.coat=t.color;o.vest=t.vest||t.color;}if(b&&b.color)o.pants=b.color;if(f&&f.color)o.shoe=f.color;
  return o;
}
/* 전신 <img>를 표정 face로. eq를 안 넘기면 내 장착 아이템. 그림을 불러오는 중이면 잠깐 비워 둬요 */
function setBody(el,face,eq){
  if(!el)return;el.dataset.body=face;el._eq=eq||null;
  const u=bodyURL(face,eq||myEq());if(u)el.src=u;else if(!el.src)el.src=IMGDATA[face]||IMGDATA.base;
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
  faceRefreshT=setTimeout(()=>{
    document.querySelectorAll('img[data-face]').forEach(el=>{el.src=avatarURL(el.dataset.face,el._eq||myEq());});
    document.querySelectorAll('img[data-body]').forEach(el=>{const u=bodyURL(el.dataset.body,el._eq||myEq());if(u)el.src=u;});
  },30);
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
    if(isPractice()){sfx('deny');toast('연습 기간에는 살 수 없어요. 정규 시즌이 시작되면 열려요! (입혀 보기·가진 아이템 장착은 돼요)');return;}
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
      if(isBodySlot(it.slot)){im.classList.add('body','t-'+it.slot);setBody(im,'base',{[it.slot]:it.id});}   /* 옷·가방은 그 부분이 보이게 전신을 잘라서 */
      else if(it.slot==='frame')setFace(im,'base',{});else setFace(im,'base',{[it.slot]:it.id});b.appendChild(im);}
    const t=document.createElement('b');t.textContent=it.name;b.appendChild(t);
    const p=document.createElement('small');p.textContent=on?'장착 중':own?'보유':fmt(it.price)+'원';if(on||own)p.className='own';b.appendChild(p);
    b.setAttribute('aria-label',`${it.name} · ${on?'장착 중':own?'보유':fmt(it.price)+'원'}`);
    b.addEventListener('click',()=>{shopSel=it.id;sfx('tick');renderShop();});
    grid.appendChild(b);
  });
  /* 미리보기: 고른 아이템을 입혀 본 모습 */
  const tryEq=shopTry(),ava=$('#shopAva');
  ava.classList.remove('fr-gold','fr-rainbow');
  if(shopSlot==='frame'){   /* 테두리는 동그란 얼굴에서만 보여서 얼굴로 */
    ava.classList.remove('body');delete ava.dataset.body;const fc=frameCls(tryEq);if(fc)ava.classList.add(fc);setFace(ava,'happy',tryEq);
  }else{ava.classList.add('body');delete ava.dataset.face;setBody(ava,'happy',tryEq);}   /* 나머지는 전신으로 입혀 봐요 */
  const nm=$('#shopName');nm.className='shopname '+nameCls(tryEq);nm.textContent=USER?USER.id:'롹순팅';
  const it=SHOP_BY[shopSel],act=$('#shopAct'),off=$('#shopOff');
  $('#shopMoney').textContent=isPractice()?'🔒 연습 기간에는 살 수 없어요. 입혀 보기와 가진 아이템 장착은 돼요.':`소지금 ${fmt(S.money)}원 · 산 아이템은 시즌이 끝나도 남아요`;
  if(!it){$('#shopSelN').textContent='아이템을 골라 입혀 보세요';$('#shopSelD').textContent=SEASON&&SEASON.metric==='pumpBest'?'이번 시즌 우승은 헛다리짚기 훈련 최고점으로 겨뤄요. 마음껏 꾸며 보세요!':'사면 소지금이 줄어서 시즌 순위도 내려가요. 꾸밀래, 우승할래?';act.hidden=true;off.hidden=true;return;}
  $('#shopSelN').textContent=`${it.name} · ${fmt(it.price)}원`;$('#shopSelD').textContent=it.desc;
  const own=shopHas(it.id),on=eq[it.slot]===it.id;
  act.hidden=false;off.hidden=!on;
  act.textContent=on?'장착 중':own?'장착하기':`사기 (${fmt(it.price)}원)`;
  act.disabled=on||(!own&&(isPractice()||S.money-it.price<SHOP_KEEP));
}
