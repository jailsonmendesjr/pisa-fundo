-- Allows a published Cup to append an already completed official round without
-- rewriting participant eligibility or duplicating official results.

begin;

alter table public.championship_cup_audit
  drop constraint championship_cup_audit_action_check,
  add constraint championship_cup_audit_action_check check (
    action in (
      'RETROACTIVE_ROUND_ADDED',
      'RETROACTIVE_ROUND_REMOVED',
      'PUBLISHED_ROUND_ADDED',
      'PUBLISHED_ROUND_REMOVED'
    )
  );

create or replace function public.validate_championship_cup_round()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cup_season_id bigint;
  cup_published_at timestamptz;
  round_season_id bigint;
  retroactive_operation boolean :=
    coalesce(current_setting('app.cup_retroactive_operation', true), '') = 'on';
  published_round_operation boolean :=
    coalesce(current_setting('app.cup_published_round_operation', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    select published_at into cup_published_at
    from public.championship_cup where id = old.cup_id;

    if cup_published_at is not null and not published_round_operation then
      raise exception 'Uma etapa de Copa publicada exige correcao administrativa excepcional.'
        using errcode = '22023';
    end if;

    perform 1 from public.championship_round
    where id = old.round_id for update;

    if (
      old.registration_closed_at is not null
      or exists (
        select 1 from public.championship_roundresult
        where round_id = old.round_id
      )
    ) and not (
      (retroactive_operation and old.retroactive_at is not null
        and cup_published_at is null)
      or (published_round_operation and old.retroactive_at is not null
        and cup_published_at is not null)
    ) then
      raise exception 'Uma etapa da Copa encerrada ou com resultados nao pode ser removida.'
        using errcode = '22023';
    end if;

    return old;
  end if;

  if tg_op = 'UPDATE' then
    if (new.cup_id, new.round_id, new.cup_order)
      is distinct from (old.cup_id, old.round_id, old.cup_order) then
      raise exception 'O vinculo e a ordem da etapa da Copa sao imutaveis.'
        using errcode = '22023';
    end if;
    if (new.retroactive_at, new.retroactive_by, new.retroactive_reason)
      is distinct from (old.retroactive_at, old.retroactive_by, old.retroactive_reason) then
      raise exception 'Os dados da inclusao retroativa sao imutaveis.'
        using errcode = '22023';
    end if;
    if old.registration_closed_at is not null
      and new.registration_closed_at is distinct from old.registration_closed_at then
      raise exception 'As adesoes desta etapa ja foram encerradas.'
        using errcode = '22023';
    end if;
  end if;

  select season_id, published_at into cup_season_id, cup_published_at
  from public.championship_cup where id = new.cup_id;
  select season_id into round_season_id
  from public.championship_round where id = new.round_id for update;

  if cup_season_id is null or round_season_id is null
    or cup_season_id <> round_season_id then
    raise exception 'A etapa deve pertencer ao campeonato oficial da Copa.'
      using errcode = '22023';
  end if;

  if new.retroactive_at is not null and not (
    new.registration_closed_at is not null
    and (
      (retroactive_operation and cup_published_at is null)
      or (published_round_operation and cup_published_at is not null)
    )
  ) then
    raise exception 'Use o fluxo controlado para incluir uma etapa ja realizada.'
      using errcode = '22023';
  end if;

  if (tg_op = 'INSERT'
      or (tg_op = 'UPDATE' and old.registration_closed_at is null))
    and exists (
      select 1 from public.championship_roundresult
      where round_id = new.round_id
    )
    and not (
      new.retroactive_at is not null
      and new.registration_closed_at is not null
      and (
        (retroactive_operation and cup_published_at is null)
        or (published_round_operation and cup_published_at is not null)
      )
    ) then
    raise exception 'Uma etapa com resultados publicados so pode ser incluida pelo fluxo retroativo.'
      using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' and old.registration_closed_at is null
    and new.registration_closed_at is not null then
    new.registration_closed_at := now();
  end if;

  return new;
end;
$$;

create function public.add_published_cup_round(
  p_cup_id bigint,
  p_round_id bigint,
  p_cup_order smallint,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  cup_season_id bigint;
  cup_published_at timestamptz;
  round_season_id bigint;
  round_official_order integer;
  linked_round_count integer;
  last_cup_order integer;
  last_official_order integer;
  participant_count integer;
  normalized_reason text := btrim(p_reason);
begin
  if caller_id is null or not exists (
    select 1 from public.app_admins where user_id = caller_id
  ) then
    raise exception 'Sua conta nao possui permissao administrativa.'
      using errcode = '42501';
  end if;

  if normalized_reason is null
    or length(normalized_reason) not between 10 and 300 then
    raise exception 'Informe uma justificativa entre 10 e 300 caracteres.'
      using errcode = '22023';
  end if;

  select season_id, published_at into cup_season_id, cup_published_at
  from public.championship_cup where id = p_cup_id for update;

  if cup_season_id is null then
    raise exception 'Mini Copa nao encontrada.' using errcode = '22023';
  end if;
  if cup_published_at is null then
    raise exception 'Use o fluxo de rascunho para uma Copa ainda nao publicada.'
      using errcode = '22023';
  end if;

  select season_id, "order" into round_season_id, round_official_order
  from public.championship_round where id = p_round_id for update;

  if round_season_id is null or round_season_id <> cup_season_id then
    raise exception 'A etapa deve pertencer ao campeonato oficial da Copa.'
      using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.championship_roundresult where round_id = p_round_id
  ) then
    raise exception 'Use o fluxo normal para uma etapa que ainda nao possui resultados.'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from public.championship_cup_round
    where cup_id = p_cup_id and round_id = p_round_id
  ) then
    raise exception 'Esta etapa ja pertence a Mini Copa.'
      using errcode = '22023';
  end if;

  select count(*)::integer,
    coalesce(max(cup_round.cup_order), 0)::integer,
    coalesce(max(round."order"), 0)::integer
  into linked_round_count, last_cup_order, last_official_order
  from public.championship_cup_round as cup_round
  join public.championship_round as round on round.id = cup_round.round_id
  where cup_round.cup_id = p_cup_id;

  if linked_round_count >= 4 then
    raise exception 'A Mini Copa ja possui quatro etapas.'
      using errcode = '22023';
  end if;
  if p_cup_order <> last_cup_order + 1 then
    raise exception 'A etapa deve ocupar a proxima ordem disponivel da Mini Copa.'
      using errcode = '22023';
  end if;
  if round_official_order <= last_official_order then
    raise exception 'A etapa realizada deve ser posterior as etapas ja vinculadas.'
      using errcode = '22023';
  end if;

  select count(*)::integer into participant_count
  from public.championship_cup_entry where cup_id = p_cup_id;

  if participant_count = 0 then
    raise exception 'A Mini Copa publicada nao possui pilotos participantes.'
      using errcode = '22023';
  end if;

  perform set_config('app.cup_published_round_operation', 'on', true);

  insert into public.championship_cup_round (
    cup_id,
    round_id,
    cup_order,
    registration_closed_at,
    retroactive_at,
    retroactive_by,
    retroactive_reason
  ) values (
    p_cup_id,
    p_round_id,
    p_cup_order,
    now(),
    now(),
    caller_id,
    normalized_reason
  );

  insert into public.championship_cup_audit (
    cup_id,
    round_id,
    action,
    reason,
    actor_id,
    details
  ) values (
    p_cup_id,
    p_round_id,
    'PUBLISHED_ROUND_ADDED',
    normalized_reason,
    caller_id,
    jsonb_build_object(
      'cup_order', p_cup_order,
      'participant_count', participant_count
    )
  );
end;
$$;

create function public.undo_published_cup_round(
  p_cup_id bigint,
  p_round_id bigint,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  cup_published_at timestamptz;
  selected_cup_order integer;
  last_cup_order integer;
  selected_retroactive_at timestamptz;
  normalized_reason text := btrim(p_reason);
begin
  if caller_id is null or not exists (
    select 1 from public.app_admins where user_id = caller_id
  ) then
    raise exception 'Sua conta nao possui permissao administrativa.'
      using errcode = '42501';
  end if;

  if normalized_reason is null
    or length(normalized_reason) not between 10 and 300 then
    raise exception 'Informe uma justificativa entre 10 e 300 caracteres.'
      using errcode = '22023';
  end if;

  select published_at into cup_published_at
  from public.championship_cup where id = p_cup_id for update;

  if cup_published_at is null then
    raise exception 'Este fluxo exige uma Mini Copa publicada.'
      using errcode = '22023';
  end if;

  select cup_order, retroactive_at
  into selected_cup_order, selected_retroactive_at
  from public.championship_cup_round
  where cup_id = p_cup_id and round_id = p_round_id
  for update;

  if not found or selected_retroactive_at is null then
    raise exception 'Etapa publicada adicionada pelo fluxo controlado nao encontrada.'
      using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.championship_cup_audit
    where cup_id = p_cup_id
      and round_id = p_round_id
      and action = 'PUBLISHED_ROUND_ADDED'
  ) then
    raise exception 'Esta etapa nao foi adicionada apos a publicacao da Copa.'
      using errcode = '22023';
  end if;

  select max(cup_order)::integer into last_cup_order
  from public.championship_cup_round where cup_id = p_cup_id;

  if selected_cup_order <> last_cup_order then
    raise exception 'Desfaca primeiro a etapa mais recente da Mini Copa.'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from public.championship_cup_entry
    where cup_id = p_cup_id and first_round_id = p_round_id
  ) then
    raise exception 'A etapa possui pilotos cuja participacao comeca nela.'
      using errcode = '22023';
  end if;

  perform set_config('app.cup_published_round_operation', 'on', true);

  delete from public.championship_cup_round
  where cup_id = p_cup_id and round_id = p_round_id;

  insert into public.championship_cup_audit (
    cup_id,
    round_id,
    action,
    reason,
    actor_id,
    details
  ) values (
    p_cup_id,
    p_round_id,
    'PUBLISHED_ROUND_REMOVED',
    normalized_reason,
    caller_id,
    jsonb_build_object('cup_order', selected_cup_order)
  );
end;
$$;

revoke all on function public.add_published_cup_round(bigint, bigint, smallint, text)
  from public, anon;
revoke all on function public.undo_published_cup_round(bigint, bigint, text)
  from public, anon;
grant execute on function public.add_published_cup_round(bigint, bigint, smallint, text)
  to authenticated, service_role;
grant execute on function public.undo_published_cup_round(bigint, bigint, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
