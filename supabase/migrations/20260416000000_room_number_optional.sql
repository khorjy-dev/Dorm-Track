-- Make student room numbers optional.
-- Safe to run multiple times.

alter table if exists public.students
  alter column room_number drop not null;
