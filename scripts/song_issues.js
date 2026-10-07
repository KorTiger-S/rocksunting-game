#!/usr/bin/env node
// AI 작곡 요청 → GitHub 이슈 (GitHub Actions에서 주기적으로 실행)
//   1. Supabase rk_songs에서 새 요청(new)을 읽어 이슈를 만들고 issued로 표시한다.
//   2. issued 요청의 이슈가 닫혔으면 done(완성)으로 바꾼다. 게임의 「내 요청」에 "완성 🎵"으로 보여요.
//   node scripts/song_issues.js --dry   이슈를 만들지 않고 본문만 출력
// 환경 변수: SUPABASE_URL, SUPABASE_SERVICE_KEY (비밀 키! GitHub Secrets에만 저장), GITHUB_TOKEN, GITHUB_REPOSITORY(owner/repo)
const { SONG_OPTS, songTags } = require('../js/compose-data.js');

const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, ''), key = process.env.SUPABASE_SERVICE_KEY || '';
const gh = process.env.GITHUB_TOKEN || '', repo = process.env.GITHUB_REPOSITORY || '';
const DRY = process.argv.includes('--dry');
const LABEL = 'ai-song';
if (!url || !key) { console.error('SUPABASE_URL 과 SUPABASE_SERVICE_KEY 가 필요해요.'); process.exit(1); }
if (!DRY && (!gh || !repo)) { console.error('GITHUB_TOKEN 과 GITHUB_REPOSITORY 가 필요해요.'); process.exit(1); }

async function rpc(fn, p) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key }, body: JSON.stringify({ p: p || {} })
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j || j.ok === false) throw new Error(`${fn} 실패: ${res.status} ${JSON.stringify(j)}`);
  return j;
}
async function github(method, path, body) {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    method, headers: { Authorization: `Bearer ${gh}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, j };
}

const ko = (k, id) => (SONG_OPTS[k].find(x => x.id === id) || {}).ko || '';
const kos = (k, a) => (a || []).map(id => ko(k, id)).filter(Boolean).join(', ') || '-';
const enOf = (k, id) => (SONG_OPTS[k].find(x => x.id === id) || {}).en || '';
// 플레이어가 쓴 글이 이슈에서 마크다운·멘션으로 바뀌지 않게: 코드 블록 안에 넣고, 블록을 닫는 ~~~ 는 바꿔 둔다
const fence = t => '~~~text\n' + String(t || '').replace(/~{3,}/g, m => '～'.repeat(m.length)) + '\n~~~';
const oneLine = t => String(t || '').replace(/[`<>@#[\]|*_\\]/g, ' ').replace(/\s+/g, ' ').trim();

function issueOf(s) {
  const o = s.opts || {}, inst = o.vocal === 'inst';
  const dur = (SONG_OPTS.dur.find(d => d.id === o.dur) || { sec: 120 }).sec;
  const at = new Date(s.at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const title = `🎵 [AI작곡] ${oneLine(s.title)} — ${oneLine(s.author)}`.slice(0, 200);
  const rows = [
    ['요청한 사람', oneLine(s.author)], ['요청 시각', at], ['노래 스타일', kos('genre', o.genre)], ['분위기', kos('mood', o.mood)],
    ['템포', `${ko('tempo', o.tempo) || '-'} (${o.bpm} BPM)`], ['보컬', ko('vocal', o.vocal) || '-'], ['가사 언어', inst ? '-' : ko('lang', o.lang) || '-'],
    ['곡 길이', ko('dur', o.dur) || `${dur}초`], ['주요 악기', kos('inst', o.inst)], ['조성', ko('key', o.key) || '-'], ['박자', ko('meter', o.meter) || '-']
  ];
  const body = [
    `롹순팅 키우기에서 들어온 AI 작곡 요청이에요. (요청 번호 ${s.no})`,
    '',
    '| 항목 | 선택 |', '| --- | --- |', ...rows.map(([a, b]) => `| ${a} | ${b} |`),
    '',
    '## 제목', fence(s.title),
    '## ACE-Step 입력값',
    '**Tags / Caption**', '~~~text\n' + songTags(o) + '\n~~~',
    '**Lyrics**', inst ? '_(연주곡 · 가사 없음)_ → ACE-Step Lyrics 칸에 `[instrumental]`' : fence(s.lyrics),
    '**설정**',
    '~~~text',
    `audio_duration: ${dur}`,
    `bpm: ${o.bpm}`,
    `keyscale: ${o.key === 'major' || o.key === 'minor' ? o.key + ' (조는 자유)' : 'auto'}`,
    `timesignature: ${enOf('meter', o.meter) || '4/4'}`,
    `vocal_language: ${inst ? 'none (instrumental)' : enOf('lang', o.lang) || 'korean'}`,
    '~~~',
    ...(s.note ? ['## 하고 싶은 말', fence(s.note)] : []),
    '',
    '---',
    '곡을 다 만들면 이 이슈를 닫아 주세요. 다음 실행 때 플레이어 화면에 「완성 🎵」으로 바뀌어요.',
    `<!-- rk-song:${s.no} -->`
  ].join('\n');
  return { title, body };
}

(async () => {
  const r = await rpc('rk_song_pending');
  console.log(`새 요청 ${r.new.length}개, 진행 중 ${r.issued.length}개`);
  if (DRY) { r.new.forEach(s => { const i = issueOf(s); console.log(`\n=== ${i.title}\n${i.body}`); }); return; }
  if (r.new.length) {   // 라벨이 없으면 만든다(이미 있으면 422)
    await github('POST', '/labels', { name: LABEL, color: 'e2334d', description: '롹순팅 키우기 AI 작곡 요청' });
  }
  for (const s of r.new) {
    const i = issueOf(s);
    const c = await github('POST', '/issues', { title: i.title, body: i.body, labels: [LABEL] });
    if (!c.ok) { console.error(`이슈 생성 실패 (요청 ${s.no}): ${c.status} ${JSON.stringify(c.j)}`); process.exitCode = 1; continue; }
    await rpc('rk_song_mark', { no: s.no, issue: c.j.number });
    console.log(`요청 ${s.no} → 이슈 #${c.j.number}`);
  }
  for (const s of r.issued) {
    const g = await github('GET', `/issues/${s.issue}`);
    if (g.ok && g.j.state === 'closed') { await rpc('rk_song_mark', { no: s.no, status: 'done' }); console.log(`요청 ${s.no} (이슈 #${s.issue}) 완성`); }
  }
})().catch(e => { console.error(e); process.exit(1); });
