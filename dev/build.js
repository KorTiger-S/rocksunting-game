#!/usr/bin/env node
// 단일 HTML 파일(dist/rocksunting-single.html)을 만든다.
// 사용법:  node dev/build.js [Apps Script 웹앱 URL]
// URL을 넘기면 game.js의 CLOUD_DEFAULT에 넣어서, 이 파일을 여는 모든 사람이 자동으로 클라우드에 연결된다.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const url = (process.argv[2] || '').trim();
if (url && !/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(url)) {
  console.error('웹앱 URL 형식이 아니에요: https://script.google.com/macros/s/…/exec');
  process.exit(1);
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
  if (!js.includes("const CLOUD_DEFAULT='';")) { console.error("CLOUD_DEFAULT 줄을 찾지 못했어요."); process.exit(1); }
  js = js.replace("const CLOUD_DEFAULT='';", "const CLOUD_DEFAULT=" + JSON.stringify(url) + ";");
}
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => '<style>\n' + css + '</style>')
           .replace('<script src="js/game.js"></script>', () => '<script>\n' + js + '</script>');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'rocksunting-single.html');
fs.writeFileSync(out, html);
console.log('만들었어요:', out, '(' + Math.round(html.length / 1024) + ' KB)' + (url ? ' · 클라우드 URL 포함' : ''));
