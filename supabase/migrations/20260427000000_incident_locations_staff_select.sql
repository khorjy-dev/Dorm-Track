-- Staff need SELECT on incident_locations to load dropdown options when logging incidents.
-- Previously only admins could access the table; empty reads fell back to hardcoded defaults.

alter table public.incident_locations enable row level security;

drop policy if exists incident_locations_admin_only on public.incident_locations;
drop policy if exists incident_locations_select_staff on public.incident_locations;

create policy incident_locations_select_staff
on public.incident_locations
for select
to authenticated
using (exists (
  select 1 from public.staff_email_allowlist a
  where a.email = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
));

drop policy if exists incident_locations_admin_all on public.incident_locations;

create policy incident_locations_admin_all
on public.incident_locations
for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');
