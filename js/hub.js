'use strict';
/* ---------- 허브 ---------- */
let betV=1000;
const betMax=()=>Math.min(3000,S.money);
function renderHub(){
  renderDuelCard();
  $('#hMoney').textContent=fmt(S.money)+'원';$('#pfMoney').textContent=fmt(S.money)+'원';$('#hDay').textContent=`${S.week}주차 ${DAYS[S.day]}요일`;
  $('#chat').innerHTML=`<b>${chatCur.n}</b>: ${chatCur.t}`;
  const f=S.fatigue||0;$('#fat').textContent='●'.repeat(f)+'○'.repeat(Math.max(0,3-f))+(f>=2?' (위험!)':'');
  $('#jobBtn').textContent=f>=2?'매점 알바 (+600원) ⚠쓰러질 위험':`매점 알바 (+600원)`;
  $('#houBtn').textContent=houDone()?'😂 호우의 아재개그 (오늘은 다 씀)':`😂 호우의 아재개그 (${houLeftToday()}/${HOU_DAILY})`;
  renderStats();
  $('#note').textContent=S.news;$('#note').className='note'+(S.cleared?' win':'');
  $('#prog').style.width=clamp(S.money/1000000*100,0,100)+'%';$('#goalTxt').textContent=`${fmt(S.money)} / 1,000,000원 (승 ${S.wins} · 패 ${S.losses})`;
  betV=clamp(betV,1000,Math.max(1000,betMax()));
  $('#betV').textContent=fmt(betV)+'원';
  const can=S.money>=1000;
  $('#acceptBtn').disabled=!can;$('#bMinus').disabled=betV<=1000||!can;$('#bPlus').disabled=betV+100>betMax();$('#bBig').disabled=betV+500>betMax();
}
/* ---------- 몸 관리: 쇠질하기(근력)·난지바베큐(체력)는 하루를 쓰고, 소리새가서 노래부르기(컨디션)·디델리(기분)는 즉시 사 먹어요 ---------- */
const GYM_COST=1500,BBQ_COST=2000,DRINK_COST=700,TTEOK_COST=1000;
const TTEOK_IMG='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><ellipse cx="32" cy="46" rx="26" ry="14" fill="#e8562c"/><ellipse cx="32" cy="42" rx="26" ry="13" fill="#f2703f"/><rect x="14" y="18" width="7" height="26" rx="3.5" fill="#fff" stroke="#d9c9b0" stroke-width="1.5"/><rect x="28" y="14" width="7" height="30" rx="3.5" fill="#fff" stroke="#d9c9b0" stroke-width="1.5"/><rect x="42" y="20" width="7" height="24" rx="3.5" fill="#fff" stroke="#d9c9b0" stroke-width="1.5"/><circle cx="24" cy="40" r="2.4" fill="#c2321a"/><circle cx="36" cy="36" r="2.4" fill="#c2321a"/><circle cx="30" cy="44" r="2" fill="#c2321a"/><ellipse cx="32" cy="42" rx="26" ry="13" fill="none" stroke="#a8391c" stroke-width="2"/></svg>');
$('#tteokIcon').src=TTEOK_IMG;
const moodLabel=m=>CONDS[clamp(Math.floor(clamp(m,0,100)/20),0,4)];   /* 기분(0~100)을 컨디션과 같은 5단계 라벨로 */
function renderStats(){
  const stam=clamp(S.stam==null?25:S.stam,0,100),str=clamp(S.str==null?25:S.str,0,100),mood=clamp(S.mood==null?50:S.mood,0,100),cond=clamp(S.cond==null?2:S.cond,0,4);
  $('#statStam').textContent=Math.round(stam)+'%';$('#stamBar').style.width=stam+'%';
  $('#statStr').textContent=Math.round(str)+'%';$('#strBar').style.width=str+'%';
  $('#statMood').textContent=moodLabel(mood);
  $('#statCond').textContent=CONDS[cond];
  $('#gymBtn').disabled=S.money<GYM_COST;$('#bbqBtn').disabled=S.money<BBQ_COST;
  $('#drinkBtn').disabled=S.money<DRINK_COST||cond>=4;$('#tteokBtn').disabled=S.money<TTEOK_COST||mood>=100;
}
/* 돈을 쓰는 순간 무엇이 얼마나 바뀌었는지 바로 보이도록, 동전 소리 + 효과별 소리 + 토스트 알림을 함께 띄워요 */
function spendToast(msg){sfx('coin');setTimeout(()=>sfx('coin'),110);toast(msg);}
function gymAction(){
  if(S.money<GYM_COST)return;
  const before=Math.round(clamp(S.str==null?25:S.str,0,100));
  S.str=clamp((S.str==null?25:S.str)+10,0,100);S.gymGap=-1;
  spendToast(`💪 헬스장 이용료 ${fmt(GYM_COST)}원 지불 · 근력 ${before}% → ${Math.round(S.str)}%`);
  dayAction('헬스장에서 쇠질을 했다. 근력이 올랐다!',-GYM_COST,false);
}
function bbqAction(){
  if(S.money<BBQ_COST)return;
  const before=Math.round(clamp(S.stam==null?25:S.stam,0,100));
  S.stam=clamp((S.stam==null?25:S.stam)+12,0,100);S.bbqGap=-1;
  spendToast(`🍖 고기값 ${fmt(BBQ_COST)}원 지불 · 체력 ${before}% → ${Math.round(S.stam)}%`);
  dayAction('난지 한강공원에서 바베큐를 구워 먹었다. 체력이 올랐다!',-BBQ_COST,false);
}
function buyDrink(){
  if(S.money<DRINK_COST||(S.cond==null?2:S.cond)>=4)return;
  const before=CONDS[clamp(S.cond==null?2:S.cond,0,4)];
  S.money-=DRINK_COST;S.cond=clamp((S.cond==null?2:S.cond)+1,0,4);S.news='소리새에 가서 노래를 불렀다. 컨디션이 좋아졌다!';
  spendToast(`🎤 소리새 노래방비 ${fmt(DRINK_COST)}원 지불 · 컨디션 ${before} → ${CONDS[S.cond]}`);
  save();renderHub();
}
function buyTteok(){
  if(S.money<TTEOK_COST||(S.mood==null?50:S.mood)>=100)return;
  const before=moodLabel(S.mood==null?50:S.mood);
  S.money-=TTEOK_COST;S.mood=clamp((S.mood==null?50:S.mood)+15,0,100);S.news='디델리에서 라볶이를 사 먹었다. 기분이 좋아졌다!';
  spendToast(`🍢 디델리 라볶이 ${fmt(TTEOK_COST)}원 지불 · 기분 ${before} → ${moodLabel(S.mood)}`);
  save();renderHub();
}
$('#gymBtn').addEventListener('click',gymAction);
$('#bbqBtn').addEventListener('click',bbqAction);
$('#drinkBtn').addEventListener('click',buyDrink);
$('#tteokBtn').addEventListener('click',buyTteok);
/* ---------- 호우의 아재개그: 하루에 한 번, 정답을 맞히면 500원 ---------- */
const HOU_REWARD=500;
const HOU_QUIZ=[
 {q:'아기 공룡 둘리가 고등학교에 입학했대요. 어디 고등학교죠?',a:'빙하타고'},
 {q:'세상에서 가장 쎈 대학교 이름은?',a:'와세다 대학'},
 {q:'가장 지루하고 지겨운 중학교 이름은?',a:'로딩중'},
 {q:'해리포터는 어떤 사람을 말하는가요?',a:'해를 취재하는 사람'},
 {q:'우리 몸에 좋지 않은 청바지 이름은?',a:'유해진'},
 {q:'도둑놈이 가장 좋아하는 아이스크림은?',a:'보석바'},
 {q:'이 세상에서 가장 뜨거운 과일은?',a:'천도복숭아'},
 {q:'반성문을 영어로 표현하면?',a:'글로벌'},
 {q:'우리나라에서 가장 오래된 화장실은?',a:'전봇대'},
 {q:'아픈 사람들이 원하는 반지는 어떤 반지가 있죠?',a:'힐링'},
 {q:'몸매랑 얼굴은 예쁜데 속이 텅빈 여자는?',a:'마네킹'},
 {q:'서울에서 조금 뚱뚱한 사람들이 사는 동네는?',a:'반포동'},
 {q:'지구에서 기형아가 가장 많이 태어나는 나라 이름은?',a:'네팔'},
 {q:'아이스크림이 죽다는 네자로 줄여보세요',a:'다이하드'},
 {q:'김밥이 경찰서에 간 이유는 무엇인겨?',a:'참기름이 고소해서'},
 {q:'세상에서 가장 야한 채소는 무엇인겨?',a:'버섯'},
 {q:'김밥이 죽으면 어디로 가남요?',a:'김밥천국'},
 {q:'바나나가 웃으면?',a:'바나나킥'},
 {q:'아버지가 정말 강한 사람이다를 세자로 줄이면?',a:'부가세'},
 {q:'할아버지 할머니가 가장 좋아하는 폭포는 무엇이대요?',a:'나이야가라'},
 {q:'할아버지가 좋아하는 돈은?',a:'할머니'},
 {q:'조금 전에 울었다가 그쳤던 사람을 다섯자로 줄이면',a:'아까운사람'},
 {q:'한의사가 가장 좋아하는 말은?',a:'인생은 한방이여'},
 {q:'이 죽을 먹으면 자연스럽게 웃게 되죠. 무슨 죽이죠?',a:'히죽'},
 {q:'이 세상에서 가장 쉬운 숫자는',a:['190000','19만'],note:'쉽구만'},
 {q:'닿기만 해도 취하는 술이 있어요.',a:'입술'},
 {q:'아저씨들이 좋아하는 돈은?',a:'아주머니'},
 {q:'도둑놈이 훔치는 돈을 무엇이라고 말할까?',a:'슬그머니'},
 {q:'채소 장수가 가장 싫어하는 도시 이름은?',a:'시드니'},
 {q:'사람의 머리가 세 개 있다를 영어로 말하면?',a:'헤드셋'},
 {q:'인디언 추장보다 높은 사람은?',a:'고추장'},
 {q:'어부들이 이 가수를 싫어합니다. 누구죠?',a:'배철수'},
 {q:'남을 등처먹고 사는 사람은?',a:'안마사'},
 {q:'많은 개수의 모자가 뭉쳐 있는 것을 네자로 줄이면',a:'밀짚모자'},
 {q:'제일 억울한 도형은?',a:'원통'},
 {q:'모든 사람들을 일어나게 하는 숫자는?',a:'5',note:'다~섯'},
 {q:'치과 의사들은 이 아파트에는 살지 않아요. 어디예요?',a:'이편한세상'},
 {q:'세계에서 가장 인기 있는 벌레 이름은?',a:'스타벅스'},
 {q:'지방 흡임의 반대말이 있다네요.',a:'수도권배출'},
 {q:'소금의 유통기간은 며칠일까요?',a:'천일염'},
 {q:'이 세상에서 가장 잔인한 비빔밥은?',a:'산채비빔밥'},
 {q:'고등학생이 가장 싫어하는 나무 이름은?',a:'야자나무'},
 {q:'비가 한시간 동안 내린다를 5자로 줄이면',a:'추적육십분'},
 {q:'승용차 문을 세게 닫으면 안되는 이유는?',a:'문에 네개니까'},
 {q:'미소의 반댓말을 무엇이라 하죠?',a:'당기소'},
 {q:'사람의 몸무게가 가장 많이 나갈때는 언제인가요?',a:'철들때'},
 {q:'자동차를 발로 차다를 네자로 말한다면?',a:'카놀라유'},
 {q:'소변과 대변 중에 어떤 것이 먼저 나오는지 아는 사람?',a:'급한것'},
 {q:'단무지가 버스를 타면서 하는 말은?',a:'저 무임 승차요'},
 {q:'전화를 가지고 건물을 세웠는데 그 건물의 이름은?',a:'콜로세움'},
 {q:'신데렐라가 잠을 못잔다를 네자로 줄이면',a:'모짜렐라'},
 {q:'신이 화를 내고 있다를 세자로 줄이면',a:'신발끈'},
 {q:'우리나라에서 땅값이 가장 싼 동네의 이름은?',a:'일원동'},
 {q:'술과 커피를 팔지 않습니다를 사자성어로 하면?',a:'주차금지'},
 {q:'연예인 송해교 송대관 송윤아 송중기의 공통점을 세자로 줄이면?',a:'성동일'},
 {q:'한국에서 가장 싸움을 잘하는 오리는?',a:'을지문덕'},
 {q:'딱 세사람 밖에 탈 수 없는 차 이름은?',a:'인삼차'},
 {q:'일본산 귤이 자신을 까먹으라고 하는 말은?',a:'나까무라'},
 {q:'드라마를 제작했는데 새우가 주인공이래요? 어떤 드라마죠?',a:'대하드라마'},
 {q:'호랑이가 새차를 타고 지나가는 여자에게 하는 말은?',a:'타이거'},
 {q:'못팔고도 돈을 잘 버는 사람은 누구인교?',a:'철물점 아저씨'},
 {q:'곰돌이 푸가 세 마리가 있으면?',a:'삼푸'},
 {q:'얼음이 죽다를 세자로 줄이면?',a:'다이빙'},
 {q:'왼쪽으로 절하는 것을 이렇게 표현하죠.',a:'좌절'},
 {q:'신발 한통에는 오천원 두통엔?',a:'게보린'},
 {q:'곰은 사고를 어떻게 먹을까요?',a:'베어먹지롱'},
 {q:'돌잔치를 하다를 영어로 말해보쇼',a:'락페스티벌'},
 {q:'세상에서 가장 뜨거운 바다는?',a:'열받아'},
 {q:'바람이 살랑살랑 가볍고 귀엽게 부는 동네는?',a:'분당'},
 {q:'손가락은 핑거라고 말하죠. 주먹은 뭐라고 말하죠?',a:'오므린거'},
 {q:'아주 오래전에 건설된 다리를 뭐라 부를까요?',a:'구닥다리'},
 {q:'침대를 밀고 돌리다를 네자로 줄이면?',a:'배드민턴'},
 {q:'우리나라 왕중에 성형한 왕이 있어요. 누구죠?',a:'인조임금'},
 {q:'세상에서 가장 돈을 많이 가지고 있는 새는?',a:'백조'},
 {q:'복은 크게 받아야 하는데 가장 작은 복은 뭐라할까요?',a:'복분자'},
 {q:'땅이 슬프다고 우는데 어떻게 우는지 아는교?',a:'흙흙'},
 {q:'베를린에서 밥을 먹으면 안되는 이유는?',a:'독일수도'},
 {q:'파 중에서 가장 인기 있는 파는?',a:'파스타'},
 {q:'빵이 시골에 가는 이유는 무얼까?',a:'소보로'},
 {q:'담배가 시골에 가는 이유는 무얼까?',a:'말보로'},
 {q:'미국에서 비가 온다를 영어로 말하면?',a:'usb'},
 {q:'과자가 자기 자신을 소개하면서 하는 말은?',a:'전과자'},
 {q:'이 동물은 항상 미안한 마음으로 살아가고 있어요 어떤 동물?',a:'오소리',note:'오,쏘~리'},
 {q:'이 세상에서 가장 뜨거운 전화는?',a:'화상전화'},
 {q:'우리나라에서 가장 바쁜 대학교 이름은?',a:'부산대학교'},
 {q:'호주의 화폐단위를 말하시오.',a:'호주머니'},
 {q:'하나님이 버스를 타고 내리다를 세자로 줄이면?',a:'신내림'},
 {q:'머리 아플 때 약을 얼마나 먹어야 할까?',a:'두통'},
 {q:'아마존에는 누가 살고 있을까요?',a:'아마존이'},
 {q:'이 세상에서 가장 가난한 임금은?',a:'최저임금'},
 {q:'성적이 나와도 말하지 못하는 이유는 무엇인가요?',a:'내성적이라서'},
 {q:'달걀을 팔아서 번 돈을 무엇이라고 하죠?',a:'에그머니'},
 {q:'가장 싼 사냥 도구는?',a:'파리채'},
 {q:'개가 사람을 가르치다 라는 사자성어는?',a:'개인지도'},
 {q:'사우디에서 우리나라까지 석유가 수입되어서 오는 기간은?',a:'오일'},
 {q:'식인종이 우사인 볼트를 보면 하는 말이 있대요',a:'패스트푸드'},
 {q:'말이 분노하고 있다를 네자로 줄이면',a:'마리화나'},
 {q:'동생이 형을 너무 좋아한다를 세자로 말하면?',a:'형광펜'},
 {q:'인천 앞바다의 반댓말은?',a:'인천엄마다'},
 {q:'세상에서 가장 무서운 전화의 이름은?',a:'무선전화'}
];
/* 하루 한도는 게임 속 "하루"(알바/패스로 얼마든지 빨리 지나갈 수 있어요)가 아니라
   실제 달력 날짜(KST 자정 기준) 기준으로 세요. 부정행위 방지를 위해 답을 맞히든 틀리든,
   심지어 답을 안 내고 닫아도 버튼을 누르는 순간 바로 한 번을 깎아요(houConsume). */
const HOU_DAILY=3;
const houEpochDay=()=>Math.floor((Date.now()+KST_MS)/DAY_MS);
function houLeftToday(){
  return S.houDate===houEpochDay()?Math.max(0,S.houLeft==null?HOU_DAILY:S.houLeft):HOU_DAILY;
}
const houDone=()=>houLeftToday()<=0;
function houConsume(){
  const t=houEpochDay();
  if(S.houDate!==t){S.houDate=t;S.houLeft=HOU_DAILY;}
  S.houLeft=Math.max(0,(S.houLeft==null?HOU_DAILY:S.houLeft)-1);
  save();
}
let houCur=null;
const houNorm=s=>String(s||'').trim().replace(/[\s.,!?~()'"`]/g,'').toLowerCase();
function houMatch(user,ans){
  const list=Array.isArray(ans)?ans:[ans],u=houNorm(user);
  if(!u)return false;
  return list.some(raw=>{const a=houNorm(raw);return a&&(u===a||(u.length>=2&&a.length>=2&&(u.includes(a)||a.includes(u))));});
}
const houAnsText=item=>Array.isArray(item.a)?item.a[0]:item.a;
/* 오늘 이미 3번 다 참여했는데 또 누르면, 호우가 다시 시작하려다 씨붕에게 단호하게 저지당해요 */
function houBlockedCut(){
  pressed={};mouse.click=false;showGame(true);
  playCut({bg:'hall',chars:[{id:'호우',x:220,y:340,s:2.4},{id:'씨붕',x:560,y:340,s:2.4,arms:'cross'}],lines:[
    {who:'호우',text:'퀴즈를 시작해볼까? 줄여서 퀴-시?'},
    {who:'씨붕',text:'그만.'}
  ]},toHub);
}
function openHouQuiz(){
  if(houDone()){houBlockedCut();return;}
  houConsume();renderHub();
  houCur=pick(HOU_QUIZ);
  $('#hqQ').textContent=houCur.q;$('#hqAns').value='';$('#hqAns').disabled=false;$('#hqGo').disabled=false;$('#hqMsg').textContent='';
  $('#houQuiz').hidden=false;setTimeout(()=>{try{$('#hqAns').focus();}catch(e){}},30);
}
function closeHouQuiz(){$('#houQuiz').hidden=true;}
function submitHouQuiz(){
  if(!houCur)return;
  const item=houCur,ok=houMatch($('#hqAns').value,item.a),ans=houAnsText(item)+(item.note?` (${item.note})`:'');
  houCur=null;
  if(ok){S.money+=HOU_REWARD;S.news=`호우의 아재개그를 맞혀서 ${fmt(HOU_REWARD)}원을 받았다!`;sfx('coin');}
  else sfx('deny');
  $('#hqMsg').textContent=ok?`😂 정답! "${ans}" · 호우에게 ${fmt(HOU_REWARD)}원 받았어요!`:`😅 아쉽지만 오답이에요. 정답은 "${ans}"였어요.`;
  $('#hqAns').disabled=true;$('#hqGo').disabled=true;
  save();renderHub();
}
$('#houBtn').addEventListener('click',openHouQuiz);
$('#hqClose').addEventListener('click',closeHouQuiz);
$('#hqGo').addEventListener('click',submitHouQuiz);
$('#hqAns').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submitHouQuiz();}});
function toHub(){mode='hub';if(pendingCloud){const r=pendingCloud;pendingCloud=null;adoptCloud(r);}chatCur=randChat();C=null;K=null;$('#skip').hidden=true;$('#ovSet').hidden=true;showGame(false);renderHub();maybeLoan();}
function dayAction(msg,gain,job){
  if(gain)S.money+=gain;
  if(job)S.fatigue=(S.fatigue||0)+1;else S.fatigue=Math.max(0,(S.fatigue||0)-1);
  chatCur=randChat();
  const wkd=advanceDay();S.news=msg+' '+S.news;if(wkd)setTimeout(()=>sfx('bell'),300);
  if(job&&S.fatigue>=3){hospitalize();return;}
  if(job&&S.fatigue===2)S.news+=' 몸이 무겁다… 알바를 또 하면 쓰러질지도 모른다.';
  if(S.money>=1000000&&!S.cleared){S.cleared=true;S.news='🎉 100만 원 달성! (엔딩 애니메이션은 다음 업데이트에서 만나요)';sfx('bigwin');}
  save();renderHub();
}
const VISIT=[
 {n:'겨맘',t:'내가 죽 끓여왔어, 원기회복엔 이만한 게 없다니까! 얼른 낫고 같이 운동장 뛰자~ (죽을 놓고 갔다)'},
 {n:'히통',t:'병원비 모자라면 빌려줄게. 이자는 10%… 퇴원 기념으로 9.9%.'},
 {n:'주멘',t:'이건 계획에 없었는데… 알바 스케줄부터 다시 짜자.'},
 {n:'머호',t:'세상은 어차피 다 5할이야. 쓰러질 확률도 5할이었던 거지~'},
 {n:'주스',t:'아픈 놈은 안 깨문다. 다 나으면 깨물어버린다!'},
 {n:'ㅈㄱ',t:'…(말없이 이상해씨 카드를 두고 갔다)'},
 {n:'씨붕',t:'인마, 몸 관리 좀 하랬지?! …아, 됐고. 죽 식기 전에 얼른 먹어.'}
];
function hospitalize(){
  const before=S.money,fee=Math.min(8000,Math.max(2000,Math.round(S.money*.35/100)*100)),paid=Math.min(S.money,fee),short=fee-paid;
  S.money-=paid;const afterFee=S.money;S.fatigue=0;S.hosp=(S.hosp||0)+1;
  const dBefore=S.day,wk=S.week;advanceDay();const w2=S.week;advanceDay();
  const weekend=S.week>wk;const v=pick(VISIT);if(weekend)setTimeout(()=>sfx('bell'),700);
  S.news=`과로로 이틀 입원했다. 병원비 ${fmt(paid)}원이 나갔다.`+(weekend?` 주말이 지나 새 주가 시작됐다. (${S.week}주차 ${DAYS[S.day]}요일)`:` (${DAYS[S.day]}요일)`);
  const pages=[
    {img:'worn',sfx:'siren',title:'과로로 쓰러졌다…',text:'매점 알바를 쉬지 않고 이어서 하다가, 계산대 앞에서 그대로 쓰러지고 말았다.'},
    {img:'sad',title:'병원에서 눈을 떴다',who:v.n,text:v.t},
    {img:'frustrated',sfx:'deny',title:'병원비 정산',text:`병원비 ${fmt(fee)}원이 나갔다. (소지금 ${fmt(before)} → ${fmt(afterFee)}원)`+(short>0?` 모자란 ${fmt(short)}원은 병원에서 사정을 봐줬다.`:'')+` 이틀을 병원에서 보냈다.`+(weekend?' 그 사이 주말이 지나 새 주가 시작됐다.':'')+' 알바는 쉬엄쉬엄 하자.'}
  ];
  save();
  showStory(pages,()=>{chatCur=randChat();renderHub();maybeLoan();},'sad');
}
let STORY=null;
function showStory(pages,done,bgm){STORY={pages,i:0,done,bgm};renderStory();$('#story').hidden=false;}
function renderStory(){const p=STORY.pages[STORY.i];$('#stT').textContent=p.title;$('#stImg').src=p.src||IMGDATA[p.img||'base'];
  const sb=$('#stB');sb.hidden=!p.burp;sb.textContent=p.burp?pick(BURPS):'';if(p.burp)burp();else sfx(p.sfx||'page');
 $('#stN').textContent=p.who?`${p.who}:`:'';$('#stX').textContent=p.text;$('#stBtn').textContent=STORY.i>=STORY.pages.length-1?'확인':'다음';
 $('#story').classList.toggle('danger',!!p.danger);$('#stImg').classList.toggle('angry',!!p.danger);}
$('#stBtn').addEventListener('click',()=>{if(!STORY)return;STORY.i++;if(STORY.i>=STORY.pages.length){$('#story').hidden=true;const d=STORY.done;STORY=null;d&&d();}else renderStory();});
/* ---------- 라털 선생님: 소지금이 0원 이하가 되면 1만 원을 빌려줘요 ----------
   대머리에 짧은 턱수염이 구레나룻까지 이어진 모습이에요. 돈을 빌려줄 때 말끝마다 "바우!" 하고 트림을 해요. */
const LOAN=10000;
const RATAL_IMG='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><clipPath id="hd"><ellipse cx="100" cy="88" rx="52" ry="60"/></clipPath></defs><rect width="200" height="200" fill="#f4f1ee"/><path d="M14 200Q20 150 100 146Q180 150 186 200Z" fill="#2f3a56"/><path d="M78 148L100 176L122 148Z" fill="#fff"/><path d="M94 152L106 152L110 196L100 202L90 196Z" fill="#c4372f"/><rect x="82" y="128" width="36" height="28" rx="6" fill="#e4b995"/><ellipse cx="47" cy="92" rx="8" ry="13" fill="#f1c9a5" stroke="#232a45" stroke-width="3"/><ellipse cx="153" cy="92" rx="8" ry="13" fill="#f1c9a5" stroke="#232a45" stroke-width="3"/><ellipse cx="100" cy="88" rx="52" ry="60" fill="#f1c9a5"/><ellipse cx="80" cy="44" rx="15" ry="7" fill="#fff" opacity=".55" transform="rotate(-25 80 44)"/><circle cx="72" cy="104" r="8" fill="#f2a7a0" opacity=".55"/><circle cx="128" cy="104" r="8" fill="#f2a7a0" opacity=".55"/><path d="M66 68Q78 61 90 68" stroke="#3b2f2a" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M110 68Q122 61 134 68" stroke="#3b2f2a" stroke-width="5" stroke-linecap="round" fill="none"/><ellipse cx="78" cy="82" rx="4.5" ry="5.5" fill="#232a45"/><ellipse cx="122" cy="82" rx="4.5" ry="5.5" fill="#232a45"/><circle cx="79.5" cy="80" r="1.6" fill="#fff"/><circle cx="123.5" cy="80" r="1.6" fill="#fff"/><path d="M100 84Q93 98 99 101Q104 102 107 100" stroke="#c99b7a" stroke-width="3" stroke-linecap="round" fill="none"/><g clip-path="url(#hd)"><path d="M40 80L58 60Q64 92 80 104Q100 98 120 104Q136 92 142 60L160 80L160 170L40 170Z" fill="#3b2f2a"/></g><path d="M74 108Q87 98 100 105Q113 98 126 108Q114 118 100 111Q86 118 74 108Z" fill="#2a201c"/><ellipse cx="100" cy="126" rx="11" ry="7" fill="#6b2a2a"/><path d="M92 128Q100 134 108 128Q100 124 92 128Z" fill="#d9667a"/><ellipse cx="100" cy="88" rx="52" ry="60" fill="none" stroke="#232a45" stroke-width="3"/></svg>');
const RATAL_LINES=[
  '돈이 바닥났다고? 쯧쯧… 선생님이 1만 원 빌려주마. 다음엔 아껴 쓰거라. 바우!',
  '허허, 또 빈털터리가 됐구나. 자, 1만 원이다. 이자는 열심히 공부하는 걸로 받으마. 바우!',
  '선생님도 월급날 전이라 빠듯하다만… 제자가 굶을 순 없지. 1만 원 가져가거라. 바우!'
];
const BURPS=['(꺼억~)','(끄으윽~)','(꺼어어억…)'];
function burp(){beep(150,.14,'sawtooth',.09);setTimeout(()=>beep(95,.32,'sawtooth',.1),120);setTimeout(()=>beep(70,.25,'square',.06),380);}
/* 허브에 있을 때 소지금이 0원 이하면 라털 선생님이 나타나요. 대결 화면·로그인·업데이트 팝업이 열려 있을 땐 기다려요. */
function maybeLoan(){
  if(!USER||mode!=='hub'||S.money>0||STORY||!$('#duel').hidden||!$('#wn').hidden||!$('#login').hidden||!$('#splash').hidden||!$('#pinChange').hidden||!$('#houQuiz').hidden||!$('#challengeInfo').hidden||!$('#profile').hidden)return;
  const before=Math.max(0,S.money);
  S.money=LOAN;S.news='라털 선생님께 1만 원을 빌렸다. 이번엔 아껴 쓰자…';save();renderHub();
  showStory([
    {img:'sad',sfx:'deny',bgm:'sad',title:'소지금이 바닥났다…',text:'지갑이 텅 비었다. 주머니를 뒤집어 봐도 먼지뿐… 그때 복도 끝에서 라털 선생님이 다가왔다.'},
    {src:RATAL_IMG,bgm:'ratal',title:'라털 선생님',who:'라털',text:pick(RATAL_LINES),burp:true},
    {img:'happy',sfx:'coin',bgm:'ratal',title:'1만 원을 빌렸다',text:`소지금 ${fmt(before)}원 → ${fmt(LOAN)}원. 다음엔 아껴 쓰자!`}
  ],()=>{chatCur=randChat();renderHub();});
}
$('#bMinus').addEventListener('click',()=>{betV=Math.max(1000,betV-100);renderHub();});
$('#bPlus').addEventListener('click',()=>{betV=Math.min(betMax(),betV+100);renderHub();});
$('#bBig').addEventListener('click',()=>{betV=Math.min(betMax(),betV+500);renderHub();});
function openChallengeInfo(){$('#chBetInfo').textContent=`이번 판돈: ${fmt(betV)}원`;$('#challengeInfo').hidden=false;}
function closeChallengeInfo(){$('#challengeInfo').hidden=true;}
$('#acceptBtn').addEventListener('click',()=>{if(S.money>=1000)openChallengeInfo();});
$('#chClose').addEventListener('click',closeChallengeInfo);
$('#chStart').addEventListener('click',()=>{closeChallengeInfo();if(S.money>=1000)startMatch(betV);});
$('#passBtn').addEventListener('click',()=>{
  S.stam=clamp((S.stam==null?25:S.stam)+3,0,100);   /* 프리킥을 쉬면 몸이 회복돼서 체력이 살짝 올라요 */
  dayAction('오늘은 쉬면서 체력을 조금 회복했다.',0,false);
});
$('#jobBtn').addEventListener('click',()=>dayAction('머호가 소개해 준 매점 심부름으로 600원을 벌었다.',600,true));
$('#sBtn').addEventListener('click',toHub);
$('#skip').addEventListener('click',()=>{if(mode==='cut')pressed.SkipCut=true;});
$('#quit').addEventListener('click',askQuit);
/* 효과음/음악 켜기·끄기: 헤더(🔊 🎵), 로그인 화면, 게임 화면의 버튼이 같은 설정을 써요. 둘은 따로 기억돼요. */
function renderSound(){
  $('#sndBtn').textContent=muted?'🔇 효과음 꺼짐':'🔊 효과음';$('#mute').textContent=muted?'효과음 켜기':'효과음 끄기';$('#lgSnd').textContent=muted?'🔇 효과음 켜기':'🔊 효과음 끄기';
  const m=BGM.on;$('#bgmBtn').textContent=m?'🎵 음악':'🎵 음악 꺼짐';$('#bgmMute').textContent=m?'음악 끄기':'음악 켜기';$('#lgBgm').textContent=m?'🎵 음악 끄기':'🎵 음악 켜기';
}
function setMuted(m){muted=m;lsSet('rk:muted',m?'1':'0');renderSound();if(!m)sfx('click');}
function setBgm(on){BGM.on=on;lsSet('rk:bgm',on?'1':'0');renderSound();bgmSync();}
['#sndBtn','#mute','#lgSnd'].forEach(sel=>$(sel).addEventListener('click',()=>setMuted(!muted)));
['#bgmBtn','#bgmMute','#lgBgm'].forEach(sel=>$(sel).addEventListener('click',()=>setBgm(!BGM.on)));
renderSound();
/* 버튼을 누르는 소리: 기본은 '똑', 버튼마다 다른 소리는 여기에 (none: 그 버튼은 자기 소리를 따로 내요) */
const BTN_SFX={jobBtn:'coin',passBtn:'swish',chStart:'start',bMinus:'tick',bPlus:'tick',bBig:'tick',duBm:'tick',duBp:'tick',duBb:'tick',rankBtn:'page',stBtn:'none',sndBtn:'none',mute:'none',lgSnd:'none',bgmBtn:'none',bgmMute:'none',lgBgm:'none',
  gymBtn:'none',bbqBtn:'none',drinkBtn:'none',tteokBtn:'none',hqGo:'none'};   /* 소리는 spendToast()/showStory()에서 직접 재생해요(중복 방지) */
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  const n=BTN_SFX[b.id]||'click';if(n!=='none')sfx(n);
},true);
const MSGS=['오늘도 학교에서 살아남자.','주스의 빵 값은 내가 지킨다.','롹!','쉬는 시간이 10분뿐이라니.','히통 이자가 10%였지…'];
/* 프로필 아이콘을 누르면 표정이 바뀌면서, 소지금/스탯/로그아웃 같은 정보를 한눈에 보는 팝업이 열려요 */
function openProfile(){renderStats();$('#pfMoney').textContent=fmt(S.money)+'원';$('#profile').hidden=false;}
function closeProfile(){$('#profile').hidden=true;}
$('#bigface').addEventListener('click',function(){this.src=IMGDATA[FACES[Math.floor(Math.random()*FACES.length)]];$('#bigmsg').textContent=MSGS[Math.floor(Math.random()*MSGS.length)];openProfile();});
$('#pfClose').addEventListener('click',closeProfile);
window.addEventListener('pagehide',()=>{save();});

