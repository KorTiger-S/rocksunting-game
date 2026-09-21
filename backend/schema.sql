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

create index if not exists rk_users_money_idx   on public.rk_users (money desc);
create index if not exists rk_users_wins_idx    on public.rk_users (wins desc);
create index if not exists rk_users_bestpts_idx on public.rk_users (best_pts desc);

alter table public.rk_users    enable row level security;
alter table public.rk_matches  enable row level security;
alter table public.rk_attempts enable row level security;
-- 정책(policy)을 만들지 않으므로 anon/authenticated 는 테이블에 직접 접근할 수 없다.
revoke all on public.rk_users, public.rk_matches, public.rk_attempts from anon, authenticated;

-- ---------- 내부 도우미 ----------
create or replace function public.rk_norm_id(t text) returns text
language plpgsql immutable as $$
declare s text := normalize(btrim(coalesce(t, '')), NFC);
begin
  if s ~ '^[0-9A-Za-z_가-힣ㄱ-ㅎㅏ-ㅣ]{2,12}$' then return s; end if;
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
  if a = 'none' then return jsonb_build_object('ok', true, 'exists', false); end if;
  if a <> 'ok' then return jsonb_build_object('ok', false, 'error', a); end if;
  select * into u from public.rk_users where id = k;
  return jsonb_build_object('ok', true, 'exists', true, 'name', u.name, 'updatedAt', u.updated_at_ms, 'data', u.data);
end $$;

create or replace function public.rk_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  nm text := public.rk_norm_id(p->>'id'); k text := lower(nm); a text;
  d jsonb := public.rk_clean(p->'data'); u public.rk_users%rowtype; n int;
  at bigint := coalesce(case when p->>'updatedAt' ~ '^[0-9]{1,15}$' then (p->>'updatedAt')::bigint end,
                        (extract(epoch from now()) * 1000)::bigint);
begin
  if k is null then return jsonb_build_object('ok', false, 'error', 'bad_id'); end if;
  if not public.rk_pin_ok(p->>'pin') then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
  a := public.rk_auth(k, p->>'pin');
  if a in ('bad_pin', 'locked') then return jsonb_build_object('ok', false, 'error', a); end if;

  if a = 'none' then                                   -- 새 ID: 이때 받은 비밀번호로 등록
    insert into public.rk_users (id, name, pin_hash, money, wins, losses, best_pts, week, cleared, data, updated_at_ms)
    values (k, nm, crypt(p->>'pin', gen_salt('bf')), (d->>'money')::int, (d->>'wins')::int, (d->>'losses')::int,
            (d->>'bestPts')::int, (d->>'week')::int, (d->>'cleared')::boolean, d, at)
    on conflict (id) do nothing;
    get diagnostics n = row_count;
    if n = 0 then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;   -- 동시에 같은 ID가 만들어진 경우
    return jsonb_build_object('ok', true, 'created', true, 'updatedAt', at);
  end if;

  select * into u from public.rk_users where id = k for update;
  if u.updated_at_ms > at then                         -- 다른 기기에서 더 최근에 저장됨
    return jsonb_build_object('ok', true, 'conflict', true, 'name', u.name, 'updatedAt', u.updated_at_ms, 'data', u.data);
  end if;
  update public.rk_users set
    money = (d->>'money')::int, wins = (d->>'wins')::int, losses = (d->>'losses')::int,
    best_pts = (d->>'bestPts')::int, week = (d->>'week')::int, cleared = (d->>'cleared')::boolean,
    data = d, updated_at_ms = at, updated_at = now()
  where id = k;
  return jsonb_build_object('ok', true, 'updatedAt', at);
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
  insert into public.rk_matches (user_id, bet, goals, pts, result, money, week) values (
    k, public.rk_int(p->'bet', 0, 100000, 0), public.rk_int(p->'goals', 0, 5, 0), public.rk_int(p->'pts', 0, 99999, 0),
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

-- 브라우저(anon)는 아래 함수만 실행할 수 있다. 내부 도우미는 막아 둔다.
revoke all on function public.rk_auth(text, text) from public, anon, authenticated;
revoke all on function public.rk_ping(jsonb), public.rk_load(jsonb), public.rk_save(jsonb),
                       public.rk_score(jsonb), public.rk_top(jsonb) from public;
grant execute on function public.rk_ping(jsonb), public.rk_load(jsonb), public.rk_save(jsonb),
                          public.rk_score(jsonb), public.rk_top(jsonb) to anon, authenticated;
