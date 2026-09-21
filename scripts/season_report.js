// 시즌 마감 결과(rk_close_season / rk_season_report 응답)를 운영자용 보고서(Markdown + CSV)로 만든다.
const kstText = iso => new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16);
const esc = s => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const won = n => Number(n).toLocaleString('ko-KR') + '원';

const COLS = {
  money: { label: '소지금', fmt: p => won(p.money) },
  wins: { label: '전적', fmt: p => `${p.wins}승 ${p.losses}패` },
  bestPts: { label: '최고점', fmt: p => p.bestPts + '점' },
  week: { label: '진행', fmt: p => p.week + '주차' }
};
// 기준이 되는 항목을 맨 앞에 두고, 나머지 항목을 뒤에 붙인 TOP 10 표
function table(players, key) {
  const top = players.slice().sort((a, b) => (b[key] - a[key]) || (b.money - a.money)).slice(0, 10);
  if (!top.length) return '_기록이 없어요._\n';
  const cols = [key].concat(Object.keys(COLS).filter(k => k !== key));
  const rows = top.map((p, i) => `| ${i + 1} | ${esc(p.id)}${p.cleared ? ' 👑' : ''} | ${cols.map(k => COLS[k].fmt(p)).join(' | ')} |`);
  return `| 순위 | ID | ${cols.map(k => COLS[k].label).join(' | ')} |\n|---:|---|${cols.map(() => '---:').join('|')}|\n${rows.join('\n')}\n`;
}

function renderReport(r) {
  const s = r.season, players = r.players || [];
  const active = players.filter(p => p.plays > 0 || p.wins > 0 || p.losses > 0);
  const cleared = players.filter(p => p.cleared);
  const name = `${s.key}_season${s.number}_${s.game}`;
  const title = `시즌${s.number} 랭킹 보고서 — ${s.gameName} (${s.key})`;
  const md = [
    `# ${title}`,
    '',
    `- 기간: ${s.startedAt ? kstText(s.startedAt) : '?'} ~ ${kstText(s.endedAt)} (한국 시간)`,
    `- 가입 플레이어: ${players.length}명 · 실제로 플레이한 사람: ${active.length}명`,
    `- 경기 기록: ${r.matchCount}건`,
    `- 100만 원 달성(완주): ${cleared.length}명${cleared.length ? ' — ' + cleared.map(p => esc(p.id)).join(', ') : ''}`,
    '',
    '## 🏆 소지금 TOP 10', '', table(players, 'money'),
    '## ⚽ 승리 TOP 10', '', table(players, 'wins'),
    '## 🎯 최고점 TOP 10', '', table(players, 'bestPts'),
    `전체 명단은 같은 이름의 \`${name}.csv\` 파일에 있어요.`,
    '',
    '> 이 보고서는 시즌 마감 때 자동으로 만들어졌고, 마감 직후 모든 플레이어의 기록이 초기화되었어요.',
    ''
  ].join('\n');
  const head = 'rank,id,money,wins,losses,best_pts,week,cleared,plays';
  const csvCell = v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
  const csv = [head].concat(players.map((p, i) => [i + 1, p.id, p.money, p.wins, p.losses, p.bestPts, p.week, p.cleared ? 'Y' : '', p.plays].map(csvCell).join(','))).join('\n') + '\n';
  return { name, title, md, csv };
}

module.exports = { renderReport };
