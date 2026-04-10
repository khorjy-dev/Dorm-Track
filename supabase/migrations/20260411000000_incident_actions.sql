-- Admin-managed "Actions taken" options for incident logging.
create table if not exists public.incident_actions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position int not null default 1,
  created_at timestamptz not null default now()
);

alter table public.incident_actions enable row level security;

drop policy if exists incident_actions_admin_only on public.incident_actions;
drop policy if exists incident_actions_select_staff on public.incident_actions;
drop policy if exists incident_actions_write_admin on public.incident_actions;
drop policy if exists incident_actions_admin_all on public.incident_actions;

-- All allowlisted staff can read options for incident logging.
create policy incident_actions_select_staff
on public.incident_actions
for select
to authenticated
using (exists (
  select 1 from public.staff_email_allowlist a
  where a.email = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
));

-- Admins can manage rows (insert/update/delete; select also allowed for admins via this or the policy above).
create policy incident_actions_admin_all
on public.incident_actions
for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

insert into public.incident_actions(name, position)
values
  ('Warning given', 1),
  ('Parents notified', 2),
  ('Security notified', 3),
  ('Confiscated item', 4),
  ('Other', 5)
on conflict (name) do nothing;
