#!/usr/bin/env node
// 시즌 마감 + 보고서 생성 (GitHub Actions에서 매일 실행)
//   node scripts/close_season.js [--out 폴더]        마감일이 지났으면 시즌을 마감하고 보고서 파일 생성
//   REPORT_KEY=2026-09 node scripts/close_season.js   이미 마감된 시즌의 보고서만 다시 생성
// 환경 변수: SUPABASE_URL, SUPABASE_SERVICE_KEY (비밀 키! GitHub Secrets에만 저장)
const fs = require('fs'), path = require('path');
const { renderReport } = require('./season_report');

const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, ''), key = process.env.SUPABASE_SERVICE_KEY || '';
if (!url || !key) { console.error('SUPABASE_URL 과 SUPABASE_SERVICE_KEY 가 필요해요.'); process.exit(1); }
const outIdx = process.argv.indexOf('--out');
const outDir = outIdx > 0 ? process.argv[outIdx + 1] : 'season-report';

async function rpc(fn, p) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key }, body: JSON.stringify({ p: p || {} })
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j || j.ok === false) throw new Error(`${fn} 실패: ${res.status} ${JSON.stringify(j)}`);
  return j;
}
function setOutput(k, v) { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); }

(async () => {
  const reportKey = (process.env.REPORT_KEY || '').trim();
  const r = reportKey ? await rpc('rk_season_report', { key: reportKey }) : await rpc('rk_close_season');
  if (!reportKey && !r.closed) { console.log(`아직 시즌이 끝나지 않았어요. (마감: ${r.endsAt})`); setOutput('closed', 'false'); return; }
  const rep = renderReport(r);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, rep.name + '.md'), rep.md);
  fs.writeFileSync(path.join(outDir, rep.name + '.csv'), '﻿' + rep.csv);   // BOM: 엑셀에서 한글이 안 깨지게
  fs.writeFileSync(path.join(outDir, 'issue.md'), rep.md);
  console.log(`보고서를 만들었어요: ${rep.name} (플레이어 ${r.players.length}명)`);
  if (r.next) console.log(`다음 시즌: 시즌${r.next.number} (${r.next.key}), 마감 ${r.next.endsAt}`);
  setOutput('closed', 'true'); setOutput('name', rep.name); setOutput('title', rep.title);
})().catch(e => { console.error(e.message); process.exit(1); });
