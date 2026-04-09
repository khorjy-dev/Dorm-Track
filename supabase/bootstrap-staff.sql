-- Add or update a staff member by email (must match the Google account email, lowercased).
-- Run in Supabase SQL Editor as a database admin.

-- insert into public.staff_email_allowlist (email, role)
-- values ('teacher@yourschool.edu', 'admin')
-- on conflict (email) do update set role = excluded.role;

-- Roles: 'staff' | 'admin'
