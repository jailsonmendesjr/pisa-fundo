-- Administrative access, single-active-season rule and atomic result editing.

begin;

create table public.app_admins (
  email text not null,
  user_id uuid unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  constraint app_admins_pkey primary key (email),
  constraint app_admins_email_lowercase_check check (email = lower(email)),
  constraint app_admins_claimed_at_check check (
    (user_id is null and claimed_at is null)
    or (user_id is not null and claimed_at is not null)
  )
);

comment on table public.app_admins is
  'Server-managed allowlist for users who may mutate championship data.';

alter table public.app_admins enable row level security;

revoke all on table public.app_admins from anon, authenticated;
grant select on table public.app_admins to authenticated;
grant update (user_id, claimed_at) on table public.app_admins to authenticated;

create policy "Admins can read or claim their invitation"
  on public.app_admins for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

create policy "Invited users can claim their admin account"
  on public.app_admins for update
  to authenticated
  using (
    email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    and (user_id is null or user_id = (select auth.uid()))
  )
  with check (
    email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    and user_id = (select auth.uid())
    and claimed_at is not null
  );

grant insert, update, delete on table
  public.championship_season,
  public.championship_team,
  public.championship_driver,
  public.championship_driverteamseason,
  public.championship_round,
  public.championship_roundresult
to authenticated;

grant usage, select on sequence
  public.championship_season_id_seq,
  public.championship_team_id_seq,
  public.championship_driver_id_seq,
  public.championship_driverteamseason_id_seq,
  public.championship_round_id_seq,
  public.championship_roundresult_id_seq
to authenticated;

grant execute on function public.set_roundresult_points() to authenticated;
grant execute on function public.enforce_team_driver_limit() to authenticated;

do $policies$
declare
  target_table text;
begin
  foreach target_table in array array[
    'championship_season',
    'championship_team',
    'championship_driver',
    'championship_driverteamseason',
    'championship_round',
    'championship_roundresult'
  ]
  loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (exists (select 1 from public.app_admins where user_id = (select auth.uid())))',
      'Admins can insert ' || target_table,
      target_table
    );

    execute format(
      'create policy %I on public.%I for update to authenticated using (exists (select 1 from public.app_admins where user_id = (select auth.uid()))) with check (exists (select 1 from public.app_admins where user_id = (select auth.uid())))',
      'Admins can update ' || target_table,
      target_table
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated using (exists (select 1 from public.app_admins where user_id = (select auth.uid())))',
      'Admins can delete ' || target_table,
      target_table
    );
  end loop;
end;
$policies$;

create unique index championship_season_single_active_uniq
  on public.championship_season (is_active)
  where is_active;

create or replace function public.activate_championship_season(
  p_season_id bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.app_admins
    where user_id = (select auth.uid())
  ) then
    raise insufficient_privilege using message = 'Apenas administradores podem ativar campeonatos.';
  end if;

  if not exists (
    select 1 from public.championship_season where id = p_season_id
  ) then
    raise exception 'Campeonato % nao encontrado.', p_season_id
      using errcode = 'P0002';
  end if;

  update public.championship_season
  set is_active = (id = p_season_id)
  where is_active or id = p_season_id;
end;
$$;

revoke all on function public.activate_championship_season(bigint)
  from public, anon;
grant execute on function public.activate_championship_season(bigint)
  to authenticated;

create or replace function public.replace_round_results(
  p_round_id bigint,
  p_results jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  round_season_id bigint;
begin
  if not exists (
    select 1
    from public.app_admins
    where user_id = (select auth.uid())
  ) then
    raise insufficient_privilege using message = 'Apenas administradores podem salvar resultados.';
  end if;

  if jsonb_typeof(p_results) <> 'array' then
    raise exception 'Os resultados devem ser enviados como uma lista.'
      using errcode = '22023';
  end if;

  select season_id
  into round_season_id
  from public.championship_round
  where id = p_round_id
  for update;

  if round_season_id is null then
    raise exception 'Etapa % nao encontrada.', p_round_id
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_results) as result(
      entry_id bigint,
      position integer,
      status text,
      fastest_lap boolean,
      has_penalty boolean,
      penalty_reason text
    )
    left join public.championship_driverteamseason as entry
      on entry.id = result.entry_id
    where result.entry_id is null
      or result.position is null
      or result.position < 1
      or result.status not in ('COMPLETED', 'DNF', 'DNS')
      or result.fastest_lap is null
      or result.has_penalty is null
      or char_length(coalesce(result.penalty_reason, '')) > 200
      or entry.id is null
      or entry.season_id <> round_season_id
  ) then
    raise exception 'Ha resultados invalidos ou pilotos de outro campeonato.'
      using errcode = '22023';
  end if;

  if exists (
    select entry_id
    from jsonb_to_recordset(p_results) as result(entry_id bigint)
    group by entry_id
    having count(*) > 1
  ) then
    raise exception 'Um piloto foi informado mais de uma vez nesta etapa.'
      using errcode = '23505';
  end if;

  if exists (
    select position
    from jsonb_to_recordset(p_results) as result(
      position integer,
      status text
    )
    where status <> 'DNS'
    group by position
    having count(*) > 1
  ) then
    raise exception 'As posicoes de chegada devem ser unicas.'
      using errcode = '23505';
  end if;

  if (
    select count(*)
    from jsonb_to_recordset(p_results) as result(fastest_lap boolean)
    where fastest_lap
  ) > 1 then
    raise exception 'A etapa pode ter apenas uma volta mais rapida.'
      using errcode = '23505';
  end if;

  delete from public.championship_roundresult
  where round_id = p_round_id;

  insert into public.championship_roundresult (
    round_id,
    entry_id,
    position,
    status,
    fastest_lap,
    has_penalty,
    penalty_reason,
    points
  )
  select
    p_round_id,
    result.entry_id,
    result.position,
    result.status,
    result.fastest_lap,
    result.has_penalty,
    coalesce(result.penalty_reason, ''),
    0
  from jsonb_to_recordset(p_results) as result(
    entry_id bigint,
    position integer,
    status text,
    fastest_lap boolean,
    has_penalty boolean,
    penalty_reason text
  );
end;
$$;

revoke all on function public.replace_round_results(bigint, jsonb)
  from public, anon;
grant execute on function public.replace_round_results(bigint, jsonb)
  to authenticated;

notify pgrst, 'reload schema';

commit;
