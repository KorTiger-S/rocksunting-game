'use strict';
const W=800,H=480,F=900,HOR=205;
/* 화면에 보이는 게임 버전. package.json의 version과 같게 맞춰 주세요 (build.js가 다르면 알려 줘요)
   버전 규칙  v메이저.마이너.패치  (v1.0.0에서 시작)
   - 메이저: 시즌이 바뀌면서 새 게임이 추가됐을 때
   - 마이너: 기능이 바뀌거나 굵직한 수정을 했을 때
   - 패치  : 자잘한 버그 수정 */
const APP_VERSION='1.6.0';
/* 캐릭터 표정 이미지 (assets/faces/*.jpg). 새 이미지를 추가하려면 여기에 경로를 등록하세요. */
const IMGDATA={
  "base": "assets/faces/base.jpg",
  "angry": "assets/faces/angry.jpg",
  "surprise": "assets/faces/surprise.jpg",
  "panic": "assets/faces/panic.jpg",
  "happy": "assets/faces/happy.jpg",
  "sad": "assets/faces/sad.jpg",
  "tired": "assets/faces/tired.jpg",
  "doubt": "assets/faces/doubt.jpg",
  "resolve": "assets/faces/resolve.jpg",
  "excited": "assets/faces/excited.jpg",
  "frustrated": "assets/faces/frustrated.jpg",
  "worn": "assets/faces/worn.jpg"
};
const IM={};
Object.keys(IMGDATA).forEach(k=>{const i=new Image();i.src=IMGDATA[k];IM[k]=i;});
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const fmt=n=>Math.floor(n).toLocaleString('ko-KR');
const FACES=['base','angry','surprise','panic','happy','sad','tired','doubt','resolve','excited','frustrated','worn'];
const DAYS=['월','화','수','목','금'];
const CONDS=['매우나쁨','나쁨','보통','좋음','매우좋음'];   /* 컨디션 5단계 (0~4) */
function gauss(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*v);}

