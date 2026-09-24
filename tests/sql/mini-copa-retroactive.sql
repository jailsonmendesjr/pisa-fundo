-- Run after mini-copa-bootstrap.sql, the base Mini Copa migration and
-- 20260924000034_add_retroactive_cup_round.sql.
-- The transaction is rolled back and never touches a real project.

begin;

insert into auth.users (id) values
  ('91000000-0000-0000-0000-000000000001');
insert into public.app_admins (email, user_id, claimed_at) values
  ('retro-admin@example.com', '91000000-0000-0000-0000-000000000001', now());

insert into public.championship_season (id, name, year, is_active) values
  (910001, 'Temporada retroativa', 2091, false);
insert into public.championship_team
  (id, name, slug, primary_color, secondary_color) values
  (910001, 'Equipe A', 'equipe-a-retro', '#111111', '#EEEEEE'),
  (910002, 'Equipe B', 'equipe-b-retro', '#222222', '#DDDDDD');
insert into public.championship_driver (id, name, nickname, slug) values
  (910001, 'Piloto Um', '', 'piloto-um-retro'),
  (910002, 'Piloto Dois', '', 'piloto-dois-retro'),
  (910003, 'Piloto Ausente', '', 'piloto-ausente-retro'),
  (910004, 'Piloto Convidado', '', 'piloto-convidado-retro');
insert into public.championship_driverteamseason
  (id, driver_id, season_id, team_id, is_guest) values
  (910001, 910001, 910001, 910001, false),
  (910002, 910002, 910001, 910001, false),
  (910003, 910003, 910001, 910002, false),
  (910004, 910004, 910001, 910002, true);
insert into public.championship_round
  (id, name, date, location, "order", season_id) values
  (910001, 'Etapa realizada', '2026-09-22', 'Kartódromo', 1, 910001),
  (910002, 'Outra etapa realizada', '2026-09-23', 'Kartódromo', 2, 910001),
  (910003, 'Etapa futura', '2026-10-20', 'Kartódromo', 3, 910001);
insert into public.championship_roundresult
  (id, position, points, entry_id, round_id, status) values
  (910001, 1, 18, 910001, 910001, 'COMPLETED'),
  (910002, 2, 15, 910002, 910001, 'COMPLETED'),
  (910003, 3, 13, 910004, 910001, 'COMPLETED'),
  (910004, 1, 18, 910001, 910002, 'COMPLETED');
insert into public.championship_cup (id, season_id, name) values
  (910001, 910001, 'Copa com backfill'),
  (910002, 910001, 'Copa sem atalho'),
  (910003, 910001, 'Copa publicada');
insert into public.championship_cup_round (cup_id, round_id, cup_order) values
  (910002, 910003, 1),
  (910003, 910003, 1);
insert into public.championship_cup_entry
  (cup_id, entry_id, first_round_id) values
  (910002, 910001, 910003),
  (910003, 910001, 910003);
update public.championship_cup
set published_at = now(), is_enabled = true
where id = 910003;

create temporary table retroactive_official_baseline as
select count(*)::integer as result_count, sum(points)::integer as points
from public.championship_roundresult
where round_id in (910001, 910002);
grant select on retroactive_official_baseline to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-0000-0000-000000000001',
  true
);

select public.add_retroactive_cup_round(
  910001,
  910001,
  1::smallint,
  array[910001, 910002, 910003]::bigint[],
  'Lista definida antes da etapa de teste.'
);

do $$
begin
  if not exists (
    select 1 from public.championship_cup_round
    where cup_id = 910001
      and round_id = 910001
      and cup_order = 1
      and registration_closed_at is not null
      and retroactive_at is not null
      and retroactive_reason = 'Lista definida antes da etapa de teste.'
  ) then
    raise exception 'Etapa retroativa nao foi vinculada e encerrada';
  end if;

  if (
    select count(*) from public.championship_cup_entry
    where cup_id = 910001 and first_round_id = 910001
  ) <> 3 then
    raise exception 'Participantes retroativos nao foram registrados';
  end if;

  if not exists (
    select 1 from public.championship_cup_audit
    where cup_id = 910001
      and round_id = 910001
      and action = 'RETROACTIVE_ROUND_ADDED'
  ) then
    raise exception 'Inclusao retroativa nao foi auditada';
  end if;
end;
$$;

do $$
declare rejected boolean := false;
begin
  begin
    insert into public.championship_cup_round (cup_id, round_id, cup_order)
    values (910002, 910002, 2);
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then
    raise exception 'Etapa com resultado entrou fora do fluxo controlado';
  end if;
end;
$$;

do $$
declare rejected boolean := false;
begin
  begin
    perform public.add_retroactive_cup_round(
      910002,
      910002,
      2::smallint,
      array[910002]::bigint[],
      null
    );
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then
    raise exception 'Inclusao retroativa aceitou justificativa vazia';
  end if;
end;
$$;

do $$
declare rejected boolean := false;
begin
  begin
    perform public.add_retroactive_cup_round(
      910002,
      910002,
      2::smallint,
      array[910001]::bigint[],
      'Nao pode deslocar uma participacao anterior.'
    );
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then
    raise exception 'Inclusao retroativa reescreveu uma adesao anterior';
  end if;
end;
$$;

do $$
declare rejected boolean := false;
begin
  begin
    perform public.add_retroactive_cup_round(
      910002,
      910002,
      2::smallint,
      array[910004]::bigint[],
      'Tentativa com piloto convidado.'
    );
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then
    raise exception 'Convidado entrou na inclusao retroativa';
  end if;
end;
$$;

do $$
declare rejected boolean := false;
begin
  begin
    perform public.add_retroactive_cup_round(
      910003,
      910002,
      2::smallint,
      array[910001]::bigint[],
      'Tentativa em uma Copa ja publicada.'
    );
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then
    raise exception 'Copa publicada aceitou inclusao retroativa';
  end if;
end;
$$;

select public.undo_retroactive_cup_round(
  910001,
  910001,
  'Desfazendo o ensaio de rollback.'
);

do $$
begin
  if exists (
    select 1 from public.championship_cup_round
    where cup_id = 910001 and round_id = 910001
  ) or exists (
    select 1 from public.championship_cup_entry
    where cup_id = 910001 and first_round_id = 910001
  ) then
    raise exception 'Rollback da inclusao retroativa deixou vinculos';
  end if;

  if not exists (
    select 1 from public.championship_cup_audit
    where cup_id = 910001
      and round_id = 910001
      and action = 'RETROACTIVE_ROUND_REMOVED'
  ) then
    raise exception 'Rollback retroativo nao foi auditado';
  end if;

  if exists (
    select 1
    from retroactive_official_baseline as baseline
    cross join lateral (
      select count(*)::integer as result_count, sum(points)::integer as points
      from public.championship_roundresult
      where round_id in (910001, 910002)
    ) as current_state
    where (baseline.result_count, baseline.points)
      is distinct from (current_state.result_count, current_state.points)
  ) then
    raise exception 'Resultados oficiais foram alterados pelo fluxo retroativo';
  end if;
end;
$$;

reset role;
rollback;
