// backend/schema.sql 로직 테스트 (PGlite = Node 안에서 도는 PostgreSQL, 계정/설치 불필요)
const fs = require('fs'), path = require('path');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const db = new PGlite({ extensions: { pgcrypto } });
  // Supabase에는 기본으로 있는 것들
  await db.exec('create schema extensions; create role anon; create role authenticated;');
  await db.exec(fs.readFileSync(path.join(__dirname, '../backend/schema.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '../backend/schema.sql'), 'utf8'));   // 다시 실행해도 안전한지
  ok(true, 'schema.sql 두 번 실행해도 오류 없음');

  const rpc = async (fn, p) => (await db.query(`select public.rk_${fn}($1::jsonb) as r`, [JSON.stringify(p || {})])).rows[0].r;
  const P = '1234';
  const save = (id, at, data, pin = P) => rpc('save', { id, pin, updatedAt: at, data });
  const load = (id, pin = P) => rpc('load', { id, pin });

  ok((await rpc('ping')).ok, 'ping');
  ok((await load('a')).error === 'bad_id', '짧은 ID 거부');
  ok((await load('홍 길동')).error === 'bad_id', '공백 ID 거부');
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
