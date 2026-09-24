-- Admin-only RLS smoke test for the isolated bootstrap schema.
-- Do not run against the real Supabase auth.users table.

begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000900101');
insert into public.app_admins (email, user_id, claimed_at) values
  (
    'mini-copa-admin@example.test',
    '00000000-0000-0000-0000-000000900101',
    now()
  );
insert into public.championship_season (id, name, year) values
  (900201, 'Temporada admin smoke', 2099);
insert into public.championship_team
  (id, name, slug, primary_color, secondary_color) values
  (900201, 'Equipe admin smoke', 'equipe-admin-smoke', '#111111', '#FFFFFF');
insert into public.championship_driver
  (id, name, slug) values
  (900201, 'Piloto admin smoke', 'piloto-admin-smoke');
insert into public.championship_driverteamseason
  (id, season_id, team_id, driver_id, is_guest) values
  (900201, 900201, 900201, 900201, false);
insert into public.championship_round
  (id, season_id, name, date, location, "order") values
  (900201, 900201, 'Etapa admin smoke', '2099-01-01', 'Pista smoke', 1);

set role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000900101';

insert into public.championship_cup (id, season_id, name) values
  (900201, 900201, 'Copa admin smoke');
insert into public.championship_cup_round (cup_id, round_id, cup_order) values
  (900201, 900201, 1);
insert into public.championship_cup_entry
  (cup_id, entry_id, first_round_id) values
  (900201, 900201, 900201);

do $$
begin
  if (select count(*) from public.championship_cup where id = 900201) <> 1
    or (select count(*) from public.championship_cup_round where cup_id = 900201) <> 1
    or (select enrolled_by from public.championship_cup_entry
        where cup_id = 900201 and entry_id = 900201)
      <> auth.uid() then
    raise exception 'Administrador nao conseguiu escrever ou ler a Copa em rascunho';
  end if;
end;
$$;

update public.championship_cup_round
set registration_closed_at = now()
where cup_id = 900201 and round_id = 900201;

do $$
declare rejected boolean := false;
begin
  begin
    update public.championship_driverteamseason
    set is_guest = true
    where id = 900201;
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then
    raise exception 'Administrador alterou elegibilidade depois do inicio da Copa';
  end if;
end;
$$;

reset role;
rollback;
