'use strict';
/* ---------- AI 작곡 요청: 선택지 목록 ----------
   화면(js/compose.js)과 GitHub 이슈를 만드는 스크립트(scripts/song_issues.js)가 같이 써요.
   ko: 화면에 보이는 이름, en: ACE-Step 태그(Caption)에 들어가는 영어 표현.
   id는 서버(backend/schema.sql rk_song_request)가 영문 소문자·숫자·_ 형식만 받아요. 바꾸면 이전 요청의 이슈에 그 항목이 빠지니 지우지 말고 추가만 하세요. */
const SONG_OPTS={
  genre:[   /* 노래 스타일 (최대 3개) */
    {id:'rock',ko:'락',en:'rock'},{id:'punk',ko:'펑크',en:'punk rock'},{id:'metal',ko:'메탈',en:'heavy metal'},
    {id:'ballad',ko:'발라드',en:'ballad'},{id:'kpop',ko:'K-POP',en:'k-pop'},{id:'dance',ko:'댄스',en:'dance pop'},
    {id:'hiphop',ko:'힙합',en:'hip hop'},{id:'edm',ko:'EDM',en:'edm'},{id:'citypop',ko:'시티팝',en:'city pop'},
    {id:'rnb',ko:'R&B',en:'r&b'},{id:'jazz',ko:'재즈',en:'jazz'},{id:'trot',ko:'트로트',en:'trot, korean traditional pop'},
    {id:'folk',ko:'어쿠스틱',en:'acoustic folk'},{id:'anthem',ko:'응원가',en:'stadium anthem, chant'},
    {id:'kids',ko:'동요',en:"children's song"},{id:'chip',ko:'8비트 게임',en:'chiptune, 8-bit game music'}
  ],
  mood:[   /* 분위기 (최대 3개) */
    {id:'energetic',ko:'신나는',en:'energetic'},{id:'funny',ko:'유쾌한',en:'playful, funny'},{id:'cute',ko:'귀여운',en:'cute'},
    {id:'emotional',ko:'감성적인',en:'emotional'},{id:'sad',ko:'슬픈',en:'sad, melancholic'},{id:'epic',ko:'웅장한',en:'epic'},
    {id:'intense',ko:'비장한',en:'intense, dramatic'},{id:'dreamy',ko:'몽환적인',en:'dreamy'},{id:'chill',ko:'잔잔한',en:'calm, chill'}
  ],
  tempo:[   /* 템포 → BPM 기본값 */
    {id:'slow',ko:'느리게',en:'slow tempo',bpm:72},{id:'mid',ko:'보통',en:'mid tempo',bpm:100},
    {id:'fast',ko:'빠르게',en:'fast tempo',bpm:132},{id:'vfast',ko:'아주 빠르게',en:'very fast tempo',bpm:168}
  ],
  vocal:[   /* 보컬 */
    {id:'male',ko:'남자 보컬',en:'male vocal'},{id:'female',ko:'여자 보컬',en:'female vocal'},
    {id:'duet',ko:'남녀 듀엣',en:'male and female duet vocals'},{id:'choir',ko:'떼창·합창',en:'group vocals, choir'},
    {id:'inst',ko:'연주곡 (가사 없음)',en:'instrumental'}
  ],
  lang:[   /* 가사 언어 (ACE-Step vocal_language) */
    {id:'ko',ko:'한국어',en:'korean'},{id:'en',ko:'영어',en:'english'},{id:'ja',ko:'일본어',en:'japanese'},{id:'mix',ko:'한국어+영어',en:'korean, english'}
  ],
  inst:[   /* 주요 악기 (최대 4개, 선택) */
    {id:'egtr',ko:'일렉기타',en:'electric guitar'},{id:'agtr',ko:'통기타',en:'acoustic guitar'},{id:'bass',ko:'베이스',en:'bass guitar'},
    {id:'drums',ko:'드럼',en:'drums'},{id:'piano',ko:'피아노',en:'piano'},{id:'synth',ko:'신디사이저',en:'synthesizer'},
    {id:'strings',ko:'현악기',en:'strings'},{id:'brass',ko:'브라스',en:'brass section'},{id:'gugak',ko:'국악기',en:'gayageum, korean traditional instruments'},
    {id:'whistle',ko:'휘파람',en:'whistling'}
  ],
  key:[   /* 조성 (ACE-Step keyscale) */
    {id:'auto',ko:'알아서',en:''},{id:'major',ko:'밝게 (장조)',en:'major key'},{id:'minor',ko:'어둡게 (단조)',en:'minor key'}
  ],
  meter:[   /* 박자 (ACE-Step timesignature) */
    {id:'4',ko:'4/4 (기본)',en:'4/4'},{id:'3',ko:'3/4 (왈츠)',en:'3/4'},{id:'6',ko:'6/8 (출렁출렁)',en:'6/8'}
  ],
  dur:[   /* 곡 길이(초). ACE-Step은 최대 약 4분 */
    {id:'30',ko:'30초',sec:30},{id:'60',ko:'1분',sec:60},{id:'120',ko:'2분',sec:120},{id:'180',ko:'3분',sec:180},{id:'240',ko:'4분',sec:240}
  ]
};
/* 가사 입력칸에 넣는 구간 태그. ACE-Step은 [verse] [chorus] 같은 태그로 노래 구조를 읽어요 */
const SONG_TAGS=[
  {t:'[intro]',ko:'인트로'},{t:'[verse]',ko:'벌스(1절)'},{t:'[pre-chorus]',ko:'프리코러스'},
  {t:'[chorus]',ko:'후렴'},{t:'[bridge]',ko:'브릿지'},{t:'[outro]',ko:'아웃트로'}
];
const SONG_MAX={genre:3,mood:3,inst:4,title:40,lyrics:2000,note:200};
const SONG_BPM={min:50,max:200};
/* 선택값 → ACE-Step 태그(Caption) 문자열. 예: "rock, punk rock, energetic, male vocal, electric guitar, drums, korean, 132 bpm" */
function songTags(o){
  const pick=(k,id)=>(SONG_OPTS[k].find(x=>x.id===id)||{}).en||'';
  const many=(k,a)=>(Array.isArray(a)?a:[]).map(id=>pick(k,id));
  const out=[...many('genre',o.genre),...many('mood',o.mood),pick('tempo',o.tempo),pick('vocal',o.vocal),...many('inst',o.inst),pick('key',o.key)];
  if(o.vocal!=='inst')out.push(pick('lang',o.lang));
  if(o.bpm)out.push(o.bpm+' bpm');
  return out.filter(Boolean).join(', ');
}
if(typeof module!=='undefined')module.exports={SONG_OPTS,SONG_TAGS,SONG_MAX,SONG_BPM,songTags};   /* node(scripts/song_issues.js)에서 읽을 때 */
