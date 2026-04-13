-- Map legacy severity values to Level 1–4, then tighten the check constraint.
-- Drop the old check first: updating low→level_1 would fail if the constraint still only allows low/medium/high.
alter table public.incidents drop constraint if exists incidents_severity_check;

update public.incidents set severity = 'level_1' where severity = 'low';
update public.incidents set severity = 'level_2' where severity = 'medium';
update public.incidents set severity = 'level_4' where severity = 'high';

-- Coerce any remaining invalid values before adding the new check
update public.incidents
set severity = 'level_1'
where severity is null
   or trim(severity) = ''
   or severity not in ('level_1', 'level_2', 'level_3', 'level_4');

alter table public.incidents add constraint incidents_severity_check
  check (severity in ('level_1', 'level_2', 'level_3', 'level_4'));

alter table public.incidents alter column severity set default 'level_1';
