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
showLogin();showSplash();requestAnimationFrame(frame);
window.__dbg={BGM,BGMT,bgmSync,wantBgm,sfx,SFX,setMuted,setBgm,maybeLoan,du:DU,sp:SP,getS:()=>S,getUser:()=>USER,startLogin,cloudUrl,api,logout,startKick,SPOTS,PEN,DIFF,buildKicks,dayAction,hospitalize,forceFire:(ki,aim,s,ys,p,ko)=>{if(!M)M={bet:1000,goals:0,pts:0,res:[]};if(!M.kicks)M.kicks=buildKicks();setupKick(ki,ko);K.aim=aim;K.s=s;K.ys=ys;K.p=p;fire();return{out:K.out,info:K.info};},startMatch,held,mouse,setKey,solve,flight,proj,unproject,setupKick,getK:()=>K,getM:()=>M,getMode:()=>mode,getS:()=>S,pressedRef:()=>pressed,skipCut:()=>{pressed.SkipCut=true;},
  gymAction,bbqAction,buyDrink,buyTteok,rollCondition,applyCondition,CONDS};
