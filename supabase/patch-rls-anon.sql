-- Run once in Supabase SQL Editor if incidents/students fail with RLS (anon role).
-- App uses VITE_SUPABASE_ANON_KEY; Firebase does not grant Supabase "authenticated".

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
