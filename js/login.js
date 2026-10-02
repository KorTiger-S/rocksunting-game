'use strict';
/* ---------- 로그인 ---------- */
let LG={id:'',pin:'',ph:'',local:null,offline:false,mode:'login'},LGMODE='login';
function lgStep(s){
  [['choice','lgChoice'],['main','lgMain'],['busy','lgBusy'],['new','lgNew'],['off','lgOff']].forEach(a=>{$('#'+a[1]).hidden=a[0]!==s;});
}
function lgModeText(){$('#lgMode').textContent=cloudUrl()?'저장 방식: 클라우드(Supabase) + 이 기기':'저장 방식: 이 기기(브라우저)';}
function showLogin(){
  $('#login').hidden=false;lgStep('choice');lgModeText();$('#lgMsg').textContent='';$('#lgPin').value='';LG.pin='';LG.ph='';
  const last=lsGet('rk:last');const b=$('#lgResume');
  if(last&&ID_RE.test(last)){b.textContent=`${last} (으)로 계속하기`;b.dataset.id=last;}else b.dataset.id='';
  if(!SP.on)setTimeout(()=>{try{$('#lgToLogin').focus();}catch(e){}},50);   /* 스플래시가 떠 있을 땐 스플래시가 끝날 때 포커스 */
}
function setLgMode(m){   /* 'login' | 'signup' : 같은 입력 칸을 로그인/회원가입에 같이 써요 */
  LGMODE=m;const su=m==='signup';
  $('#lgTitle').textContent=su?'📝 회원가입':'🔑 로그인';
  $('#lgGo').textContent=su?'가입하고 시작하기':'로그인';
  $('#lgSwitch').textContent=su?'이미 ID가 있어요 → 로그인':'처음이에요 → 회원가입';
  $('#lgPin2').hidden=!su;$('#lgPin2').value='';$('#lgTipIn').hidden=su;$('#lgTipUp').hidden=!su;
  const b=$('#lgResume');b.hidden=su||!b.dataset.id;
  $('#lgMsg').textContent='';
}
/* 로그인 유지: 한 번 로그인하면 로그아웃하거나 브라우저의 사이트 데이터(쿠키 등)를 지울 때까지 자동으로 들어와요 */
const SESSION_KEY='rk:session';
function keepSession(){if(USER)lsSet(SESSION_KEY,JSON.stringify({id:USER.id,pin:USER.pin}));}
function dropSession(){lsDel(SESSION_KEY);}
function autoLogin(){
  let s=null;try{s=JSON.parse(lsGet(SESSION_KEY)||'null');}catch(e){}
  if(!s||!ID_RE.test(String(s.id||''))||!PIN_RE.test(String(s.pin||''))){dropSession();return false;}
  setLgMode('login');$('#lgId').value=s.id;startLogin(s.id,s.pin);return true;
}
function goLoginForm(m){
  setLgMode(m||'login');lgStep('main');
  setTimeout(()=>{try{($('#lgId').value?$('#lgPin'):$('#lgId')).focus();}catch(e){}},30);
}
async function startLogin(raw,rawPin,rawPin2){
  let id=String(raw||'').trim();if(id.normalize)id=id.normalize('NFC');
  const pin=String(rawPin||'').trim();
  if(!ID_RE.test(id)){$('#lgMsg').textContent='ID는 2~12자, 한글·영문·숫자·_ 만 쓸 수 있어요.';return;}
  if(/^(guest|게스트)$/i.test(id)){$('#lgMsg').textContent='이 ID는 쓸 수 없어요.';return;}
  if(!PIN_RE.test(pin)){$('#lgMsg').textContent='비밀번호는 숫자 4자리로 입력해 주세요.';return;}
  if(LGMODE==='signup'&&pin!==String(rawPin2||'').trim()){$('#lgMsg').textContent='비밀번호 확인이 맞지 않아요. 같은 숫자 4자리를 두 번 넣어 주세요.';$('#lgPin2').value='';try{$('#lgPin2').focus();}catch(e){}return;}
  LG={id,pin,ph:pinHash(id,pin),local:readLocal(id),offline:false,mode:LGMODE};
  const su=LG.mode==='signup';
  lgStep('busy');$('#lgBusyTx').textContent=su?'ID를 확인하는 중…':'기록을 찾는 중…';
  let cloud=null;
  if(cloudUrl()){
    try{cloud=await api('load',{id,pin});setSeason(cloud.current);LG.season=cloud.exists?cloud.season:(cloud.current&&cloud.current.key);}
    catch(e){
      if(su&&(e.message==='bad_pin'||e.message==='locked')){idTaken();return;}   /* 비밀번호가 다르다 = 누군가 이미 쓰는 ID */
      if(e.message==='bad_pin'){pinFail();return;}
      if(e.message==='locked'){pinFail('비밀번호를 여러 번 틀려서 5분 동안 잠겼어요. 잠시 후 다시 시도해 주세요.');return;}
      sfx('error');lgStep('off');return;
    }
  }
  if(su){if((cloud&&cloud.exists)||LG.local)idTaken();else signupNew();return;}
  finishLogin(cloud);
}
function idTaken(){sfx('error');lgStep('main');$('#lgMsg').textContent='이미 사용 중인 ID예요. 다른 ID를 골라 주세요. (내 ID라면 로그인으로 들어오세요)';try{$('#lgId').focus();}catch(e){}}
function idMissing(){dropSession();sfx('error');lgStep('main');$('#lgMsg').textContent='없는 ID예요. 처음이라면 회원가입을 해 주세요.';try{$('#lgId').focus();}catch(e){}}
function signupNew(){
  const raw=lsGet(LEGACY_KEY),done=lsGet('rk:legacyDone');let leg=null;
  try{if(raw&&!done)leg=JSON.parse(raw);}catch(e){}
  if(leg)showNew(LG.id);else createUser(false);   /* 이 기기에 예전 기록이 있을 때만 가져올지 물어봐요 */
}
function pinFail(msg){dropSession();sfx('error');lgStep('main');$('#lgMsg').textContent=msg||'ID 또는 비밀번호가 맞지 않아요.';$('#lgPin').value='';try{$('#lgPin').focus();}catch(e){}}
function finishLogin(cloud){
  const id=LG.id,cEx=cloud&&cloud.exists&&cloud.data;
  let local=LG.local,stale=false;
  if(local&&local.pin&&!cloud&&local.pin!==LG.ph){pinFail();return;}   /* 클라우드 확인을 못 했을 때는 이 기기의 저장값으로 확인 */
  if(local&&cEx&&(local.season||LEGACY_SEASON)!==cloud.season){local=null;stale=true;}   /* 이 기기의 기록이 지난 시즌 것이면 버려요 */
  if(!LG.season)LG.season=(local&&local.season)||(SEASON&&SEASON.key)||LEGACY_SEASON;
  if(!local&&!cEx){idMissing();return;}
  const lAt=local?(local.updatedAt||0):0,cAt=cEx?(cloud.updatedAt||0):0;
  let data,name,at,news=null;
  if(cEx&&cAt>lAt){data=mergeData(cloud.data);name=cloud.name||id;at=cAt;if(stale)news='새 시즌이 시작되어 모든 기록이 초기화됐어요. 처음부터 다시!';}
  else{data=mergeData(local.data);name=local.name||id;at=lAt;}
  enter(name,data,at,news);
}
function showNew(id){
  lgStep('new');$('#lgNewTx').textContent=`"${id}" (으)로 가입해요.`;
  const raw=lsGet(LEGACY_KEY),done=lsGet('rk:legacyDone');let leg=null;
  try{if(raw&&!done)leg=JSON.parse(raw);}catch(e){}
  LG.legacy=leg;$('#lgImport').hidden=!leg;$('#lgLegacy').hidden=!leg;
  if(leg)$('#lgLegacy').textContent=`이 기기에 이전에 하던 기록이 있어요. (소지금 ${fmt(leg.money||0)}원) 이 ID로 가져올 수 있어요.`;
}
function createUser(useLegacy){
  const id=LG.id;let data=DEF();
  if(useLegacy&&LG.legacy){data=mergeData(LG.legacy);lsSet('rk:legacyDone','1');}
  enter(id,data,0,null,true);
}
function enter(name,data,at,news,isNew){
  USER={id:name,pin:LG.pin,ph:LG.ph,season:LG.season||(SEASON&&SEASON.key)||LEGACY_SEASON};S=data;
  OFFLINE_BASE=(LG.offline&&cloudUrl())?(at||0):null;keepSession();
  $('#login').hidden=true;mode='hub';
  save();renderHub();updateUserChip();setSync(cloudUrl()?'idle':'idle');
  sfx('welcome');toast(news||(isNew?`${name} 님, 환영해요!`:`${name} 님, 다시 만나서 반가워요!`),news?5000:2600);
  maybeShowNotes(isNew);maybeLoan();
}
function updateUserChip(){
  $('#hUser').textContent=USER?USER.id:'';$('#hUserW').hidden=!USER;
  const pb=$('#pinBtn');if(pb)pb.disabled=!USER;
}
async function logout(){
  if(mode!=='hub')return;
  try{if(dirty)await cloudPush();}catch(e){}
  dropSession();USER=null;S=DEF();OFFLINE_BASE=null;pendingCloud=null;dirty=false;hubCard=null;updateUserChip();showLogin();
}
/* ---------- 업데이트 내역: 새 버전이 나온 뒤 처음 로그인할 때 한 번만 보여줘요 ---------- */
/* 버전을 올릴 때(APP_VERSION + package.json) 여기에 그 버전의 내역을 추가하세요. 내역이 없는 버전은 팝업이 안 떠요. */
const RELEASE_NOTES={
  '2.5.0':{sub:'전신 꾸미기 👕👖👟🎒',items:[
    '🧍 이제 롹순팅을 머리부터 발끝까지 꾸밀 수 있어요! 상점에 상의 · 하의 · 신발 · 가방 칸이 생겼어요.',
    '👕 축구부 유니폼, 회색 후드티, 하와이안 셔츠, 가죽 재킷 / 👖 반바지, 청바지, 삼선 트레이닝 바지, 카고 바지',
    '👟 축구화, 빨간 운동화, 황금 운동화 / 🎒 책가방, 크로스백, 기타 케이스',
    '👀 입은 옷은 내 프로필, 다른 사람 프로필(랭킹에서 이름 누르기), 게임 속 작은 롹순팅에도 보여요.'
  ]},
  '2.4.0':{sub:'다른 플레이어 프로필 · 한줄 방명록 ✍',items:[
    '👀 랭킹에서 이름이나 얼굴을 누르면 그 플레이어의 프로필이 열려요. 꾸민 캐릭터, 시즌 뱃지, 이번 시즌 기록을 볼 수 있어요.',
    '📜 지난 시즌마다 몇 위였는지도 한눈에! (얼굴을 누르면 표정도 바뀌어요)',
    '✍ 프로필 아래 한줄 방명록에 응원 한마디를 남겨 보세요. 50자까지, 내가 쓴 글과 내 방명록의 글은 ✕로 지울 수 있어요.'
  ]},
  '2.3.6':{sub:'「나락쓰레기장」 채보를 가사에 맞췄어요 🎤',items:[
    '🎤 노래를 목소리·드럼으로 나눠서, 가사 한 음절 한 음절이 불리는 순간에 노트가 오도록 채보를 새로 만들었어요.',
    '🎚 쉬움은 단어마다, 보통은 음절마다, 어려움은 음절 + 드럼, 매우 어려움은 16분음표·하이햇까지. 별은 ★1 · 5 · 7 · 11이에요.',
    '💥 후렴 첫 음절과 "모여!", "외쳐!", "찾는다!", "불태워!"에서는 점프!'
  ]},
  '2.3.5':{sub:'새 곡 「나락쓰레기장」 🎮',items:[
    '🎵 헛다리짚기 훈련에 우리끼리 만든 노래 「나락쓰레기장」이 추가됐어요. 처음으로 진짜 노래 음원으로 하는 곡이에요!',
    '🎬 노래 전에 인트로가 나와요: 지루한 회사 → 6시 칼퇴근 → 후다닥 집안일 → 밤 9시 롤 접속 → 10시에 하나둘 로그인하는 친구들.',
    '🎨 이 곡을 할 때만 우리 다섯 명이 롤 챔피언으로 그려진 전용 테마가 깔려요. 결과표와 공유 이미지도 같은 테마예요.',
    '⏳ 음원을 불러오는 동안은 "노래 불러오는 중…"이 보이고, 다 불러오면 카운트다운이 시작돼요.'
  ]},
  '2.3.2':{sub:'교표가 생기고 위쪽 메뉴가 깔끔해졌어요 🛡',items:[
    '🛡 왼쪽 위 빨간 동그라미가 머대부속고 교표(롹)로 바뀌었어요. 로그인 화면에도 나와요.',
    '🏠 교표나 "롹순팅 키우기" 제목을 누르면 홈으로 돌아가요.',
    '👆 위쪽 메뉴에서 누를 수 있는 버튼(홈·랭킹·꾸미기)은 버튼 모양으로, 닉네임·시즌·소지금은 글씨로 바뀌어 구분이 쉬워졌어요. 효과음·음악은 꺼지면 흐리게 보여요.',
    '📱 브라우저 탭과 휴대폰 홈 화면 바로가기에도 같은 교표 아이콘이 보여요.'
  ]},
  '2.3.1':{sub:'헛다리짚기 훈련 발판 수정 🔧',items:[
    '🔧 노래를 시작하자마자 게이지가 0이 되며 끝나던 문제를 고쳤어요. 화면이 잠깐 멈추면(알림·제어 센터 등) 멈추기 직전 위치로 되돌려 자동으로 일시정지해요.',
    '🔧 아이폰에서 소리가 멈춰 있다 깨어날 때 곡 시계가 어긋나지 않게, 소리가 실제로 흐르는 걸 확인한 뒤 카운트다운을 시작해요.',
    '🔧 화면이 낮은 휴대폰(아이폰 SE·13 등)과 아이폰 사파리 아래 툴바 때문에 아래쪽 발판(↙ ↘)이 가려지던 문제를 고쳤어요. 발판이 화면 크기에 맞춰 줄어들어요.'
  ]},
  '2.3.0':{sub:'어디서든 홈으로 🏠 · 연습 기간은 무한 도전!',items:[
    '🏠 화면 위쪽에 "🏠 홈" 버튼이 생겼어요. 게임 고르다가, 난이도 고르다가, 상점에서도 바로 홈으로 돌아가요.',
    '♾ 연습 기간(프리시즌)에는 마이크·축구공이 줄지 않고 소지금도 무한이에요. 마음껏 연습하세요! (상점에서 사는 것만 정규 시즌부터)',
    '🎤 헛다리짚기 훈련에서 호우를 이기면(목표 점수 이상) 쓴 마이크를 돌려받아요.'
  ]},
  '2.2.2':{sub:'헛다리짚기 훈련 버그 수정 🔧',items:[
    '🔧 곡을 시작하자마자 3·2·1 카운트다운 없이 노트가 빠르게 쏟아지고 F로 끝나던 문제를 고쳤어요. (휴대폰에서 소리가 잠깐 끊겼다 돌아온 뒤에 생기던 문제)'
  ]},
  '2.2.1':{sub:'프리킥은 판돈 없이, 꾸미기는 더 가까이',items:[
    '⚽ 주스의 프리킥 도전장은 이제 판돈 없이 해요. 축구공만 있으면 도전! 점수는 랭킹의 "프리킥 최고점"에 올라가요.',
    '🛍 롹순팅 꾸미기 상점은 화면 위쪽 "🛍 꾸미기" 버튼으로 바로 열어요.',
    '📜 업데이트 소식을 놓쳤다면, 마지막으로 본 소식 다음 것부터 차례대로 보여 줘요.',
    '🏆 정정: 시즌2 우승·준우승은 지금처럼 소지금으로 정해요. 랭킹은 소지금 탭부터 보여요.'
  ]},
  '2.2.0':{sub:'가을이 왔어요 🍂',items:[
    '🏆 랭킹의 승리 탭이 없어지고, 소지금 · 펌프 최고점 · 프리킥 최고점 탭으로 정리했어요. 시즌 우승·준우승은 소지금으로 정해요.',
    '🍂 시작 화면이 가을 옷을 입었어요. 낙엽이 떨어지고, 시즌2 표시도 생겼어요.',
    '🏠 홈 화면은 헛다리짚기 훈련이 맨 위로 올라오고, 준비 중이던 다른 내기 목록은 정리했어요.',
    '👑 모자가 동그란 얼굴 틀 밖으로 살짝 나오게 그려서, 게임 속 롹순팅도 모자를 제대로 써요.'
  ]},
  '2.1.0':{sub:'상점이 생겼어요! 롹순팅을 꾸며 보세요 🛍',items:[
    '🛍 홈 화면에 "상점 · 롹순팅 꾸미기"가 생겼어요. 모자·안경·얼굴 소품·테두리·이름 색을 소지금으로 살 수 있어요.',
    '👀 사기 전에 미리 입혀 볼 수 있고, 산 아이템은 언제든 장착하거나 벗을 수 있어요.',
    '🏆 꾸민 모습은 랭킹과 1:1 대결에서 친구들에게도 보여요. 이름 색도 바뀌어요!',
    '♾ 산 아이템은 시즌이 끝나도 남아요.'
  ]},
  /* 시즌2(소리새 펌프) 오픈용 내역: APP_VERSION을 2.0.0으로 올릴 때 팝업으로 나가요. 그 전까지는 아무 영향이 없어요. */
  '2.0.0':{sub:'시즌2 시작! 새 게임 "소리새 펌프"가 왔어요 🎤',items:[
    '🎮 허브에 "호우와 소리새 펌프"가 생겼어요. 오락실 펌프처럼 5개 발판(↙ ↖ ● ↗ ↘)을 노트가 닿는 순간 맞춰 밟아요.',
    '⌨ 키보드는 Z Q S E C(숫자패드 1 7 5 9 3), 모바일은 화면 아래 발판을 터치해요. 길게 늘어난 롱노트는 끝까지 눌러야 해요.',
    '🎵 곡 12개! 우리 학교 교가, 캉캉·터키 행진곡·왕벌의 비행·투우사의 노래 같은 클래식 명곡도 있어요. 곡을 고른 뒤 난이도(쉬움·보통·어려움·매우 어려움)를 골라요. 판돈은 난이도마다 정해져 있고(1,000~4,000원), 호우의 목표 점수를 넘기면 판돈 2배! S 랭크(95만 점)면 판돈의 절반을 더 받아요.',
    '🎤 프리킥의 축구공처럼 마이크 5개가 있어요. 도전할 때마다 1개씩 쓰고 30분마다 1개 충전돼요.',
    '💪 몸 관리(근력·체력·피로도·컨디션·기분)가 없어졌어요. 쇠질하기·난지바베큐·소리새·디델리도 함께 사라지고, 이제 실력만으로 승부해요!',
    '🏅 시즌이 끝나면 소지금 1등은 우승, 2등은 준우승 뱃지를 받아요. 프로필과 랭킹 이름 옆에서 볼 수 있어요.',
    '⚙ 옵션에서 노트 속도와 싱크(소리·화면 어긋남)를 맞출 수 있어요.',
    '🏆 랭킹에 "펌프 최고점" 탭이 생겼어요.'
  ]},
  '1.8.1':{sub:'허브가 한결 단순해졌어요',items:[
    '🧹 "오늘의 다른 선택"(오늘은 패스 · 매점 알바 · 호우의 아재개그) 메뉴를 없앴어요.'
  ]},
  '1.8.0':{sub:'주스와의 프리킥 도전에 횟수 제한이 생겼어요!',items:[
    '⚽ 도전장 카드에 축구공 5개가 생겼어요. 주스와 프리킥 내기를 시작할 때마다 1개씩 사라져요.',
    '⏱ 30분이 지날 때마다 축구공이 1개씩 다시 채워져요. (최대 5개, 앱을 꺼 둬도 시간은 흘러요)',
    '🚫 공이 다 떨어지면 다음 공이 채워질 때까지 내기를 받을 수 없어요.'
  ]},
  '1.7.0':{sub:'비밀번호 변경, 새 미니게임, 프리킥 개선이 한번에!',items:[
    '🔑 로그인 후 프로필 카드에서 비밀번호를 직접 바꿀 수 있어요.',
    '😂 매점 알바 옆에 "호우의 아재개그"가 생겼어요. 하루 한 번, 정답을 맞히면 500원을 받아요.',
    '⬅ 프리킥의 공 부위·파워 단계에서 Backspace(모바일은 뒤로 버튼)로 이전 단계로 돌아갈 수 있어요.',
    '🏥 컨디션이 매우 나빠서 자빠지는 부상 몰수패가 예전보다 덜 자주 일어나요.',
    '🔒 프리킥 대결 중 새로고침으로 판돈을 되돌리던 문제를 고쳤어요.',
    '💢 "머호 꽈추때리기" 메뉴는 없앴어요.'
  ]},
  '1.5.0':{sub:'체력·근력·컨디션·기분이 생겼어요!',items:[
    '💪 근력이 생겼어요. 헬스장에서 쇠질하기(1,500원)로 올릴 수 있고, 오래 쉬면 점점 떨어져요.',
    '🍖 체력이 생겼어요. 난지바베큐(2,000원)로 올릴 수 있고, 오래 쉬면 점점 떨어져요.',
    '⚡ 컨디션(매우나쁨~매우좋음)이 매일 랜덤으로 바뀌고, 프리킥 난이도에 영향을 줘요. 소리새가서 노래부르면(700원) 한 단계 좋아져요.',
    '😊 기분이 생겼어요. 계속 지면 기분이 나빠지고, 기분이 나쁘면 컨디션도 잘 안 좋아져요. 디델리 라볶이(1,000원)를 사 먹으면 좋아져요.'
  ]},
  '1.4.0':{sub:'이제 소리가 나요! 🔊🎵',items:[
    '🔊 게임 전체에 효과음이 생겼어요. 버튼 누르는 소리, 돈이 들어오는 소리, 학교 종소리, 구급차 사이렌, 호루라기, 공 차는 소리, 골망, 환호와 탄식까지!',
    '🎵 배경음악도 생겼어요! 시작 화면, 쉬는 시간(허브), 프리킥 경기, 1:1 대결, 병원, 라털 선생님 이야기마다 다른 곡이 나와요.',
    '💬 대사가 한 글자씩 나올 때 말하는 사람마다 조금씩 다른 소리가 나요.',
    '🎚 효과음(🔊)과 음악(🎵)은 화면 위쪽 버튼(로그인 화면과 게임 화면에도 있어요)으로 따로 켜고 끌 수 있고, 설정은 기억돼요.'
  ]},
  '1.3.0':{sub:'용돈이 사라지고, 라털 선생님이 나타났어요!',items:[
    '🚫 주말마다 받던 부모님 용돈이 없어졌어요. 이제 소지금은 내가 직접 벌어야 해요!',
    '🧔 소지금이 0원이 되면 라털 선생님이 1만 원을 빌려줘요. 돈을 빌려줄 때마다 말끝에 "바우!" 하고 트림을 한대요.',
    '🏥 병원비가 모자라도 부모님이 내주지 않아요. 알바는 쉬엄쉬엄!'
  ]},
  '1.2.0':{sub:'1:1 대결에 판돈이 생겼어요!',items:[
    '🪙 1:1 페널티킥 대결에 판돈을 걸 수 있어요. 방장이 0~5,000원 사이로 정하고, 방을 만들고 참가하는 순간 소지금에서 빠져요.',
    '💰 이긴 사람이 판돈 2배를 가져가요. 대결 중에 나가거나 자리를 비우면 몰수패예요!',
    '↩ 아무도 안 들어온 방을 닫거나 방이 만료되면 판돈은 돌려받아요.',
    '👀 참가하기 전에 방장과 판돈을 먼저 보여 줘요.'
  ]},
  '1.1.0':{sub:'친구와 1:1로 붙어요!',items:[
    '⚽ 1:1 페널티킥 대결이 생겼어요. 방을 만들고 4자리 코드를 친구에게 알려 주면 바로 승부!',
    '🎯 피파 온라인처럼! 슈터는 골대 안을 조준하고 파워 게이지를 맞춰 차고, 골키퍼는 다이브 방향을 골라요. 번갈아 5번씩, 동점이면 서든데스!',
    '🚪 로그인한 사람끼리만 할 수 있고, 이번 대결은 판돈과 랭킹 기록이 없어요.'
  ]},
  '1.0.0':{sub:'시즌1 시작! 이렇게 바뀌었어요.',items:[
    '🔑 이제 ID와 숫자 4자리 비밀번호로 로그인해요. 처음 만든 비밀번호가 내 비밀번호예요.',
    '👤 로그인 없이 Guest로도 시작할 수 있어요. (기록은 저장되지 않아요)',
    '🏁 시즌제가 시작됐어요! 매달 1시즌, 시즌이 끝나면 랭킹이 기록되고 모두 처음부터 다시 시작해요. 시즌1은 9월 프리킥 축구!',
    '☁ 기록이 클라우드에 저장돼서 다른 기기에서도 이어서 할 수 있어요.',
    '🏫 시작 화면에 롹순팅이 등교하는 애니메이션이 생겼어요.'
  ]}
};
const seenKey=()=>'rk:seen:'+(USER?USER.id.toLowerCase():'');
/* 업데이트 내역은 v2.0.0부터 누적해서 보여줘요: 마지막으로 읽은 버전(rk:seen:ID) 다음 것부터 지금 버전까지,
   오래된 버전부터 한 장씩. "확인"을 누르면 그 버전까지 읽은 걸로 기억하고 다음 버전을 띄워요. */
const NOTES_FROM='2.0.0';
const verCmp=(a,b)=>{const x=String(a).split('.').map(Number),y=String(b).split('.').map(Number);for(let i=0;i<3;i++){const d=(x[i]||0)-(y[i]||0);if(d)return d;}return 0;};
let NOTE_Q=[],NOTE_CUR=null,NOTE_N=0;
function maybeShowNotes(isNew){
  if(!USER)return;
  if(isNew){lsSet(seenKey(),APP_VERSION);return;}   /* 처음 가입한 사람에게는 "바뀐 점"이 없어요 */
  const seen=lsGet(seenKey()),from=/^\d+\.\d+\.\d+$/.test(seen||'')&&verCmp(seen,NOTES_FROM)>=0?seen:null;   /* 2.0.0보다 전에 읽었으면 2.0.0부터 */
  NOTE_Q=Object.keys(RELEASE_NOTES).filter(v=>verCmp(v,NOTES_FROM)>=0&&verCmp(v,APP_VERSION)<=0&&(!from||verCmp(v,from)>0)).sort(verCmp);
  NOTE_N=NOTE_Q.length;
  if(NOTE_N)showNextNote();
}
function showNextNote(){
  NOTE_CUR=NOTE_Q.shift();const n=RELEASE_NOTES[NOTE_CUR];
  $('#wnT').textContent='🎉 업데이트 v'+NOTE_CUR+(NOTE_N>1?` (${NOTE_N-NOTE_Q.length}/${NOTE_N})`:'');$('#wnSub').textContent=n.sub||'';
  const ul=$('#wnList');ul.textContent='';n.items.forEach(t=>{const li=document.createElement('li');li.textContent=t;ul.appendChild(li);});
  $('#wnOk').textContent=NOTE_Q.length?'다음 업데이트 보기':'확인';
  $('#wnAll').hidden=!NOTE_Q.length;$('#wnAll').textContent=`남은 ${NOTE_Q.length}개 모두 닫기`;   /* 쌓인 업데이트가 많을 때 한 번에 */
  $('#wn').hidden=false;sfx(NOTE_N-NOTE_Q.length>1?'page':'chime');setTimeout(()=>{try{$('#wnOk').focus();}catch(e){}},30);
}
function closeNotes(){
  if(USER&&NOTE_CUR)lsSet(seenKey(),NOTE_CUR);   /* 여기까지 읽었어요 (중간에 창을 닫아도 다음엔 그다음 버전부터) */
  if(NOTE_Q.length){showNextNote();return;}
  if(USER)lsSet(seenKey(),APP_VERSION);
  NOTE_CUR=null;$('#wn').hidden=true;maybeLoan();
}
$('#wnOk').addEventListener('click',closeNotes);
$('#wnAll').addEventListener('click',()=>{NOTE_Q=[];closeNotes();});   /* 남은 업데이트를 건너뛰고 모두 읽은 걸로 */
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#wn').hidden)closeNotes();});
const lgSubmit=()=>startLogin($('#lgId').value,$('#lgPin').value,$('#lgPin2').value);
$('#lgGo').addEventListener('click',lgSubmit);
$('#lgId').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.defaultPrevented){e.preventDefault();$('#lgPin').focus();}});
$('#lgPin').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.defaultPrevented){e.preventDefault();if(LGMODE==='signup')$('#lgPin2').focus();else lgSubmit();}});
$('#lgPin2').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.defaultPrevented){e.preventDefault();lgSubmit();}});
['#lgPin','#lgPin2'].forEach(q=>$(q).addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,4);}));
$('#lgResume').addEventListener('click',e=>{$('#lgId').value=e.currentTarget.dataset.id;$('#lgPin').focus();});
$('#lgToLogin').addEventListener('click',()=>goLoginForm('login'));
$('#lgToSignup').addEventListener('click',()=>goLoginForm('signup'));
$('#lgSwitch').addEventListener('click',()=>goLoginForm(LGMODE==='signup'?'login':'signup'));
$('#lgBackChoice').addEventListener('click',()=>{$('#lgMsg').textContent='';lgStep('choice');setTimeout(()=>{try{$('#lgToLogin').focus();}catch(e){}},30);});
$('#lgCreate').addEventListener('click',()=>createUser(false));
$('#lgImport').addEventListener('click',()=>createUser(true));
$('#lgBack1').addEventListener('click',()=>lgStep('main'));
$('#lgBack2').addEventListener('click',()=>lgStep('main'));
$('#lgRetry').addEventListener('click',()=>startLogin(LG.id,LG.pin,LG.pin));
$('#lgOffline').addEventListener('click',()=>{LG.offline=true;if(LG.mode==='signup'){if(LG.local)idTaken();else signupNew();}else if(LG.local)finishLogin(null);else idMissing();});
$('#outBtn').addEventListener('click',logout);
/* ---------- 비밀번호 변경 ---------- */
function openPinChange(){
  if(!USER)return;
  $('#pcOld').value='';$('#pcNew').value='';$('#pcNew2').value='';$('#pcMsg').textContent='';
  $('#pinChange').hidden=false;setTimeout(()=>{try{$('#pcOld').focus();}catch(e){}},30);
}
function closePinChange(){$('#pinChange').hidden=true;}
async function submitPinChange(){
  const oldPin=$('#pcOld').value.trim(),n1=$('#pcNew').value.trim(),n2=$('#pcNew2').value.trim(),msg=$('#pcMsg');
  if(!PIN_RE.test(oldPin)){msg.textContent='현재 비밀번호를 숫자 4자리로 입력해 주세요.';return;}
  if(!PIN_RE.test(n1)){msg.textContent='새 비밀번호는 숫자 4자리로 입력해 주세요.';return;}
  if(n1!==n2){msg.textContent='새 비밀번호가 서로 달라요.';return;}
  if(n1===oldPin){msg.textContent='기존 비밀번호와 다른 번호로 정해 주세요.';return;}
  $('#pcGo').disabled=true;msg.textContent='변경하는 중…';
  try{
    if(cloudUrl())await api('change_pin',{id:USER.id,pin:oldPin,newPin:n1});
    else if(oldPin!==USER.pin)throw new Error('bad_pin');
    USER.pin=n1;USER.ph=pinHash(USER.id,n1);save();keepSession();
    sfx('coin');toast('비밀번호를 변경했어요.');closePinChange();
  }catch(e){
    const m=e&&e.message;
    msg.textContent=m==='bad_pin'?'현재 비밀번호가 맞지 않아요.':m==='locked'?'비밀번호를 여러 번 틀려서 잠겼어요. 잠시 후 다시 시도해 주세요.':'변경에 실패했어요. 잠시 후 다시 시도해 주세요.';
    sfx('error');
  }
  $('#pcGo').disabled=false;
}
$('#pinBtn').addEventListener('click',openPinChange);
$('#pcClose').addEventListener('click',closePinChange);
$('#pcGo').addEventListener('click',submitPinChange);
[$('#pcOld'),$('#pcNew'),$('#pcNew2')].forEach(el=>{
  el.addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,4);});
  el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submitPinChange();}});
});

