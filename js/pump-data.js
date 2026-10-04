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
     모든 음절을 그 박자 지도의 16분음표 칸에 붙였어요(후렴은 같은 가사가 반복되면 리듬도 같게).
   - v2.3.7 싱크 보정: 분석(스펙트럼 창)으로 잰 시각은 실제 소리보다 33ms 일러서 노트가 일찍 내려왔어요. 드럼 타격 159개를 파형에서 1ms 단위로 다시 재서
     박자 지도를 33ms 늦췄고, 이제 노트와 실제 소리 시작의 차이는 중앙값 0~3ms예요.
   v2.5.2: 쉬움·보통·어려움은 유저가 채보 메이커로 직접 만든 채보. 매우 어려움은 아래 v2.3.6 방식 그대로(작업 중).
   v2.3.6 이후: 쉬움은 유저가 채보 메이커로 직접 만든 채보(박자감의 기준). 보통·어려움·매우 어려움은 그 노트를 모두 그대로 두고 사이에만 더했어요:
     보통 = 박(4분) 자리 가사 + 앞뒤가 빈 8분 가사 / 어려움 = 8분 가사 + 1박 넘게 빈 곳은 박으로 / 매우 어려움 = 16분 가사 + 후렴 2박마다 앞 16분(따-닥).
     더한 노트 발판은 유저 패턴을 따라요(점프 다음은 가운데, 한쪽 다음은 반대쪽), 롱노트 구간엔 안 넣어요.
   노트 표기: 음원 시각(ms), 뒤에 *는 점프(발판 두 개), :숫자는 롱노트 길이(ms). 발판(↙↖●↗↘)은 다른 곡처럼 pgChart가 패턴으로 정해요.
     채보 메이커(dev/chart-maker.html)로 직접 만든 채보는 '시각/발판' 표기예요(예: 1230/2:400 = 1.23초 가운데 발판 0.4초 롱노트, 같은 시각 두 개 = 점프).
     메이커에서 저장한 파일은 node dev/apply_chart.js 파일.json 으로 여기에 넣어요.
   음원을 바꾸면 이 채보도 다시 만들어야 박자가 맞아요. */
const PG_CHART={pg13:{dur:59.8,lv:[
  '2073/2 3703/2 5343/1 6153/3 6973/1 7783/3 8593/2 10223/2 11853/0 12663/4 13483/0 14293/4 15103/2 15408/2 15713/2 16733/2 17038/2 17343/2 18253/1 19163/3 19973/0:810 19973/4:810 21593/2:1210 23203/0 23203/4 24813/1 25623/3 26433/0 27243/4 27643/2 28023/1 28843/3 29663/0 30463/4 30863/2 31263/1:620 31263/3:620 32883/0:600 32883/4:600 34493/1 34493/3 34893/2 35293/1 35293/3 35693/2 36103/0:400 36103/4:400 36903/2 37313/2 37713/1 38513/3 39323/0 40123/4 40523/2 40933/1 41733/3 42543/0 43343/4 44553/1 44553/3 45363/1 45363/3 46063/0 46063/4 46963/0 46963/4 47473/2 47773/1 48173/3 48563/2 48973/2:600 50563/1:800 50563/3:800 52163/0:1200 52163/4:1200 53763/1:1190 53763/3:1190 55353/1 55753/3 56153/2 56553/4 56953/0',
  '2073/2 3703/2 5343/1 6153/3 6973/1 7783/3 8593/2 10223/2 11853/0 12663/4 13483/0 14293/4 15103/2 15408/2 15713/2 16733/2 17038/2 17343/2 18253/1 18253/3 19163/1 19163/3 19973/0 19973/4 20783/0 20783/4 21593/2:1210 23203/0 23203/4 23613/0 23613/4 24813/1 24813/3 25223/2 25623/1 25623/3 26023/2 26433/0 26433/4 26833/2 27243/0 27243/4 27643/2 28023/1 28023/3 28443/2 28843/1 28843/3 29253/2 29663/0 29663/4 30063/2 30463/0 30463/4 30863/2 31263/1 31263/3 31568/1 31568/3 31883/1 31883/3 32883/0 32883/4 33183/0 33183/4 33483/0 33483/4 34493/1 34493/3 34893/2 35293/1 35293/3 35693/2 36103/0:400 36103/4:400 36903/2 37313/2 37713/1 37713/3 38113/2 38513/1 38513/3 38923/2 39323/0 39323/4 39723/2 40123/0 40123/4 40523/2 40933/1 41333/3 41733/1 42133/3 42543/0 42943/4 43343/0 43753/4 44553/1 44553/3 45363/1 45363/3 46063/0 46063/4 46963/2 47473/1 47773/3 48173/0 48563/4 48973/2:600 50163/1 50163/3 50563/2:1100 52163/0:1200 52163/4:1200 53763/1:1190 53763/3:1190 55353/1 55553/3 55753/1 55953/3 56153/2 56353/4 56553/0 56753/4',
  '1653/1 2073/3 2483/2 2893/4 3293/0 3703/0:830 3703/4:830 4933/2 5343/1:810 5343/3:810 6973/1 7383/3 7783/1 8193/2 8593/0:820 8593/3:820 9823/2 10223/1:820 10223/4:820 11443/2 11853/0 12053/4 12253/0 12453/4 12663/1 12873/3 13073/1 13273/3 13483/2 13893/0:400 13893/4:400 15103/2 15408/2 15713/0 15713/4 16733/1 16733/4 17038/2 17343/0 17343/3 17753/2:300 18253/1 18553/3 18863/2 19163/0 19163/4 19973/1 19973/3 20373/2 20783/0 20783/4 21183/2 21593/2 21803/3 22003/2 22203/1 22403/2 22603/0 22803/2 23203/0:410 23203/4:410 24813/1 24813/3 25223/2 25623/0 25623/4 26023/2 26433/0 26433/3 26833/2 27243/1 27243/4 27643/2 28023/1 28023/3 28443/2 28843/0 28843/4 29253/2 29663/0 29663/3 30063/2 30463/1 30463/4 30863/2 31263/1 31463/3 31673/2 31883/4 32083/0 32883/0 33083/4 33283/2 33483/3 33683/1 34493/0 34493/3 34893/2 35293/1 35293/4 35693/2 36103/3 36303/1 36503/3 36703/1 36903/4 37103/0 37313/4 37513/0 37713/1 37713/3 38113/2 38513/0 38513/4 38923/2 39323/0 39323/3 39723/2 40123/1 40123/4 40523/2 40933/1 41133/3 41333/1 41533/3 41733/0 41933/4 42133/0 42333/4 42543/2 42943/0:400 42943/4:400 43753/2 44153/2 44553/1 44553/3 44963/2 45363/1 45363/3 45763/2 46063/0 46063/3 46563/2 46963/1 46963/4 47473/1 47573/3 47773/1 47973/3 48173/0 48363/4 48563/0 48773/4 48973/2:600 50163/0 50163/4 50563/2 50763/3 50963/2 51163/1 51363/2 51563/0 51763/2 51963/4 52163/2 52563/0 52563/4 53763/1:1190 53763/3:1190 55353/1 55553/3 55753/1 55953/3 56153/2 56353/4 56553/0 56753/0:400 56753/4:400',
  '1553/3 1653/1 2073/2 2273/1 2483/3 2588/1 2893/1 3293/3 3503/1 3703/2 3913/3 4018/1 4323/2 4533/1 4933/3 5133/2 5238/3 5343/1 5553/2 5753/3 5953/1 6153/3 6353/2 6563/1 6973/1 7183/2 7383/3 7783/3 8393/1 8593/2 9013/3 9213/1 9313/3 9613/1 9923/3 10223/2 10328/3 10533/1 10843/1 11243/3 11643/1 11748/3 11853/0 12253/3 12353/2 12453/1 12663/4 12768/0 12873/1 12973/3 13273/3 13483/0 13583/3 13893/3 14293/4 14393/1 14493/0 14703/1 15103/2 15408/2 15713/2 16113/3 16323/1 16428/3 16733/2 17038/2 17343/2 17753/3 18053/2 18253/1 18253/3 18453/0 18553/2 18963/4 19163/1 19163/3 19263/2 19563/2 19868/1 19973/0 19973/4 20273/1 20373/2 20678/3 20783/0 20783/4 21083/1 21183/2 21283/1 21593/2:1210 23203/0 23203/4 23513/2 23613/0 23613/4 23813/1 24013/2 24313/1 24413/3 24613/2 24813/1 24813/3 25118/0 25223/2 25623/1 25623/3 25923/0 26023/2 26233/1 26433/0 26433/4 26633/1 26733/3 26833/2 27033/3 27243/0 27243/4 27443/1 27543/3 27643/2 27833/0 28023/1 28023/3 28338/0 28443/2 28843/1 28843/3 29153/0 29253/2 29453/3 29663/0 29663/4 29963/1 30063/2 30253/1 30463/0 30463/4 30563/2 30763/3 30863/2 30963/1 31263/1 31263/3 31568/1 31568/3 31778/2 31883/1 31883/3 32273/0 32373/3 32473/2 32673/3 32883/0 32883/4 33183/0 33183/4 33483/0 33483/4 33983/1 34083/2 34293/0 34493/1 34493/3 34693/0 34793/3 34893/2 35093/4 35293/1 35293/3 35493/0 35593/3 35693/2 35893/1 36103/0:400 36103/4:400 36703/1 36903/2 37208/1 37313/2 37513/4 37713/1 37713/3 38013/0 38113/2 38513/1 38513/3 38823/0 38923/2 39123/1 39323/0 39323/4 39523/1 39623/3 39723/2 39923/3 40123/0 40123/4 40323/1 40423/3 40523/2 40933/1 41233/2 41333/3 41733/1 42033/2 42133/3 42333/1 42543/0 42743/3 42843/1 42943/4 43143/1 43343/0 43543/3 43648/1 43753/4 43953/1 44353/2 44453/4 44553/1 44553/3 44753/2 45163/0 45263/4 45363/1 45363/3 45763/2 45963/3 46063/0 46063/4 46363/2 46763/3 46863/1 46963/2 47068/1 47473/1 47573/2 47673/1 47773/3 47973/1 48173/0 48363/3 48463/1 48563/4 48773/1 48973/2:600 49973/0 50163/1 50163/3 50363/0 50563/2:1100 52063/3 52163/0:1200 52163/4:1200 53563/2 53763/1:1190 53763/3:1190 55253/2 55353/1 55453/2 55553/3 55653/2 55753/1 55853/2 55953/3 56053/1 56153/2 56253/1 56353/4 56453/1 56553/0 56653/3 56753/4'
]}};

/* 곡 목록. 곡마다 난이도 4개(diffs[0]=쉬움 · [1]=보통 · [2]=어려움 · [3]=매우 어려움)가 있어요.
   stars = 별 개수. 채보의 초당 노트 수·4초 최대 밀도·점프 비율·노트 속도로 난이도를 재서, 교가 쉬움 = ★1 · 교가 롹 버전 매우 어려움(v1.8.9 채보) = ★11을
   기준으로 맞춘 값이에요(v1.8.10에서 어려움부터 채보가 촘촘해져서 그보다 어려운 채보는 11을 넘어요). 채보를 바꾸면 별도 다시 매겨 주세요, target = 호우의 목표 점수(이 이상이면 내기 승리), approach = 노트가 화면 아래에서 발판까지 올라오는 시간(초, 속도 ×1 기준) */
const PG_DIFFS=['쉬움','보통','어려움','매우 어려움'];
const PG_BET=[1000,2000,3000,4000];   /* 난이도별 판돈(원, 고정). 쉬운 곡으로 큰돈을 버는 걸 막아요 */
const PGSONGS=[
  /* 새로 나온 곡은 맨 위에 두고 isNew:true로 곡 목록에 NEW 태그를 달아요(다음 신곡이 나오면 내려 주세요) */
  {id:'pg13',isNew:true,name:'나락쓰레기장',sub:'퇴근하고 롤 켜는 우리들의 노래',seed:1313,intro:'narak',theme:'narak',audio:'assets/music/narak.mp3',audioHead:.14,bpmx:148.93,audioOff:0,
   diffs:[{stars:3,target:680000,approach:1.9},{stars:5,target:710000,approach:1.75},{stars:7,target:760000,approach:1.55},{stars:9,target:790000,approach:1.42,wip:true}]},   /* wip: 채보 작업 중 — 허브에서 '🚧 채보 작업 중'으로 보이고 고를 수 없어요 */
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
/* 음원 파일 곡(audio): bpmx = BPM(화면엔 반올림, 박자 반짝임에만 써요), audioOff = 채보 0초가 음원의 몇 초인지(PG_CHART는 음원 시각 그대로라 0),
   audioHead = 분석 때 음원 첫 소리(|x|>0.01) 위치(ms, 브라우저 지연 자동 보정 pgAudLag용), 채보는 PG_CHART */
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
  if(EX){   /* 음원 곡: 적어 둔 채보 그대로 (시각·점프·롱노트 모두 정해져 있어요. 발판까지 적힌 노트는 그 발판 그대로) */
    items=EX.lv[lv-1].trim().split(/\s+/).map(w=>{
      const m=/^(\d+)(?:\/([0-4]))?(\*?)(?::(\d+))?$/.exec(w),t=(+m[1])/1000-(sg.audioOff||0);
      return {t,s:Math.round(t/spb),hold:m[4]?(+m[4])/1000:0,jump:!!m[3],lane:m[2]==null?null:+m[2]};
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
    if(it.lane!=null){notes.push({t,lane:it.lane,hold,s});last=it.lane;pat=null;return;}   /* 채보 메이커로 직접 찍은 노트 */
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
