'use strict';
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

