#!/usr/bin/env node
// 채보 메이커(dev/chart-maker.html)에서 저장한 파일을 게임(js/pump-data.js의 PG_CHART)에 넣는다.
// 사용법:  node dev/apply_chart.js narak-chart.json
// 노트가 하나도 없는 난이도는 건드리지 않고 지금 채보를 그대로 둔다.
// 넣은 다음 node dev/build.js 로 단일 파일(dist)도 다시 만들어 주세요.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const LV = ['쉬움', '보통', '어려움', '매우 어려움'];
const file = process.argv[2];
if (!file) { console.error('사용법: node dev/apply_chart.js 채보파일.json'); process.exit(1); }
let o;
try { o = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error('채보 파일을 읽지 못했어요:', e.message); process.exit(1); }
if (!o || typeof o.song !== 'string' || !Array.isArray(o.levels)) { console.error('채보 메이커에서 저장한 파일이 아니에요.'); process.exit(1); }
const src = path.join(root, 'js/pump-data.js');
let js = fs.readFileSync(src, 'utf8');
// PG_CHART 안의 이 곡 블록:  pg13:{dur:59.8,lv:[\n  '...',\n  '...'\n]}
const re = new RegExp(`(${o.song}:\\{dur:[\\d.]+,lv:\\[\\r?\\n)([\\s\\S]*?)(\\r?\\n\\]\\})`);   // 줄바꿈은 LF/CRLF 둘 다
const m = js.match(re);
if (!m) { console.error(`js/pump-data.js의 PG_CHART에서 ${o.song} 곡을 찾지 못했어요.`); process.exit(1); }
const NL = m[1].endsWith('\r\n') ? '\r\n' : '\n';
const cur = m[2].split(/,\r?\n/).map(x => x.trim());
if (cur.length !== 4) { console.error('PG_CHART 형식이 예상과 달라요(난이도 4개).'); process.exit(1); }
const out = cur.slice();
o.levels.slice(0, 4).forEach((lv, i) => {
  if (!Array.isArray(lv) || !lv.length) { console.log(`- ${LV[i]}: 노트가 없어서 지금 채보를 그대로 둬요`); return; }
  const notes = lv.map(a => {
    const t = Math.round(+a[0]), l = a[1] | 0, h = Math.round(+a[2] || 0);
    if (!(t >= 0) || l < 0 || l > 4 || h < 0) throw new Error(`${LV[i]}: 잘못된 노트 ${JSON.stringify(a)}`);
    return [t, l, h];
  }).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  out[i] = "'" + notes.map(([t, l, h]) => `${t}/${l}` + (h ? `:${h}` : '')).join(' ') + "'";
  const jumps = new Set(notes.map(n => n[0])).size;
  console.log(`- ${LV[i]}: 노트 ${notes.length}개 (롱노트 ${notes.filter(n => n[2]).length}, 점프 자리 ${notes.length - jumps})`);
});
js = js.replace(re, (_, a, __, c) => a + out.map(x => '  ' + x).join(',' + NL) + c);
fs.writeFileSync(src, js);
console.log(`js/pump-data.js에 넣었어요 (${o.name || o.song}). 다음: node dev/build.js — 별 개수(PGSONGS의 stars)도 새 채보에 맞게 확인해 주세요.`);
