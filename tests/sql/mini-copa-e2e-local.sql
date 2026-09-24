-- Local end-to-end fixture for the Mini Copa UI and rollback checks.
-- Never apply this file to a linked or production Supabase project.

begin;

insert into public.championship_team
  (id, name, slug, primary_color, secondary_color)
values
  (900301, 'Equipe Convidados E2E', 'equipe-convidados-e2e', '#64748B', '#FFFFFF');

insert into public.championship_driver
  (id, name, nickname, slug, number)
values
  (900301, 'Piloto Convidado E2E', 'Convidado', 'piloto-convidado-e2e', 99);

insert into public.championship_driverteamseason
  (id, season_id, team_id, driver_id, car_number, is_guest)
values
  (900301, 3, 900301, 900301, 99, true);

insert into public.championship_round
  (id, season_id, name, date, location, "order")
values
  (900301, 3, '🇬🇧 Etapa 06', '2026-09-24', 'Jardim Camburi/ES', 6),
  (900302, 3, '🇮🇹 Etapa 07', '2026-10-22', 'Jardim Camburi/ES', 7),
  (900303, 3, '🇯🇵 Etapa 08', '2026-11-19', 'Jardim Camburi/ES', 8),
  (900304, 3, '🇧🇷 Etapa 09', '2026-12-17', 'Jardim Camburi/ES', 9);

insert into public.championship_cup
  (id, season_id, name)
values
  (900301, 3, 'Mini Copa Pisa Fundo 2026');

insert into public.championship_cup_round
  (cup_id, round_id, cup_order)
values
  (900301, 900301, 1),
  (900301, 900302, 2),
  (900301, 900303, 3),
  (900301, 900304, 4);

insert into public.championship_cup_entry
  (cup_id, entry_id, first_round_id)
values
  (900301, 34, 900301),
  (900301, 35, 900301),
  (900301, 36, 900301),
  (900301, 37, 900301),
  (900301, 38, 900301),
  (900301, 39, 900302);

update public.championship_cup_round
set registration_closed_at = now()
where cup_id = 900301 and round_id in (900301, 900302);

insert into public.championship_roundresult
  (round_id, entry_id, position, status, fastest_lap, has_penalty, penalty_reason)
values
  (900301, 900301, 1, 'COMPLETED', false, false, ''),
  (900301, 40,      2, 'COMPLETED', false, false, ''),
  (900301, 34,      3, 'COMPLETED', true,  false, ''),
  (900301, 35,      4, 'COMPLETED', false, false, ''),
  (900301, 36,      5, 'COMPLETED', false, false, ''),
  (900301, 37,      6, 'COMPLETED', false, false, ''),
  (900301, 38,      7, 'DNF',       false, false, ''),
  (900301, 39,      8, 'COMPLETED', false, false, ''),
  (900302, 35,      1, 'COMPLETED', false, false, ''),
  (900302, 34,      2, 'COMPLETED', true,  false, ''),
  (900302, 39,      3, 'COMPLETED', false, false, ''),
  (900302, 36,      4, 'COMPLETED', false, false, ''),
  (900302, 37,      5, 'DNF',       false, false, ''),
  (900302, 38,      6, 'DNS',       false, false, ''),
  (900302, 900301,  7, 'COMPLETED', false, false, ''),
  (900302, 40,      8, 'COMPLETED', false, false, '');

update public.championship_cup
set published_at = now(), is_enabled = true
where id = 900301;

commit;
