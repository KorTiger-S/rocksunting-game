#!/usr/bin/env node
// 단일 HTML 파일(dist/rocksunting-single.html)을 만든다.
// 사용법:  node dev/build.js [Supabase Project URL] [anon key]
// 두 값을 넘기면 game.js의 CLOUD_DEFAULT에 넣어서, 이 파일을 여는 모든 사람이 자동으로 클라우드에 연결된다.
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
let js = read('js/game.js');
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
           .replace('<script src="js/game.js"></script>', () => '<script>\n' + js + '</script>');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'rocksunting-single.html');
fs.writeFileSync(out, html);
console.log('만들었어요:', out, '(' + Math.round(html.length / 1024) + ' KB)' + (url ? ' · 클라우드 URL 포함' : ''));
