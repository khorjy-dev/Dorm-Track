-- DormTrack schema (Supabase/Postgres)
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_id text not null unique,
  grade_level text not null check (grade_level in ('K','1','2','3','4','5','6','7','8','9','10','11','12')),
  first_name text not null,
  last_name text not null,
  student_email text not null,
  parent_name text not null,
  parent_email text not null,
  room_number text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.incident_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.incident_actions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position int not null default 1,
  created_at timestamptz not null default now()
);

-- Legacy: user_id -> role (optional; app uses staff_email_allowlist).
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('staff','admin')) default 'staff',
  created_at timestamptz not null default now()
);

-- Who may use the app: one row per allowed school email (lowercase). See bootstrap-staff.sql.
create table if not exists public.staff_email_allowlist (
  email text primary key,
  role text not null check (role in ('staff','admin')) default 'staff',
  created_at timestamptz not null default now(),
  constraint staff_email_allowlist_email_lower check (email = lower(email))
);

create table if not exists public.incidents (
  id text primary key,
  submitted_at timestamptz not null default now(),
  student_ids text[] not null default '{}',
  students text[] not null default '{}',
  datetime_local text not null default '',
  location text not null default '',
  severity text not null default 'level_1' check (severity in ('level_1','level_2','level_3','level_4')),
  description text not null default '',
  actions_taken text[] not null default '{}',
  actions_other text not null default '',
  media jsonb not null default '[]'::jsonb,
  send_email_notifications boolean not null default true,
  student_notification_emails text not null default '',
  parent_notification_emails text not null default '',
  student_email_template text not null default '',
  parent_email_template text not null default '',
  email_status text not null default 'not_requested' check (email_status in ('not_requested','queued','queue_failed','sent')),
  email_queued_count int not null default 0,
  email_error text not null default '',
  recorded_by_email text,
  created_at timestamptz not null default now()
);

-- Queue collection for email trigger extensions/functions.
create table if not exists public.mail (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  message jsonb not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  send_error text
);

-- Used by Edge Function send-mail to know when all recipients for an incident were sent.
create or replace function public.mail_send_stats_for_incident(incident_id text)
returns table(total_count bigint, sent_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::bigint,
    count(*) filter (where sent_at is not null)::bigint
  from public.mail
  where coalesce(metadata->>'incidentId','') = incident_id;
$$;

revoke all on function public.mail_send_stats_for_incident(text) from public;
grant execute on function public.mail_send_stats_for_incident(text) to service_role;
grant execute on function public.mail_send_stats_for_incident(text) to postgres;

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

-- Row level security: JWT email must exist in staff_email_allowlist. Bootstrap: supabase/bootstrap-staff.sql
alter table public.students enable row level security;
alter table public.incident_locations enable row level security;
alter table public.incident_actions enable row level security;
alter table public.user_roles enable row level security;
alter table public.staff_email_allowlist enable row level security;
alter table public.incidents enable row level security;
alter table public.mail enable row level security;

do $$
begin
  drop policy if exists staff_email_allowlist_select_own on public.staff_email_allowlist;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='staff_email_allowlist' and policyname='staff_email_allowlist_select_admin_or_own') then
    create policy staff_email_allowlist_select_admin_or_own on public.staff_email_allowlist
      for select to authenticated
      using (
        public.current_user_role() = 'admin'
        or email = public.current_user_email()
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='staff_email_allowlist' and policyname='staff_email_allowlist_insert_admin') then
    create policy staff_email_allowlist_insert_admin on public.staff_email_allowlist
      for insert to authenticated
      with check (public.current_user_role() = 'admin');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='staff_email_allowlist' and policyname='staff_email_allowlist_update_admin') then
    create policy staff_email_allowlist_update_admin on public.staff_email_allowlist
      for update to authenticated
      using (public.current_user_role() = 'admin')
      with check (public.current_user_role() = 'admin');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='staff_email_allowlist' and policyname='staff_email_allowlist_delete_admin') then
    create policy staff_email_allowlist_delete_admin on public.staff_email_allowlist
      for delete to authenticated
      using (public.current_user_role() = 'admin');
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='students' and policyname='students_staff_email') then
    create policy students_staff_email on public.students
      for all to authenticated
      using (exists (
        select 1 from public.staff_email_allowlist a
        where a.email = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      ))
      with check (exists (
        select 1 from public.staff_email_allowlist a
        where a.email = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='incident_locations' and policyname='incident_locations_admin_only') then
    create policy incident_locations_admin_only on public.incident_locations
      for all to authenticated
      using (public.current_user_role() = 'admin')
      with check (public.current_user_role() = 'admin');
  end if;
  drop policy if exists incident_actions_admin_only on public.incident_actions;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='incident_actions' and policyname='incident_actions_select_staff') then
    create policy incident_actions_select_staff on public.incident_actions
      for select to authenticated
      using (exists (
        select 1 from public.staff_email_allowlist a
        where a.email = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      ));
  end if;
  drop policy if exists incident_actions_write_admin on public.incident_actions;
  drop policy if exists incident_actions_admin_all on public.incident_actions;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='incident_actions' and policyname='incident_actions_admin_all') then
    create policy incident_actions_admin_all on public.incident_actions
      for all to authenticated
      using (public.current_user_role() = 'admin')
      with check (public.current_user_role() = 'admin');
  end if;
  drop policy if exists incidents_staff_email on public.incidents;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='incidents' and policyname='incidents_select_admin_or_owner') then
    create policy incidents_select_admin_or_owner on public.incidents
      for select to authenticated
      using (
        public.current_user_role() = 'admin'
        or lower(coalesce(recorded_by_email, '')) = public.current_user_email()
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='incidents' and policyname='incidents_insert_admin_or_self') then
    create policy incidents_insert_admin_or_self on public.incidents
      for insert to authenticated
      with check (
        public.current_user_role() = 'admin'
        or lower(coalesce(recorded_by_email, '')) = public.current_user_email()
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='incidents' and policyname='incidents_update_admin_or_owner') then
    create policy incidents_update_admin_or_owner on public.incidents
      for update to authenticated
      using (
        public.current_user_role() = 'admin'
        or lower(coalesce(recorded_by_email, '')) = public.current_user_email()
      )
      with check (
        public.current_user_role() = 'admin'
        or lower(coalesce(recorded_by_email, '')) = public.current_user_email()
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='incidents' and policyname='incidents_delete_admin_only') then
    create policy incidents_delete_admin_only on public.incidents
      for delete to authenticated
      using (public.current_user_role() = 'admin');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='mail' and policyname='mail_staff_email') then
    create policy mail_staff_email on public.mail
      for all to authenticated
      using (exists (
        select 1 from public.staff_email_allowlist a
        where a.email = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      ))
      with check (exists (
        select 1 from public.staff_email_allowlist a
        where a.email = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      ));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_roles' and policyname='user_roles_select_own') then
    create policy user_roles_select_own on public.user_roles
      for select to authenticated using (user_id = auth.uid());
  end if;
end
$$;

insert into public.incident_locations(name, position)
values
  ('3rd Floor Hallway', 1),
  ('Common Room', 2),
  ('Outside Entrance', 3),
  ('Student Room', 4)
on conflict (name) do nothing;

insert into public.incident_actions(name, position)
values
  ('Warning given', 1),
  ('Parents notified', 2),
  ('Security notified', 3),
  ('Confiscated item', 4),
  ('Other', 5)
on conflict (name) do nothing;

