'use strict';
/* ---------- 소리새 펌프: 곡 + 채보 데이터 ----------
   곡은 audio.js의 배경음악처럼 8분음표 한 칸씩 적은 악보(BGMT)예요. 별도 소리 파일이 없어요.
   채보(노트 배치)도 손으로 찍지 않고 악보에서 자동으로 만들어요. 곡마다 쉬움·보통·어려움·매우 어려움 네 채보가 있고, 곡 id + 난이도(level)로 항상 같은 채보가 나와요.
     level 1 : 멜로디 중 4분음표 자리(짝수 칸)만 노트  → 쉬움
     level 2 : 멜로디 음마다 노트                         → 보통
     level 3 : 멜로디 + 베이스 음(한 박 단위)까지 노트, 점프(동시 두 발판)가 자주 나와요 → 어려움
     level 4 : 멜로디 + 베이스 음 전부, 반 마디마다 점프, 롱노트는 줄이고 발판을 크게 건너뛰는 흐름까지 → 매우 어려움
   새 곡은 pgBuild()로 BGMT에 악보를 등록하고 PGSONGS에 한 줄(난이도 4개 포함) 추가하면 돼요. */
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
   'A:main:1' 처럼 셋째 칸을 쓰면 그 구간만 progs[1](코드)·basses[1](베이스)·riffs[1](기타 리프)를 써요.
   롹 편곡: leadGtr:true면 멜로디를 일렉기타로, riffs를 주면 파워코드 리프 파트가 더해져요(audio.js의 gtr). */
function pgBuild(o){
  const L={lead:[],bass:[],pad:[],kick:[],snare:[],hat:[],riff:[]};
  o.form.forEach(f=>{
    const p=f.split(':'),lead=o.lead[p[0]],kd=o.drums[p[1]],pr=(o.progs&&o.progs[+p[2]||0])||o.prog,bs=(o.basses&&o.basses[+p[2]||0])||o.bass,rf=o.riffs&&o.riffs[+p[2]||0];
    for(let b=0;b<4;b++){
      L.lead.push(lead[b]);L.bass.push(bs[b]);L.pad.push(pr[b]+' . . . . . . .');if(rf)L.riff.push(rf[b]);
      L.kick.push(kd.kick);L.snare.push(kd.snare);L.hat.push(kd.hat);
    }
  });
  const e=L.lead.length-1;   /* 마지막 마디: 으뜸음 한 번 울리고 끝 */
  L.lead[e]=o.end;L.bass[e]=o.endBass+' . . . . . . .';L.pad[e]=o.endChord+' . . . . . . .';
  L.kick[e]='x . . . . . . .';L.snare[e]='. . . . . . . .';L.hat[e]='. . . . . . . .';
  const ly=[
    o.leadGtr?{n:'lead',t:'gtr',vol:o.leadVol,d:o.leadD||1.3,seq:bars(...L.lead)}:{n:'lead',t:'note',wave:o.wave,vol:o.leadVol,d:1.3,seq:bars(...L.lead)},
    {n:'bass',t:'note',wave:o.bassWave||'triangle',vol:o.bassVol,d:1.4,seq:bars(...L.bass)},
    {n:'pad',t:'chord',wave:'sine',vol:o.padVol||.03,d:7,att:.1,seq:bars(...L.pad)},
    {n:'kick',t:'kick',vol:o.kickVol,seq:bars(...L.kick)},
    {n:'snare',t:'snare',vol:o.snareVol||.05,seq:bars(...L.snare)},
    {n:'hat',t:'hat',vol:o.hatVol||.02,seq:bars(...L.hat)}
  ];
  if(o.riffs){L.riff[e]=o.endRiff+' . . . . . . .';ly.push({n:'riff',t:'gtr',pc:true,vol:o.riffVol,d:o.riffD||.75,seq:bars(...L.riff)});}
  BGMT[o.id]=trk({bpm:o.bpm,len:L.lead.length*8,L:ly});
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

/* ---------- 클래식 명곡 (저작권이 끝난 곡) ----------
   작곡가가 세상을 떠난 지 70년이 훨씬 넘은 곡들이라 곡 자체의 저작권이 없어요. 음반·현대 편곡·리믹스는 따라 하지 않고,
   원곡의 주제 선율만 가져와 이 게임용 칩튠으로 새로 편곡했어요(중간부 일부는 게임용으로 새로 지었어요).
   터키 행진곡·왕벌의 비행은 원곡이 16분음표로 달리는 곡이라, 한 칸 = 16분음표로 적고 bpm을 두 배로 잡았어요. */
const PGDR_16={main:{kick:'x . . . x . . .',snare:'. . . . x . . .',hat:'x . x . x . x .'},
               soft:{kick:'x . . . . . . .',snare:'. . . . . . . .',hat:'. . . . x . . .'}};
/* 5) 캉캉 — 오펜바흐 「천국과 지옥」 서곡 중 '지옥의 갤럽' (1858) */
pgBuild({id:'pg5',bpm:160,wave:'square',leadVol:.036,bassVol:.08,kickVol:.18,
  prog:['C','G','G','C'],
  progs:[['C','G','G','C'],['C','F','C','G'],['C','G','C','G']],
  lead:{
    A:['C5 . . . D5 F5 E5 D5','G5 . G5 . G5 A5 E5 F5','D5 . D5 . D5 F5 E5 D5','C5 C6 B5 A5 G5 F5 E5 D5'],
    E:['C5 . . . D5 F5 E5 D5','G5 . G5 . G5 A5 E5 F5','D5 . D5 . D5 F5 E5 D5','C5 G4 D5 E5 C5 . . .'],
    B:['E5 . E5 . E5 . F5 G5','A5 . A5 . A5 . G5 F5','E5 . G5 . C6 . G5 E5','D5 . G4 . D5 . . .'],
    C:['C5 E5 G5 C6 G5 E5 C5 E5','D5 F5 G5 B5 G5 F5 D5 F5','E5 G5 C6 E6 C6 G5 E5 G5','D5 G5 B5 D6 B5 G5 D5 B4']},
  bass:['C3 . G2 . C3 . G2 .','G2 . D3 . G2 . D3 .','G2 . D3 . G2 . D3 .','C3 . G2 . C3 . G2 .'],
  basses:[['C3 . G2 . C3 . G2 .','G2 . D3 . G2 . D3 .','G2 . D3 . G2 . D3 .','C3 . G2 . C3 . G2 .'],
          ['C3 . G2 . C3 . G2 .','F2 . C3 . F2 . C3 .','C3 . G2 . C3 . G2 .','G2 . D3 . G2 . D3 .'],
          ['C3 C3 G2 G2 C3 C3 G2 G2','G2 G2 D3 D3 G2 G2 D3 D3','C3 C3 G2 G2 C3 C3 G2 G2','G2 G2 D3 D3 G2 G2 D3 D3']],
  drums:{main:{kick:'x . x . x . x .',snare:'. . x . . . x .',hat:'. x . x . x . x'},soft:PGDR_SOFT},
  form:['A:main:0','E:main:0','B:soft:1','B:main:1','A:main:0','E:main:0','C:main:2','C:main:2','A:main:0'],
  end:'C6 . . . . . . .',endChord:'C',endBass:'C3'});
/* 6) 터키 행진곡 — 모차르트 피아노 소나타 11번 3악장 (1783). 한 칸 = 16분음표 */
pgBuild({id:'pg6',bpm:184,wave:'square',leadVol:.034,bassVol:.08,kickVol:.15,
  prog:['Am','Am','E','Am'],
  progs:[['Am','Am','E','Am'],['Em','Em','Am','E'],['C','G','Am','E'],['A','E','A','E']],
  lead:{
    A:['B4 A4 G#4 A4 C5 . . .','D5 C5 B4 C5 E5 . . .','F5 E5 D#5 E5 B5 A5 G#5 A5','B5 A5 G#5 A5 C6 . A5 C6'],
    B:['B5 . A5 . G5 . A5 .','B5 . A5 . G5 . A5 .','B5 . A5 . G5 . F#5 .','E5 . . . . . . .'],
    C:['C6 . D6 . E6 . E6 .','F6 E6 D6 C6 B5 . . .','A5 . B5 . C6 . C6 .','D6 C6 B5 A5 G#5 . . .'],
    D:['C#6 . D6 . E6 . E6 .','F#6 E6 D6 C#6 B5 . . .','C#6 . D6 . E6 . E6 .','F#6 E6 D6 C#6 B5 . A5 .']},
  bass:['A2 . . . E3 . . .','A2 . . . E3 . . .','E2 . . . B2 . . .','A2 . . . E3 . . .'],
  basses:[['A2 . . . E3 . . .','A2 . . . E3 . . .','E2 . . . B2 . . .','A2 . . . E3 . . .'],
          ['E2 . . . B2 . . .','E2 . . . B2 . . .','A2 . . . E3 . . .','E2 . . . B2 . . .'],
          ['C3 . . . G2 . . .','G2 . . . D3 . . .','A2 . . . E3 . . .','E2 . . . B2 . . .'],
          ['A2 . A2 . E3 . A2 .','E2 . E2 . B2 . E2 .','A2 . A2 . E3 . A2 .','E2 . E2 . B2 . E2 .']],
  drums:PGDR_16,
  form:['A:main:0','B:main:1','A:main:0','B:main:1','C:main:2','C:main:2','D:main:3','D:main:3','A:main:0','B:main:1'],
  end:'A5 . . . . . . .',endChord:'Am',endBass:'A2'});
/* 7) 왕벌의 비행 — 림스키코르사코프 오페라 「술탄 황제 이야기」 (1900). 한 칸 = 16분음표, 반음씩 오르내리는 벌 소리 */
pgBuild({id:'pg7',bpm:200,wave:'sawtooth',leadVol:.026,bassVol:.07,kickVol:.17,
  prog:['Am','Am','Am','Am'],
  progs:[['Am','Am','Am','Am'],['Dm','Dm','Dm','Dm'],['Am','Am','E','E'],['E','E','Am','Am']],
  lead:{
    I:['E6 D#6 D6 C#6 D6 C#6 C6 B5','C6 B5 A#5 A5 G#5 G5 F#5 F5','E5 F5 E5 D#5 D5 C#5 C5 B4','C5 B4 A#4 A4 G#4 A4 B4 C5'],
    A:['A5 G#5 G5 F#5 F5 A#5 A5 G#5','A5 G#5 G5 F#5 F5 F#5 G5 G#5','A5 G#5 G5 F#5 F5 A#5 A5 G#5','A5 G#5 G5 F#5 F5 F#5 G5 G#5'],
    B:['D6 C#6 C6 B5 A#5 D#6 D6 C#6','D6 C#6 C6 B5 A#5 B5 C6 C#6','D6 C#6 C6 B5 A#5 D#6 D6 C#6','D6 C#6 C6 B5 A#5 B5 C6 C#6'],
    C:['A5 A#5 A5 G#5 A5 A#5 A5 G#5','A5 A#5 B5 C6 C#6 D6 D#6 E6','E6 D#6 D6 C#6 C6 B5 A#5 A5','G#5 G5 F#5 F5 E5 . E5 .']},
  bass:['A2 . . . E3 . . .','A2 . . . E3 . . .','A2 . . . E3 . . .','A2 . . . E3 . . .'],
  basses:[['A2 . . . E3 . . .','A2 . . . E3 . . .','A2 . . . E3 . . .','A2 . . . E3 . . .'],
          ['D3 . . . A2 . . .','D3 . . . A2 . . .','D3 . . . A2 . . .','D3 . . . A2 . . .'],
          ['A2 . . . E3 . . .','A2 . . . E3 . . .','E2 . . . B2 . . .','E2 . . . B2 . . .'],
          ['E2 . . . B2 . . .','E2 . . . B2 . . .','A2 . . . E3 . . .','A2 . . . E3 . . .']],
  drums:{main:{kick:'x . . . x . . .',snare:'. . . . x . . .',hat:'x x x x x x x x'},soft:PGDR_16.soft},
  form:['I:soft:3','A:main:0','A:main:0','B:main:1','A:main:0','C:main:2','B:main:1','A:main:0','C:main:2','A:main:0'],
  end:'A5 . . . . . . .',endChord:'Am',endBass:'A2'});
/* 8) 투우사의 노래 — 비제 오페라 「카르멘」 (1875) */
pgBuild({id:'pg8',bpm:120,wave:'square',leadVol:.038,bassVol:.09,kickVol:.17,
  prog:['F','F','C','F'],
  progs:[['F','F','C','C'],['F','F','Bb','F'],['Dm','Dm','C','C'],['F','F','C','C']],
  lead:{
    A:['C5 . . D5 C5 . A4 .','A4 . A4 G4 A4 Bb4 A4 .','Bb4 . . G4 C5 . A4 .','F4 . D4 G4 C4 . . .'],
    B:['C5 . . D5 C5 . A4 .','A4 . A4 G4 A4 Bb4 A4 .','D5 . . C5 Bb4 . A4 .','G4 . C5 . F4 . . .'],
    C:['D5 . . . C5 . A4 .','D5 . . . C5 . A4 .','G4 . A4 . Bb4 . C5 .','D5 . E5 . F5 . G5 .'],
    D:['A5 . . . . . G5 .','F5 . . . C5 . . .','G5 . . . . . F5 .','E5 . . . C5 . . .']},
  bass:['F2 . C3 . F2 . C3 .','F2 . C3 . F2 . C3 .','C3 . G2 . C3 . G2 .','F2 . C3 . F2 . C3 .'],
  basses:[['F2 . C3 . F2 . C3 .','F2 . C3 . F2 . C3 .','C3 . G2 . C3 . G2 .','C3 . G2 . C3 . G2 .'],
          ['F2 . C3 . F2 . C3 .','F2 . C3 . F2 . C3 .','Bb2 . F2 . Bb2 . F2 .','F2 . C3 . F2 . C3 .'],
          ['D3 . A2 . D3 . A2 .','D3 . A2 . D3 . A2 .','C3 . G2 . C3 . G2 .','C3 . G2 . C3 . G2 .'],
          ['F2 . C3 . F2 . C3 .','F2 . C3 . F2 . C3 .','C3 . G2 . C3 . G2 .','C3 . G2 . C3 . G2 .']],
  drums:{main:{kick:'x . . . x . . .',snare:'. . x . . . x .',hat:'. x . x . x . x'},soft:PGDR_SOFT},
  form:['A:main:0','B:main:1','C:soft:2','D:main:3','A:main:0','B:main:1','C:main:2','D:main:3'],
  end:'F5 . . . . . . .',endChord:'F',endBass:'F2'});

/* 9) 머대부고 교가 — 실제 학교 교가(김순세 작곡)의 멜로디를 악보 그대로 옮겼어요(가사는 쓰지 않아요).
   사장조 4/4, 24마디를 4마디씩 6구간(S1~S6)으로 나눴어요. 16분음표·셋잇단음표는 8분음표 칸에 맞춰 조금 다듬었어요.
   1절을 한 번 부르고, 후렴(S5~S6)을 드럼을 세게 해서 한 번 더 불러요.
   ※ 작곡가 저작권이 남아 있을 수 있는 곡이에요. 친구들끼리 하는 게임이라 넣었고, 학교·유족이 원하지 않으면 빼야 해요. */
const PGKB={G:'G2 . D3 . G2 . D3 .',C:'C3 . G2 . C3 . G2 .',D:'D3 . A2 . D3 . A2 .',Am:'A2 . E3 . A2 . E3 .'};
const PG9_PROGS=[['G','G','C','D'],['G','Am','D','G'],['D','G','Am','D'],['G','C','D','G'],['C','G','G','D'],['G','C','D','G']];
const PG9_LEAD={
    S1:['D4 . . . G4 . E4 .','D4 . B3 C4 D4 . D4 .','E4 . . F#4 G4 . E4 .','A4 . . . . . D4 .'],
    S2:['B4 . . C5 D5 . G4 .','A4 . . B4 C5 . E4 .','D4 . . E4 D4 . A4 .','G4 . . . . . . .'],
    S3:['A4 . . G4 F#4 D4 E4 F#4','G4 . A4 . B4 . B4 .','C5 . . B4 A4 . B4 C#5','D5 . . . . . D5 .'],
    S4:['D5 . . C5 B4 . B4 .','C5 . . C5 E4 . E4 .','F#4 . . G4 A4 . B4 .','G4 . . . . . G4 .'],
    S5:['C5 . . . C5 C5 C5 D5','E5 . D5 C5 B4 . B4 .','B4 . . C5 D5 D5 C5 B4','A4 . . . . . D5 D5'],
    S6:['D5 . . . B4 B4 A4 G4','E5 . . . . . D4 C5','B4 . . . . . A4 .','G4 . . . . . . .']};
pgBuild({id:'pg9',bpm:112,wave:'square',leadVol:.04,bassVol:.09,kickVol:.17,
  prog:PG9_PROGS[0],progs:PG9_PROGS,basses:PG9_PROGS.map(p=>p.map(c=>PGKB[c])),bass:PG9_PROGS[0].map(c=>PGKB[c]),
  lead:PG9_LEAD,
  drums:{soft:{kick:'x . . . x . . .',snare:'. . . . . . . .',hat:'. . x . . . x .'},
         beat:{kick:'x . . . x . . .',snare:'. . x . . . x .',hat:'. x . x . x . x'},
         rock:{kick:'x . . x x . . .',snare:'. . x . . . x .',hat:'x x x x x x x x'}},
  form:['S1:soft:0','S2:soft:1','S3:beat:2','S4:beat:3','S5:beat:4','S6:beat:5','S5:rock:4','S6:rock:5'],
  end:'G4 . . . . . . .',endChord:'G',endBass:'G2'});

/* 10) 머대부고 교가 (롹 버전) — 교가 멜로디를 일렉기타 리드로 치고, 파워코드 리프·베이스·록 드럼을 얹어 빠르게(BPM 184) 편곡했어요.
   도입 리프(R)와 기타 솔로(X·Y)는 이 게임용으로 새로 지었어요. 코드 진행은 교가(PG9_PROGS)를 그대로 따라가요. */
const PGPC={G:'G2',C:'C3',D:'D3',Am:'A2'};   /* 코드 → 파워코드 근음 */
const PG10_PROGS=PG9_PROGS.concat([['G','C','D','G']]);   /* [6]: 기타 솔로 구간 */
const pg10Bar=pat=>c=>pat.replace(/X/g,PGPC[c]);
pgBuild({id:'pg10',bpm:184,leadGtr:true,leadVol:.034,leadD:2,bassVol:.08,padVol:.012,kickVol:.22,snareVol:.08,hatVol:.024,riffVol:.04,riffD:.7,
  prog:PG10_PROGS[0],progs:PG10_PROGS,
  bass:PG10_PROGS[0].map(pg10Bar('X . X X . X X .')),basses:PG10_PROGS.map(p=>p.map(pg10Bar('X . X X . X X .'))),
  riffs:PG10_PROGS.map(p=>p.map(pg10Bar('X X X X X X X X'))),
  lead:Object.assign({
    R:['G4 . D5 . G4 A4 B4 D5','G5 . D5 . B4 . G4 .','E5 . C5 . G4 A4 C5 E5','D5 . F#5 . A5 . F#5 D5'],
    X:['G4 B4 D5 G5 D5 B4 G4 B4','C5 E5 G5 C6 G5 E5 C5 E5','D5 F#5 A5 D6 A5 F#5 D5 F#5','G5 D5 B4 D5 G5 . . .'],
    Y:['B4 D5 G5 B5 A5 G5 D5 B4','C5 E5 G5 C6 B5 A5 G5 E5','F#5 A5 D6 . C6 A5 F#5 D5','G5 . D5 . G4 . . .']},PG9_LEAD),
  drums:{drive:{kick:'x . . x x . . .',snare:'. . x . . . x .',hat:'x x x x x x x x'},
         rock:{kick:'x . x x x . x x',snare:'. . x . . . x .',hat:'x x x x x x x x'}},
  form:['R:rock:0','S1:drive:0','S2:drive:1','S3:drive:2','S4:drive:3','S5:rock:4','S6:rock:5','X:rock:6','Y:rock:6','S5:rock:4','S6:rock:5'],
  end:'G5 . . . . . . .',endChord:'G',endBass:'G2',endRiff:'G2'});

/* 곡 목록. 곡마다 난이도 4개(diffs[0]=쉬움 · [1]=보통 · [2]=어려움 · [3]=매우 어려움)가 있어요.
   stars = 별 개수(1~12), target = 호우의 목표 점수(이 이상이면 내기 승리), approach = 노트가 화면 아래에서 발판까지 올라오는 시간(초, 속도 ×1 기준) */
const PG_DIFFS=['쉬움','보통','어려움','매우 어려움'];
const PG_BETMAX=[1000,2000,3000,4000];   /* 난이도별 판돈 상한(원). 쉬운 곡으로 큰돈을 버는 걸 막아요 */
const PGSONGS=[
  {id:'pg1',name:'등굣길 뜀박질',sub:'가볍게 몸 풀기',seed:101,diffs:[{stars:1,target:650000,approach:2.0},{stars:3,target:700000,approach:1.8},{stars:5,target:750000,approach:1.6},{stars:7,target:780000,approach:1.4}]},
  {id:'pg9',name:'머대부고 교가',sub:'김순세 작곡 · 우리 학교 노래',seed:909,diffs:[{stars:1,target:650000,approach:2.0},{stars:3,target:700000,approach:1.8},{stars:5,target:750000,approach:1.6},{stars:7,target:780000,approach:1.4}]},
  {id:'pg10',name:'머대부고 교가 (롹 버전)',sub:'일렉기타로 달리는 우리 학교 노래',seed:1010,diffs:[{stars:4,target:700000,approach:1.8},{stars:6,target:740000,approach:1.6},{stars:8,target:780000,approach:1.45},{stars:11,target:820000,approach:1.3}]},
  {id:'pg8',name:'투우사의 노래',sub:'비제 · 오페라 「카르멘」',seed:808,diffs:[{stars:2,target:650000,approach:2.0},{stars:4,target:720000,approach:1.8},{stars:6,target:760000,approach:1.6},{stars:8,target:790000,approach:1.4}]},
  {id:'pg4',name:'비창 3악장',sub:'베토벤 · 소나타 8번 (칩튠)',seed:404,diffs:[{stars:3,target:700000,approach:1.9},{stars:5,target:720000,approach:1.7},{stars:7,target:750000,approach:1.5},{stars:9,target:790000,approach:1.35}]},
  {id:'pg5',name:'캉캉',sub:'오펜바흐 · 「천국과 지옥」',seed:505,diffs:[{stars:3,target:680000,approach:1.9},{stars:6,target:740000,approach:1.7},{stars:8,target:780000,approach:1.5},{stars:10,target:800000,approach:1.35}]},
  {id:'pg2',name:'매점 러시',sub:'종 치면 뛰어!',seed:202,diffs:[{stars:3,target:700000,approach:1.9},{stars:5,target:750000,approach:1.7},{stars:7,target:780000,approach:1.5},{stars:9,target:800000,approach:1.35}]},
  {id:'pg6',name:'터키 행진곡',sub:'모차르트 · 피아노 소나타 11번',seed:606,diffs:[{stars:3,target:680000,approach:1.9},{stars:6,target:740000,approach:1.7},{stars:8,target:780000,approach:1.5},{stars:10,target:800000,approach:1.35}]},
  {id:'pg3',name:'운명의 페널티킥',sub:'호우의 진짜 실력',seed:303,diffs:[{stars:4,target:700000,approach:1.8},{stars:6,target:760000,approach:1.6},{stars:8,target:800000,approach:1.5},{stars:10,target:820000,approach:1.3}]},
  {id:'pg7',name:'왕벌의 비행',sub:'림스키코르사코프 · 보스곡',seed:707,diffs:[{stars:5,target:700000,approach:1.8},{stars:8,target:760000,approach:1.6},{stars:10,target:800000,approach:1.4},{stars:12,target:830000,approach:1.25}]}
];
PGSONGS.forEach(s=>{s.bpm=BGMT[s.id].bpm;s.spb=60/s.bpm/2;s.len=BGMT[s.id].len;s.secs=Math.round(s.len*s.spb);});
/* 곡 + 난이도 → 한 판에 쓰는 설정(level 1~4, 별·목표·속도). 채보는 곡 id + 난이도(key)마다 따로 만들어요. */
function pgPick(si,di){
  const s=PGSONGS[si],d=s.diffs[di];
  return Object.assign({},s,d,{level:di+1,diff:di,key:s.id+':'+(di+1),seed:s.seed+di*1000});
}

/* ---------- 채보 자동 생성 ---------- */
function pgRng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
/* 발판 밟는 순서 조각. 0=↙ 1=↖ 2=● 3=↗ 4=↘ */
const PGPAT1=[[0,1,2,3,4],[4,3,2,1,0],[0,1,0,1],[4,3,4,3],[2,1,2,3],[0,1,2,1,0],[1,2,3,2,1],[2,3,2,1]];
const PGPAT2=PGPAT1.concat([[1,3,1,3],[2,0,2,4],[3,2,1,0,1],[1,0,1,2,3]]);
const PGPAT3=PGPAT2.concat([[0,3,0,3],[1,4,1,4],[0,1,4,3],[4,3,0,1]]);
const PGPAT4=PGPAT3.concat([[0,4,0,4],[1,3,0,4],[4,0,3,1],[0,2,4,2,0],[3,1,4,0]]);   /* 매우 어려움: 양 끝을 크게 건너뛰어요 */
const PGJUMPS=[[0,4],[1,3],[0,3],[1,4]];
const PGJUMP_P=[0,.12,.4,.6];   /* level별 마디 첫 박에서 점프가 나올 확률 (level 4는 반 마디 자리에서도 PGJUMP_HALF 확률로) */
const PGJUMP_HALF=.25;
const PGHOLD_P=[0,.7,.6,.5,.3];    /* level별, 노트 뒤로 4칸 이상 비면 그 사이를 롱노트로 만들 확률 */
const PGCHARTS={};
function pgChart(sg){
  if(PGCHARTS[sg.key])return PGCHARTS[sg.key];
  const T=BGMT[sg.id],lead=T.L.find(l=>l.n==='lead').a,bass=T.L.find(l=>l.n==='bass').a,R=pgRng(sg.seed),lv=sg.level,spb=sg.spb;
  const lib=lv===1?PGPAT1:lv===2?PGPAT2:lv===3?PGPAT3:PGPAT4,steps=[];
  for(let s=0;s<T.len;s++){
    const hasL=lead[s]!=='.',hasB=bass[s]!=='.';
    const on=lv===1?(hasL&&s%2===0):lv===2?hasL:lv===3?(hasL||(hasB&&s%4===0)):(hasL||hasB);
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
    if(!fin&&((s%8===0&&R()<PGJUMP_P[lv-1])||(lv>=4&&s%8===4&&R()<PGJUMP_HALF))){   /* 점프: 두 발판을 동시에 */
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
  return PGCHARTS[sg.key]=out;
}
