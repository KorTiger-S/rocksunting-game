/**
 * 롹순팅 키우기 - 사용자 데이터 / 점수 DB (Google Apps Script)
 *
 * [설치 방법]
 * 1. 새 구글 스프레드시트를 만든다.
 * 2. 메뉴: 확장 프로그램 > Apps Script  → 이 코드를 전부 붙여넣고 저장.
 * 3. 오른쪽 위 "배포" > "새 배포" > 유형: 웹 앱
 *      - 다음 사용자로 실행: 나
 *      - 액세스 권한이 있는 사용자: 모든 사용자
 * 4. 처음 한 번 권한 승인을 하고, 나온 "웹 앱 URL"(…/exec)을 복사한다.
 * 5. 게임의 [클라우드 연결 설정]에 그 URL을 붙여넣는다.
 *
 * 시트는 첫 요청 때 자동으로 만들어진다.
 *   - Users   : ID별 저장 데이터 (소지금, 승/패, 최고점수 …)
 *   - Matches : 경기 결과 기록(로그)
 * 코드를 고친 뒤에는 "배포 관리"에서 새 버전으로 다시 배포해야 반영된다.
 */

var VERSION = '1.1';
var USERS_HEAD = ['id', 'name', 'money', 'wins', 'losses', 'bestPts', 'week', 'cleared', 'updatedAt', 'updated', 'created', 'data', 'pin'];
var PIN_COL = 12;   // 0부터 센 pin 열 위치 (SHA-256 해시가 저장됨, 비밀번호 원문은 저장하지 않음)
var LOG_HEAD = ['time', 'id', 'bet', 'goals', 'pts', 'result', 'money', 'week'];
var ID_RE = /^[0-9A-Za-z_가-힣ㄱ-ㅎㅏ-ㅣ]{2,12}$/;

function doGet(e) { return handle_((e && e.parameter) || {}); }

function doPost(e) {
  var p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) { p = {}; }
  return handle_(p);
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function handle_(p) {
  var write = (p.action === 'save' || p.action === 'score');
  var lock = null;
  try {
    if (write) { lock = LockService.getScriptLock(); lock.waitLock(15000); }
    switch (p.action) {
      case 'ping':  return out_({ ok: true, version: VERSION });
      case 'load':  return out_(load_(p));
      case 'save':  return out_(save_(p));
      case 'score': return out_(score_(p));
      case 'top':   return out_(top_(p));
      default:      return out_({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e2) {} }
  }
}

function sheet_(name, head) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); }
  else if (name === 'Users' && !String(sh.getRange(1, head.length, 1, 1).getValues()[0][0])) {
    sh.getRange(1, head.length, 1, 1).setValues([[head[head.length - 1]]]);   // 예전 시트에 pin 열 머리글 추가
  }
  return sh;
}

function pinOk_(p) { return /^\d{4}$/.test(String(p.pin == null ? '' : p.pin)); }

function pinHash_(key, pin) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, key + ':' + String(pin));
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

// 저장된 비밀번호와 맞는지 확인. 저장된 값이 없는 예전 계정은 통과(저장 때 등록됨).
function pinMatches_(cur, key, p) {
  var stored = String(cur[PIN_COL] || '');
  return !stored || stored === pinHash_(key, p.pin);
}

function normId_(s) {
  s = String(s == null ? '' : s).trim();
  if (s.normalize) s = s.normalize('NFC');
  return ID_RE.test(s) ? s : null;
}

function findRow_(sh, key) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var vals = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === key) return i + 2;
  }
  return 0;
}

function num_(v, lo, hi, dflt) {
  v = Number(v);
  if (!isFinite(v)) return dflt;
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}

// 저장 데이터에서 허용된 항목만 남긴다.
function clean_(d) {
  d = d || {};
  var up = d.up || {};
  return {
    money: num_(d.money, 0, 100000000, 0),
    day: num_(d.day, 0, 4, 0),
    week: num_(d.week, 1, 9999, 1),
    fatigue: num_(d.fatigue, 0, 3, 0),
    hosp: num_(d.hosp, 0, 9999, 0),
    wins: num_(d.wins, 0, 99999, 0),
    losses: num_(d.losses, 0, 99999, 0),
    bestPts: num_(d.bestPts, 0, 99999, 0),
    plays: num_(d.plays, 0, 99999, 0),
    cleared: !!d.cleared,
    up: { shoes: num_(up.shoes, 0, 3, 0), snack: num_(up.snack, 0, 3, 0), sneak: num_(up.sneak, 0, 1, 0) }
  };
}

function parse_(v) {
  if (v && typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (e) { return null; }
}

function stamp_(ms) {
  return Utilities.formatDate(new Date(ms), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
}

function load_(p) {
  var key = normId_(p.id);
  if (!key) return { ok: false, error: 'bad_id' };
  if (!pinOk_(p)) return { ok: false, error: 'bad_pin' };
  var sh = sheet_('Users', USERS_HEAD);
  var row = findRow_(sh, key.toLowerCase());
  if (!row) return { ok: true, exists: false };
  var r = sh.getRange(row, 1, 1, USERS_HEAD.length).getValues()[0];
  if (!pinMatches_(r, key.toLowerCase(), p)) return { ok: false, error: 'bad_pin' };
  var data = parse_(r[11]);
  return { ok: true, exists: true, name: String(r[1]), updatedAt: Number(r[8]) || 0, data: data ? clean_(data) : null };
}

function save_(p) {
  var name = normId_(p.id);
  if (!name) return { ok: false, error: 'bad_id' };
  if (!pinOk_(p)) return { ok: false, error: 'bad_pin' };
  var key = name.toLowerCase();
  var data = clean_(parse_(p.data));
  var json = JSON.stringify(data);
  if (json.length > 4000) return { ok: false, error: 'too_big' };
  var at = Number(p.updatedAt) || Date.now();
  var sh = sheet_('Users', USERS_HEAD);
  var row = findRow_(sh, key);
  if (row) {
    var cur = sh.getRange(row, 1, 1, USERS_HEAD.length).getValues()[0];
    if (!pinMatches_(cur, key, p)) return { ok: false, error: 'bad_pin' };
    var curAt = Number(cur[8]) || 0;
    if (curAt > at) {                       // 다른 기기에서 더 최근에 저장됨
      var cd = parse_(cur[11]);
      return { ok: true, conflict: true, name: String(cur[1]), updatedAt: curAt, data: cd ? clean_(cd) : null };
    }
    var keepName = String(cur[1]) || name;
    sh.getRange(row, 1, 1, USERS_HEAD.length).setValues([[key, keepName, data.money, data.wins, data.losses, data.bestPts, data.week, data.cleared ? 'Y' : '', at, stamp_(at), cur[10], json, String(cur[PIN_COL] || '') || pinHash_(key, p.pin)]]);
    return { ok: true, updatedAt: at };
  }
  sh.appendRow([key, name, data.money, data.wins, data.losses, data.bestPts, data.week, data.cleared ? 'Y' : '', at, stamp_(at), stamp_(Date.now()), json, pinHash_(key, p.pin)]);
  return { ok: true, created: true, updatedAt: at };
}

function score_(p) {
  var name = normId_(p.id);
  if (!name) return { ok: false, error: 'bad_id' };
  if (!pinOk_(p)) return { ok: false, error: 'bad_pin' };
  var us = sheet_('Users', USERS_HEAD);
  var urow = findRow_(us, name.toLowerCase());
  if (urow && !pinMatches_(us.getRange(urow, 1, 1, USERS_HEAD.length).getValues()[0], name.toLowerCase(), p)) return { ok: false, error: 'bad_pin' };
  var sh = sheet_('Matches', LOG_HEAD);
  sh.appendRow([stamp_(Date.now()), name.toLowerCase(), num_(p.bet, 0, 100000, 0), num_(p.goals, 0, 5, 0), num_(p.pts, 0, 99999, 0), String(p.result || '').slice(0, 10), num_(p.money, 0, 100000000, 0), num_(p.week, 1, 9999, 1)]);
  return { ok: true };
}

function top_(p) {
  var metric = { money: 2, wins: 3, bestPts: 5 }[p.metric] || 2;
  var limit = num_(p.limit, 1, 30, 10);
  var sh = sheet_('Users', USERS_HEAD);
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, list: [] };
  var rows = sh.getRange(2, 1, last - 1, USERS_HEAD.length).getValues();
  var list = rows.map(function (r) {
    return { id: String(r[1]), money: Number(r[2]) || 0, wins: Number(r[3]) || 0, losses: Number(r[4]) || 0, bestPts: Number(r[5]) || 0, week: Number(r[6]) || 1, cleared: r[7] === 'Y', at: Number(r[8]) || 0, v: Number(r[metric]) || 0 };
  });
  list.sort(function (a, b) { return (b.v - a.v) || (a.at - b.at); });
  return { ok: true, total: list.length, list: list.slice(0, limit) };
}
