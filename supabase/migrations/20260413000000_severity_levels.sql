-- Map legacy severity values to Level 1–4, then tighten the check constraint.
update public.incidents set severity = 'level_1' where severity = 'low';
update public.incidents set severity = 'level_2' where severity = 'medium';
update public.incidents set severity = 'level_4' where severity = 'high';

alter table public.incidents drop constraint if exists incidents_severity_check;

alter table public.incidents add constraint incidents_severity_check
  check (severity in ('level_1', 'level_2', 'level_3', 'level_4'));

alter table public.incidents alter column severity set default 'level_1';
