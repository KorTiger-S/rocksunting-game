'use strict';
/* ---------- AI 작곡 요청 ----------
   로그인한 플레이어가 제목·가사·스타일을 골라 하루 1번 요청해요(서버 rk_song_request가 KST 날짜로 막아요).
   요청은 Supabase rk_songs 테이블에 쌓이고, GitHub Actions(.github/workflows/song-issues.yml)가 GitHub 이슈로 옮겨요.
   관리자가 이슈를 보고 ACE-Step으로 곡을 만든 뒤 이슈를 닫으면 "완성"으로 바뀌어요.
   쓰던 내용은 이 기기에 임시 저장돼요(rk:sg:<ID>). */
const SONG_REPO='https://github.com/KorTiger-S/rocksunting-game';
const SG_DEF=()=>({title:'',lyrics:'',note:'',genre:[],mood:[],tempo:'mid',bpm:100,vocal:'male',lang:'ko',dur:'120',inst:[],key:'auto',meter:'4'});
let SG=SG_DEF(),sgUser=null,sgBusy=false,SG_MINE=null;   /* SG_MINE: {id, today, list} 서버에서 받은 내 요청 */
const SG_MULTI={genre:SONG_MAX.genre,mood:SONG_MAX.mood,inst:SONG_MAX.inst};
const SG_ERR={
  daily_limit:'오늘은 이미 요청했어요. 내일 다시 요청할 수 있어요!',busy:'오늘 요청이 너무 많이 들어왔어요. 내일 다시 해 주세요.',
  no_title:'제목을 써 주세요.',no_lyrics:'가사를 써 주세요. (가사 없는 곡은 보컬에서 「연주곡」을 골라요)',no_genre:'노래 스타일을 하나 이상 골라 주세요.',
  too_long:'글자 수가 너무 많아요.',bad_opts:'선택한 옵션을 다시 확인해 주세요.',
  no_user:'클라우드에 가입된 ID로 로그인해야 요청할 수 있어요.',bad_pin:'비밀번호가 맞지 않아요. 다시 로그인해 주세요.',locked:'잠시 잠겨 있어요. 5분 뒤에 다시 해 주세요.'
};
const sgKey=()=>USER?'rk:sg:'+USER.id:'';
function sgLoad(){   /* 로그인한 사람이 바뀌면 그 사람의 임시 저장 내용을 불러와요 */
  const id=USER&&USER.id;if(sgUser===id)return;sgUser=id;SG=SG_DEF();SG_MINE=null;
  if(!id)return;
  try{const d=JSON.parse(lsGet(sgKey())||'null');if(d&&typeof d==='object')Object.keys(SG).forEach(k=>{if(d[k]!=null&&typeof d[k]===typeof SG[k]&&Array.isArray(d[k])===Array.isArray(SG[k]))SG[k]=d[k];});}catch(e){}
}
let sgSaveT=0;
function sgSave(){clearTimeout(sgSaveT);sgSaveT=setTimeout(()=>{if(USER)lsSet(sgKey(),JSON.stringify(SG));},400);}
/* 칩(선택 버튼) 그리기 */
function sgChips(){
  document.querySelectorAll('.sgchips').forEach(box=>{
    const k=box.dataset.k,multi=SG_MULTI[k],sel=multi?SG[k]:[SG[k]];
    if(!box.children.length)SONG_OPTS[k].forEach(o=>{
      const b=document.createElement('button');b.type='button';b.dataset.id=o.id;b.textContent=o.ko;
      b.addEventListener('click',()=>sgPick(k,o.id));box.appendChild(b);
    });
    [...box.children].forEach(b=>{
      const on=sel.includes(b.dataset.id);b.setAttribute('aria-pressed',String(on));
      b.disabled=!!multi&&!on&&sel.length>=multi;   /* 최대 개수를 다 고르면 나머지는 잠가요 */
    });
  });
}
function sgPick(k,id){
  if(SG_MULTI[k]){const a=SG[k],i=a.indexOf(id);if(i>=0)a.splice(i,1);else if(a.length<SG_MULTI[k])a.push(id);}
  else{
    SG[k]=id;
    if(k==='tempo')SG.bpm=(SONG_OPTS.tempo.find(t=>t.id===id)||{}).bpm||SG.bpm;   /* 템포를 고르면 BPM도 그 기본값으로 */
  }
  sgSave();renderSongForm();
}
function sgTempoOf(bpm){   /* BPM 슬라이더를 움직이면 가장 가까운 템포 칸을 켜요 */
  let best=SONG_OPTS.tempo[0];SONG_OPTS.tempo.forEach(t=>{if(Math.abs(t.bpm-bpm)<Math.abs(best.bpm-bpm))best=t;});return best.id;
}
function renderSongForm(){
  sgChips();
  const inst=SG.vocal==='inst';
  $('#sgLangW').hidden=inst;
  $('#sgBpm').value=SG.bpm;$('#sgBpmV').textContent=SG.bpm+' BPM';
  $('#sgTitleN').textContent=`${SG.title.length}/${SONG_MAX.title}`;
  $('#sgLyricsN').textContent=inst?'연주곡은 안 써도 돼요':`${SG.lyrics.length}/${SONG_MAX.lyrics}`;
  $('#sgPrev').textContent=songTags(SG)||'스타일을 골라 주세요';
  sgRenderGo();
}
function sgRenderGo(){
  const ok=duOk(),today=!!(ok&&SG_MINE&&SG_MINE.id===USER.id&&SG_MINE.today);
  $('#sgGo').disabled=!ok||today||sgBusy;
  $('#sgGo').textContent=sgBusy?'보내는 중…':today?'✅ 오늘 요청 완료':'🎼 만들기 요청';
  if(!ok)$('#sgMsg').textContent='로그인하면 요청할 수 있어요.';
  else if(today)$('#sgMsg').textContent=SG_ERR.daily_limit;
}
/* 내 요청 목록 (최근 5개) */
const SG_ST={new:'접수됨',issued:'만드는 중',done:'완성 🎵'};
function renderSongMine(){
  const box=$('#sgMine'),list=SG_MINE&&USER&&SG_MINE.id===USER.id?SG_MINE.list:[];
  box.hidden=!list.length;box.innerHTML='';if(!list.length)return;
  const h=document.createElement('b');h.textContent='📮 내 요청';box.appendChild(h);
  const ul=document.createElement('ul');
  list.forEach(s=>{
    const li=document.createElement('li'),t=document.createElement('span'),st=document.createElement('span'),sm=document.createElement('small');
    t.textContent=`「${s.title}」`;
    st.className='sgst'+(s.status==='done'?' done':'');st.textContent=SG_ST[s.status]||s.status;
    sm.textContent=' '+new Date(s.at).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'});
    li.append(t,st,sm);
    if(s.issue){const a=document.createElement('a');a.href=`${SONG_REPO}/issues/${s.issue}`;a.target='_blank';a.rel='noopener';a.textContent=` #${s.issue}`;li.appendChild(a);}
    ul.appendChild(li);
  });
  box.appendChild(ul);
}
function sgLoadMine(){
  if(!duOk())return;const id=USER.id;
  api('song_mine',{id:USER.id,pin:USER.pin}).then(r=>{
    if(!USER||USER.id!==id)return;
    SG_MINE={id,today:!!r.today,list:r.list||[]};renderSongMine();sgRenderGo();
  }).catch(()=>{});   /* 서버에 아직 rk_song_mine이 없거나 오프라인이면 조용히 넘어가요 */
}
/* 허브 게임 목록 한 줄 + 카드 */
function renderSongCard(){
  sgLoad();
  $('#glSong').textContent=duOk()?'제목·가사를 쓰면 노래로! · 하루 1번 요청':'로그인하면 AI 작곡을 요청할 수 있어요';
  if(hubCard!=='songCard')return;
  [['#sgTitle','title'],['#sgLyrics','lyrics'],['#sgNote','note']].forEach(([sel,k])=>{const el=$(sel);if(el!==document.activeElement&&el.value!==SG[k])el.value=SG[k];});   /* 입력 중인 칸은 건드리지 않아요(커서가 튀지 않게) */
  $('#sgMsg').textContent='';renderSongForm();renderSongMine();
}
/* 가사칸에 구간 태그 넣기: 커서 자리에 새 줄로 */
function sgInsertTag(tag){
  const ta=$('#sgLyrics'),v=ta.value,s=ta.selectionStart??v.length,e=ta.selectionEnd??s;
  const pre=v.slice(0,s),before=!pre||pre.endsWith('\n\n')?'':pre.endsWith('\n')?'\n':'\n\n';
  const ins=before+tag+'\n';
  if(v.length-(e-s)+ins.length>SONG_MAX.lyrics){sfx('deny');return;}
  ta.value=pre+ins+v.slice(e);ta.focus();ta.selectionStart=ta.selectionEnd=s+ins.length;
  SG.lyrics=ta.value;sgSave();renderSongForm();
}
async function sgSubmit(e){
  e.preventDefault();
  if(!duOk()||sgBusy)return;
  const fail=k=>{sfx('deny');$('#sgMsg').textContent=SG_ERR[k];};
  SG.title=$('#sgTitle').value.replace(/\s+/g,' ').trim();SG.lyrics=$('#sgLyrics').value.trim();SG.note=$('#sgNote').value.replace(/\s+/g,' ').trim();
  if(!SG.title){fail('no_title');$('#sgTitle').focus();return;}
  if(SG.vocal!=='inst'&&!SG.lyrics){fail('no_lyrics');$('#sgLyrics').focus();return;}
  if(!SG.genre.length){fail('no_genre');return;}
  if(!confirm(`「${SG.title}」 작곡을 요청할까요?\n오늘은 더 요청할 수 없고, 닉네임과 함께 GitHub 이슈(공개)에 올라가요.`))return;
  sgBusy=true;sgRenderGo();$('#sgMsg').textContent='';
  const id=USER.id;
  try{
    const opts={genre:SG.genre,mood:SG.mood,tempo:SG.tempo,bpm:SG.bpm,vocal:SG.vocal,lang:SG.lang,dur:SG.dur,inst:SG.inst,key:SG.key,meter:SG.meter};
    const r=await api('song_request',{id:USER.id,pin:USER.pin,title:SG.title,lyrics:SG.vocal==='inst'?'':SG.lyrics,note:SG.note,opts});
    sfx('compose');
    if(USER&&USER.id===id){
      SG_MINE={id,today:true,list:r.list||[]};
      const keep=SG_DEF();['genre','mood','tempo','bpm','vocal','lang','dur','inst','key','meter'].forEach(k=>keep[k]=SG[k]);   /* 스타일은 다음에도 쓰게 남기고 글만 비워요 */
      SG=keep;lsSet(sgKey(),JSON.stringify(SG));
    }
    toast('🎼 작곡 요청이 접수됐어요! 노래가 완성되면 「내 요청」에 표시돼요.',5000);
    renderSongCard();
  }catch(err){sfx('deny');$('#sgMsg').textContent=SG_ERR[err.message]||'연결이 불안정해서 보내지 못했어요. 잠시 뒤 다시 해 주세요.';if(err.message==='daily_limit')sgLoadMine();}
  sgBusy=false;if(USER&&USER.id===id)sgRenderGo();
}
SONG_TAGS.forEach(t=>{const b=document.createElement('button');b.type='button';b.textContent=t.t;b.title=t.ko;b.setAttribute('aria-label',`${t.ko} 구간 넣기`);b.addEventListener('click',()=>sgInsertTag(t.t));$('#sgTags').appendChild(b);});
$('#sgTitle').addEventListener('input',e=>{SG.title=e.target.value;sgSave();renderSongForm();});
$('#sgLyrics').addEventListener('input',e=>{SG.lyrics=e.target.value;sgSave();renderSongForm();});
$('#sgNote').addEventListener('input',e=>{SG.note=e.target.value;sgSave();});
$('#sgBpm').addEventListener('input',e=>{SG.bpm=clamp(+e.target.value|0,SONG_BPM.min,SONG_BPM.max);SG.tempo=sgTempoOf(SG.bpm);sgSave();renderSongForm();});
$('#sgForm').addEventListener('submit',sgSubmit);
document.querySelector('.gopen[data-card="songCard"]').addEventListener('click',()=>{renderSongCard();sgLoadMine();});
