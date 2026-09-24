-- Run after the existing championship schema and the Mini Copa migration.
-- Uses high fixture IDs and rolls back every row it creates.

begin;

insert into public.championship_season (id, name, year, is_active) values
  (900101, 'Copa smoke 2099', 2099, false),
  (900102, 'Outra temporada smoke 2098', 2098, false);
insert into public.championship_team
  (id, name, slug, primary_color, secondary_color) values
  (900101, 'Equipe smoke A', 'equipe-smoke-a', '#111111', '#FFFFFF'),
  (900102, 'Equipe smoke B', 'equipe-smoke-b', '#222222', '#FFFFFF');
insert into public.championship_driver
  (id, name, nickname, slug, number) values
  (900101, 'Piloto smoke regular A', '', 'piloto-smoke-regular-a', null),
  (900102, 'Piloto smoke convidado', '', 'piloto-smoke-convidado', null),
  (900103, 'Piloto smoke regular B', '', 'piloto-smoke-regular-b', null),
  (900104, 'Piloto smoke de outra temporada', '', 'piloto-smoke-outra-temporada', null);
insert into public.championship_driverteamseason
  (id, season_id, team_id, driver_id, is_guest) values
  (900101, 900101, 900101, 900101, false),
  (900102, 900101, 900101, 900102, true),
  (900103, 900101, 900102, 900103, false),
  (900104, 900102, 900101, 900104, false);
insert into public.championship_round
  (id, season_id, name, date, location, "order") values
  (900101, 900101, 'Etapa smoke 1', '2099-01-01', 'Pista smoke', 1),
  (900102, 900101, 'Etapa smoke 2', '2099-02-01', 'Pista smoke', 2),
  (900103, 900102, 'Etapa de outra temporada', '2098-01-01', 'Pista smoke', 1),
  (900104, 900101, 'Etapa com resultado anterior', '2099-03-01', 'Pista smoke', 3);

insert into public.championship_roundresult
  (id, round_id, entry_id, position, status) values
  (900101, 900104, 900101, 1, 'COMPLETED');

insert into public.championship_cup (id, season_id, name) values
  (900101, 900101, 'Mini Copa smoke'),
  (900102, 900101, 'Copa sem etapas');

do $$
declare rejected boolean := false;
begin
  begin
    update public.championship_cup set season_id = 900102 where id = 900101;
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then raise exception 'Campeonato de origem da Copa foi alterado'; end if;
end;
$$;

do $$
declare rejected boolean := false;
begin
  begin
    update public.championship_cup set published_at = now() where id = 900102;
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then raise exception 'Copa sem etapas foi publicada'; end if;
end;
$$;

insert into public.championship_cup_round (cup_id, round_id, cup_order) values
  (900101, 900101, 1),
  (900101, 900102, 2);

do $$
declare rejected boolean := false;
begin
  begin
    insert into public.championship_cup_round (cup_id, round_id, cup_order)
      values (900101, 900103, 3);
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then raise exception 'Etapa de outra temporada foi vinculada'; end if;
end;
$$;

do $$
declare rejected boolean := false;
begin
  begin
    insert into public.championship_cup_round (cup_id, round_id, cup_order)
      values (900101, 900104, 3);
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then raise exception 'Etapa ja publicada foi vinculada'; end if;
end;
$$;

insert into public.championship_cup_entry
  (cup_id, entry_id, first_round_id) values (900101, 900101, 900102);

do $$
declare rejected boolean := false;
begin
  begin
    insert into public.championship_cup_entry
      (cup_id, entry_id, first_round_id) values (900101, 900102, 900101);
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then raise exception 'Convidado entrou na Copa'; end if;
end;
$$;

do $$
declare rejected boolean := false;
begin
  begin
    insert into public.championship_cup_entry
      (cup_id, entry_id, first_round_id) values (900101, 900104, 900101);
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then raise exception 'Inscricao de outra temporada entrou na Copa'; end if;
end;
$$;

do $$
begin
  if (select first_round_id from public.championship_cup_entry
      where cup_id = 900101 and entry_id = 900101) <> 900102 then
    raise exception 'A etapa inicial da adesao nao foi preservada';
  end if;
end;
$$;

set role anon;
do $$
begin
  if (select count(*) from public.championship_cup where id = 900101) <> 0
    or (select count(*) from public.championship_cup_round where cup_id = 900101) <> 0
    or (select count(*) from public.championship_cup_entry where cup_id = 900101) <> 0 then
    raise exception 'Uma Copa em rascunho ficou visivel ao publico';
  end if;
end;
$$;
reset role;

set role authenticated;
do $$
declare rejected boolean := false;
begin
  if (select count(*) from public.championship_cup where id = 900101) <> 0 then
    raise exception 'Usuario comum enxergou a Copa em rascunho';
  end if;
  begin
    insert into public.championship_cup (season_id, name)
      values (900101, 'Criacao nao autorizada');
  exception when sqlstate '42501' then rejected := true;
  end;
  if not rejected then raise exception 'Usuario comum criou uma Copa'; end if;
end;
$$;
reset role;

update public.championship_cup
set published_at = now(), is_enabled = true where id = 900101;

set role anon;
do $$
begin
  if (select count(*) from public.championship_cup where id = 900101) <> 1
    or (select count(*) from public.championship_cup_round where cup_id = 900101) <> 2
    or (select count(*) from public.championship_cup_entry where cup_id = 900101) <> 1 then
    raise exception 'A Copa publicada nao ficou visivel ao publico';
  end if;
end;
$$;
reset role;

update public.championship_cup set is_enabled = false where id = 900101;
set role anon;
do $$
begin
  if (select count(*) from public.championship_cup where id = 900101) <> 0
    or (select count(*) from public.championship_cup_round where cup_id = 900101) <> 0
    or (select count(*) from public.championship_cup_entry where cup_id = 900101) <> 0 then
    raise exception 'Copa desativada continuou visivel ao publico';
  end if;
end;
$$;
reset role;
update public.championship_cup set is_enabled = true where id = 900101;

do $$
declare rejected boolean := false;
begin
  begin
    delete from public.championship_cup_round
    where cup_id = 900101 and round_id = 900102;
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then raise exception 'Etapa de Copa publicada foi removida'; end if;
end;
$$;

update public.championship_cup_round
set registration_closed_at = now()
where cup_id = 900101 and round_id = 900101;

do $$
declare rejected boolean := false;
begin
  begin
    update public.championship_driverteamseason
    set is_guest = true
    where id = 900101;
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then raise exception 'Participante foi convertido em convidado depois do inicio'; end if;
end;
$$;

do $$
declare rejected boolean := false;
begin
  begin
    insert into public.championship_cup_entry
      (cup_id, entry_id, first_round_id) values (900101, 900103, 900101);
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then raise exception 'Adesao apos encerramento foi aceita'; end if;
end;
$$;

do $$
declare rejected boolean := false;
begin
  begin
    update public.championship_cup_round
    set registration_closed_at = null
    where cup_id = 900101 and round_id = 900101;
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then raise exception 'Etapa encerrada foi reaberta'; end if;
end;
$$;

rollback;
