-- Minimal Supabase-like schema for an isolated PostgreSQL migration smoke test.
-- Never apply this fixture to the real Pisa Fundo database.

create role anon;
create role authenticated;
create role service_role;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

create table public.app_admins (
  email text primary key,
  user_id uuid references auth.users(id)
);
grant usage on schema public to anon, authenticated, service_role;
grant select on public.app_admins to authenticated;
alter table public.app_admins enable row level security;
create policy "Admins can read their own record" on public.app_admins
  for select to authenticated using (user_id = (select auth.uid()));

create table public.championship_season (
  id bigint primary key,
  name varchar(100) not null,
  year integer not null,
  is_active boolean not null default false
);
create table public.championship_team (
  id bigint primary key,
  name varchar(100) not null,
  slug varchar(120) not null,
  primary_color varchar(7) not null,
  secondary_color varchar(7) not null
);
create table public.championship_driver (
  id bigint primary key,
  name varchar(100) not null,
  nickname varchar(50) not null default '',
  slug varchar(120) not null,
  number integer
);
create table public.championship_driverteamseason (
  id bigint primary key,
  car_number integer,
  driver_id bigint not null references public.championship_driver(id),
  season_id bigint not null references public.championship_season(id),
  team_id bigint not null references public.championship_team(id),
  is_guest boolean not null default false
);
create table public.championship_round (
  id bigint primary key,
  name varchar(100) not null,
  date date not null,
  location varchar(100) not null,
  "order" integer not null,
  season_id bigint not null references public.championship_season(id)
);
create table public.championship_roundresult (
  id bigint primary key,
  position integer not null,
  fastest_lap boolean not null default false,
  points integer not null default 0,
  entry_id bigint not null references public.championship_driverteamseason(id),
  round_id bigint not null references public.championship_round(id),
  has_penalty boolean not null default false,
  penalty_reason varchar(200) not null default '',
  status varchar(10) not null default 'COMPLETED'
);

grant select on table
  public.championship_season,
  public.championship_team,
  public.championship_driver,
  public.championship_driverteamseason,
  public.championship_round,
  public.championship_roundresult
to anon, authenticated;
grant update on
  public.championship_round,
  public.championship_driverteamseason
to authenticated;
