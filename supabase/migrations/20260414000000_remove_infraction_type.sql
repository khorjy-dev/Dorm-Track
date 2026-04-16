-- Remove infraction type from incident logging flow.
-- Safe to run multiple times.

alter table if exists public.incidents
  drop column if exists infraction_type;

drop policy if exists infraction_types_staff_email on public.infraction_types;

drop table if exists public.infraction_types;
