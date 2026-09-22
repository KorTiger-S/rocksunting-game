'use strict';
/* ---------- 효과음 ----------
   Web Audio로 그때그때 합성해서 별도 소리 파일이 없어요. sfx('이름')으로 재생해요.
   소리 켜기/끄기는 헤더의 🔊, 로그인 화면, 게임 화면의 버튼이 모두 같은 설정을 쓰고 브라우저에 기억돼요.
   새 소리는 아래 SFX에 함수 하나를 추가하면 돼요. (tone: 음, noise: 잡음 — 발소리/함성/바람 같은 소리) */
let AC=null,MASTER=null,MUSIC=null,COMP=null,muted=lsGet('rk:muted')==='1';
function actx(){
  if(!AC){
    const Ctor=window.AudioContext||window.webkitAudioContext;if(!Ctor)return null;
    AC=new Ctor();
    COMP=AC.createDynamicsCompressor();COMP.connect(AC.destination);
    MASTER=AC.createGain();MASTER.gain.value=.9;MASTER.connect(COMP);       /* 효과음 */
    MUSIC=AC.createGain();MUSIC.gain.value=.35;MUSIC.connect(COMP);         /* 배경음악은 효과음보다 작게 */
  }
  if(AC.state==='suspended')AC.resume().catch(()=>{});
  return AC;
}
/* 음 하나: 높이(f) 길이(d) 파형 크기(vol) 시작 지연(when, 초) 끝 높이(slide) */
function tone(f,d,type,vol,when,slide){
  if(muted)return;
  try{
    const a=actx();if(!a)return;
    const t0=a.currentTime+(when||0),o=a.createOscillator(),g=a.createGain();
    o.type=type||'sine';o.frequency.setValueAtTime(f,t0);
    if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t0+d);
    g.gain.setValueAtTime(.0001,t0);g.gain.linearRampToValueAtTime(vol||.05,t0+Math.min(.008,d/4));
    g.gain.exponentialRampToValueAtTime(.0001,t0+d);
    o.connect(g);g.connect(MASTER);o.start(t0);o.stop(t0+d+.03);
  }catch(e){}
}
/* 잡음: 걸러 내는 높이를 f0→f1로 움직이면 휙(바람)·촥(그물)·와(함성) 같은 소리가 돼요. attack이 있으면 서서히 커져요. */
function noise(d,vol,when,f0,f1,q,attack){
  if(muted)return;
  try{
    const a=actx();if(!a)return;
    const t0=a.currentTime+(when||0),n=Math.max(1,Math.floor(a.sampleRate*d)),buf=a.createBuffer(1,n,a.sampleRate),ch=buf.getChannelData(0);
    for(let i=0;i<n;i++)ch[i]=Math.random()*2-1;
    const src=a.createBufferSource(),flt=a.createBiquadFilter(),g=a.createGain();
    src.buffer=buf;flt.type='bandpass';flt.Q.value=q||1;flt.frequency.setValueAtTime(f0,t0);
    if(f1)flt.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t0+d);
    const at=Math.min(attack||.005,d/2);
    g.gain.setValueAtTime(.0001,t0);g.gain.linearRampToValueAtTime(vol||.05,t0+at);g.gain.exponentialRampToValueAtTime(.0001,t0+d);
    src.connect(flt);flt.connect(g);g.connect(MASTER);src.start(t0);src.stop(t0+d+.03);
  }catch(e){}
}
function beep(f,d,type,vol){tone(f,d||.12,type||'square',vol||.06,0);}
const NT={C5:523.25,E5:659.25,G5:783.99,A5:880,B5:987.77,C6:1046.5,E6:1318.5,G6:1568};
const SFX={
  /* 화면(UI) */
  click(){tone(900,.035,'triangle',.03);},
  tick(){tone(1350,.028,'square',.022);},
  page(){noise(.1,.05,0,3200,900,.7);tone(500,.06,'triangle',.025,.02);},          /* 종이 넘기는 소리 */
  swish(){noise(.28,.05,0,900,250,.6);},                                           /* 하루를 흘려보낼 때 */
  coin(){tone(NT.B5,.07,'square',.045);tone(NT.E6,.28,'square',.045,.07);},        /* 돈이 들어올 때 */
  buy(){[NT.G5,NT.C6,NT.E6].forEach((f,i)=>tone(f,.06,'square',.04,i*.07));tone(NT.G6,.3,'square',.04,.21);noise(.25,.03,.21,6000,3000,1);},   /* 강화 구매(찰칵) */
  deny(){tone(200,.16,'square',.05);tone(150,.24,'square',.05,.14);},
  error(){tone(160,.12,'sawtooth',.055);tone(120,.22,'sawtooth',.055,.1);},
  chime(){[NT.E5,NT.A5,NT.E6].forEach((f,i)=>tone(f,.28,'triangle',.05,i*.09));},
  welcome(){[NT.C5,NT.E5,NT.G5,NT.C6].forEach((f,i)=>tone(f,.3,'triangle',.05,i*.09));},
  start(){tone(NT.C5,.1,'square',.04);tone(NT.G5,.22,'square',.04,.09);},
  bell(){[0,.42,.84,1.26].forEach(t=>{tone(1568,.7,'sine',.05,t);tone(2093,.5,'sine',.025,t);tone(784,.7,'sine',.03,t);});},   /* 학교 종소리(새 주) */
  siren(){for(let i=0;i<4;i++)tone(i%2?900:700,.28,'square',.035,i*.3);},           /* 구급차(입원) */
  blip(f){tone(f||420,.03,'square',.016);},                                        /* 대사가 한 글자씩 나올 때 */
  gauge(v){tone(300+(v||0)*900,.03,'square',.018);},                               /* 파워 게이지가 차오를 때 */
  /* 축구 */
  whistle(){tone(2700,.12,'sine',.05);tone(3000,.12,'sine',.05,.13);tone(2700,.42,'sine',.05,.26);},
  kick(){tone(150,.14,'sine',.16,0,55);noise(.07,.1,0,2600,700,.8);},              /* 공을 차는 소리 */
  net(){noise(.4,.07,.03,4200,1400,.6);},                                          /* 골망 */
  crowd(){noise(1.6,.07,0,700,1500,.5,.35);},                                      /* 환호 */
  aww(){noise(1,.045,0,500,250,.5,.2);tone(330,.7,'sawtooth',.03,0,190);},         /* 탄식 */
  thud(){tone(190,.12,'sine',.15,0,80);noise(.09,.07,0,1800,450,.8);},             /* 선방/벽 */
  ping(){tone(1400,.55,'sine',.08);tone(2100,.4,'sine',.035);},                    /* 골대 맞힘 */
  whoosh(){noise(.55,.06,0,500,2600,.7,.15);},                                     /* 빗나감 */
  win(){[NT.C5,NT.E5,NT.G5,NT.C6].forEach((f,i)=>tone(f,.2,'square',.045,i*.11));[NT.G5,NT.C6,NT.E6].forEach(f=>tone(f,.55,'triangle',.05,.5));},
  bigwin(){[NT.C5,NT.E5,NT.G5,NT.C6,NT.E6,NT.G6].forEach((f,i)=>tone(f,.2,'square',.045,i*.09));[NT.C6,NT.E6,NT.G6].forEach(f=>tone(f,.8,'triangle',.05,.55));noise(1.6,.06,.5,700,1500,.5,.35);},
  lose(){[392,370,349].forEach((f,i)=>tone(f,.28,'sawtooth',.05,i*.28));tone(330,.7,'sawtooth',.05,.84,262);}   /* 슬픈 트롬본 */
};
const DUCK={win:2.4,bigwin:3.2,lose:2.4,bell:2,siren:1.4};   /* 이 효과음이 나는 동안 배경음악을 줄이는 시간(초) */
function sfx(n,a){if(muted)return;try{if(SFX[n]){SFX[n](a);if(DUCK[n])bgmDuck(DUCK[n]);}}catch(e){}}
function cheer(){sfx('crowd');}

/* ---------- 배경음악 ----------
   효과음처럼 Web Audio로 합성한 짧은 곡을 계속 되풀이해요. 장면이 바뀌면(wantBgm) 알아서 곡이 바뀌고,
   승리/패배 팡파르나 종소리가 나는 동안에는 잠깐 작아져요(bgmDuck). 음악 켜기/끄기는 효과음과 따로 기억돼요.
   곡은 8분음표 한 칸씩 적은 악보예요. 한 마디 = 8칸, "." 은 쉼표, 음 이름(C5, F#4 …)은 그 음을 쳐요.
     note  : 음 하나씩(멜로디/베이스/아르페지오)   chord : 코드 이름(C, Am …)을 화음으로   kick/snare/hat : x 가 있는 칸에서 북
   새 곡은 BGMT에 추가하고, 어떤 장면에서 틀지는 wantBgm()에서 정해요. */
const BGM={on:lsGet('rk:bgm')!=='0',name:null,tg:null,step:0,next:0,timer:0,unlocked:false};
const CHORDS={C:['C4','E4','G4'],G:['G3','B3','D4'],Am:['A3','C4','E4'],F:['F3','A3','C4'],Em:['E3','G3','B3'],D:['D3','F#3','A3'],E:['E3','G#3','B3']};
const NOTE_SEMI={C:0,D:2,E:4,F:5,G:7,A:9,B:11},NF={};
function nf(n){
  if(NF[n])return NF[n];
  const m=/^([A-G])([#b]?)(-?\d)$/.exec(n);if(!m)return 440;
  const midi=12*(+m[3]+1)+NOTE_SEMI[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0);
  return NF[n]=440*Math.pow(2,(midi-69)/12);
}
const bars=(...b)=>b.join(' ');
function trk(o){o.L.forEach(l=>{l.a=l.seq.trim().split(/\s+/);if(l.a.length!==o.len)console.error('악보 길이가 달라요:',l.t,l.a.length,'≠',o.len);});return o;}
const R2=(a,b)=>bars(a,a,b,b);
const BGMT={
  /* 시작/로그인: 밝은 등굣길 (C-G-Am-F) */
  title:trk({bpm:116,len:64,L:[
    {t:'note',wave:'square',vol:.04,d:1.4,seq:bars('E5 . G5 . E5 . C5 .','D5 . G5 . B5 . G5 .','C5 . E5 . A5 . E5 .','A5 . F5 . C5 . A4 .','G5 . E5 . C5 . E5 G5','B5 . G5 . D5 . G5 .','E5 . A5 . C6 . A5 .','F5 . D5 . G5 . . .')},
    {t:'note',wave:'triangle',vol:.09,d:1.6,seq:bars('C3 . C3 . G3 . C3 .','G2 . G2 . D3 . G2 .','A2 . A2 . E3 . A2 .','F2 . F2 . C3 . F2 .','C3 . C3 . G3 . C3 .','G2 . G2 . D3 . G2 .','A2 . A2 . E3 . A2 .','G2 . G2 . D3 . G2 .')},
    {t:'chord',wave:'sine',vol:.03,d:7,att:.1,seq:bars('C . . . . . . .','G . . . . . . .','Am . . . . . . .','F . . . . . . .','C . . . . . . .','G . . . . . . .','Am . . . . . . .','G . . . . . . .')},
    {t:'kick',vol:.16,seq:bars(...Array(8).fill('x . . . x . . .'))},
    {t:'hat',vol:.018,seq:bars(...Array(8).fill('. x . x . x . x'))}
  ]}),
  /* 허브: 쉬는 시간의 느긋한 로파이 (C-Am-F-G) */
  hub:trk({bpm:88,len:64,L:[
    {t:'note',wave:'triangle',vol:.035,d:1.3,seq:R2(bars('C4 E4 G4 E4 C5 G4 E4 G4','A3 C4 E4 C4 A4 E4 C4 E4'),bars('F3 A3 C4 A3 F4 C4 A3 C4','G3 B3 D4 B3 G4 D4 B3 D4'))},
    {t:'note',wave:'sine',vol:.09,d:3,seq:R2(bars('C2 . . . G2 . . .','A1 . . . E2 . . .'),bars('F2 . . . C3 . . .','G2 . . . D3 . . .'))},
    {t:'note',wave:'sine',vol:.045,d:3,seq:bars('E5 . . . D5 . C5 .','E5 . . . C5 . . .','A5 . . . F5 . . .','G5 . . D5 . . B4 .','G5 . E5 . D5 . C5 .','C5 . E5 . A5 . . .','A5 . C6 . A5 . F5 .','D5 . G5 . . . . .')},
    {t:'kick',vol:.1,seq:bars(...Array(8).fill('x . . . x . . .'))},
    {t:'snare',vol:.03,seq:bars(...Array(8).fill('. . . . x . . .'))},
    {t:'hat',vol:.014,seq:bars(...Array(8).fill('. . x . . . x .'))}
  ]}),
  /* 프리킥 경기: 두근두근 킥오프 (Am-F-C-G) */
  match:trk({bpm:136,len:64,L:[
    {t:'note',wave:'square',vol:.035,d:.9,seq:bars('A5 . C6 . E6 . C6 .','A5 . C6 . F6 . C6 .','G5 . C6 . E6 . C6 .','G5 . B5 . D6 . B5 .','E6 . D6 C6 . A5 . C6','C6 . A5 F5 . A5 . C6','E6 . D6 C6 . G5 . C6','D6 . B5 G5 . B5 D6 .')},
    {t:'note',wave:'square',vol:.06,d:.8,seq:bars('A2 . A2 A2 . A2 A2 .','A2 . A2 A2 . A2 A2 .','F2 . F2 F2 . F2 F2 .','F2 . F2 F2 . F2 F2 .','C3 . C3 C3 . C3 C3 .','C3 . C3 C3 . C3 C3 .','G2 . G2 G2 . G2 G2 .','G2 . G2 G2 . G2 G2 .')},
    {t:'kick',vol:.18,seq:bars(...Array(8).fill('x . x . x . x .'))},
    {t:'snare',vol:.05,seq:bars(...Array(8).fill('. . x . . . x .'))},
    {t:'hat',vol:.02,seq:bars(...Array(8).fill('. x . x . x . x'))}
  ]}),
  /* 1:1 대결: 팽팽한 승부 (Em-C-G-D) */
  duel:trk({bpm:148,len:64,L:[
    {t:'note',wave:'sawtooth',vol:.028,d:1.1,seq:bars('B5 . E6 . G6 . E6 B5','G5 . C6 . E6 . C6 G5','B5 . D6 . G6 . D6 B5','A5 . D6 . F#6 . D6 A5','G6 F#6 E6 . B5 . E6 .','E6 D6 C6 . G5 . C6 .','D6 C6 B5 . G5 . B5 .','F#6 E6 D6 . A5 . D6 .')},
    {t:'note',wave:'sawtooth',vol:.05,d:.8,seq:bars('E2 . E2 E2 . E2 E3 .','E2 . E2 E2 . E2 E3 .','C2 . C2 C2 . C2 C3 .','C2 . C2 C2 . C2 C3 .','G2 . G2 G2 . G2 G3 .','G2 . G2 G2 . G2 G3 .','D2 . D2 D2 . D2 D3 .','D2 . D2 D2 . D2 D3 .')},
    {t:'kick',vol:.2,seq:bars(...Array(8).fill('x . x . x . x .'))},
    {t:'snare',vol:.06,seq:bars(...Array(8).fill('. . x . . . x .'))},
    {t:'hat',vol:.022,seq:bars(...Array(8).fill('x x x x x x x x'))}
  ]}),
  /* 병원/빈털터리: 쓸쓸한 분위기 (Am-F-C-E) */
  sad:trk({bpm:66,len:64,L:[
    {t:'chord',wave:'sine',vol:.04,d:7,att:.25,seq:bars('Am . . . . . . .','Am . . . . . . .','F . . . . . . .','F . . . . . . .','C . . . . . . .','C . . . . . . .','E . . . . . . .','E . . . . . . .')},
    {t:'note',wave:'triangle',vol:.045,d:3,seq:bars('E5 . . . C5 . D5 .','E5 . . . . . . .','F5 . . . A5 . G5 .','F5 . . . . . . .','G5 . . . E5 . D5 .','C5 . . . . . . .','B4 . . . G#4 . B4 .','E5 . . . . . . .')},
    {t:'note',wave:'sine',vol:.07,d:6,seq:bars('A2 . . . . . . .','A2 . . . . . . .','F2 . . . . . . .','F2 . . . . . . .','C3 . . . . . . .','C3 . . . . . . .','E2 . . . . . . .','E2 . . . . . . .')}
  ]}),
  /* 라털 선생님: 우스꽝스러운 뿌뿌 행진곡 (C-G-C-G-F-C-G-C) */
  ratal:trk({bpm:112,len:64,L:[
    {t:'note',wave:'sawtooth',vol:.03,d:1.3,seq:bars('E5 . E5 . G5 . E5 .','D5 . D5 . B4 . D5 .','E5 . G5 . C6 . G5 .','F5 . D5 . G5 . . .','A5 . A5 . F5 . A5 .','G5 . E5 . C5 . E5 .','D5 . F5 . G5 . B5 .','C6 . G5 . E5 . C5 .')},
    {t:'note',wave:'square',vol:.07,d:1.4,seq:bars('C3 . . . G2 . . .','G2 . . . D3 . . .','C3 . . . G2 . . .','G2 . . . D3 . . .','F2 . . . C3 . . .','C3 . . . G2 . . .','G2 . . . D3 . . .','C3 . . . G2 . . .')},
    {t:'chord',wave:'square',vol:.02,d:1,att:.01,seq:bars('. . C . . . C .','. . G . . . G .','. . C . . . C .','. . G . . . G .','. . F . . . F .','. . C . . . C .','. . G . . . G .','. . C . . . C .')},
    {t:'kick',vol:.12,seq:bars(...Array(8).fill('x . . . x . . .'))},
    {t:'snare',vol:.04,seq:bars(...Array(8).fill('. . x . . . x .'))}
  ]})
};
let NB=null;
function bnoise(dest,t0,d,vol,f,q){
  const a=AC;if(!NB){NB=a.createBuffer(1,a.sampleRate,a.sampleRate);const c=NB.getChannelData(0);for(let i=0;i<c.length;i++)c[i]=Math.random()*2-1;}
  const s=a.createBufferSource(),fl=a.createBiquadFilter(),g=a.createGain();
  s.buffer=NB;fl.type='bandpass';fl.frequency.value=f;fl.Q.value=q||1;
  g.gain.setValueAtTime(vol,t0);g.gain.exponentialRampToValueAtTime(.0001,t0+d);
  s.connect(fl);fl.connect(g);g.connect(dest);s.start(t0,Math.random()*.5);s.stop(t0+d+.02);
}
function bnote(dest,f,t0,d,wave,vol,att){
  const a=AC,o=a.createOscillator(),g=a.createGain(),at=att||.01;
  o.type=wave;o.frequency.setValueAtTime(f,t0);
  g.gain.setValueAtTime(.0001,t0);g.gain.linearRampToValueAtTime(vol,t0+at);
  g.gain.setValueAtTime(vol,t0+Math.max(at,d*.55));g.gain.exponentialRampToValueAtTime(.0001,t0+d);
  o.connect(g);g.connect(dest);o.start(t0);o.stop(t0+d+.03);
}
function bstep(T,i,t0,spb,dest){
  T.L.forEach(l=>{
    const k=l.a[i];if(k==='.'||!k)return;
    if(l.t==='note')bnote(dest,nf(k),t0,l.d*spb,l.wave,l.vol);
    else if(l.t==='chord'){const c=CHORDS[k];if(c)c.forEach(n=>bnote(dest,nf(n),t0,l.d*spb,l.wave,l.vol,l.att));}
    else if(l.t==='kick'){const o=AC.createOscillator(),g=AC.createGain();o.type='sine';o.frequency.setValueAtTime(130,t0);o.frequency.exponentialRampToValueAtTime(45,t0+.12);g.gain.setValueAtTime(l.vol,t0);g.gain.exponentialRampToValueAtTime(.0001,t0+.18);o.connect(g);g.connect(dest);o.start(t0);o.stop(t0+.2);}
    else if(l.t==='snare'){bnoise(dest,t0,.12,l.vol,1700,.7);bnote(dest,190,t0,.07,'triangle',l.vol*.8);}
    else if(l.t==='hat')bnoise(dest,t0,.04,l.vol,8000,1.5);
  });
}
function bgmTick(){
  const a=AC,T=BGMT[BGM.name];if(!a||!T||!BGM.tg)return;
  const spb=60/T.bpm/2;
  while(BGM.next<a.currentTime+.25){bstep(T,BGM.step,BGM.next,spb,BGM.tg);BGM.step=(BGM.step+1)%T.len;BGM.next+=spb;}
}
function bgmPlay(name){
  if(BGM.name===name)return;
  const a=actx();if(!a)return;
  if(BGM.tg){const old=BGM.tg;old.gain.cancelScheduledValues(a.currentTime);old.gain.setTargetAtTime(0,a.currentTime,.12);setTimeout(()=>{try{old.disconnect();}catch(e){}},900);}
  clearInterval(BGM.timer);BGM.name=name;BGM.tg=null;
  if(!name||!BGMT[name])return;
  const tg=a.createGain();tg.gain.setValueAtTime(.0001,a.currentTime);tg.gain.setTargetAtTime(1,a.currentTime+.05,.3);tg.connect(MUSIC);
  BGM.tg=tg;BGM.step=0;BGM.next=a.currentTime+.08;BGM.timer=setInterval(bgmTick,30);
}
/* 지금 장면에 맞는 곡 (null이면 조용히) */
function wantBgm(){
  if(!$('#splash').hidden||!$('#login').hidden)return 'title';
  if(STORY){const p=STORY.pages[STORY.i];return (p&&p.bgm)||STORY.bgm||'hub';}
  if(!$('#duel').hidden){
    const st=DU.st;if(!st||st.status==='waiting')return 'hub';
    if(st.status==='done'&&!DU.anim&&DU.shown===st.hist.length)return null;   /* 승부가 끝나면 팡파르만 */
    return 'duel';
  }
  return mode==='hub'?'hub':'match';
}
function bgmSync(){if(!BGM.unlocked)return;bgmPlay(BGM.on?wantBgm():null);}
/* 팡파르·종소리 같은 효과음이 나는 동안 음악을 잠깐 줄여요 */
function bgmDuck(sec){
  if(!AC||!MUSIC)return;const t=AC.currentTime;
  MUSIC.gain.cancelScheduledValues(t);MUSIC.gain.setTargetAtTime(.1,t,.04);MUSIC.gain.setTargetAtTime(.35,t+sec,.5);
}
setInterval(bgmSync,300);
document.addEventListener('visibilitychange',()=>{if(!AC)return;if(document.hidden)AC.suspend().catch(()=>{});else AC.resume().catch(()=>{});});
/* 브라우저는 사용자가 처음 누르거나 두드리기 전에는 소리를 못 내게 해서, 첫 입력 때 소리를 깨워 둬요. */
['pointerdown','keydown','touchstart'].forEach(ev=>window.addEventListener(ev,()=>{BGM.unlocked=true;if(!muted||BGM.on){actx();bgmSync();}},true));

