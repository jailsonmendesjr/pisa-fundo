-- Run after mini-copa-bootstrap.sql and every Mini Copa migration.
-- The transaction is rolled back and never touches a real project.

begin;

insert into auth.users (id) values
  ('92000000-0000-0000-0000-000000000001');
insert into public.app_admins (email, user_id, claimed_at) values
  ('published-round-admin@example.com', '92000000-0000-0000-0000-000000000001', now());

insert into public.championship_season (id, name, year, is_active) values
  (920001, 'Temporada publicada', 2092, false);
insert into public.championship_team
  (id, name, slug, primary_color, secondary_color) values
  (920001, 'Equipe Publicada', 'equipe-publicada', '#111111', '#EEEEEE');
insert into public.championship_driver (id, name, nickname, slug) values
  (920001, 'Piloto Publicado Um', '', 'piloto-publicado-um'),
  (920002, 'Piloto Publicado Dois', '', 'piloto-publicado-dois');
insert into public.championship_driverteamseason
  (id, driver_id, season_id, team_id, is_guest) values
  (920001, 920001, 920001, 920001, false),
  (920002, 920002, 920001, 920001, false);
insert into public.championship_round
  (id, name, date, location, "order", season_id) values
  (920001, 'Primeira etapa', '2026-09-22', 'Kartódromo', 8, 920001),
  (920002, 'Segunda etapa realizada', '2026-10-29', 'Kartódromo', 9, 920001),
  (920003, 'Terceira etapa realizada', '2026-11-20', 'Kartódromo', 10, 920001);

insert into public.championship_cup (id, season_id, name) values
  (920001, 920001, 'Copa publicada com etapa pendente');
insert into public.championship_cup_round (cup_id, round_id, cup_order) values
  (920001, 920001, 1);
insert into public.championship_cup_entry
  (cup_id, entry_id, first_round_id) values
  (920001, 920001, 920001),
  (920001, 920002, 920001);
update public.championship_cup
set published_at = now(), is_enabled = true
where id = 920001;

insert into public.championship_roundresult
  (id, position, points, entry_id, round_id, status) values
  (920001, 1, 18, 920001, 920001, 'COMPLETED'),
  (920002, 2, 15, 920002, 920001, 'COMPLETED'),
  (920003, 2, 15, 920001, 920002, 'COMPLETED'),
  (920004, 1, 18, 920002, 920002, 'COMPLETED'),
  (920005, 1, 18, 920001, 920003, 'COMPLETED');

create temporary table published_round_official_baseline as
select count(*)::integer as result_count, sum(points)::integer as points
from public.championship_roundresult
where round_id in (920001, 920002, 920003);
grant select on published_round_official_baseline to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '92000000-0000-0000-0000-000000000001',
  true
);

select public.add_published_cup_round(
  920001,
  920002,
  2::smallint,
  'Incluindo a segunda etapa previamente prevista.'
);

do $$
begin
  if not exists (
    select 1 from public.championship_cup_round
    where cup_id = 920001
      and round_id = 920002
      and cup_order = 2
      and registration_closed_at is not null
      and retroactive_at is not null
  ) then
    raise exception 'Etapa realizada nao foi anexada a Copa publicada';
  end if;

  if (
    select count(*) from public.championship_cup_entry
    where cup_id = 920001 and first_round_id = 920001
  ) <> 2 then
    raise exception 'A elegibilidade existente dos pilotos foi alterada';
  end if;

  if exists (
    select 1 from public.championship_cup_entry
    where cup_id = 920001 and first_round_id = 920002
  ) then
    raise exception 'A etapa publicada criou adesoes retroativas';
  end if;

  if not exists (
    select 1 from public.championship_cup_audit
    where cup_id = 920001
      and round_id = 920002
      and action = 'PUBLISHED_ROUND_ADDED'
  ) then
    raise exception 'A inclusao na Copa publicada nao foi auditada';
  end if;
end;
$$;

do $$
declare rejected boolean := false;
begin
  begin
    perform public.add_published_cup_round(
      920001,
      920003,
      4::smallint,
      'Tentativa de deixar uma lacuna na ordem.'
    );
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then
    raise exception 'A Copa aceitou etapa fora da proxima ordem';
  end if;
end;
$$;

do $$
declare rejected boolean := false;
begin
  begin
    insert into public.championship_cup_round (cup_id, round_id, cup_order)
    values (920001, 920003, 3);
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then
    raise exception 'Etapa com resultado entrou fora do fluxo controlado';
  end if;
end;
$$;

select public.undo_published_cup_round(
  920001,
  920002,
  'Desfazendo a inclusao para validar o rollback.'
);

do $$
begin
  if exists (
    select 1 from public.championship_cup_round
    where cup_id = 920001 and round_id = 920002
  ) then
    raise exception 'Rollback manteve a etapa vinculada';
  end if;

  if (
    select count(*) from public.championship_cup_entry
    where cup_id = 920001 and first_round_id = 920001
  ) <> 2 then
    raise exception 'Rollback alterou a elegibilidade dos pilotos';
  end if;

  if not exists (
    select 1 from public.championship_cup_audit
    where cup_id = 920001
      and round_id = 920002
      and action = 'PUBLISHED_ROUND_REMOVED'
  ) then
    raise exception 'Rollback da Copa publicada nao foi auditado';
  end if;

  if exists (
    select 1
    from published_round_official_baseline as baseline
    cross join lateral (
      select count(*)::integer as result_count, sum(points)::integer as points
      from public.championship_roundresult
      where round_id in (920001, 920002, 920003)
    ) as current_state
    where baseline.result_count is distinct from current_state.result_count
      or baseline.points is distinct from current_state.points
  ) then
    raise exception 'O fluxo alterou resultados oficiais';
  end if;
end;
$$;

rollback;
