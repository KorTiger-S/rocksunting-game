-- 롹순팅 키우기 백엔드 (Supabase / PostgreSQL)
--
-- [설치 방법]
-- 1. https://supabase.com 에서 새 프로젝트를 만든다.
-- 2. 왼쪽 메뉴 SQL Editor 에 이 파일 내용을 전부 붙여넣고 Run.
-- 3. Project Settings > API 에서 "Project URL"과 "anon(public) key"(또는 publishable key)를 복사한다.
-- 4. 게임의 [클라우드 연결 설정]에 두 값을 붙여넣는다. (README 참고)
--
-- 보안 구조
--   - 테이블은 RLS로 잠겨 있어서 브라우저(anon)가 직접 읽거나 쓸 수 없다.
--   - 브라우저는 아래 rk_* 함수(RPC)로만 접근하고, 함수 안에서 ID/비밀번호를 검증한다.
--   - 비밀번호(숫자 4자리)는 bcrypt 해시로만 저장한다.
--   - 같은 ID로 비밀번호를 5번 틀리면 5분간 잠긴다.
-- 이 파일은 여러 번 실행해도 안전하다(함수는 덮어쓰고, 테이블은 있으면 그대로 둔다).

create extension if not exists pgcrypto with schema extensions;

-- ---------- 테이블 ----------
create table if not exists public.rk_users (
  id            text primary key,            -- 소문자로 통일한 ID
  name          text not null,               -- 처음 등록한 표시용 ID(대소문자 유지)
  pin_hash      text not null,
  money         int  not null default 0,
  wins          int  not null default 0,
  losses        int  not null default 0,
  best_pts      int  not null default 0,
  week          int  not null default 1,
  cleared       boolean not null default false,
  data          jsonb not null,              -- 저장 데이터 전체
  updated_at_ms bigint not null default 0,   -- 기기 간 충돌 판단용(클라이언트 시각)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.rk_matches (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id    text not null,
  bet        int not null default 0,
  goals      int not null default 0,
  pts        int not null default 0,
  result     text not null default '',
  money      int not null default 0,
  week       int not null default 1
);

create table if not exists public.rk_attempts (
  user_id      text primary key,
  fails        int not null default 0,
  locked_until timestamptz
);

-- ---------- 시즌 ----------
-- rk_config 'season' : 지금 진행 중인 시즌. 이 값은 스키마를 다시 실행해도 덮어쓰지 않는다.
create table if not exists public.rk_config (
  key   text primary key,
  value jsonb not null
);
-- 마감된 시즌의 랭킹 스냅샷(운영자 보고서의 원본)
create table if not exists public.rk_seasons (
  season_key   text primary key,
  number       int  not null,
  game         text not null,
  game_name    text not null,
  started_at   timestamptz,
  ended_at     timestamptz not null,
  closed_at    timestamptz not null default now(),
  player_count int  not null default 0,
  match_count  int  not null default 0,
  snapshot     jsonb not null
);

alter table public.rk_users   add column if not exists season_key text;                       -- 이 기록이 속한 시즌
alter table public.rk_matches add column if not exists season_key text;
-- 게임 안의 운영자 기능은 없다. (이전 버전에서 만든 흔적이 있으면 정리)
alter table public.rk_users drop column if exists is_admin;
drop function if exists public.rk_season_set(jsonb);

insert into public.rk_config (key, value) values ('season', jsonb_build_object(
  'key', '2026-09', 'number', 1, 'game', 'football', 'game_name', '프리킥 축구',
  'started_at', '2026-08-31T15:00:00Z',     -- 2026-09-01 00:00 KST
  'ends_at',    '2026-09-30T15:00:00Z'))    -- 2026-10-01 00:00 KST (= 9월 30일까지 진행)
on conflict (key) do nothing;
update public.rk_users   set season_key = (select value->>'key' from public.rk_config where key = 'season') where season_key is null;
update public.rk_matches set season_key = (select value->>'key' from public.rk_config where key = 'season') where season_key is null;

create index if not exists rk_users_money_idx   on public.rk_users (money desc);
create index if not exists rk_users_wins_idx    on public.rk_users (wins desc);
create index if not exists rk_users_bestpts_idx on public.rk_users (best_pts desc);

alter table public.rk_users    enable row level security;
alter table public.rk_matches  enable row level security;
alter table public.rk_attempts enable row level security;
alter table public.rk_config   enable row level security;
alter table public.rk_seasons  enable row level security;
-- 정책(policy)을 만들지 않으므로 anon/authenticated 는 테이블에 직접 접근할 수 없다.
revoke all on public.rk_users, public.rk_matches, public.rk_attempts, public.rk_config, public.rk_seasons from anon, authenticated;

-- ---------- 내부 도우미 ----------
create or replace function public.rk_norm_id(t text) returns text
language plpgsql immutable as $$
declare s text := normalize(btrim(coalesce(t, '')), NFC);
begin
  if s ~ '^[0-9A-Za-z_가-힣ㄱ-ㅎㅏ-ㅣ]{2,12}$' and lower(s) not in ('guest', '게스트') then return s; end if;   -- guest는 예약어
  return null;
end $$;

create or replace function public.rk_pin_ok(t text) returns boolean
language sql immutable as $$ select coalesce(t ~ '^[0-9]{4}$', false) $$;

-- 숫자를 범위 안으로 보정한다. 숫자가 아니면 기본값.
create or replace function public.rk_int(v jsonb, lo int, hi int, dflt int) returns int
language plpgsql immutable as $$
declare n numeric;
begin
  begin n := (v #>> '{}')::numeric; exception when others then return dflt; end;
  if n is null or n in ('NaN', 'Infinity', '-Infinity') then return dflt; end if;
  return greatest(lo, least(hi, floor(n)))::int;
end $$;

-- 저장 데이터에서 허용된 항목만 남기고 값 범위를 보정한다.
create or replace function public.rk_clean(d jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'money',   public.rk_int(d->'money',   0, 100000000, 0),
    'day',     public.rk_int(d->'day',     0, 4, 0),
    'week',    public.rk_int(d->'week',    1, 9999, 1),
    'fatigue', public.rk_int(d->'fatigue', 0, 3, 0),
    'hosp',    public.rk_int(d->'hosp',    0, 9999, 0),
    'wins',    public.rk_int(d->'wins',    0, 99999, 0),
    'losses',  public.rk_int(d->'losses',  0, 99999, 0),
    'bestPts', public.rk_int(d->'bestPts', 0, 99999, 0),
    'plays',   public.rk_int(d->'plays',   0, 99999, 0),
    'cleared', coalesce((d->>'cleared') = 'true', false),
    'up', jsonb_build_object(
      'shoes', public.rk_int(d#>'{up,shoes}', 0, 3, 0),
      'snack', public.rk_int(d#>'{up,snack}', 0, 3, 0),
      'sneak', public.rk_int(d#>'{up,sneak}', 0, 1, 0)))
$$;

-- 비밀번호 확인 + 실패 횟수 관리. 'none' | 'ok' | 'bad_pin' | 'locked'
create or replace function public.rk_auth(p_key text, p_pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare u public.rk_users%rowtype; a public.rk_attempts%rowtype;
begin
  select * into u from public.rk_users where id = p_key;
  if not found then return 'none'; end if;
  select * into a from public.rk_attempts where user_id = p_key;
  if found and a.locked_until is not null and a.locked_until > now() then return 'locked'; end if;
  if u.pin_hash = crypt(p_pin, u.pin_hash) then
    delete from public.rk_attempts where user_id = p_key;
    return 'ok';
  end if;
  insert into public.rk_attempts (user_id, fails) values (p_key, 1)
  on conflict (user_id) do update set
    locked_until = case when public.rk_attempts.fails + 1 >= 5 then now() + interval '5 minutes' else null end,
    fails        = case when public.rk_attempts.fails + 1 >= 5 then 0 else public.rk_attempts.fails + 1 end;
  return 'bad_pin';
end $$;

-- 지금 진행 중인 시즌 정보
create or replace function public.rk_season_json() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('key', value->>'key', 'number', (value->>'number')::int, 'game', value->>'game',
                            'gameName', value->>'game_name', 'startedAt', value->>'started_at', 'endsAt', value->>'ends_at')
  from public.rk_config where key = 'season'
$$;

-- 시즌 마감 때 되돌아가는 초기 저장 데이터 (클라이언트의 DEF()와 같은 값)
create or replace function public.rk_default_data() returns jsonb
language sql immutable as $$
  select jsonb_build_object('fatigue', 0, 'hosp', 0, 'bestPts', 0, 'plays', 0, 'money', 10000, 'day', 0, 'week', 1,
                            'wins', 0, 'losses', 0, 'cleared', false,
                            'up', jsonb_build_object('shoes', 0, 'snack', 0, 'sneak', 0))
$$;

-- ---------- 게임이 호출하는 함수 (매개변수는 jsonb 하나: {"p": {...}}) ----------
create or replace function public.rk_ping(p jsonb default '{}') returns jsonb
language sql immutable as $$ select jsonb_build_object('ok', true, 'version', '2.0') $$;

create or replace function public.rk_load(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare k text := lower(public.rk_norm_id(p->>'id')); a text; u public.rk_users%rowtype;
begin
  if k is null then return jsonb_build_object('ok', false, 'error', 'bad_id'); end if;
  if not public.rk_pin_ok(p->>'pin') then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
  a := public.rk_auth(k, p->>'pin');
  if a = 'none' then return jsonb_build_object('ok', true, 'exists', false, 'current', public.rk_season_json()); end if;
  if a <> 'ok' then return jsonb_build_object('ok', false, 'error', a); end if;
  select * into u from public.rk_users where id = k;
  return jsonb_build_object('ok', true, 'exists', true, 'name', u.name, 'updatedAt', u.updated_at_ms, 'data', u.data,
                            'season', u.season_key, 'current', public.rk_season_json());
end $$;

create or replace function public.rk_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  nm text := public.rk_norm_id(p->>'id'); k text := lower(nm); a text;
  d jsonb := public.rk_clean(p->'data'); u public.rk_users%rowtype; n int;
  cur text := public.rk_season_json()->>'key';
  at bigint := coalesce(case when p->>'updatedAt' ~ '^[0-9]{1,15}$' then (p->>'updatedAt')::bigint end,
                        (extract(epoch from now()) * 1000)::bigint);
begin
  if k is null then return jsonb_build_object('ok', false, 'error', 'bad_id'); end if;
  if not public.rk_pin_ok(p->>'pin') then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
  a := public.rk_auth(k, p->>'pin');
  if a in ('bad_pin', 'locked') then return jsonb_build_object('ok', false, 'error', a); end if;

  if a = 'none' then                                   -- 새 ID: 이때 받은 비밀번호로 등록
    insert into public.rk_users (id, name, pin_hash, money, wins, losses, best_pts, week, cleared, data, updated_at_ms, season_key)
    values (k, nm, crypt(p->>'pin', gen_salt('bf')), (d->>'money')::int, (d->>'wins')::int, (d->>'losses')::int,
            (d->>'bestPts')::int, (d->>'week')::int, (d->>'cleared')::boolean, d, at, cur)
    on conflict (id) do nothing;
    get diagnostics n = row_count;
    if n = 0 then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;   -- 동시에 같은 ID가 만들어진 경우
    return jsonb_build_object('ok', true, 'created', true, 'updatedAt', at, 'season', cur);
  end if;

  select * into u from public.rk_users where id = k for update;
  -- 다른 기기에서 더 최근에 저장됐거나, 시즌이 바뀐 뒤 예전 시즌 기록을 보내온 경우 → 서버 기록을 돌려준다
  if u.updated_at_ms > at or u.season_key is distinct from (p->>'season') then
    return jsonb_build_object('ok', true, 'conflict', true, 'name', u.name, 'updatedAt', u.updated_at_ms, 'data', u.data, 'season', u.season_key);
  end if;
  update public.rk_users set
    money = (d->>'money')::int, wins = (d->>'wins')::int, losses = (d->>'losses')::int,
    best_pts = (d->>'bestPts')::int, week = (d->>'week')::int, cleared = (d->>'cleared')::boolean,
    data = d, updated_at_ms = at, updated_at = now()
  where id = k;
  return jsonb_build_object('ok', true, 'updatedAt', at, 'season', u.season_key);
end $$;

create or replace function public.rk_score(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare k text := lower(public.rk_norm_id(p->>'id')); a text;
begin
  if k is null then return jsonb_build_object('ok', false, 'error', 'bad_id'); end if;
  if not public.rk_pin_ok(p->>'pin') then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
  a := public.rk_auth(k, p->>'pin');
  if a = 'none' then return jsonb_build_object('ok', false, 'error', 'no_user'); end if;
  if a <> 'ok' then return jsonb_build_object('ok', false, 'error', a); end if;
  insert into public.rk_matches (user_id, season_key, bet, goals, pts, result, money, week) values (
    k, public.rk_season_json()->>'key', public.rk_int(p->'bet', 0, 100000, 0), public.rk_int(p->'goals', 0, 5, 0), public.rk_int(p->'pts', 0, 99999, 0),
    left(coalesce(p->>'result', ''), 10), public.rk_int(p->'money', 0, 100000000, 0), public.rk_int(p->'week', 1, 9999, 1));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.rk_top(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m text := coalesce(p->>'metric', 'money'); n int := public.rk_int(p->'limit', 1, 30, 10); res jsonb;
begin
  select jsonb_build_object('ok', true, 'total', (select count(*) from public.rk_users),
                            'list', coalesce(jsonb_agg(to_jsonb(t) order by t.v desc, t.at asc), '[]'::jsonb))
  into res from (
    select name as id, money, wins, losses, best_pts as "bestPts", week, cleared, updated_at_ms as at,
           case m when 'wins' then wins when 'bestPts' then best_pts else money end as v
    from public.rk_users
    order by 9 desc, updated_at_ms asc
    limit n) t;
  return res;
end $$;

-- ---------- 시즌 ----------
create or replace function public.rk_season_get(p jsonb default '{}') returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'season', public.rk_season_json())
$$;

-- 운영자용: 시즌 마감일 변경. Supabase 대시보드 SQL Editor(또는 service_role)에서만 실행할 수 있다.
--   select public.rk_set_season_end('2026-09-30');
-- → 그 날 밤 12시(한국 시간)까지 진행하고 다음 날 0시에 마감된다. 오늘보다 이전 날짜는 거부한다.
create or replace function public.rk_set_season_end(d date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ends timestamptz;
begin
  if d is null or d < (now() at time zone 'Asia/Seoul')::date then
    raise exception '오늘(한국 시간)보다 이전 날짜로는 바꿀 수 없어요: %', d;
  end if;
  ends := ((d + 1)::timestamp at time zone 'Asia/Seoul');
  update public.rk_config set value = jsonb_set(value, '{ends_at}', to_jsonb(to_char(ends at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))
  where key = 'season';
  return public.rk_season_json();
end $$;

-- 시즌 마감(자동화 전용: GitHub Actions가 service_role 키로 매일 호출). 마감일 전이면 아무 것도 하지 않는다.
-- 마감 시: 랭킹 스냅샷을 rk_seasons에 저장 → 모든 플레이어 기록 초기화 → 다음 시즌 시작.
create or replace function public.rk_close_season(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  cfg jsonb; ends timestamptz; players jsonb; mc int; nxt_key text; nxt_ends timestamptz; i int := 1; nowms bigint;
begin
  select value into cfg from public.rk_config where key = 'season' for update;
  ends := (cfg->>'ends_at')::timestamptz;
  if now() < ends then return jsonb_build_object('ok', true, 'closed', false, 'endsAt', cfg->>'ends_at'); end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', name, 'money', money, 'wins', wins, 'losses', losses,
           'bestPts', best_pts, 'week', week, 'cleared', cleared, 'plays', coalesce((data->>'plays')::int, 0))
           order by money desc, wins desc, updated_at_ms asc), '[]'::jsonb)
    into players from public.rk_users where season_key = cfg->>'key';
  select count(*) into mc from public.rk_matches where season_key = cfg->>'key';

  insert into public.rk_seasons (season_key, number, game, game_name, started_at, ended_at, player_count, match_count, snapshot)
  values (cfg->>'key', (cfg->>'number')::int, cfg->>'game', cfg->>'game_name', (cfg->>'started_at')::timestamptz, ends,
          jsonb_array_length(players), mc,
          jsonb_build_object('players', players, 'matchCount', mc));

  -- 다음 시즌: 마감 시각이 속한 달(한국 시간)의 이름. 이미 쓴 이름이면 -2, -3 … 을 붙인다.
  nxt_key := to_char(ends at time zone 'Asia/Seoul', 'YYYY-MM');
  while exists (select 1 from public.rk_seasons where season_key = nxt_key) or nxt_key = cfg->>'key' loop
    i := i + 1; nxt_key := to_char(ends at time zone 'Asia/Seoul', 'YYYY-MM') || '-' || i;
  end loop;
  nxt_ends := (date_trunc('month', ends at time zone 'Asia/Seoul') + interval '1 month') at time zone 'Asia/Seoul';
  if nxt_ends <= now() then nxt_ends := (date_trunc('month', now() at time zone 'Asia/Seoul') + interval '1 month') at time zone 'Asia/Seoul'; end if;

  update public.rk_config set value = jsonb_build_object('key', nxt_key, 'number', (cfg->>'number')::int + 1,
      'game', cfg->>'game', 'game_name', cfg->>'game_name',
      'started_at', to_char(ends at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'ends_at', to_char(nxt_ends at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
  where key = 'season';

  nowms := (extract(epoch from now()) * 1000)::bigint;
  update public.rk_users set money = 10000, wins = 0, losses = 0, best_pts = 0, week = 1, cleared = false,
    data = public.rk_default_data(), season_key = nxt_key, updated_at_ms = nowms, updated_at = now();

  return jsonb_build_object('ok', true, 'closed', true,
    'season', jsonb_build_object('key', cfg->>'key', 'number', (cfg->>'number')::int, 'game', cfg->>'game', 'gameName', cfg->>'game_name',
                                 'startedAt', cfg->>'started_at', 'endedAt', to_char(ends at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    'players', players, 'matchCount', mc, 'next', public.rk_season_json());
end $$;

-- 마감된 시즌의 보고서 원본 다시 가져오기(자동화 전용)
create or replace function public.rk_season_report(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.rk_seasons%rowtype;
begin
  select * into r from public.rk_seasons where season_key = p->>'key';
  if not found then return jsonb_build_object('ok', false, 'error', 'no_season'); end if;
  return jsonb_build_object('ok', true, 'season', jsonb_build_object('key', r.season_key, 'number', r.number, 'game', r.game,
      'gameName', r.game_name, 'startedAt', r.started_at, 'endedAt', r.ended_at),
    'players', r.snapshot->'players', 'matchCount', r.match_count);
end $$;

-- 브라우저(anon)는 아래 함수만 실행할 수 있다. 내부 도우미와 시즌 마감 함수는 막아 둔다.
revoke all on function public.rk_auth(text, text), public.rk_season_json(), public.rk_default_data() from public, anon, authenticated;
revoke all on function public.rk_ping(jsonb), public.rk_load(jsonb), public.rk_save(jsonb),
                       public.rk_score(jsonb), public.rk_top(jsonb), public.rk_season_get(jsonb),
                       public.rk_close_season(jsonb), public.rk_season_report(jsonb), public.rk_set_season_end(date) from public;
revoke all on function public.rk_close_season(jsonb), public.rk_season_report(jsonb), public.rk_set_season_end(date) from anon, authenticated;
grant execute on function public.rk_ping(jsonb), public.rk_load(jsonb), public.rk_save(jsonb),
                          public.rk_score(jsonb), public.rk_top(jsonb), public.rk_season_get(jsonb)
  to anon, authenticated;
grant execute on function public.rk_close_season(jsonb), public.rk_season_report(jsonb) to service_role;
