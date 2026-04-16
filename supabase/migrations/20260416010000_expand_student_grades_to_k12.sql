-- Expand student grade levels from 7-12 to K-12.
-- Safe to run multiple times.

alter table if exists public.students
  drop constraint if exists students_grade_level_check;

alter table if exists public.students
  add constraint students_grade_level_check
  check (grade_level in ('K','1','2','3','4','5','6','7','8','9','10','11','12'));
