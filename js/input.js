'use strict';
/* ---------- input ---------- */
const held={};let pressed={};const mouse={x:W/2,y:H/2,click:false,down:false,mv:false};
const KMAP={KeyW:'ArrowUp',KeyA:'ArrowLeft',KeyS:'ArrowDown',KeyD:'ArrowRight'};
let mode='hub';
function setKey(code,down){if(down&&!held[code])pressed[code]=true;held[code]=down;}
window.addEventListener('keydown',e=>{
  let code=e.code;
  if(mode==='cut'&&code==='KeyS'){pressed.SkipCut=true;e.preventDefault();return;}
  code=KMAP[code]||code;
  if(mode!=='hub'&&(code.startsWith('Arrow')||code==='Space'))e.preventDefault();
  if(mode!=='hub'&&code==='Escape'){askQuit();return;}
  if(!e.repeat)setKey(code,true);else held[code]=true;
});
window.addEventListener('keyup',e=>{held[KMAP[e.code]||e.code]=false;});
window.addEventListener('blur',()=>{Object.keys(held).forEach(k=>held[k]=false);mouse.down=false;});
const cv=$('#cv'),ctx=cv.getContext('2d');
['#pad','#cv','.stagewrap'].forEach(s=>{const el=document.querySelector(s);if(el){el.addEventListener('contextmenu',e=>e.preventDefault());el.addEventListener('selectstart',e=>e.preventDefault());}});
document.querySelectorAll('#pad button').forEach(b=>{b.addEventListener('contextmenu',e=>e.preventDefault());b.addEventListener('touchstart',e=>e.preventDefault(),{passive:false});});
function mpos(e){const r=cv.getBoundingClientRect();mouse.x=(e.clientX-r.left)*W/r.width;mouse.y=(e.clientY-r.top)*H/r.height;}
cv.addEventListener('pointermove',e=>{mpos(e);mouse.mv=true;});
cv.addEventListener('pointerdown',e=>{mpos(e);mouse.click=true;mouse.down=true;mouse.mv=true;});
window.addEventListener('pointerup',()=>{mouse.down=false;});
document.querySelectorAll('#pad [data-k]').forEach(b=>{
  const k=b.dataset.k;
  b.addEventListener('pointerdown',e=>{e.preventDefault();setKey(k,true);});
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,()=>{held[k]=false;}));
});

