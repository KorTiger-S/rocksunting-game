'use strict';
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
$('#bigface').src=IMGDATA.base;
$('#verTip').textContent='(v'+APP_VERSION+')';
renderHub();setSync('idle');renderSeason();
if(cloudUrl())api('season_get').then(r=>setSeason(r.season)).catch(()=>{});
showLogin();autoLogin();showSplash();requestAnimationFrame(frame);
