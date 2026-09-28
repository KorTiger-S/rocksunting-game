'use strict';
/* ---------- 소리새 펌프: 곡 + 채보 데이터 ----------
   곡은 audio.js의 배경음악처럼 8분음표 한 칸씩 적은 악보(BGMT)예요. 별도 소리 파일이 없어요.
   채보(노트 배치)도 손으로 찍지 않고 악보에서 자동으로 만들어요. 곡 id + 난이도(level)로 항상 같은 채보가 나와요.
     level 1 : 멜로디 중 4분음표 자리(짝수 칸)만 노트  → 쉬움
     level 2 : 멜로디 음마다 노트                         → 보통
     level 3 : 멜로디 + 베이스 음(한 박 단위)까지 노트, 점프(동시 두 발판)가 자주 나와요 → 어려움
   새 곡은 pgBuild()로 BGMT에 악보를 등록하고 PGSONGS에 한 줄 추가하면 돼요. */
/* ---------- 시즌2 잠금 ----------
   허브에는 제목이 "???"로 가려진 카드만 보이고, 관리자 번호(숫자 4자리)를 입력해야 플레이할 수 있어요.
   번호는 소스에 남기지 않고 확인값(PUMP_KEY)만 남겨요. 바꾸려면: node dev/pump_key.js 새번호
   ※ 브라우저에서 도는 코드라 '가벼운 잠금'이에요. 소스를 뜯어보는 사람까지 막지는 못해요.
   모두에게 열 때: PUMP_PUBLIC=true (잠금 없이 바로 보임) + 버전을 2.0.0으로 올려요(README '시즌2 오픈 절차') */
const PUMP_PUBLIC=false;
const PUMP_KEY='2e0rybdu1xw';
const pgUnlocked=()=>PUMP_PUBLIC||lsGet('rk:pumpkey')===PUMP_KEY;
const PG_LANES=5;   /* 0=↙ 1=↖ 2=● 3=↗ 4=↘  (화면 왼쪽→오른쪽 순서, 펌프 발판과 같아요) */

/* form 항목 'A:main' = 멜로디 변주 A를 4마디, 드럼 세트 main으로. 총 8~10개 × 4마디 = 32~40마디
   'A:main:1' 처럼 셋째 칸을 쓰면 그 구간만 progs[1](코드)·basses[1](베이스)를 써요. */
function pgBuild(o){
  const L={lead:[],bass:[],pad:[],kick:[],snare:[],hat:[]};
  o.form.forEach(f=>{
    const p=f.split(':'),lead=o.lead[p[0]],kd=o.drums[p[1]],pr=(o.progs&&o.progs[+p[2]||0])||o.prog,bs=(o.basses&&o.basses[+p[2]||0])||o.bass;
    for(let b=0;b<4;b++){
      L.lead.push(lead[b]);L.bass.push(bs[b]);L.pad.push(pr[b]+' . . . . . . .');
      L.kick.push(kd.kick);L.snare.push(kd.snare);L.hat.push(kd.hat);
    }
  });
  const e=L.lead.length-1;   /* 마지막 마디: 으뜸음 한 번 울리고 끝 */
  L.lead[e]=o.end;L.bass[e]=o.endBass+' . . . . . . .';L.pad[e]=o.endChord+' . . . . . . .';
  L.kick[e]='x . . . . . . .';L.snare[e]='. . . . . . . .';L.hat[e]='. . . . . . . .';
  BGMT[o.id]=trk({bpm:o.bpm,len:L.lead.length*8,L:[
    {n:'lead',t:'note',wave:o.wave,vol:o.leadVol,d:1.3,seq:bars(...L.lead)},
    {n:'bass',t:'note',wave:'triangle',vol:o.bassVol,d:1.4,seq:bars(...L.bass)},
    {n:'pad',t:'chord',wave:'sine',vol:.03,d:7,att:.1,seq:bars(...L.pad)},
    {n:'kick',t:'kick',vol:o.kickVol,seq:bars(...L.kick)},
    {n:'snare',t:'snare',vol:.05,seq:bars(...L.snare)},
    {n:'hat',t:'hat',vol:.02,seq:bars(...L.hat)}
  ]});
}
const PGDR_SOFT={kick:'x . . . x . . .',snare:'. . . . x . . .',hat:'. . x . . . x .'};
/* 1) 등굣길 뜀박질 — 쉬움 (C-G-Am-F, 등굣길 테마) */
pgBuild({id:'pg1',bpm:112,wave:'square',leadVol:.04,bassVol:.09,kickVol:.16,
  prog:['C','G','Am','F'],
  lead:{
    A:['E5 . G5 . E5 . C5 .','D5 . G5 . B5 . G5 .','C5 . E5 . A5 . E5 .','A5 . F5 . C5 . A4 .'],
    B:['G5 . E5 G5 C6 . G5 .','B5 . G5 B5 D6 . B5 .','A5 . E5 A5 C6 . A5 .','F5 . A5 C6 . A5 F5 .'],
    C:['E5 . . . G5 . . .','D5 . . . B5 . . .','C5 . . . E5 . . .','A5 . . . C6 . . .']},
  bass:['C3 . C3 . G3 . C3 .','G2 . G2 . D3 . G2 .','A2 . A2 . E3 . A2 .','F2 . F2 . C3 . F2 .'],
  drums:{main:{kick:'x . . . x . . .',snare:'. . . . . . . .',hat:'. x . x . x . x'},
         beat:{kick:'x . . . x . . .',snare:'. . . . x . . .',hat:'. x . x . x . x'},
         soft:{kick:'x . . . . . . .',snare:'. . . . . . . .',hat:'. . . . . . . .'}},
  form:['A:main','A:main','B:beat','B:beat','C:soft','A:beat','B:beat','B:beat'],
  end:'C6 . . . . . . .',endChord:'C',endBass:'C3'});
/* 2) 매점 러시 — 보통 (Am-F-C-G, 킥오프 테마) */
pgBuild({id:'pg2',bpm:138,wave:'square',leadVol:.035,bassVol:.06,kickVol:.18,
  prog:['Am','F','C','G'],
  lead:{
    A:['A5 . C6 . E6 . C6 .','A5 . C6 . F6 . C6 .','G5 . C6 . E6 . C6 .','G5 . B5 . D6 . B5 .'],
    B:['E6 . D6 C6 . A5 . C6','C6 . A5 F5 . A5 . C6','E6 . D6 C6 . G5 . C6','D6 . B5 G5 . B5 D6 .'],
    C:['A5 C6 E6 . A6 . E6 C6','A5 C6 F6 . A6 . F6 C6','G5 C6 E6 . G6 . E6 C6','G5 B5 D6 . G6 . D6 B5'],
    D:['E6 . . . D6 . . .','C6 . . . A5 . . .','G5 . . . E6 . . .','D6 . . . B5 . . .']},
  bass:['A2 . A2 A2 . A2 A2 .','F2 . F2 F2 . F2 F2 .','C3 . C3 C3 . C3 C3 .','G2 . G2 G2 . G2 G2 .'],
  drums:{main:{kick:'x . x . x . x .',snare:'. . x . . . x .',hat:'. x . x . x . x'},soft:PGDR_SOFT},
  form:['A:main','B:main','A:main','B:main','C:main','C:main','D:soft','C:main'],
  end:'A5 . . . . . . .',endChord:'Am',endBass:'A2'});
/* 3) 운명의 페널티킥 — 어려움 (Em-C-G-D, 대결 테마) */
pgBuild({id:'pg3',bpm:158,wave:'sawtooth',leadVol:.028,bassVol:.05,kickVol:.2,
  prog:['Em','C','G','D'],
  lead:{
    A:['B5 . E6 . G6 . E6 B5','G5 . C6 . E6 . C6 G5','B5 . D6 . G6 . D6 B5','A5 . D6 . F#6 . D6 A5'],
    B:['G6 F#6 E6 . B5 . E6 .','E6 D6 C6 . G5 . C6 .','D6 C6 B5 . G5 . B5 .','F#6 E6 D6 . A5 . D6 .'],
    C:['E6 G6 B6 G6 E6 G6 B6 .','C6 E6 G6 E6 C6 E6 G6 .','D6 G6 B6 G6 D6 G6 B6 .','D6 F#6 A6 F#6 D6 F#6 A6 .'],
    D:['E6 . . . . . B5 .','C6 . . . . . G5 .','B5 . . . . . D6 .','A5 . . . . . F#6 .']},
  bass:['E2 . E2 E2 . E2 E3 .','C2 . C2 C2 . C2 C3 .','G2 . G2 G2 . G2 G3 .','D2 . D2 D2 . D2 D3 .'],
  drums:{main:{kick:'x . x . x . x .',snare:'. . x . . . x .',hat:'x x x x x x x x'},soft:PGDR_SOFT},
  form:['A:main','A:main','B:main','B:main','D:soft','C:main','C:main','B:main','C:main','C:main'],
  end:'E6 . . . . . . .',endChord:'Em',endBass:'E2'});

/* 4) 비창 3악장 — 쉬움 (Cm-Fm-G, 베토벤 피아노 소나타 8번 「비창」 3악장의 분위기를 살린 칩튠 편곡)
   베토벤의 원곡(1799)은 저작권이 없는 곡이지만, 멜로디는 원곡을 그대로 옮기지 않고 이 게임에 맞게 새로 지었어요. */
pgBuild({id:'pg4',bpm:144,wave:'square',leadVol:.036,bassVol:.09,kickVol:.17,
  prog:['Cm','Fm','G','Cm'],
  progs:[['Cm','Fm','G','Cm'],['Ab','Fm','G','Cm']],
  lead:{
    A:['G4 . C5 . Eb5 . D5 C5','C5 . F5 . Ab5 . G5 F5','D5 . G5 . B5 . A5 G5','Eb5 . D5 . C5 . . .'],
    B:['C5 D5 Eb5 . G5 . Eb5 .','F5 G5 Ab5 . C6 . Ab5 .','B5 . D6 . G5 . B5 .','C6 . G5 Eb5 C5 . . .'],
    C:['G5 . . . Eb5 . . .','Ab5 . . . F5 . . .','B5 . . . D6 . . .','C6 . . . . . . .'],
    D:['Eb5 . Ab5 . C6 . Bb5 Ab5','C5 . F5 . Ab5 . G5 F5','D5 . G5 . B5 . A5 G5','G5 . Eb5 . C5 . . .']},
  bass:['C3 . C3 . G3 . C3 .','F2 . F2 . C3 . F2 .','G2 . G2 . D3 . G2 .','C3 . C3 . G3 . C3 .'],
  basses:[['C3 . C3 . G3 . C3 .','F2 . F2 . C3 . F2 .','G2 . G2 . D3 . G2 .','C3 . C3 . G3 . C3 .'],['Ab2 . Ab2 . Eb3 . Ab2 .','F2 . F2 . C3 . F2 .','G2 . G2 . D3 . G2 .','C3 . C3 . G3 . C3 .']],
  drums:{main:{kick:'x . . . x . . .',snare:'. . . . . . . .',hat:'. x . x . x . x'},
         beat:{kick:'x . . . x . . .',snare:'. . . . x . . .',hat:'. x . x . x . x'},
         soft:{kick:'x . . . . . . .',snare:'. . . . . . . .',hat:'. . . . . . . .'}},
  form:['A:main:0','A:main:0','B:beat:0','D:beat:1','C:soft:0','A:beat:0','B:beat:0','D:beat:1'],
  end:'C5 . . . . . . .',endChord:'Cm',endBass:'C3'});

/* 곡 목록. target = 호우의 목표 점수(이 이상이면 내기 승리), approach = 노트가 화면 아래에서 발판까지 올라오는 시간(초, 속도 ×1 기준) */
const PGSONGS=[
  {id:'pg1',name:'등굣길 뜀박질',sub:'가볍게 몸 풀기',level:1,stars:2,target:650000,approach:2.0,seed:101},
  {id:'pg4',name:'비창 3악장',sub:'베토벤 · 소나타 8번 (칩튠)',level:1,stars:3,target:700000,approach:1.9,seed:404},
  {id:'pg2',name:'매점 러시',sub:'종 치면 뛰어!',level:2,stars:5,target:750000,approach:1.7,seed:202},
  {id:'pg3',name:'운명의 페널티킥',sub:'호우의 진짜 실력',level:3,stars:8,target:800000,approach:1.5,seed:303}
];
PGSONGS.forEach(s=>{s.bpm=BGMT[s.id].bpm;s.spb=60/s.bpm/2;s.len=BGMT[s.id].len;s.secs=Math.round(s.len*s.spb);});

/* ---------- 채보 자동 생성 ---------- */
function pgRng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
/* 발판 밟는 순서 조각. 0=↙ 1=↖ 2=● 3=↗ 4=↘ */
const PGPAT1=[[0,1,2,3,4],[4,3,2,1,0],[0,1,0,1],[4,3,4,3],[2,1,2,3],[0,1,2,1,0],[1,2,3,2,1],[2,3,2,1]];
const PGPAT2=PGPAT1.concat([[1,3,1,3],[2,0,2,4],[3,2,1,0,1],[1,0,1,2,3]]);
const PGPAT3=PGPAT2.concat([[0,3,0,3],[1,4,1,4],[0,1,4,3],[4,3,0,1]]);
const PGJUMPS=[[0,4],[1,3],[0,3],[1,4]];
const PGJUMP_P=[0,.12,.4];      /* level별 마디 첫 박에서 점프가 나올 확률 */
const PGHOLD_P=[0,.7,.6,.5];    /* level별, 노트 뒤로 4칸 이상 비면 그 사이를 롱노트로 만들 확률 */
const PGCHARTS={};
function pgChart(sg){
  if(PGCHARTS[sg.id])return PGCHARTS[sg.id];
  const T=BGMT[sg.id],lead=T.L.find(l=>l.n==='lead').a,bass=T.L.find(l=>l.n==='bass').a,R=pgRng(sg.seed),lv=sg.level,spb=sg.spb;
  const lib=lv===1?PGPAT1:lv===2?PGPAT2:PGPAT3,steps=[];
  for(let s=0;s<T.len;s++){
    const hasL=lead[s]!=='.',hasB=bass[s]!=='.';
    const on=lv===1?(hasL&&s%2===0):lv===2?hasL:(hasL||(hasB&&s%4===0));
    if(on)steps.push(s);
  }
  const notes=[];let pat=null,pi=0,last=2,curS=0;
  const nextLane=()=>{
    if(pat&&pi>=3&&curS%8===0)pat=null;   /* 마디가 바뀌면 새 흐름으로 */
    if(!pat||pi>=pat.length){
      const c=lib.filter(p=>p[0]!==last&&Math.abs(p[0]-last)<=2);
      pat=c[Math.floor(R()*c.length)]||lib[0];pi=0;
    }
    return pat[pi++];
  };
  steps.forEach((s,i)=>{
    curS=s;
    const nx=i+1<steps.length?steps[i+1]:T.len,gap=nx-s,fin=i===steps.length-1;
    const t=s*spb;
    if(!fin&&s%8===0&&R()<PGJUMP_P[lv-1]){   /* 점프: 두 발판을 동시에 */
      const j=PGJUMPS[Math.floor(R()*PGJUMPS.length)];
      j.forEach(l=>notes.push({t,lane:l,hold:0,s}));
      last=j[Math.floor(R()*2)];pat=null;return;
    }
    const lane=(lv>=2&&R()<.06)?last:nextLane();   /* 가끔 같은 발판을 한 번 더 */
    let hold=0;
    if(!fin&&gap>=4&&R()<PGHOLD_P[lv])hold=(gap-1)*spb;
    notes.push({t,lane,hold,s});last=lane;
  });
  const out={notes,total:0,taps:0,holds:0,end:0};
  notes.forEach(n=>{if(n.hold){out.holds++;out.total+=2;}else{out.taps++;out.total++;}out.end=Math.max(out.end,n.t+n.hold);});
  return PGCHARTS[sg.id]=out;
}
