-- Apply admin/staff-only role model and incidents ownership RLS on existing projects.
-- Run in Supabase SQL editor as a database admin.

-- 1) Normalize any legacy "ra" roles to "staff"
update public.staff_email_allowlist
set role = 'staff'
where role = 'ra';

update public.user_roles
set role = 'staff'
where role = 'ra';

-- 2) Restrict role constraints to admin/staff only
alter table public.staff_email_allowlist drop constraint if exists staff_email_allowlist_role_check;
alter table public.staff_email_allowlist
  add constraint staff_email_allowlist_role_check check (role in ('staff', 'admin'));

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles
  add constraint user_roles_role_check check (role in ('staff', 'admin'));

-- 3) Helper functions for RLS checks
create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select lower(trim(coalesce(auth.jwt() ->> 'email', '')));
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select a.role
  from public.staff_email_allowlist a
  where a.email = public.current_user_email()
  limit 1;
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_role() to service_role;
grant execute on function public.current_user_role() to postgres;

-- 4) Replace incidents policy: admin all, staff own rows only
drop policy if exists incidents_staff_email on public.incidents;
drop policy if exists incidents_select_admin_or_owner on public.incidents;
drop policy if exists incidents_insert_admin_or_self on public.incidents;
drop policy if exists incidents_update_admin_or_owner on public.incidents;
drop policy if exists incidents_delete_admin_only on public.incidents;

create policy incidents_select_admin_or_owner
on public.incidents
for select
to authenticated
using (
  public.current_user_role() = 'admin'
  or lower(coalesce(recorded_by_email, '')) = public.current_user_email()
);

create policy incidents_insert_admin_or_self
on public.incidents
for insert
to authenticated
with check (
  public.current_user_role() = 'admin'
  or lower(coalesce(recorded_by_email, '')) = public.current_user_email()
);

create policy incidents_update_admin_or_owner
on public.incidents
for update
to authenticated
using (
  public.current_user_role() = 'admin'
  or lower(coalesce(recorded_by_email, '')) = public.current_user_email()
)
with check (
  public.current_user_role() = 'admin'
  or lower(coalesce(recorded_by_email, '')) = public.current_user_email()
);

create policy incidents_delete_admin_only
on public.incidents
for delete
to authenticated
using (public.current_user_role() = 'admin');

-- 5) staff_email_allowlist management: admin can manage all rows; users can read own row
drop policy if exists staff_email_allowlist_select_own on public.staff_email_allowlist;
drop policy if exists staff_email_allowlist_select_admin_or_own on public.staff_email_allowlist;
drop policy if exists staff_email_allowlist_insert_admin on public.staff_email_allowlist;
drop policy if exists staff_email_allowlist_update_admin on public.staff_email_allowlist;
drop policy if exists staff_email_allowlist_delete_admin on public.staff_email_allowlist;

create policy staff_email_allowlist_select_admin_or_own
on public.staff_email_allowlist
for select
to authenticated
using (
  public.current_user_role() = 'admin'
  or email = public.current_user_email()
);

create policy staff_email_allowlist_insert_admin
on public.staff_email_allowlist
for insert
to authenticated
with check (public.current_user_role() = 'admin');

create policy staff_email_allowlist_update_admin
on public.staff_email_allowlist
for update
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy staff_email_allowlist_delete_admin
on public.staff_email_allowlist
for delete
to authenticated
using (public.current_user_role() = 'admin');
