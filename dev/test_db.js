// backend/schema.sql 로직 테스트 (PGlite = Node 안에서 도는 PostgreSQL, 계정/설치 불필요)
const fs = require('fs'), path = require('path');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const db = new PGlite({ extensions: { pgcrypto } });
  // Supabase에는 기본으로 있는 것들
  await db.exec('create schema extensions; create role anon; create role authenticated; create role service_role;');
  await db.exec(fs.readFileSync(path.join(__dirname, '../backend/schema.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '../backend/schema.sql'), 'utf8'));   // 다시 실행해도 안전한지
  ok(true, 'schema.sql 두 번 실행해도 오류 없음');

  const rpc = async (fn, p) => (await db.query(`select public.rk_${fn}($1::jsonb) as r`, [JSON.stringify(p || {})])).rows[0].r;
  const P = '1234';
  const SEASON = '2026-09';
  const save = (id, at, data, pin = P, season = SEASON) => rpc('save', { id, pin, season, updatedAt: at, data });
  const load = (id, pin = P) => rpc('load', { id, pin });

  ok((await rpc('ping')).ok, 'ping');
  ok((await load('a')).error === 'bad_id', '짧은 ID 거부');
  ok((await load('홍 길동')).error === 'bad_id', '공백 ID 거부');
  ok((await load('Guest')).error === 'bad_id' && (await save('게스트', 1, { money: 1 })).error === 'bad_id', 'Guest/게스트는 예약어라 거부');
  ok((await load('히포우')).exists === false, '없는 ID는 exists=false');
  ok((await load('히포우', '12')).error === 'bad_pin', '4자리 아닌 비밀번호 거부');
  ok((await load('히포우', 'abcd')).error === 'bad_pin', '숫자 아닌 비밀번호 거부');

  let r = await save('히포우', 1000, { money: 12345, wins: 2, losses: 1, bestPts: 230, week: 2, up: { shoes: 1, snack: 0, sneak: 1 } });
  ok(r.ok && r.created, '새 ID 저장(created)');
  r = await load('히포우');
  ok(r.exists && r.data.money === 12345 && r.data.up.shoes === 1, '저장한 데이터 불러오기');
  ok((await load('히포우'.toUpperCase())).exists, '대소문자/동일 ID 조회');
  await save('ABCd', 1000, { money: 5000 });
  r = await load('abcD');
  ok(r.exists && r.name === 'ABCd', 'ID 대소문자 무시 + 표시 이름 유지');

  ok((await save('히포우', 2000, { money: 20000, wins: 3, bestPts: 400, week: 3 })).ok, '더 최신 저장 성공');
  r = await save('히포우', 1500, { money: 1, wins: 0 });
  ok(r.conflict && r.data.money === 20000, '오래된 기기는 충돌(최신 데이터 반환)');
  await save('히포우', 3000, { money: 9e15, wins: 'x', up: { shoes: 99 } });
  let d = (await load('히포우')).data;
  ok(d.money === 100000000 && d.wins === 0 && d.up.shoes === 3, '값 범위 보정(치트/오류 방지)');
  await save('히포우', 4000, { money: 1000, note: 'x'.repeat(9000) });
  d = (await load('히포우')).data;
  ok(d.money === 1000 && !('note' in d), '허용되지 않은 필드는 버리고 저장');

  // ----- 비밀번호 -----
  ok((await load('히포우', '9999')).error === 'bad_pin', '틀린 비밀번호로 불러오기 거부');
  ok((await save('히포우', 9000, { money: 1 }, '9999')).error === 'bad_pin', '틀린 비밀번호로 저장 거부');
  ok((await load('히포우')).data.money === 1000, '거부된 저장은 데이터를 바꾸지 않음');
  ok((await rpc('score', { id: '히포우', pin: '9999', bet: 1, goals: 1, pts: 1, result: '승' })).error === 'bad_pin', '틀린 비밀번호로 점수 기록 거부');
  const h = (await db.query(`select pin_hash from public.rk_users where id = '히포우'`)).rows[0].pin_hash;
  ok(h.startsWith('$2') && !h.includes(P), '비밀번호는 bcrypt 해시로만 저장');

  // ----- 잠금: 5번 틀리면 5분 잠김, 이 동안은 맞는 비밀번호도 거부 -----
  await save('잠금이', 1, { money: 1 }, '1111');
  const seq = [];
  for (let i = 0; i < 5; i++) seq.push((await load('잠금이', '0000')).error);
  ok(seq.every(e => e === 'bad_pin'), '5번까지는 bad_pin');
  ok((await load('잠금이', '0000')).error === 'locked', '6번째부터 locked');
  ok((await load('잠금이', '1111')).error === 'locked', '잠긴 동안은 맞는 비밀번호도 거부');
  await db.exec(`update public.rk_attempts set locked_until = now() - interval '1 second' where user_id = '잠금이'`);
  ok((await load('잠금이', '1111')).exists, '잠금 시간이 지나면 다시 로그인 가능');
  await load('잠금이', '0000'); await load('잠금이', '1111');
  const left = await db.query(`select count(*)::int as n from public.rk_attempts where user_id = '잠금이'`);
  ok(left.rows[0].n === 0, '로그인 성공하면 실패 횟수 초기화');

  // ----- 점수 기록 / 랭킹 -----
  ok((await rpc('score', { id: '히포우', pin: P, bet: 1500, goals: 3, pts: 330, result: '승리', money: 11500, week: 2 })).ok, '점수 기록');
  ok((await rpc('score', { id: '없는사람', pin: P, bet: 1, goals: 1, pts: 1 })).error === 'no_user', '없는 ID의 점수 기록 거부');
  ok((await db.query('select count(*)::int as n from public.rk_matches')).rows[0].n === 1, 'rk_matches 로그 1건');
  await save('짱구', 1, { money: 7000, wins: 9, bestPts: 900 });
  await save('철수', 1, { money: 30000, wins: 1, bestPts: 100 });
  let t = await rpc('top', { metric: 'money', limit: 3 });
  ok(t.list[0].id === '철수' && t.list.length === 3, '소지금 랭킹 1위 + limit');
  t = await rpc('top', { metric: 'wins' }); ok(t.list[0].id === '짱구', '승리 랭킹 1위');
  t = await rpc('top', { metric: 'bestPts' }); ok(t.list[0].id === '짱구' && t.list[0].bestPts === 900, '최고점 랭킹 1위');
  t = await rpc('top', { metric: 'money', limit: 3 });
  ok(t.list.every((x, i, a) => !i || a[i - 1].money >= x.money), '랭킹이 내림차순으로 정렬됨');
  ok(!JSON.stringify(t).includes('pin'), '랭킹 응답에 비밀번호 정보 없음');

  // ----- 시즌 -----
  const kst = (addDays) => new Date(Date.now() + 9 * 3600e3 + addDays * 864e5).toISOString().slice(0, 10);
  let s = await rpc('season_get');
  ok(s.ok && s.season.key === SEASON && s.season.number === 1 && s.season.game === 'football', '시즌1(2026-09, 축구)이 기본 시즌');
  ok(s.season.endsAt === '2026-09-30T15:00:00Z', '기본 마감은 2026-10-01 00:00 KST');
  r = await load('히포우');
  ok(r.season === SEASON && r.current.key === SEASON && r.admin === false, '불러오기 응답에 시즌 정보 + 운영자 여부');
  ok((await load('새사람')).current.key === SEASON, '없는 ID도 현재 시즌 정보를 받음');

  const setEnd = (id, pin, date) => rpc('season_set', { id, pin, date });
  ok((await setEnd('히포우', P, kst(3))).error === 'not_admin', '운영자가 아니면 마감일 변경 거부');
  await db.exec(`update public.rk_users set is_admin = true where id = '히포우'`);
  ok((await load('히포우')).admin === true, '운영자 계정은 admin=true');
  ok((await setEnd('히포우', '9999', kst(3))).error === 'bad_pin', '운영자라도 비밀번호가 틀리면 거부');
  ok((await setEnd('히포우', P, '2000-01-01')).error === 'past_date', '지난 날짜로는 변경 불가');
  ok((await setEnd('히포우', P, '2026-13-45')).error === 'bad_date' && (await setEnd('히포우', P, 'abc')).error === 'bad_date', '잘못된 날짜 거부');
  r = await setEnd('히포우', P, kst(3));
  const want = new Date(Date.parse(kst(3) + 'T00:00:00Z') + 864e5 - 9 * 3600e3).toISOString().slice(0, 19) + 'Z';
  ok(r.ok && r.season.endsAt === want, '운영자가 마감일을 바꾸면 그 날 다음 0시(KST)에 마감');
  ok((await rpc('season_get')).season.endsAt === want, '바뀐 마감일이 모두에게 보임');

  r = await db.query('select public.rk_close_season($1::jsonb) as r', ['{}']);
  ok(r.rows[0].r.closed === false, '마감일 전에는 마감하지 않음');

  // 마감: 마감 시각을 과거로 돌린 뒤 service_role로 실행
  await db.exec(`update public.rk_users set money = 500 where id = '짱구'`);
  await db.exec(`update public.rk_config set value = jsonb_set(value, '{ends_at}', to_jsonb(to_char(now() at time zone 'utc' - interval '1 second', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))) where key = 'season'`);
  let denied2 = false;
  await db.exec('set role anon'); try { await db.query(`select public.rk_close_season('{}'::jsonb)`); } catch (e) { denied2 = true; } await db.exec('reset role');
  ok(denied2, 'anon은 시즌 마감 함수를 호출할 수 없음');
  await db.exec('set role service_role');
  const cl = (await db.query(`select public.rk_close_season('{}'::jsonb) as r`)).rows[0].r;
  await db.exec('reset role');
  ok(cl.ok && cl.closed && cl.season.key === SEASON && cl.season.number === 1, '마감일이 지나면 시즌1이 마감됨');
  ok(cl.players.length >= 4 && cl.players.every((x, i, a) => !i || a[i - 1].money >= x.money), '스냅샷에 전체 플레이어가 소지금 순으로 들어감');
  ok(cl.matchCount === 1, '스냅샷에 시즌 경기 수가 들어감');
  ok(cl.next.number === 2 && cl.next.key !== SEASON, '다음 시즌(시즌2)이 시작됨');
  r = await load('철수');
  ok(r.data.money === 10000 && r.data.wins === 0 && r.data.week === 1 && r.data.up.shoes === 0 && r.season === cl.next.key, '마감 뒤 모든 플레이어 기록이 초기화됨');
  ok((await rpc('top', { metric: 'money' })).list.every(x => x.money === 10000 && x.wins === 0), '랭킹도 초기화됨');
  ok((await load('철수')).data.plays === 0 && (await load('짱구')).name === '짱구', '계정(ID)은 유지됨');
  r = await save('철수', Date.now() + 1000, { money: 99999, wins: 9 });   // 예전 시즌 기록을 들고 온 오래된 화면
  ok(r.conflict && r.data.money === 10000 && r.season === cl.next.key, '예전 시즌 기록으로 저장하면 거부되고 초기화된 기록을 돌려줌');
  ok((await load('철수')).data.money === 10000, '거부된 저장이 초기화된 기록을 덮어쓰지 않음');
  r = await save('철수', Date.now() + 2000, { money: 12000, wins: 1 }, P, cl.next.key);
  ok(r.ok && !r.conflict && (await load('철수')).data.money === 12000, '새 시즌 키로는 정상 저장');
  await db.exec('set role service_role');
  const rep = (await db.query(`select public.rk_season_report($1::jsonb) as r`, [JSON.stringify({ key: SEASON })])).rows[0].r;
  await db.exec('reset role');
  ok(rep.ok && rep.season.gameName === '프리킥 축구' && rep.players.length === cl.players.length, '마감된 시즌 보고서를 다시 가져올 수 있음');
  ok((await rpc('score', { id: '철수', pin: P, bet: 1, goals: 1, pts: 1, result: '승' })).ok, '새 시즌에도 점수 기록 가능');
  ok((await db.query(`select season_key from public.rk_matches order by id desc limit 1`)).rows[0].season_key === cl.next.key, '경기 기록에 시즌 키가 붙음');
  // 한 번 더 마감해도 시즌 이름이 겹치지 않음
  await db.exec(`update public.rk_config set value = jsonb_set(value, '{ends_at}', to_jsonb(to_char(now() at time zone 'utc' - interval '1 second', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))) where key = 'season'`);
  await db.exec('set role service_role');
  const cl2 = (await db.query(`select public.rk_close_season('{}'::jsonb) as r`)).rows[0].r;
  await db.exec('reset role');
  const keys = (await db.query('select season_key from public.rk_seasons')).rows.map(x => x.season_key);
  ok(cl2.closed && cl2.next.number === 3 && new Set(keys).size === 2 && ![...keys].includes(cl2.next.key), '연속 마감해도 시즌 이름이 겹치지 않음');

  // ----- 보고서 생성 (scripts/) -----
  const { renderReport } = require('../scripts/season_report');
  const rp = renderReport(cl);
  ok(rp.title.includes('시즌1') && rp.md.includes('소지금 TOP 10') && rp.md.includes(cl.players[0].id), '보고서 Markdown에 제목·순위표가 들어감');
  ok(rp.csv.trim().split('\n').length === cl.players.length + 1 && rp.name === `${SEASON}_season1_football`, '보고서 CSV에 전체 명단이 들어감');
  {
    const http = require('http'), cp = require('child_process'), os = require('os');
    const srv = http.createServer((req, res) => {
      let b = ''; req.on('data', c => b += c); req.on('end', async () => {
        try {
          const fn = req.url.split('/').pop();
          await db.exec('set role service_role');
          const out = (await db.query(`select public.${fn}($1::jsonb) as r`, [JSON.stringify(JSON.parse(b).p)])).rows[0].r;
          await db.exec('reset role');
          res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(out));
        } catch (e) { await db.exec('reset role').catch(() => {}); res.statusCode = 400; res.end(JSON.stringify({ message: String(e) })); }
      });
    });
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    const env = Object.assign({}, process.env, { SUPABASE_URL: `http://127.0.0.1:${srv.address().port}`, SUPABASE_SERVICE_KEY: 'test-key' });
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rk-report-'));
    const run = (extra = {}) => new Promise(resolve => cp.execFile('node', [path.join(__dirname, '../scripts/close_season.js'), '--out', outDir], { env: Object.assign({}, env, extra) }, (err, so, se) => resolve({ err, so, se })));
    let x = await run();
    ok(!x.err && x.so.includes('아직 시즌이 끝나지 않았어요') && fs.readdirSync(outDir).length === 0, '마감일 전에는 스크립트가 아무 파일도 만들지 않음');
    await db.exec(`update public.rk_config set value = jsonb_set(value, '{ends_at}', to_jsonb(to_char(now() at time zone 'utc' - interval '1 second', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))) where key = 'season'`);
    x = await run();
    const files = fs.readdirSync(outDir);
    ok(!x.err && files.some(f => f.endsWith('.md')) && files.some(f => f.endsWith('.csv')) && files.includes('issue.md'), '마감일이 지나면 스크립트가 보고서 파일을 만듦');
    const md = fs.readFileSync(path.join(outDir, files.find(f => f.endsWith('.md') && f !== 'issue.md')), 'utf8');
    ok(md.includes('시즌3'), '스크립트가 만든 보고서가 3번째 시즌 마감 결과');
    x = await run({ REPORT_KEY: SEASON });
    ok(!x.err && x.so.includes(`${SEASON}_season1_football`), '이미 마감된 시즌의 보고서를 다시 만들 수 있음');
    x = await run({ SUPABASE_SERVICE_KEY: '' });
    ok(x.err && x.se.includes('SUPABASE_SERVICE_KEY'), '키가 없으면 스크립트가 실패');
    srv.close(); fs.rmSync(outDir, { recursive: true, force: true });
  }

  // ----- 권한: anon은 테이블에 직접 접근 불가, rk_ 함수만 실행 가능 -----
  await db.exec('set role anon');
  let denied = false; try { await db.query('select * from public.rk_users'); } catch (e) { denied = true; }
  ok(denied, 'anon은 rk_users를 직접 읽을 수 없음');
  denied = false; try { await db.query(`select public.rk_auth('철수', '1234')`); } catch (e) { denied = true; }
  ok(denied, 'anon은 내부 함수 rk_auth를 직접 호출할 수 없음');
  ok((await rpc('top', { metric: 'money' })).ok, 'anon도 rk_top 함수는 실행 가능');
  await db.exec('reset role');

  console.log(fails ? `\n실패 ${fails}건` : '\n전부 통과');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
