'use strict';
/* ---------- 소리새 펌프: 곡 + 채보 데이터 ----------
   곡은 audio.js의 배경음악처럼 8분음표 한 칸씩 적은 악보(BGMT)예요. 별도 소리 파일이 없어요.
   채보(노트 배치)도 손으로 찍지 않고 악보에서 자동으로 만들어요. 곡마다 쉬움·보통·어려움·매우 어려움 네 채보가 있고, 곡 id + 난이도(level)로 항상 같은 채보가 나와요.
     level 1 : 멜로디 중 4분음표 자리(짝수 칸)만 노트  → 쉬움
     level 2 : 멜로디 음마다 노트                         → 보통
     level 3 : 멜로디 + 베이스 음 전부 + 틈을 채운 노트(마디 뒤 절반은 0.4초, 앞 절반은 0.55초까지), 점프(동시 두 발판)가 자주 나와요 → 어려움
     level 4 : 틈을 0.3초까지 촘촘히 채우고, 반 마디마다 점프, 롱노트는 줄이고 발판을 크게 건너뛰는 흐름까지 → 매우 어려움
   새 곡은 pgBuild()로 BGMT에 악보를 등록하고 PGSONGS에 한 줄(난이도 4개 포함) 추가하면 돼요.
   음원 파일(mp3) 곡도 넣을 수 있어요: PGSONGS에 audio·bpmx·audioOff를 적고, 채보는 PG_CHART에 노트 시각으로 직접 적어요(아래 '나락쓰레기장'). */
/* ---------- 시즌2 잠금 ----------
   허브에는 제목이 "???"로 가려진 카드만 보이고, 관리자 번호(숫자 4자리)를 입력해야 플레이할 수 있어요.
   번호는 소스에 남기지 않고 확인값(PUMP_KEY)만 남겨요. 바꾸려면: node dev/pump_key.js 새번호
   ※ 브라우저에서 도는 코드라 '가벼운 잠금'이에요. 소스를 뜯어보는 사람까지 막지는 못해요.
   모두에게 열 때: PUMP_PUBLIC=true (잠금 없이 바로 보임) + 버전을 2.0.0으로 올려요(README '시즌2 오픈 절차') */
const PUMP_PUBLIC=true;   /* 시즌2(v2.0.0, 2026-10-01)부터 모두에게 공개 */
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

/* 11) 난지 캠프파이어 인더 홀 — 이 게임용으로 새로 지은 롹 곡이에요(멜로디·리프·코드 진행 모두 창작).
   캠프파이어 앞에서 발 구르며 시작해서 후렴에 다 같이 떼창하는 분위기예요. 템포는 한 곡 안에서 바꿀 수 없어서,
   앞부분은 드럼·기타·노트를 성기게 두고 후렴에서 촘촘하게 몰아쳐 '빨라지는' 느낌을 내요.
   progs: [0] 도입 [1] 벌스 [2] 프리코러스 [3] 후렴·기타 훅 [4] 브레이크다운 — 구간마다 베이스·리프 밀도가 달라요. */
const PG11_ROOT={Em:'E2',C:'C3',G:'G2',D:'D3',Am:'A2'};
const PG11_PROGS=[['Em','Em','C','D'],['Em','Em','C','D'],['Am','C','Em','D'],['Em','C','G','D'],['C','D','Em','Em']];
const PG11_BASS=['X . . . . . . .','X . . . X . . .','X . X . X . X .','X . X X . X X .','X . . . . . . .'];
const PG11_RIFF=['. . . . . . . .','X . . . X . . .','X . X X . X X .','X X X X X X X X','. . . . . . . .'];
const pg11Bars=pats=>PG11_PROGS.map((p,i)=>p.map(c=>pats[i].replace(/X/g,PG11_ROOT[c])));
pgBuild({id:'pg11',bpm:176,leadGtr:true,leadVol:.034,leadD:2,bassVol:.08,padVol:.012,kickVol:.22,snareVol:.08,hatVol:.03,riffVol:.04,riffD:.7,
  prog:PG11_PROGS[0],progs:PG11_PROGS,bass:pg11Bars(PG11_BASS)[0],basses:pg11Bars(PG11_BASS),riffs:pg11Bars(PG11_RIFF),
  lead:{
    I:['E4 . . . . . . .','. . . . G4 . . .','E4 . . . . . . .','. . . . B4 . A4 .'],
    V:['E4 . . . G4 . E4 .','B4 . . A4 G4 . E4 .','E4 . . . G4 . A4 .','F#4 . . . D4 . . .'],
    W:['E4 . . . G4 . B4 .','A4 . G4 . E4 . . .','G4 . . . E4 . C5 .','B4 . A4 . F#4 . . .'],
    P:['A4 . C5 . A4 . C5 .','G4 . C5 . E5 . C5 .','B4 . E5 . G5 . E5 .','A4 . D5 . F#5 . A5 .'],
    K:['B5 . B5 . B5 A5 G5 .','E5 . . . G5 . . .','D5 . D5 . D5 E5 G5 .','F#5 . . . . . . .'],
    L:['B5 . B5 . B5 A5 G5 .','E5 . G5 . E5 . C5 .','D5 . G5 . B5 . A5 G5','F#5 . A5 . D5 . . .'],
    Z:['C5 . . . . . . .','D5 . . . . . . .','E5 . . . . . . .','B4 . B4 . B4 B4 B4 B4'],
    H:['E5 E5 G5 E5 B5 . A5 G5','E5 E5 G5 E5 C6 . B5 G5','D5 D5 G5 D5 B5 . A5 G5','F#5 F#5 A5 F#5 D6 . A5 F#5']},
  drums:{stomp:{kick:'x . x . x . x .',snare:'. . x . . . x .',hat:'. x . x . x . x'},   /* 발 구르기 + 박수 + 탬버린 */
         build:{kick:'x . x . x . x .',snare:'. . x . . . x .',hat:'x x x x x x x x'},
         fire:{kick:'x . x x x . x x',snare:'. . x . . . x .',hat:'x x x x x x x x'},
         quiet:{kick:'x . . . x . . .',snare:'. . . . . . . .',hat:'. . . . . . . .'}},
  form:['I:stomp:0','V:stomp:1','W:stomp:1','P:build:2','K:fire:3','L:fire:3','Z:quiet:4','H:fire:3','P:build:2','K:fire:3','L:fire:3'],
  end:'E5 . . . . . . .',endChord:'Em',endBass:'E2',endRiff:'E2'});

/* 12) ㅈㄱ의 카드 모험 — 이 게임용으로 새로 지은 밝은 모험 테마(게임보이 느낌 칩튠). 쉬운 편 곡이에요.
   시작할 때마다 ㅈㄱ와 파이리 이야기 인트로(js/jgintro.js)가 먼저 나와요(PGSONGS의 intro). */
const PG12_RF={D:['D3','A2'],G:['G2','D3'],A:['A2','E3'],Bm:['B2','F#3'],Em:['E2','B2']};   /* 코드 → 베이스 근음·5도 */
const PG12_PROGS=[['D','G','A','D'],['Bm','G','D','A'],['G','A','D','Bm'],['Em','A','D','D']];
pgBuild({id:'pg12',bpm:132,wave:'square',leadVol:.038,bassVol:.08,kickVol:.16,
  prog:PG12_PROGS[0],progs:PG12_PROGS,
  basses:PG12_PROGS.map(p=>p.map(c=>`${PG12_RF[c][0]} . ${PG12_RF[c][1]} . ${PG12_RF[c][0]} . ${PG12_RF[c][1]} .`)),
  bass:PG12_PROGS[0].map(c=>`${PG12_RF[c][0]} . ${PG12_RF[c][1]} . ${PG12_RF[c][0]} . ${PG12_RF[c][1]} .`),
  lead:{
    A:['D5 . F#5 . A5 . F#5 A5','B5 . A5 . G5 . B5 .','A5 . E5 . C#6 . A5 .','D6 . . . A5 . F#5 .'],
    B:['F#5 . D5 . B4 . D5 F#5','G5 . . . D5 . B4 .','A5 . F#5 . D5 . F#5 .','E5 . C#5 . A4 . . .'],
    C:['B5 . . A5 G5 . B5 .','C#6 . . B5 A5 . E5 .','F#5 . A5 . D6 . A5 .','B5 . A5 . F#5 . D5 .'],
    D:['G5 . E5 . B4 . E5 .','A5 . E5 . C#5 . E5 .','F#5 E5 D5 . A4 . D5 .','F#5 . . . . . . .']},
  drums:{main:{kick:'x . . . x . . .',snare:'. . x . . . x .',hat:'. x . x . x . x'},soft:PGDR_SOFT},
  form:['A:main:0','B:main:1','C:main:2','D:soft:3','A:main:0','B:main:1','C:main:2','C:main:2'],
  end:'D6 . . . . . . .',endChord:'D',endBass:'D3'});

/* 13) 나락쓰레기장 — 우리끼리 직접 만든 노래(음원 파일 assets/music/narak.mp3). 합성 악보가 없어서 채보를 시각으로 직접 적어요(PG_CHART).
   가사에 맞춰 만들었어요(dev 밖에서 한 번 분석):
   - 음원을 보컬·드럼·베이스·반주로 나누고(Demucs), 보컬을 음성 인식(Whisper)해서 가사 단어마다 시작 시각을 찾았어요.
   - 단어를 음절(166개)로 나눠, 보컬 소리가 새로 시작되는 곳·음높이가 바뀌는 곳에 하나씩 맞췄어요.
   - 이 곡은 템포가 조금씩 흔들려요(Verse 약 147, 후렴 149, Outro 150 BPM). 드럼으로 8분음표 297개의 실제 시각을 따라가는 박자 지도를 만들고,
     후렴은 그 박자 칸에 정확히 맞추고(같은 가사가 반복되면 리듬도 같게), Verse·Outro는 잰 시각을 그대로 써요(박자 칸과 25ms 안이면 칸에 맞춰요).
   난이도: [0] 쉬움 = 가사 단어 첫 음절(길게 끄는 단어는 롱노트) · [1] 보통 = 가사 음절마다(8분음표보다 촘촘한 음절은 빼요), 후렴 줄 첫 음절은 점프
           [2] 어려움 = 모든 음절 + 노래가 쉬는 틈은 킥·스네어 8분 박자로 채우고, 후렴 줄 첫 음절·외치는 끝음절(모여! 외쳐! 찾는다! 불태워!)은 점프
           [3] 매우 어려움 = 16분 음절까지 전부 + 킥·스네어 + 후렴은 박마다 끝 16분(하이햇)까지 따-닥, 후렴 스네어 백비트도 점프
   노트 표기: 음원 시각(ms), 뒤에 *는 점프(발판 두 개), :숫자는 롱노트 길이(ms). 발판(↙↖●↗↘)은 다른 곡처럼 pgChart가 패턴으로 정해요.
   음원을 바꾸면 이 채보도 다시 만들어야 박자가 맞아요. */
const PG_CHART={pg13:{dur:59.8,lv:[
  '1230:590 2040 2450 3260 3985 4940 5310 6320 8310 9150 9890 10840 11610 12220 12840 13410:730 14360 15070 16080 16700 17920 18625 19835 21400:1780 23780 26200 27000 27610 27990 28810:1190 30220 31030 31535 32240 32850 34050 34460 35460:990 36670 39090 39890 40490 40900 41700 42300 43110 43720 44720 45730 46330 47540 48140 49500:1450 51170:1340 52730:2370 55320',
  '1230 1560 2040 2240 2450 2660 2860 3260 3510 3985 4320 4940 5310 5520 5720 5920 6120 6320 6770 7350 7650 7900 8310 8560 8980 9330 9580 9890 10400 10840 11210 11610 12020 12220 12420 12630 12840 13040 13240 13650:490 14360 14565 14770 15070 15375 15680 16080 16290 16500 16700 17005:465 17690 17920 18350 18625 18930 19130 19330 19835:695 20750 21150 21400 23780* 23980 24380 24580 24780 25190 25590 25990 26200 26600 27000* 27410 27610 27800 28410 28810 29120 29420:580 30220* 30830 31030 31230 31535 31850 32145 32440 32640 32850 33450 34050* 34260 34460 34660 34860 35060 35260 35460 35660 35860:590 36670* 36870 37280 37480 37680 38080 38480 38890 39090 39490 39890* 40290 40490 40900 41300 41700 42000 42300 42710 43110* 43510 43720 43920 44320 44720 45130 45330 45730 45930 46330* 46730 47340 47540 47740 47940 48140 49040 49500 50035 50400:550 51170 51730 52030:480 52730 53200 53530:1570 55320 55750 56120 56320 56550 57020',
  '1030 1230 1560 2040 2240 2450 2660 2860 3260 3510 3985 4120 4320 4500 4940 5100 5310 5520 5720 5920 6120 6320 6770 7350 7650 7900 8310 8560 8980 9150 9330 9580 9890 10190 10400 10600 10840 11210 11410 11610 11770 12020 12220 12420 12630 12840 13040 13240 13410 13650 13860 14060 14360 14565 14770 15070 15375 15680 15880 16080 16290 16500 16700 17005 17690 17920 18350 18625 18930 19130 19330 19530 19835 20140 20340 20540 20750 20950 21150 21400 21560:1620 23380 23580 23780* 23980 24380 24580 24780 25190 25590 25990 26200 26400 26600* 26800 27000* 27210 27410 27610 27800 27990 28410 28810 29120 29420 29630 29830 30220* 30430 30830 31030 31230 31535 31850 32145 32440 32640 32850 33250 33450* 33650 33850 34050* 34260 34460 34660 34860 35060 35260 35460 35660 35860* 36070 36270 36470 36670* 36870 37070 37280 37480 37680 38080 38480 38690 38890 39090 39290 39490* 39690 39890* 40090 40290 40490 40900 41300 41700 42000 42300 42510 42710 42910 43110* 43510 43720 43920 44120 44320 44520 44720 44930 45130 45330 45730 45930 46130 46330* 46530 46730 46930 47140 47340 47540 47740 47940 48140 48330 48530 48740 49040* 49500 49740 50035 50400 50930 51170 51530 51730 52030 52530 52730 52930 53200 53530:1570 55320 55750 55920 56120 56320 56550 56720 57020 57320',
  '1030 1130 1230 1420 1560 2040 2240 2345 2450 2660 2860 3260 3510 3670 3985 4120 4320 4500 4940 5100 5310 5520 5720 5920 6120 6220 6320 6770 6940 7350 7550 7650 7750 7900 8160 8310 8560 8980 9150 9330 9580 9790 9890 9990 10190 10400 10600 10840 11010 11210 11410 11610 11770 12020 12220 12420 12630 12840 13040 13240 13410 13650 13860 14060 14260 14360 14460 14565 14670 14770 15070 15375 15480 15680 15880 16080 16290 16500 16700 17005 17110 17520 17690 17920 18220 18350 18625 18730 18930 19130 19330 19530 19730 19835 19940 20140 20240 20340 20540 20750 20950 21150 21400 21560:1620 23380 23480 23580 23680 23780* 23880 23980 24380* 24580 24780* 25085 25190 25490 25590 25990 26200 26400* 26600* 26700 26800* 27000* 27210 27410 27510 27610* 27800 27990 28305 28410 28810 29120 29220 29420 29630 29830 29930 30030* 30220* 30325 30430 30830 31030 31130 31230* 31535 31640 31850 31950 32050 32145 32440 32640 32850* 33250* 33450* 33650 33850 34050* 34260 34360 34460 34660 34860 35060 35260 35460 35660 35860* 36070* 36270 36470 36670* 36770 36870 36970 37070 37175 37280 37380 37480 37580 37680 37980 38080 38380 38480 38690 38890 39090 39190 39290* 39490* 39690 39890* 40090 40290 40390 40490 40900 41300 41600 41700* 41900 42000 42100 42300 42405 42510* 42710 42910* 43110* 43210 43510* 43720 43920 44020 44120 44320 44520 44720 44825 44930 45130 45230 45330 45630 45730* 45930 46130* 46330* 46530 46730 46930* 47140 47340 47540 47740 47940 48140 48330 48430 48530 48740 48940 49040* 49140 49340 49500 49740 50035 50130 50400 50530 50930 51170 51330 51530 51730 52030 52130 52530 52730 52930 53200 53330 53530:1570 55320 55750 55920 56120 56320 56550 56720 57020 57120 57320'
]}};

/* 곡 목록. 곡마다 난이도 4개(diffs[0]=쉬움 · [1]=보통 · [2]=어려움 · [3]=매우 어려움)가 있어요.
   stars = 별 개수. 채보의 초당 노트 수·4초 최대 밀도·점프 비율·노트 속도로 난이도를 재서, 교가 쉬움 = ★1 · 교가 롹 버전 매우 어려움(v1.8.9 채보) = ★11을
   기준으로 맞춘 값이에요(v1.8.10에서 어려움부터 채보가 촘촘해져서 그보다 어려운 채보는 11을 넘어요). 채보를 바꾸면 별도 다시 매겨 주세요, target = 호우의 목표 점수(이 이상이면 내기 승리), approach = 노트가 화면 아래에서 발판까지 올라오는 시간(초, 속도 ×1 기준) */
const PG_DIFFS=['쉬움','보통','어려움','매우 어려움'];
const PG_BET=[1000,2000,3000,4000];   /* 난이도별 판돈(원, 고정). 쉬운 곡으로 큰돈을 버는 걸 막아요 */
const PGSONGS=[
  /* 새로 나온 곡은 맨 위에 두고 isNew:true로 곡 목록에 NEW 태그를 달아요(다음 신곡이 나오면 내려 주세요) */
  {id:'pg13',isNew:true,name:'나락쓰레기장',sub:'퇴근하고 롤 켜는 우리들의 노래',seed:1313,intro:'narak',theme:'narak',audio:'assets/music/narak.mp3',bpmx:148.93,audioOff:0,
   diffs:[{stars:1,target:650000,approach:2.0},{stars:5,target:710000,approach:1.75},{stars:7,target:760000,approach:1.55},{stars:11,target:800000,approach:1.38}]},
  {id:'pg1',name:'등굣길 뜀박질',sub:'가볍게 몸 풀기',seed:101,intro:'late',diffs:[{stars:2,target:650000,approach:2.0},{stars:3,target:700000,approach:1.8},{stars:5,target:750000,approach:1.6},{stars:7,target:780000,approach:1.4}]},
  {id:'pg9',name:'머대부고 교가',sub:'김순세 작곡 · 우리 학교 노래',seed:909,diffs:[{stars:1,target:650000,approach:2.0},{stars:2,target:700000,approach:1.8},{stars:5,target:750000,approach:1.6},{stars:8,target:780000,approach:1.4}]},
  {id:'pg10',name:'머대부고 교가 (롹 버전)',sub:'일렉기타로 달리는 우리 학교 노래',seed:1010,diffs:[{stars:3,target:700000,approach:1.8},{stars:7,target:740000,approach:1.6},{stars:10,target:780000,approach:1.45},{stars:14,target:820000,approach:1.3}]},
  {id:'pg11',name:'난지 캠프파이어 인더 홀',sub:'발 구르다 떼창으로 터지는 롹',seed:1111,diffs:[{stars:3,target:700000,approach:1.8},{stars:6,target:740000,approach:1.6},{stars:9,target:780000,approach:1.45},{stars:12,target:820000,approach:1.3}]},
  {id:'pg12',name:'ㅈㄱ의 카드 모험',sub:'파이리와 함께하는 모험 테마',seed:1212,intro:'jg',diffs:[{stars:2,target:650000,approach:2.0},{stars:3,target:700000,approach:1.8},{stars:6,target:750000,approach:1.6},{stars:9,target:780000,approach:1.4}]},
  {id:'pg8',name:'투우사의 노래',sub:'비제 · 오페라 「카르멘」',seed:808,diffs:[{stars:2,target:650000,approach:2.0},{stars:3,target:720000,approach:1.8},{stars:6,target:760000,approach:1.6},{stars:8,target:790000,approach:1.4}]},
  {id:'pg4',name:'비창 3악장',sub:'베토벤 · 소나타 8번 (칩튠)',seed:404,diffs:[{stars:3,target:700000,approach:1.9},{stars:4,target:720000,approach:1.7},{stars:8,target:750000,approach:1.5},{stars:10,target:790000,approach:1.35}]},
  {id:'pg5',name:'캉캉',sub:'오펜바흐 · 「천국과 지옥」',seed:505,diffs:[{stars:3,target:680000,approach:1.9},{stars:7,target:740000,approach:1.7},{stars:9,target:780000,approach:1.5},{stars:12,target:800000,approach:1.35}]},
  {id:'pg2',name:'매점 러시',sub:'종 치면 뛰어!',seed:202,diffs:[{stars:2,target:700000,approach:1.9},{stars:4,target:750000,approach:1.7},{stars:8,target:780000,approach:1.5},{stars:10,target:800000,approach:1.35}]},
  {id:'pg6',name:'터키 행진곡',sub:'모차르트 · 피아노 소나타 11번',seed:606,diffs:[{stars:4,target:680000,approach:1.9},{stars:7,target:740000,approach:1.7},{stars:9,target:780000,approach:1.5},{stars:13,target:800000,approach:1.35}]},
  {id:'pg3',name:'운명의 페널티킥',sub:'호우의 진짜 실력',seed:303,diffs:[{stars:3,target:700000,approach:1.8},{stars:6,target:760000,approach:1.6},{stars:9,target:800000,approach:1.5},{stars:12,target:820000,approach:1.3}]},
  {id:'pg7',name:'왕벌의 비행',sub:'림스키코르사코프 · 보스곡',seed:707,diffs:[{stars:5,target:700000,approach:1.8},{stars:11,target:760000,approach:1.6},{stars:14,target:800000,approach:1.4},{stars:15,target:830000,approach:1.25}]}
];
/* 음원 파일 곡(audio): bpmx = BPM(화면엔 반올림, 박자 반짝임에만 써요), audioOff = 채보 0초가 음원의 몇 초인지(PG_CHART는 음원 시각 그대로라 0), 채보는 PG_CHART */
PGSONGS.forEach(s=>{
  if(s.audio){s.bpm=Math.round(s.bpmx);s.spb=60/s.bpmx/2;s.len=Math.round(PG_CHART[s.id].dur/s.spb);}
  else{s.bpm=BGMT[s.id].bpm;s.spb=60/s.bpm/2;s.len=BGMT[s.id].len;}
  s.secs=Math.round(s.len*s.spb);
});
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
const PGJUMP_P=[0,.12,.7,.9];   /* level별 마디 첫 박에서 점프가 나올 확률 (어려움부터는 반 마디 자리에서도 PGJUMP_HALF 확률로) */
const PGJUMP_HALF=[0,0,0,.35,.6];   /* level별 반 마디 자리 점프 확률 */
const PGHOLD_P=[0,.7,.6,.5,.3];
const PGGAP=[0,0,0,.4,.3];     /* level별 노트 사이 최대 간격(초). 어려움·매우 어려움은 이보다 벌어진 틈을 노트로 채워요 */
const PGGAP_HEAD=.55;           /* 어려움은 마디 앞 절반만 조금 느슨하게 → 쿵 쿵 따다다다 흐름 */    /* level별, 노트 뒤로 4칸 이상 비면 그 사이를 롱노트로 만들 확률 */
const PGCHARTS={};
function pgChart(sg){
  if(PGCHARTS[sg.key])return PGCHARTS[sg.key];
  const R=pgRng(sg.seed),lv=sg.level,spb=sg.spb,lib=lv===1?PGPAT1:lv===2?PGPAT2:lv===3?PGPAT3:PGPAT4;
  /* 1) 노트 자리: {s 칸, t 시각, hold 롱노트 길이(없으면 아래에서 확률로), jump 점프 여부(없으면 확률로)} */
  let items;
  const EX=PG_CHART[sg.id];
  if(EX){   /* 음원 곡: 적어 둔 채보 그대로 (시각·점프·롱노트 모두 정해져 있어요) */
    items=EX.lv[lv-1].trim().split(/\s+/).map(w=>{
      const m=/^(\d+)(\*?)(?::(\d+))?$/.exec(w),t=(+m[1])/1000-(sg.audioOff||0);
      return {t,s:Math.round(t/spb),hold:m[3]?(+m[3])/1000:0,jump:!!m[2]};
    });
  }else{
    const T=BGMT[sg.id],lead=T.L.find(l=>l.n==='lead').a,bass=T.L.find(l=>l.n==='bass').a,steps=[];
    for(let s=0;s<T.len;s++){
      const hasL=lead[s]!=='.',hasB=bass[s]!=='.';
      const on=lv===1?(hasL&&s%2===0):lv===2?hasL:(hasL||hasB);
      if(on)steps.push(s);
    }
    if(PGGAP[lv]){   /* 어려움부터: 노트 사이가 PGGAP초보다 벌어지면 그 사이 칸을 고르게 채워요(멜로디가 쉬는 곳에서도 계속 밟게) */
      const add=[];
      for(let i=0;i+1<steps.length;i++){
        const a=steps[i],b=steps[i+1],G=lv===3&&a%8<4?PGGAP_HEAD:PGGAP[lv],n=Math.ceil((b-a)*spb/G-1e-9);
        for(let k=1;k<n;k++)add.push(a+Math.round(k*(b-a)/n));
      }
      steps.push(...add);steps.sort((x,y)=>x-y);
      for(let i=steps.length-1;i>0;i--)if(steps[i]===steps[i-1])steps.splice(i,1);
    }
    items=steps.map((s,i)=>{
      const nx=i+1<steps.length?steps[i+1]:T.len,gap=nx-s,fin=i===steps.length-1;
      return {s,t:s*spb,
        jump:!fin&&((s%8===0&&R()<PGJUMP_P[lv-1])||(lv>=3&&s%8===4&&R()<PGJUMP_HALF[lv])),
        hold:!fin&&gap>=4&&R()<PGHOLD_P[lv]?(gap-1)*spb:0};
    });
  }
  /* 2) 발판 정하기: 패턴 조각(PGPAT)을 이어 붙여 자연스럽게 흘러가요 */
  const notes=[];let pat=null,pi=0,last=2,curS=0;
  const nextLane=()=>{
    if(pat&&pi>=3&&curS%8===0)pat=null;   /* 마디가 바뀌면 새 흐름으로 */
    if(!pat||pi>=pat.length){
      const c=lib.filter(p=>p[0]!==last&&Math.abs(p[0]-last)<=2);
      pat=c[Math.floor(R()*c.length)]||lib[0];pi=0;
    }
    return pat[pi++];
  };
  items.forEach(it=>{
    const {s,t,hold}=it;curS=s;
    if(it.jump){   /* 점프: 두 발판을 동시에 */
      const j=PGJUMPS[Math.floor(R()*PGJUMPS.length)];
      j.forEach(l=>notes.push({t,lane:l,hold:0,s}));
      last=j[Math.floor(R()*2)];pat=null;return;
    }
    const lane=(lv>=2&&R()<.06)?last:nextLane();   /* 가끔 같은 발판을 한 번 더 */
    notes.push({t,lane,hold,s});last=lane;
  });
  const out={notes,total:0,taps:0,holds:0,end:0};
  notes.forEach(n=>{if(n.hold){out.holds++;out.total+=2;}else{out.taps++;out.total++;}out.end=Math.max(out.end,n.t+n.hold);});
  return PGCHARTS[sg.key]=out;
}
