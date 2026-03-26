-- DormTrack schema (Supabase/Postgres)
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_id text not null unique,
  grade_level text not null check (grade_level in ('7','8','9','10','11','12')),
  first_name text not null,
  last_name text not null,
  student_email text not null,
  parent_name text not null,
  parent_email text not null,
  room_number text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.infraction_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position int not null default 1,
  created_at timestamptz not null default now()
);

-- Maps a Supabase Auth user to an application role (ra/staff/admin).
-- This replaces the previous Firestore-based `users/{uid}` role document.
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('ra','staff','admin')) default 'staff',
  created_at timestamptz not null default now()
);

create table if not exists public.incidents (
  id text primary key,
  submitted_at timestamptz not null default now(),
  student_ids text[] not null default '{}',
  students text[] not null default '{}',
  datetime_local text not null default '',
  location text not null default '',
  infraction_type text not null default '',
  severity text not null default 'low' check (severity in ('low','medium','high')),
  description text not null default '',
  actions_taken text[] not null default '{}',
  actions_other text not null default '',
  media jsonb not null default '[]'::jsonb,
  send_email_notifications boolean not null default true,
  student_email_template text not null default '',
  parent_email_template text not null default '',
  email_status text not null default 'not_requested' check (email_status in ('not_requested','queued','queue_failed')),
  email_queued_count int not null default 0,
  email_error text not null default '',
  created_at timestamptz not null default now()
);

-- Queue collection for email trigger extensions/functions.
create table if not exists public.mail (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  message jsonb not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Basic permissive policies for prototyping (tighten before production).
alter table public.students enable row level security;
alter table public.infraction_types enable row level security;
alter table public.user_roles enable row level security;
alter table public.incidents enable row level security;
alter table public.mail enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='students' and policyname='students_all_auth') then
    create policy students_all_auth on public.students for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='infraction_types' and policyname='infraction_types_all_auth') then
    create policy infraction_types_all_auth on public.infraction_types for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='incidents' and policyname='incidents_all_auth') then
    create policy incidents_all_auth on public.incidents for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='mail' and policyname='mail_all_auth') then
    create policy mail_all_auth on public.mail for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_roles' and policyname='user_roles_select_own') then
    create policy user_roles_select_own on public.user_roles
      for select to authenticated using (user_id = auth.uid());
  end if;
end
$$;

-- Anonymous key (VITE_SUPABASE_ANON_KEY) uses role `anon`. Firebase login does not set Supabase JWT,
-- so without these policies inserts/selects fail. Tighten before production (e.g. Supabase Auth + policies).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='students' and policyname='students_all_anon') then
    create policy students_all_anon on public.students for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='infraction_types' and policyname='infraction_types_all_anon') then
    create policy infraction_types_all_anon on public.infraction_types for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='incidents' and policyname='incidents_all_anon') then
    create policy incidents_all_anon on public.incidents for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='mail' and policyname='mail_all_anon') then
    create policy mail_all_anon on public.mail for all to anon using (true) with check (true);
  end if;
end
$$;

-- Seed defaults once.
insert into public.infraction_types(name, position)
values
  ('Curfew', 1),
  ('Noise', 2),
  ('Missing from room', 3),
  ('Guest violation', 4),
  ('Other', 5)
on conflict (name) do nothing;

