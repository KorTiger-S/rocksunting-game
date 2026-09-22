#!/usr/bin/env node
// 단일 HTML 파일(dist/rocksunting-single.html)을 만든다.
// 사용법:  node dev/build.js [Supabase Project URL] [anon key]
// 두 값을 넘기면 js/cloud.js의 CLOUD_DEFAULT에 넣어서, 이 파일을 여는 모든 사람이 자동으로 클라우드에 연결된다.
// (anon key는 브라우저에 공개되는 값이에요. 비밀 키(service_role)는 절대 넣지 마세요.)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const url = (process.argv[2] || '').trim().replace(/\/+$/, '');
const key = (process.argv[3] || '').trim();
if (url && !/^https:\/\/[A-Za-z0-9-]+\.supabase\.co$/.test(url)) {
  console.error('Supabase URL 형식이 아니에요: https://프로젝트ID.supabase.co');
  process.exit(1);
}
if (url && key.length < 20) { console.error('두 번째 인자로 anon(public) key도 넘겨 주세요.'); process.exit(1); }
if (/service_role|^sb_secret_/i.test(key) || (key.split('.').length === 3 && /"role"\s*:\s*"service_role"/.test(Buffer.from(key.split('.')[1], 'base64url').toString()))) {
  console.error('service_role 키는 넣으면 안 돼요. anon(public) key를 쓰세요.'); process.exit(1);
}
let html = read('index.html');
let css = read('css/style.css');

// index.html의 <!-- BUILD:JS:START --> ~ <!-- BUILD:JS:END --> 사이에 나열된 js/*.js를,
// 적힌 순서 그대로 이어붙인다. (서로 전역 스코프를 공유하는 일반 스크립트라 순서가 중요해요)
const blockM = html.match(/<!-- BUILD:JS:START[\s\S]*?-->([\s\S]*?)<!-- BUILD:JS:END -->/);
if (!blockM) { console.error('index.html에서 BUILD:JS:START/END 블록을 찾지 못했어요.'); process.exit(1); }
const jsFiles = [...blockM[1].matchAll(/<script src="(js\/[\w-]+\.js)"><\/script>/g)].map(m => m[1]);
if (!jsFiles.length) { console.error('BUILD:JS 블록에서 <script src="js/...">를 찾지 못했어요.'); process.exit(1); }
let js = jsFiles.map(f => read(f)).join('\n');

// 화면에 보이는 버전(APP_VERSION)이 package.json의 version과 같은지 확인
{
  const m = js.match(/const APP_VERSION='([^']+)'/), pv = JSON.parse(read('package.json')).version;
  if (!m) { console.error('APP_VERSION 줄을 찾지 못했어요.'); process.exit(1); }
  if (!/^\d+\.\d+\.\d+$/.test(m[1])) { console.error(`버전은 메이저.마이너.패치 형식이어야 해요: ${m[1]}`); process.exit(1); }
  if (m[1] !== pv) console.warn(`⚠ 버전이 달라요: util.js APP_VERSION=${m[1]}, package.json version=${pv}`);
  if (!js.includes(`'${m[1]}':{sub:`) && !/\.0$/.test(m[1])) console.log(`ℹ 이 버전(${m[1]})의 업데이트 내역(RELEASE_NOTES)이 없어서 팝업은 뜨지 않아요.`);
  else if (!js.includes(`'${m[1]}':{sub:`)) console.warn(`⚠ RELEASE_NOTES에 ${m[1]} 내역이 없어요. 팝업이 안 떠요.`);
}
// 이미지 → data URI
js = js.replace(/assets\/faces\/([A-Za-z0-9_]+)\.jpg/g, (m, name) => {
  const b = fs.readFileSync(path.join(root, 'assets/faces', name + '.jpg'));
  return 'data:image/jpeg;base64,' + b.toString('base64');
});
if (url) {
  const marker = "const CLOUD_DEFAULT={url:'',key:''};";
  if (!js.includes(marker)) { console.error("CLOUD_DEFAULT 줄을 찾지 못했어요."); process.exit(1); }
  js = js.replace(marker, () => "const CLOUD_DEFAULT=" + JSON.stringify({ url, key }) + ";");
}
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => '<style>\n' + css + '</style>')
           .replace(/<!-- BUILD:JS:START[\s\S]*?-->[\s\S]*?<!-- BUILD:JS:END -->/, () => '<script>\n' + js + '</script>');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'rocksunting-single.html');
fs.writeFileSync(out, html);
console.log('만들었어요:', out, '(' + Math.round(html.length / 1024) + ' KB)' + (url ? ' · 클라우드 URL 포함' : ''), '·', jsFiles.length, '개 모듈 병합');
