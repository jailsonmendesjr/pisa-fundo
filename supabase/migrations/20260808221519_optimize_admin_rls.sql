begin;

drop policy "Admins can read or claim their invitation"
  on public.app_admins;
drop policy "Invited users can claim their admin account"
  on public.app_admins;

create policy "Admins can read or claim their invitation"
  on public.app_admins for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );

create policy "Invited users can claim their admin account"
  on public.app_admins for update
  to authenticated
  using (
    email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
    and (user_id is null or user_id = (select auth.uid()))
  )
  with check (
    email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
    and user_id = (select auth.uid())
    and claimed_at is not null
  );

commit;
