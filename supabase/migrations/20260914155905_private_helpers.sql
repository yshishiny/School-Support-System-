-- Move RLS helper functions out of the API-exposed "public" schema so they
-- cannot be called through /rest/v1/rpc, and lock down the auth trigger.

create schema if not exists app_private;
grant usage on schema app_private to authenticated, service_role;

create or replace function app_private.current_family_id()
returns uuid language sql stable security definer set search_path = public as $$
  select family_id from public.profiles where id = auth.uid()
$$;

create or replace function app_private.current_role_is(r public.user_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = r)
$$;

create or replace function app_private.student_in_family(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = sid and p.family_id = app_private.current_family_id()
  )
$$;

revoke all on function app_private.current_family_id() from public;
revoke all on function app_private.current_role_is(public.user_role) from public;
revoke all on function app_private.student_in_family(uuid) from public;
grant execute on function app_private.current_family_id() to authenticated, service_role;
grant execute on function app_private.current_role_is(public.user_role) to authenticated, service_role;
grant execute on function app_private.student_in_family(uuid) to authenticated, service_role;

-- The signup trigger runs as the auth admin; nobody should call it over the API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin, postgres;

-- Recreate every policy against the private helpers.
drop policy if exists families_select on public.families;
drop policy if exists families_update on public.families;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_update_parent on public.profiles;
drop policy if exists subjects_select on public.subjects;
drop policy if exists subjects_write on public.subjects;
drop policy if exists assignments_select on public.assignments;
drop policy if exists assignments_parent_all on public.assignments;
drop policy if exists assignments_student_insert on public.assignments;
drop policy if exists assignments_student_update on public.assignments;
drop policy if exists timetable_select on public.timetable_entries;
drop policy if exists timetable_write on public.timetable_entries;
drop policy if exists checkins_select on public.checkins;
drop policy if exists checkins_student_write on public.checkins;
drop policy if exists checkin_items_select on public.checkin_items;
drop policy if exists checkin_items_student_write on public.checkin_items;
drop policy if exists imports_parent on public.whatsapp_imports;
drop policy if exists points_select on public.points_ledger;
drop policy if exists points_parent_insert on public.points_ledger;
drop policy if exists rewards_select on public.rewards;
drop policy if exists rewards_parent_all on public.rewards;
drop policy if exists redemptions_select on public.redemptions;
drop policy if exists redemptions_student_insert on public.redemptions;
drop policy if exists redemptions_parent_update on public.redemptions;
drop policy if exists reports_parent on public.daily_reports;

drop function if exists public.student_points(uuid);
drop function if exists public.student_in_family(uuid);
drop function if exists public.current_role_is(public.user_role);
drop function if exists public.current_family_id();

create policy families_select on public.families for select to authenticated using (id = app_private.current_family_id());
create policy families_update on public.families for update to authenticated using (id = app_private.current_family_id() and app_private.current_role_is('parent'));

create policy profiles_select on public.profiles for select to authenticated using (family_id = app_private.current_family_id());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid());
create policy profiles_update_parent on public.profiles for update to authenticated using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));

create policy subjects_select on public.subjects for select to authenticated using (app_private.student_in_family(student_id));
create policy subjects_write on public.subjects for all to authenticated
  using (app_private.student_in_family(student_id) and (app_private.current_role_is('parent') or student_id = auth.uid()))
  with check (app_private.student_in_family(student_id) and (app_private.current_role_is('parent') or student_id = auth.uid()));

create policy assignments_select on public.assignments for select to authenticated using (app_private.student_in_family(student_id));
create policy assignments_parent_all on public.assignments for all to authenticated
  using (app_private.student_in_family(student_id) and app_private.current_role_is('parent'))
  with check (app_private.student_in_family(student_id) and app_private.current_role_is('parent'));
create policy assignments_student_insert on public.assignments for insert to authenticated
  with check (student_id = auth.uid() and source = 'student');
create policy assignments_student_update on public.assignments for update to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy timetable_select on public.timetable_entries for select to authenticated using (app_private.student_in_family(student_id));
create policy timetable_write on public.timetable_entries for all to authenticated
  using (app_private.student_in_family(student_id) and (app_private.current_role_is('parent') or student_id = auth.uid()))
  with check (app_private.student_in_family(student_id) and (app_private.current_role_is('parent') or student_id = auth.uid()));

create policy checkins_select on public.checkins for select to authenticated using (app_private.student_in_family(student_id));
create policy checkins_student_write on public.checkins for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy checkin_items_select on public.checkin_items for select to authenticated
  using (exists (select 1 from public.checkins c where c.id = checkin_id and app_private.student_in_family(c.student_id)));
create policy checkin_items_student_write on public.checkin_items for all to authenticated
  using (exists (select 1 from public.checkins c where c.id = checkin_id and c.student_id = auth.uid()))
  with check (exists (select 1 from public.checkins c where c.id = checkin_id and c.student_id = auth.uid()));

create policy imports_parent on public.whatsapp_imports for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));

create policy points_select on public.points_ledger for select to authenticated using (app_private.student_in_family(student_id));
create policy points_parent_insert on public.points_ledger for insert to authenticated
  with check (app_private.student_in_family(student_id) and app_private.current_role_is('parent'));

create policy rewards_select on public.rewards for select to authenticated using (family_id = app_private.current_family_id());
create policy rewards_parent_all on public.rewards for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));

create policy redemptions_select on public.redemptions for select to authenticated using (app_private.student_in_family(student_id));
create policy redemptions_student_insert on public.redemptions for insert to authenticated with check (student_id = auth.uid());
create policy redemptions_parent_update on public.redemptions for update to authenticated
  using (app_private.student_in_family(student_id) and app_private.current_role_is('parent'));

create policy reports_parent on public.daily_reports for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));
