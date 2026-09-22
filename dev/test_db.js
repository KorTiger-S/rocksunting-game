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
  t = await rpc('top', { metric: 'wins' });
  ok(t.list.every(x => x.wins === 0), '승리 스코어는 save()로 보낸 전적을 반영하지 않음(1:1 대결에서만 올라감)');
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
  ok(r.season === SEASON && r.current.key === SEASON && !('admin' in r), '불러오기 응답에 시즌 정보가 있고 운영자 정보는 없음');
  ok((await load('새사람')).current.key === SEASON, '없는 ID도 현재 시즌 정보를 받음');

  // 마감일 변경은 대시보드(SQL Editor = 관리자 권한)에서만 가능. anon(게임)은 호출할 수 없다.
  const setEnd = async (d) => (await db.query('select public.rk_set_season_end($1::date) as r', [d])).rows[0].r;
  let denied0 = false;
  await db.exec('set role anon'); try { await db.query(`select public.rk_set_season_end('${kst(3)}')`); } catch (e) { denied0 = true; } await db.exec('reset role');
  ok(denied0, 'anon(게임)은 마감일을 바꿀 수 없음');
  denied0 = false; try { await rpc('season_set', { id: '히포우', pin: P, date: kst(3) }); } catch (e) { denied0 = true; }
  ok(denied0, '게임에서 부르던 운영자용 함수(rk_season_set)는 없어짐');
  let pastErr = ''; try { await setEnd('2000-01-01'); } catch (e) { pastErr = String(e.message); }
  ok(pastErr.includes('이전 날짜'), '지난 날짜로는 변경 불가');
  r = await setEnd(kst(3));
  const want = new Date(Date.parse(kst(3) + 'T00:00:00Z') + 864e5 - 9 * 3600e3).toISOString().slice(0, 19) + 'Z';
  ok(r.endsAt === want, '대시보드에서 마감일을 바꾸면 그 날 다음 0시(KST)에 마감');
  ok((await rpc('season_get')).season.endsAt === want, '바뀐 마감일이 모두에게 보임');
  const users = await db.query(`select column_name from information_schema.columns where table_name = 'rk_users' and column_name = 'is_admin'`);
  ok(users.rows.length === 0, 'rk_users에 운영자 표시 열이 없음');

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

  // ----- 1:1 페널티킥 대결 (피파 온라인 방식: 슈터는 조준+파워, 골키퍼는 다이브 칸) -----
  {
    const A = { id: '방장', pin: P }, B = { id: '손님', pin: P }, Cc = { id: '제삼자', pin: P };
    for (const u of [A, B, Cc]) await save(u.id, 1, { money: 1000 });
    const st = async (u, code) => rpc('duel_state', { ...u, code });
    const shoot = (u, code, round, ax, ay, pw) => rpc('duel_pick', { ...u, code, round, ax, ay, pw });
    const dive = (u, code, round, pick) => rpc('duel_pick', { ...u, code, round, pick });
    const row = async code => (await db.query('select * from public.rk_duels where code = $1', [code])).rows[0];
    // 결과가 확실한 슛: 골 = 왼쪽 아래로 차는데 골키퍼는 위쪽 오른쪽(칸 2) / 막힘 = 왼쪽 아래 정중앙으로 차는데 골키퍼도 왼쪽 아래(칸 3)
    const GOAL = [-0.6, 0.25, 0.8], SAVE = [-0.667, 0.25, 0.8], GOAL_DIVE = 2, SAVE_DIVE = 3;
    const play = async (code, round, goal) => {       // 한 킥을 끝까지 진행하고 마지막 응답을 돌려준다
      const sh = round % 2 === 0 ? A : B, kp = round % 2 === 0 ? B : A;
      await shoot(sh, code, round, ...(goal ? GOAL : SAVE));
      return dive(kp, code, round, goal ? GOAL_DIVE : SAVE_DIVE);
    };

    ok((await rpc('duel_create', { ...A, pin: '9999' })).error === 'bad_pin', '대결: 틀린 비밀번호로 방 만들기 거부');
    ok((await rpc('duel_create', { id: '없는사람', pin: P })).error === 'no_user', '대결: 없는 ID는 방을 만들 수 없음');
    let r = await rpc('duel_create', A);
    const code = r.code;
    ok(r.ok && /^[A-Z2-9]{4}$/.test(code) && r.status === 'waiting' && r.me === 'host', '대결: 방 만들기 → 4자리 코드, 대기 중');
    ok((await rpc('duel_create', A)).code === code, '대결: 방이 있으면 새로 만들지 않고 같은 방으로 돌아감');
    ok((await rpc('duel_join', { ...B, code: 'ZZZZ' })).error === 'no_room', '대결: 없는 코드는 참가 불가');
    ok((await st(Cc, code)).error === 'not_member', '대결: 참가자가 아니면 상태를 볼 수 없음');
    r = await rpc('duel_join', { ...B, code: code.toLowerCase() });
    ok(r.ok && r.status === 'playing' && r.me === 'guest' && r.host === '방장' && r.guest === '손님', '대결: 코드로 참가(소문자도 허용) → 시작');
    ok((await rpc('duel_join', { ...Cc, code })).error === 'full', '대결: 이미 시작한 방은 제3자가 못 들어감');
    ok((await rpc('duel_create', Cc)).ok && (await rpc('duel_join', { ...Cc, code })).error === 'busy', '대결: 다른 방에 참여 중이면 참가 불가(busy)');
    await rpc('duel_leave', { ...Cc, code: (await rpc('duel_create', Cc)).code });

    // 라운드 0: 방장이 슈터, 손님이 골키퍼
    r = await st(A, code);
    ok(r.role === 'kick' && !r.mine && !r.theirs, '대결: 방장이 먼저 슈터');
    ok((await st(B, code)).role === 'keep', '대결: 손님은 골키퍼');
    ok((await shoot(A, code, 0, 'abc', 0.5, 0.8)).error === 'bad_pick', '대결: 숫자가 아닌 조준값은 거부');
    ok((await rpc('duel_pick', { ...A, code, round: 0, pick: 3 })).error === 'bad_pick', '대결: 슈터가 칸(pick)만 보내면 거부');
    ok((await rpc('duel_pick', { ...B, code, round: 0, ax: 0, ay: 0.5, pw: 0.8 })).error === 'bad_pick', '대결: 골키퍼가 조준값만 보내면 거부');
    ok((await dive(B, code, 0, 7)).error === 'bad_pick', '대결: 0~5 밖의 다이브 칸은 거부');
    r = await shoot(A, code, 0, ...GOAL);
    ok(r.mine && !r.theirs && r.round === 0, '대결: 내 선택만 기록되고 판정은 대기');
    r = await st(B, code);
    ok(r.theirs === true && !JSON.stringify(r).includes('"ax"') && !JSON.stringify(r).includes('k_ax'), '대결: 상대가 골랐는지만 보이고 조준 위치는 안 보임');
    await shoot(A, code, 0, 0.9, 0.9, 0.2);
    let d0 = await row(code);
    ok(d0.k_ax === GOAL[0] && d0.k_pw === GOAL[2], '대결: 이미 제출한 슛은 바꿀 수 없음');
    r = await dive(B, code, 0, GOAL_DIVE);
    ok(r.round === 1 && r.hg === 1 && r.hist[0].r === 'goal' && r.hist[0].gp === 2 && r.hist[0].ax === -0.6 && typeof r.hist[0].fx === 'number', '대결: 둘 다 고르면 서버가 판정(골) + 조준/최종 위치 공개');
    ok(r.role === 'kick', '대결: 다음 킥은 손님이 슈터(손님 입장에서 kick)');
    ok((await dive(A, code, 0, 1)).round === 1, '대결: 지난 킥에 대한 늦은 선택은 무시');
    r = await play(code, 1, false);
    ok(r.round === 2 && r.gg === 0 && r.hist[1].r === 'saved', '대결: 골키퍼가 방향을 맞히면 막힘');
    r = await play(code, 2, true);   // 방장 2골째
    await shoot(B, code, 3, 1.3, 0.5, 0.8); r = await dive(A, code, 3, 4);
    ok(r.hist[3].r === 'miss' && r.gg === 0, '대결: 골대 밖으로 차면 빗나감');

    // 판정 규칙(직접): 파워 게이지에 따른 흔들림, 프레임(post), 파워가 약하면 골키퍼 반경이 커짐
    const shots = async (ax, ay, pw, gp, n) => {
      const o = { goal: 0, saved: 0, miss: 0, post: 0 };
      for (let i = 0; i < n; i++) o[(await db.query('select public.rk_duel_shot($1, $2, $3, $4)->>\'r\' as r', [ax, ay, pw, gp])).rows[0].r]++;
      return o;
    };
    let o = await shots(0.4, 0.5, 0.8, 3, 200);
    ok(o.miss + o.post === 0 && o.goal === 200, '대결: 초록 구간(파워 0.8)이면 조준한 곳으로 정확히 감(골키퍼가 먼 칸이면 골)');
    o = await shots(0, 0.5, 0.2, 5, 300);
    ok(o.miss + o.post > 0, '대결: 파워가 초록 구간에서 멀면 공이 흔들려 골대 밖/프레임으로 갈 수 있음');
    o = await shots(1.03, 0.5, 0.8, 3, 200);
    ok(o.post > 140 && o.miss < 30, '대결: 골포스트 바깥선을 노리면 대부분 프레임을 맞힘(post)');
    o = await shots(0, 1.03, 0.8, 3, 200);
    ok(o.post > 140, '대결: 크로스바를 노리면 대부분 프레임을 맞힘(post)');
    o = await shots(-0.9, 0.9, 0.8, 0, 200);
    ok(o.saved > 190, '대결: 골키퍼가 그 구석 칸으로 다이브하면 막힘');
    o = await shots(-0.9, 0.9, 0.8, 5, 200);
    ok(o.goal === 200, '대결: 골키퍼가 반대편으로 다이브하면 골');
    o = await shots(0, 0.5, 0.8, 1, 100);
    ok(o.saved === 100, '대결: 가운데 높이의 슛은 가운데 위쪽 다이브로 막힘');
    const oWeak = await shots(0.55, 0.5, 0.35, 1, 200), oStrong = await shots(0.55, 0.5, 0.85, 1, 200);
    ok(oWeak.saved > oStrong.saved, '대결: 약한 슛은 골키퍼가 더 넓게 막음 (약한 슛 ' + oWeak.saved + ' > 강한 슛 ' + oStrong.saved + ')');

    // 시간 초과: 25초 지나면 안 고른 쪽은 무작위 선택 → 판정
    const before = (await st(A, code)).round;
    await db.query(`update public.rk_duels set round_at = now() - interval '30 seconds' where code = $1`, [code]);
    r = await st(A, code);
    ok(r.round === before + 1 && r.hist.length === before + 1, '대결: 25초가 지나면 무작위로 선택되어 다음 킥으로 넘어감');

    // 자리 비움: 90초 넘게 안 보이면 몰수패(남아 있는 쪽 승리)
    await db.query(`update public.rk_duels set guest_seen = now() - interval '100 seconds' where code = $1`, [code]);
    r = await st(A, code);
    ok(r.status === 'done' && r.winner === 'host' && r.reason === 'left', '대결: 상대가 자리를 비우면 몰수승');
    ok((await dive(A, code, r.round, 1)).status === 'done', '대결: 끝난 방에는 더 이상 선택할 수 없음');
    ok((await rpc('duel_create', A)).code !== code, '대결: 끝난 뒤에는 새 방을 만들 수 있음');
    await rpc('duel_leave', { ...A, code: (await rpc('duel_create', A)).code });

    // 방장 전부 골, 손님 전부 막힘 → 남은 킥으로 따라잡을 수 없으면 조기 종료
    r = await rpc('duel_create', A); const c2 = r.code; await rpc('duel_join', { ...B, code: c2 });
    for (let i = 0; i < 10; i++) { r = await st(A, c2); if (r.status === 'done') break; r = await play(c2, i, i % 2 === 0); }
    ok(r.status === 'done' && r.winner === 'host' && r.hg === 3 && r.gg === 0 && r.reason === 'score', '대결: 남은 킥으로 따라잡을 수 없으면 조기 종료(3:0)');

    // 동점 → 서든데스
    r = await rpc('duel_create', A); const c3 = r.code; await rpc('duel_join', { ...B, code: c3 });
    for (let i = 0; i < 10; i++) r = await play(c3, i, true);       // 전부 골 → 5:5
    ok(r.status === 'playing' && r.round === 10 && r.hg === 5 && r.gg === 5, '대결: 5:5 동점이면 서든데스로 계속');
    r = await play(c3, 10, true);
    ok(r.status === 'playing' && r.hg === 6, '대결: 서든데스에서 방장이 넣어도 손님 차례가 남아 있으면 계속');
    r = await play(c3, 11, false);
    ok(r.status === 'done' && r.winner === 'host' && r.hg === 6 && r.gg === 5, '대결: 서든데스 한 쌍이 끝났을 때 앞서면 승리');

    // 나가기
    r = await rpc('duel_create', A); const c4 = r.code;
    ok((await rpc('duel_leave', { ...A, code: c4 })).ok && !(await row(c4)), '대결: 대기 중에 나가면 방이 사라짐');
    r = await rpc('duel_create', A); const c5 = r.code; await rpc('duel_join', { ...B, code: c5 });
    await rpc('duel_leave', { ...B, code: c5 });
    r = await st(A, c5);
    ok(r.status === 'done' && r.winner === 'host' && r.reason === 'left', '대결: 진행 중에 나가면 상대 승리');
    // 대기방 만료
    r = await rpc('duel_create', B); const c6 = r.code;
    await db.query(`update public.rk_duels set created_at = now() - interval '20 minutes' where code = $1`, [c6]);
    r = await st(B, c6);
    ok(r.status === 'done' && r.reason === 'expired', '대결: 15분 넘게 기다린 방은 만료');

    // 랭킹의 승리 스코어(wins/losses)는 이 블록에서 방장이 이긴 1:1 대결 결과(몰수승·3:0·서든데스·상대 이탈)만큼만 올라감
    const wl = async id => (await db.query(`select wins, losses from public.rk_users where id = $1`, [id])).rows[0];
    ok((await wl(A.id)).wins === 4 && (await wl(A.id)).losses === 0, '대결: 방장의 승리 스코어는 이긴 1:1 대결 수만큼 올라감(무승부·만료는 제외)');
    ok((await wl(B.id)).losses === 4 && (await wl(B.id)).wins === 0, '대결: 진 쪽은 패배 스코어가 올라감');
    ok((await rpc('top', { metric: 'wins' })).list[0].id === A.id, '대결: 랭킹의 승리 스코어는 1:1 대결 결과를 따름');
  }

  // ----- 1:1 대결 판돈: 미리 빼 두고(에스크로), 이긴 사람이 2배, 무승부/만료/닫기는 환불, 나가면 몰수 -----
  {
    const A = { id: '판돈갑', pin: P }, B = { id: '판돈을', pin: P };
    await save(A.id, 1, { money: 5000 }); await save(B.id, 1, { money: 5000 });
    const row = async id => (await db.query(`select money, (data->>'money')::int as dm, updated_at_ms from public.rk_users where id = $1`, [id])).rows[0];
    const bal = async id => (await row(id)).money;
    const setMoney = (id, m) => db.query(`update public.rk_users set money = $2, data = jsonb_set(data, '{money}', to_jsonb($2::int)) where id = $1`, [id, m]);
    const st = (u, code) => rpc('duel_state', { ...u, code });
    const play = async (code, round, goal) => {
      const sh = round % 2 === 0 ? A : B, kp = round % 2 === 0 ? B : A;
      await rpc('duel_pick', { ...sh, code, round, ax: goal ? -0.6 : -0.667, ay: 0.25, pw: 0.8 });
      return rpc('duel_pick', { ...kp, code, round, pick: goal ? 2 : 3 });
    };
    const drow = async code => (await db.query('select * from public.rk_duels where code = $1', [code])).rows[0];
    const t0 = (await row(A.id)).updated_at_ms;

    // 판돈 범위: 5,000원 상한, 100원 단위, 숫자가 아니면 0
    let r = await rpc('duel_create', { ...A, bet: 99999 });
    ok(r.ok && r.bet === 5000 && r.money === 0 && (await bal(A.id)) === 0, '판돈: 최대 5,000원으로 보정되고 방을 만드는 순간 소지금에서 빠짐');
    ok((await row(A.id)).dm === 0 && (await row(A.id)).updated_at_ms > t0, '판돈: 저장 데이터(data.money)도 같이 바뀌고 갱신 시각이 올라감');
    ok((await save(A.id, 5, { money: 99999 })).conflict === true, '판돈: 예전 소지금을 들고 있는 기기는 덮어쓰지 못하고 서버 값을 받아 감');
    ok((await rpc('duel_leave', { ...A, code: r.code })).money === 5000 && (await bal(A.id)) === 5000 && !(await drow(r.code)), '판돈: 아무도 안 들어온 방을 닫으면 판돈을 돌려받고 방이 사라짐');
    r = await rpc('duel_create', { ...A, bet: 'abc' });
    ok(r.bet === 0 && (await bal(A.id)) === 5000, '판돈: 숫자가 아니면 판돈 없음(0원)');
    await rpc('duel_leave', { ...A, code: r.code });
    await setMoney(A.id, 200);
    ok((await rpc('duel_create', { ...A, bet: 5000 })).error === 'no_money' && (await db.query(`select 1 from public.rk_duels where host = $1 and status <> 'done'`, [A.id])).rows.length === 0, '판돈: 가진 돈보다 많이 걸면 방을 만들 수 없음');
    await setMoney(A.id, 5000);

    // 방 정보 미리보기 + 참가자 소지금 확인
    r = await rpc('duel_create', { ...A, bet: 1234 });
    const code = r.code;
    ok(r.bet === 1200 && (await bal(A.id)) === 3800, '판돈: 100원 단위로 내림(1,234 → 1,200)');
    let pk = await rpc('duel_peek', { ...B, code: code.toLowerCase() });
    ok(pk.ok && pk.host === '판돈갑' && pk.bet === 1200 && pk.mine === false, '판돈: 참가하기 전에 방장과 판돈을 미리 볼 수 있음');
    ok((await rpc('duel_peek', { ...A, code })).mine === true && (await rpc('duel_peek', { ...B, code: 'ZZZZ' })).error === 'no_room', '판돈: 내 방이면 mine, 없는 코드는 no_room');
    await setMoney(B.id, 500);
    r = await rpc('duel_join', { ...B, code });
    ok(r.error === 'no_money' && r.bet === 1200 && (await bal(B.id)) === 500 && (await drow(code)).status === 'waiting', '판돈: 소지금이 모자라면 참가할 수 없고 방은 그대로');
    await setMoney(B.id, 5000);
    r = await rpc('duel_join', { ...B, code });
    ok(r.ok && r.status === 'playing' && r.bet === 1200 && r.money === 3800 && (await bal(B.id)) === 3800, '판돈: 참가하는 순간 참가자의 판돈도 빠짐');
    ok((await rpc('duel_peek', { id: '판돈병', pin: P, code })).error === 'no_user', '판돈: 미리보기도 로그인 필요');

    // 방장 3:0 승리 → 방장이 판돈의 2배(2,400원)
    for (let i = 0; i < 10; i++) { r = await st(A, code); if (r.status === 'done') break; r = await play(code, i, i % 2 === 0); }
    ok(r.status === 'done' && r.winner === 'host', '판돈: 대결이 끝남(방장 승)');
    ok((await bal(A.id)) === 6200 && (await bal(B.id)) === 3800, '판돈: 이긴 방장은 2,400원을 받음(+1,200), 진 참가자는 판돈을 잃음(-1,200)');
    await st(A, code); await st(B, code); await rpc('duel_leave', { ...A, code }); await rpc('duel_create', { ...A });
    ok((await bal(A.id)) === 6200 && (await bal(B.id)) === 3800 && (await drow(code)).settled === true, '판돈: 정산은 딱 한 번만(상태 조회/나가기를 반복해도 돈이 다시 오가지 않음)');
    r = await st(A, code);
    ok(r.money === 6200 && r.bet === 1200, '판돈: 상태 응답에 내 소지금과 판돈이 들어 있음');
    await rpc('duel_leave', { ...A, code: (await rpc('duel_create', { ...A })).code });

    // 대결 중에 나가면 몰수패: 상대가 판돈을 모두 가져감
    r = await rpc('duel_create', { ...A, bet: 1000 }); const c2 = r.code;
    await rpc('duel_join', { ...B, code: c2 });
    ok((await bal(A.id)) === 5200 && (await bal(B.id)) === 2800, '판돈: 둘 다 1,000원씩 빠짐');
    r = await rpc('duel_leave', { ...B, code: c2 });
    ok(r.money === 2800 && (await bal(A.id)) === 7200 && (await bal(B.id)) === 2800, '판돈: 나간 사람은 몰수패, 남은 사람이 2,000원을 가져감');
    ok((await st(A, c2)).winner === 'host' && (await st(A, c2)).money === 7200, '판돈: 몰수 정산 뒤에도 값이 그대로');

    // 자리 비움(한 명): 남은 사람 승
    r = await rpc('duel_create', { ...A, bet: 500 }); const c3 = r.code;
    await rpc('duel_join', { ...B, code: c3 });
    await db.query(`update public.rk_duels set guest_seen = now() - interval '100 seconds' where code = $1`, [c3]);
    r = await st(A, c3);
    ok(r.winner === 'host' && (await bal(A.id)) === 7700 && (await bal(B.id)) === 2300, '판돈: 상대가 자리를 비우면 몰수승으로 판돈을 가져감');

    // 대기방 만료: 방장에게 환불
    r = await rpc('duel_create', { ...B, bet: 500 }); const c4 = r.code;
    ok((await bal(B.id)) === 1800, '판돈: 대기방을 만들면 판돈이 빠짐');
    await db.query(`update public.rk_duels set created_at = now() - interval '20 minutes' where code = $1`, [c4]);
    r = await st(B, c4);
    ok(r.status === 'done' && r.reason === 'expired' && (await bal(B.id)) === 2300, '판돈: 15분 넘게 기다려 만료된 방은 판돈을 돌려줌');
    await st(B, c4);
    ok((await bal(B.id)) === 2300, '판돈: 만료 환불도 한 번만');

    // 둘 다 사라짐 → 무승부, 각자 환불 (다음에 방을 만들 때 정리됨)
    r = await rpc('duel_create', { ...A, bet: 1000 }); const c5 = r.code;
    await rpc('duel_join', { ...B, code: c5 });
    ok((await bal(A.id)) === 6700 && (await bal(B.id)) === 1300, '판돈: 다시 1,000원씩 빠짐');
    await db.query(`update public.rk_duels set host_seen = now() - interval '200 seconds', guest_seen = now() - interval '200 seconds' where code = $1`, [c5]);
    r = await rpc('duel_create', { ...A });          // 지난 방부터 정리하고 새 방을 만든다
    ok((await drow(c5)).winner === 'draw' && (await bal(A.id)) === 7700 && (await bal(B.id)) === 2300, '판돈: 둘 다 사라진 방은 무승부로 각자 판돈을 돌려받음');
    await rpc('duel_leave', { ...A, code: r.code });

    // 정산은 돈이 새지 않는다: 두 사람의 합계는 처음 그대로(10,000원)
    ok((await bal(A.id)) + (await bal(B.id)) === 10000, '판돈: 정산이 끝나면 두 사람 소지금의 합계는 그대로(돈이 생기거나 사라지지 않음)');
    // 시즌이 바뀌어 소지금이 초기화된 뒤에는 옛 방을 정산하지 않는다
    r = await rpc('duel_create', { ...A, bet: 1000 }); const c6 = r.code;
    await rpc('duel_join', { ...B, code: c6 });
    await db.query(`update public.rk_users set season_key = '2099-01' where id in ($1, $2)`, [A.id, B.id]);
    const a0 = await bal(A.id), b0 = await bal(B.id);
    await rpc('duel_leave', { ...B, code: c6 });
    ok((await bal(A.id)) === a0 && (await bal(B.id)) === b0, '판돈: 시즌이 바뀐 뒤에는 옛 시즌 판돈을 정산하지 않음(새 시즌 소지금에 영향 없음)');
    await db.query(`update public.rk_users set season_key = $1 where id in ($2, $3)`, [SEASON, A.id, B.id]);
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
