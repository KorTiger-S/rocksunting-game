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
    'str',     public.rk_int(d->'str',     0, 100, 15),
    'stam',    public.rk_int(d->'stam',    0, 100, 15),
    'mood',    public.rk_int(d->'mood',    0, 100, 50),
    'cond',    public.rk_int(d->'cond',    0, 4,   1),
    'gymGap',  public.rk_int(d->'gymGap',  0, 999, 0),
    'bbqGap',  public.rk_int(d->'bbqGap',  0, 999, 0),
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
                            'str', 15, 'stam', 15, 'mood', 50, 'cond', 1, 'gymGap', 0, 'bbqGap', 0,
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

-- ---------- 1:1 페널티킥 대결 ----------
-- 피파 온라인 방식: 슈터는 골대 안에서 조준(ax, ay) + 파워 게이지(pw), 골키퍼는 다이브 칸(0~5)을 고른다.
-- 방 코드(4자리)로 친구를 초대하고, 번갈아 5번씩 차고 막는다. 선택은 서버가 둘 다 받은 뒤에 판정한다.
-- 판돈: 방장이 0~5,000원을 정한다. 방을 만들 때/참가할 때 각자의 소지금에서 미리 빠지고, 이긴 사람이 2배를 받는다.
--       무승부(둘 다 사라짐)와 대기방 만료/닫기는 판돈을 돌려주고, 나가거나 자리를 비우면 몰수패다. 정산은 딱 한 번만 한다(settled).
--   골대 좌표: ax = -1(왼쪽 골포스트) ~ 1(오른쪽 골포스트), ay = 0(바닥) ~ 1(크로스바). 밖으로 나가면 빗나감.
create table if not exists public.rk_duels (
  code       text primary key,
  host       text not null, host_name  text not null,
  guest      text,          guest_name text,
  status     text not null default 'waiting',      -- waiting | playing | done
  round      int  not null default 0,              -- 끝난 킥 수 (짝수=방장이 슛, 홀수=참가자가 슛)
  hg         int  not null default 0,
  gg         int  not null default 0,
  k_ax       double precision,                     -- 이번 킥: 슈터의 조준 위치와 파워(0~1)
  k_ay       double precision,
  k_pw       double precision,
  g_pick     smallint,                             -- 이번 킥: 골키퍼가 고른 칸(0~2 위쪽 · 3~5 아래쪽, 왼쪽→오른쪽)
  hist       jsonb not null default '[]'::jsonb,
  winner     text,                                 -- host | guest | draw
  reason     text,                                 -- score | left | expired
  round_at   timestamptz not null default now(),
  host_seen  timestamptz not null default now(),
  guest_seen timestamptz,
  bet        int  not null default 0,             -- 판돈(한 사람당)
  season_key text,                                -- 방을 만든 시즌 (시즌이 바뀌면 소지금이 초기화되므로 정산하지 않는다)
  settled    boolean not null default false,      -- 판돈 정산을 마쳤는지
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 예전 버전(칸 선택 방식)에서 올라온 경우를 위한 정리
alter table public.rk_duels add column if not exists k_ax double precision;
alter table public.rk_duels add column if not exists k_ay double precision;
alter table public.rk_duels add column if not exists k_pw double precision;
alter table public.rk_duels add column if not exists bet int not null default 0;
alter table public.rk_duels add column if not exists season_key text;
alter table public.rk_duels add column if not exists settled boolean not null default false;
alter table public.rk_duels drop column if exists k_pick;
drop function if exists public.rk_duel_shot(int, int);
alter table public.rk_duels enable row level security;
revoke all on public.rk_duels from anon, authenticated;

create or replace function public.rk_duel_user(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare k text := lower(public.rk_norm_id(p->>'id')); a text;
begin
  if k is null then return jsonb_build_object('ok', false, 'error', 'bad_id'); end if;
  if not public.rk_pin_ok(p->>'pin') then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
  a := public.rk_auth(k, p->>'pin');
  if a = 'none' then return jsonb_build_object('ok', false, 'error', 'no_user'); end if;
  if a <> 'ok' then return jsonb_build_object('ok', false, 'error', a); end if;
  return jsonb_build_object('ok', true, 'id', k);
end $$;

create or replace function public.rk_duel_gauss() returns double precision
language sql volatile as $$ select sqrt(-2 * ln(1 - random())) * cos(2 * pi() * random()) $$;

-- 슛 판정.
--   1) 파워가 초록 구간(0.8 근처)에서 벗어날수록 공이 조준에서 흔들린다. (오차 = 0.02 + 0.55 * |파워 - 0.8|)
--   2) 골대 밖이면 빗나감(miss), 골대 프레임(포스트/크로스바)을 맞으면 post — 둘 다 골이 아니다.
--   3) 골키퍼는 자기가 고른 칸 중심에서 일정 반경 안의 공을 막는다. 파워가 약할수록 반경이 넓어진다.
create or replace function public.rk_duel_shot(ax double precision, ay double precision, pw double precision, gp int) returns jsonb
language plpgsql volatile as $$
declare sd double precision := 0.02 + 0.55 * abs(pw - 0.8); fx double precision; fy double precision;
        zx double precision; zy double precision; reach double precision; r text;
begin
  fx := ax + sd * public.rk_duel_gauss();
  fy := greatest(0.02, ay + sd * 0.8 * public.rk_duel_gauss());
  if abs(fx) > 1.06 or fy > 1.08 then
    r := 'miss';
  elsif abs(fx) > 1 or fy > 1 then
    r := 'post';
  else
    zx := ((gp % 3) - 1) * 0.667;
    zy := case when gp < 3 then 0.75 else 0.25 end;
    reach := 0.44 + 0.3 * (1 - least(1, greatest(0, pw)));
    r := case when sqrt((fx - zx) ^ 2 + (1.5 * (fy - zy)) ^ 2) <= reach then 'saved' else 'goal' end;
  end if;
  return jsonb_build_object('r', r, 'fx', round(fx::numeric, 3), 'fy', round(fy::numeric, 3));
end $$;

-- 판돈 입출금(내부용). 시즌이 바뀌어 소지금이 초기화된 사람에게는 적용하지 않는다.
-- updated_at_ms를 올려서, 예전 소지금을 들고 있는 다른 기기가 덮어쓰지 못하고 이 값을 받아 가게 한다.
create or replace function public.rk_duel_pay(k text, delta int, sk text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if k is null or delta = 0 then return; end if;
  update public.rk_users set
    money = greatest(0, least(100000000, money + delta)),
    data = jsonb_set(data, '{money}', to_jsonb(greatest(0, least(100000000, money + delta)))),
    updated_at_ms = greatest(updated_at_ms + 1, (extract(epoch from now()) * 1000)::bigint),
    updated_at = now()
  where id = k and season_key is not distinct from sk;
end $$;

create or replace function public.rk_duel_json(d public.rk_duels, k text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me text := case when d.host = k then 'host' else 'guest' end;
        kicker text := case when d.round % 2 = 0 then 'host' else 'guest' end;
begin
  return jsonb_build_object('ok', true, 'code', d.code, 'status', d.status, 'me', me,
    'host', d.host_name, 'guest', d.guest_name, 'round', d.round, 'hg', d.hg, 'gg', d.gg,
    'role', case when kicker = me then 'kick' else 'keep' end,
    'mine', case when kicker = me then d.k_ax is not null else d.g_pick is not null end,
    'theirs', case when kicker = me then d.g_pick is not null else d.k_ax is not null end,
    'hist', d.hist, 'winner', d.winner, 'reason', d.reason,
    'bet', d.bet, 'money', (select money from public.rk_users where id = k),
    'left', greatest(0, ceil(extract(epoch from (d.round_at + interval '25 seconds' - now()))))::int);
end $$;

-- 접속 표시 + 시간 초과 처리(대기방 만료, 자리 비움 몰수패, 25초 넘으면 무작위 선택) + 판정
create or replace function public.rk_duel_settle(d0 public.rk_duels, k text) returns public.rk_duels
language plpgsql security definer set search_path = public as $$
declare d public.rk_duels := d0; kicker text; v jsonb; hl int; gl int; done boolean := false;
begin
  if k is not null and d.status <> 'done' then
    if d.host = k then d.host_seen := now(); elsif d.guest = k then d.guest_seen := now(); end if;
  end if;
  if d.status = 'waiting' and d.created_at < now() - interval '15 minutes' then
    d.status := 'done'; d.winner := 'draw'; d.reason := 'expired';
  elsif d.status = 'playing' then
    if d.host_seen < now() - interval '90 seconds' and d.guest_seen < now() - interval '90 seconds' then
      d.status := 'done'; d.winner := 'draw'; d.reason := 'left';       -- 둘 다 사라졌으면 판돈은 돌려준다
    elsif d.host_seen < now() - interval '90 seconds' then
      d.status := 'done'; d.winner := 'guest'; d.reason := 'left';
    elsif d.guest_seen < now() - interval '90 seconds' then
      d.status := 'done'; d.winner := 'host'; d.reason := 'left';
    elsif now() > d.round_at + interval '25 seconds' then
      if d.k_ax is null then
        d.k_ax := random() * 1.6 - 0.8; d.k_ay := 0.15 + random() * 0.7; d.k_pw := 0.7;
      end if;
      d.g_pick := coalesce(d.g_pick, floor(random() * 6)::int);
    end if;
  end if;
  if d.status = 'playing' and d.k_ax is not null and d.g_pick is not null then
    kicker := case when d.round % 2 = 0 then 'host' else 'guest' end;
    v := public.rk_duel_shot(d.k_ax, d.k_ay, d.k_pw, d.g_pick);
    d.hist := d.hist || jsonb_build_array(jsonb_build_object('k', kicker,
      'ax', round(d.k_ax::numeric, 3), 'ay', round(d.k_ay::numeric, 3), 'pw', round(d.k_pw::numeric, 3),
      'fx', v->'fx', 'fy', v->'fy', 'gp', d.g_pick, 'r', v->>'r'));
    if v->>'r' = 'goal' then
      if kicker = 'host' then d.hg := d.hg + 1; else d.gg := d.gg + 1; end if;
    end if;
    d.round := d.round + 1; d.k_ax := null; d.k_ay := null; d.k_pw := null; d.g_pick := null; d.round_at := now();
    if d.round < 10 then
      hl := 5 - (d.round + 1) / 2; gl := 5 - d.round / 2;      -- 남은 킥 수
      done := d.hg > d.gg + gl or d.gg > d.hg + hl;
    else
      done := (d.round % 2 = 0 and d.hg <> d.gg) or d.round >= 40;   -- 서든데스: 한 쌍이 끝났을 때 앞서 있으면 끝
    end if;
    if done then
      d.status := 'done'; d.reason := 'score';
      d.winner := case when d.hg > d.gg then 'host' when d.gg > d.hg then 'guest' else 'draw' end;
    end if;
  end if;
  -- 판돈 정산(딱 한 번): 이긴 사람이 2배, 무승부/만료는 각자 돌려받는다
  if d.status = 'done' and not d.settled then
    d.settled := true;
    if d.bet > 0 then
      if d.winner = 'host' then perform public.rk_duel_pay(d.host, 2 * d.bet, d.season_key);
      elsif d.winner = 'guest' then perform public.rk_duel_pay(d.guest, 2 * d.bet, d.season_key);
      else perform public.rk_duel_pay(d.host, d.bet, d.season_key); perform public.rk_duel_pay(d.guest, d.bet, d.season_key);
      end if;
    end if;
  end if;
  update public.rk_duels set status = d.status, round = d.round, hg = d.hg, gg = d.gg,
    k_ax = d.k_ax, k_ay = d.k_ay, k_pw = d.k_pw, g_pick = d.g_pick,
    hist = d.hist, winner = d.winner, reason = d.reason, round_at = d.round_at,
    host_seen = d.host_seen, guest_seen = d.guest_seen, settled = d.settled, updated_at = now()
  where code = d.code;
  return d;
end $$;

-- 이 사람이 참여 중인 방 코드(시간 초과된 방은 정리하고 건너뜀). 없으면 null
create or replace function public.rk_duel_active(k text) returns text
language plpgsql security definer set search_path = public as $$
declare d public.rk_duels; res text;
begin
  for d in select * from public.rk_duels where status in ('waiting', 'playing') and (host = k or guest = k) order by created_at desc for update loop
    d := public.rk_duel_settle(d, null);
    if d.status in ('waiting', 'playing') and res is null then res := d.code; end if;
  end loop;
  return res;
end $$;

create or replace function public.rk_duel_create(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb := public.rk_duel_user(p); k text; nm text; m int; d public.rk_duels; c text; i int := 0; n int := 0; act text;
  bet int := 0; sk text := public.rk_season_json()->>'key';
  alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if not (u->>'ok')::boolean then return u; end if;
  k := u->>'id';
  if coalesce(p->>'bet', '') ~ '^[0-9]{1,6}$' then bet := least(5000, (p->>'bet')::int / 100 * 100); end if;   -- 판돈: 0~5,000원 (100원 단위)
  -- 오래된 방 정리: 아직 정산하지 않은 방은 먼저 정산(환불/몰수)한 뒤에 지운다
  for d in select * from public.rk_duels where updated_at < now() - interval '2 days' and not settled and status in ('waiting', 'playing') for update loop
    perform public.rk_duel_settle(d, null);
  end loop;
  delete from public.rk_duels where updated_at < now() - interval '2 days' and status = 'done';
  act := public.rk_duel_active(k);
  if act is not null then                                -- 이미 참여 중인 방으로 돌아간다
    select * into d from public.rk_duels where code = act for update;
    d := public.rk_duel_settle(d, k);
    return public.rk_duel_json(d, k);
  end if;
  select name, money into nm, m from public.rk_users where id = k for update;
  if bet > m then return jsonb_build_object('ok', false, 'error', 'no_money'); end if;
  loop
    i := i + 1; c := '';
    for j in 1..4 loop c := c || substr(alpha, 1 + floor(random() * 32)::int, 1); end loop;
    insert into public.rk_duels (code, host, host_name, bet, season_key) values (c, k, nm, bet, sk) on conflict (code) do nothing;
    get diagnostics n = row_count;
    exit when n = 1 or i >= 10;
  end loop;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'busy'); end if;
  if bet > 0 then perform public.rk_duel_pay(k, -bet, sk); end if;     -- 판돈은 방을 만드는 순간 소지금에서 빠진다
  select * into d from public.rk_duels where code = c;
  return public.rk_duel_json(d, k);
end $$;

-- 참가하기 전에 방 정보(방장, 판돈)를 미리 본다
create or replace function public.rk_duel_peek(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb := public.rk_duel_user(p); k text; d public.rk_duels;
begin
  if not (u->>'ok')::boolean then return u; end if;
  k := u->>'id';
  select * into d from public.rk_duels where code = upper(btrim(coalesce(p->>'code', '')));
  if not found then return jsonb_build_object('ok', false, 'error', 'no_room'); end if;
  if d.host = k or d.guest = k then
    return jsonb_build_object('ok', true, 'host', d.host_name, 'bet', d.bet, 'mine', true);
  end if;
  if d.status <> 'waiting' then return jsonb_build_object('ok', false, 'error', case when d.status = 'playing' then 'full' else 'closed' end); end if;
  return jsonb_build_object('ok', true, 'host', d.host_name, 'bet', d.bet, 'mine', false);
end $$;

create or replace function public.rk_duel_join(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb := public.rk_duel_user(p); k text; nm text; m int; d public.rk_duels; c text := upper(btrim(coalesce(p->>'code', ''))); act text;
begin
  if not (u->>'ok')::boolean then return u; end if;
  k := u->>'id';
  act := public.rk_duel_active(k);
  if act is not null and act <> c then return jsonb_build_object('ok', false, 'error', 'busy', 'code', act); end if;
  select * into d from public.rk_duels where code = c for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_room'); end if;
  d := public.rk_duel_settle(d, null);
  if d.host = k or d.guest = k then
    d := public.rk_duel_settle(d, k);
    return public.rk_duel_json(d, k);
  end if;
  if d.status <> 'waiting' then return jsonb_build_object('ok', false, 'error', case when d.status = 'playing' then 'full' else 'closed' end); end if;
  if d.bet > 0 and d.season_key is distinct from public.rk_season_json()->>'key' then    -- 시즌이 바뀐 방은 판돈을 정산할 수 없다
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  select name, money into nm, m from public.rk_users where id = k for update;
  if m < d.bet then return jsonb_build_object('ok', false, 'error', 'no_money', 'bet', d.bet); end if;
  update public.rk_duels set guest = k, guest_name = nm, guest_seen = now(), status = 'playing', round_at = now(), updated_at = now()
  where code = c returning * into d;
  if d.bet > 0 then perform public.rk_duel_pay(k, -d.bet, d.season_key); end if;   -- 참가자의 판돈도 이 순간 빠진다
  return public.rk_duel_json(d, k);
end $$;

create or replace function public.rk_duel_state(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb := public.rk_duel_user(p); k text; d public.rk_duels;
begin
  if not (u->>'ok')::boolean then return u; end if;
  k := u->>'id';
  select * into d from public.rk_duels where code = upper(btrim(coalesce(p->>'code', ''))) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_room'); end if;
  if d.host <> k and d.guest is distinct from k then return jsonb_build_object('ok', false, 'error', 'not_member'); end if;
  d := public.rk_duel_settle(d, k);
  return public.rk_duel_json(d, k);
end $$;

-- 선택 제출. 슈터: {round, ax, ay, pw}  /  골키퍼: {round, pick}
create or replace function public.rk_duel_pick(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb := public.rk_duel_user(p); k text; d public.rk_duels; kicker text; me text;
  num text := '^-?[0-9]{1,3}(\.[0-9]{1,6})?$'; ax double precision; ay double precision; pw double precision;
begin
  if not (u->>'ok')::boolean then return u; end if;
  k := u->>'id';
  select * into d from public.rk_duels where code = upper(btrim(coalesce(p->>'code', ''))) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_room'); end if;
  if d.host <> k and d.guest is distinct from k then return jsonb_build_object('ok', false, 'error', 'not_member'); end if;
  d := public.rk_duel_settle(d, k);
  -- 이미 끝난 킥에 대한 늦은 선택은 무시하고 현재 상태만 돌려준다
  if d.status <> 'playing' or coalesce(p->>'round', '') !~ '^[0-9]{1,3}$' or (p->>'round')::int <> d.round then
    return public.rk_duel_json(d, k);
  end if;
  kicker := case when d.round % 2 = 0 then 'host' else 'guest' end;
  me := case when d.host = k then 'host' else 'guest' end;
  if kicker = me then
    if coalesce(p->>'ax', '') !~ num or coalesce(p->>'ay', '') !~ num or coalesce(p->>'pw', '') !~ num then
      return jsonb_build_object('ok', false, 'error', 'bad_pick');
    end if;
    ax := greatest(-1.3, least(1.3, (p->>'ax')::double precision));
    ay := greatest(0, least(1.3, (p->>'ay')::double precision));
    pw := greatest(0, least(1, (p->>'pw')::double precision));
    -- 이미 제출했다면 바꾸지 않는다 (UPDATE의 우변은 모두 갱신 전 값을 본다)
    update public.rk_duels set k_ax = case when k_ax is null then ax else k_ax end,
                               k_ay = case when k_ax is null then ay else k_ay end,
                               k_pw = case when k_ax is null then pw else k_pw end
    where code = d.code;
  else
    if coalesce(p->>'pick', '') !~ '^[0-5]$' then return jsonb_build_object('ok', false, 'error', 'bad_pick'); end if;
    update public.rk_duels set g_pick = coalesce(g_pick, (p->>'pick')::int) where code = d.code;
  end if;
  select * into d from public.rk_duels where code = d.code;
  d := public.rk_duel_settle(d, k);
  return public.rk_duel_json(d, k);
end $$;

create or replace function public.rk_duel_leave(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb := public.rk_duel_user(p); k text; d public.rk_duels; m int;
begin
  if not (u->>'ok')::boolean then return u; end if;
  k := u->>'id';
  select * into d from public.rk_duels where code = upper(btrim(coalesce(p->>'code', ''))) for update;
  if not found then return jsonb_build_object('ok', true); end if;
  if d.host <> k and d.guest is distinct from k then return jsonb_build_object('ok', false, 'error', 'not_member'); end if;
  if d.status = 'waiting' then                            -- 아무도 안 들어온 방을 닫으면 판돈을 돌려받는다
    if d.bet > 0 then perform public.rk_duel_pay(d.host, d.bet, d.season_key); end if;
    delete from public.rk_duels where code = d.code;
  elsif d.status = 'playing' then                         -- 대결 중에 나가면 몰수패: 상대가 판돈을 모두 가져간다
    d.status := 'done'; d.winner := case when d.host = k then 'guest' else 'host' end; d.reason := 'left';
    d := public.rk_duel_settle(d, null);
  end if;
  select money into m from public.rk_users where id = k;
  return jsonb_build_object('ok', true, 'money', m);
end $$;

-- 브라우저(anon)는 아래 함수만 실행할 수 있다. 내부 도우미와 시즌 마감 함수는 막아 둔다.
revoke all on function public.rk_auth(text, text), public.rk_season_json(), public.rk_default_data() from public, anon, authenticated;
revoke all on function public.rk_duel_user(jsonb), public.rk_duel_shot(double precision, double precision, double precision, int), public.rk_duel_gauss(), public.rk_duel_json(public.rk_duels, text),
                       public.rk_duel_settle(public.rk_duels, text), public.rk_duel_active(text), public.rk_duel_pay(text, int, text) from public, anon, authenticated;
revoke all on function public.rk_ping(jsonb), public.rk_load(jsonb), public.rk_save(jsonb),
                       public.rk_score(jsonb), public.rk_top(jsonb), public.rk_season_get(jsonb),
                       public.rk_close_season(jsonb), public.rk_season_report(jsonb), public.rk_set_season_end(date),
                       public.rk_duel_create(jsonb), public.rk_duel_join(jsonb), public.rk_duel_state(jsonb),
                       public.rk_duel_pick(jsonb), public.rk_duel_leave(jsonb), public.rk_duel_peek(jsonb) from public;
revoke all on function public.rk_close_season(jsonb), public.rk_season_report(jsonb), public.rk_set_season_end(date) from anon, authenticated;
grant execute on function public.rk_ping(jsonb), public.rk_load(jsonb), public.rk_save(jsonb),
                          public.rk_score(jsonb), public.rk_top(jsonb), public.rk_season_get(jsonb),
                          public.rk_duel_create(jsonb), public.rk_duel_join(jsonb), public.rk_duel_state(jsonb),
                          public.rk_duel_pick(jsonb), public.rk_duel_leave(jsonb), public.rk_duel_peek(jsonb)
  to anon, authenticated;
grant execute on function public.rk_close_season(jsonb), public.rk_season_report(jsonb) to service_role;
