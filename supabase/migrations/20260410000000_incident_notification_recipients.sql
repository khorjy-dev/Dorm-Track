-- Editable recipient lists for student/parent notification emails (incident log UI).
alter table public.incidents
  add column if not exists student_notification_emails text not null default '',
  add column if not exists parent_notification_emails text not null default '';
