import type { SubmittedIncident } from '../IncidentLoggerApp';
import { normalizeSeverityFromDb } from '../utils/severity';
import { supabase, withAuthTokenLockRetry } from '../lib/supabase';

const INCIDENT_LIST_COLUMNS = [
  'id',
  'submitted_at',
  'student_ids',
  'students',
  'datetime_local',
  'location',
  'infraction_type',
  'severity',
  'description',
  'actions_taken',
  'actions_other',
  'send_email_notifications',
  'student_notification_emails',
  'parent_notification_emails',
  'student_email_template',
  'parent_email_template',
  'email_status',
  'email_queued_count',
  'email_error',
  'recorded_by_email',
].join(', ');

function fromRow(row: any): SubmittedIncident {
  return {
    id: row.id,
    submittedAt: row.submitted_at,
    studentIds: row.student_ids ?? [],
    students: row.students ?? [],
    datetimeLocal: row.datetime_local ?? '',
    location: row.location ?? '',
    infractionType: row.infraction_type ?? '',
    severity: normalizeSeverityFromDb(row.severity),
    description: row.description ?? '',
    actionsTaken: row.actions_taken ?? [],
    actionsOther: row.actions_other ?? '',
    media: row.media ?? [],
    sendEmailNotifications: row.send_email_notifications ?? true,
    studentNotificationEmails: row.student_notification_emails ?? '',
    parentNotificationEmails: row.parent_notification_emails ?? '',
    studentEmailTemplate: row.student_email_template ?? '',
    parentEmailTemplate: row.parent_email_template ?? '',
    emailStatus: row.email_status ?? 'not_requested',
    emailQueuedCount: row.email_queued_count ?? 0,
    emailError: row.email_error ?? '',
    recordedByEmail: row.recorded_by_email ?? '',
  };
}

export function subscribeIncidents(onData: (incidents: SubmittedIncident[]) => void, onError?: (err: unknown) => void) {
  let alive = true;
  const fetchOnce = async () => {
    const { data, error } = await withAuthTokenLockRetry(() =>
      supabase
        .from('incidents')
        .select(INCIDENT_LIST_COLUMNS)
        .order('submitted_at', { ascending: false }),
    );
    if (!alive) return;
    if (error) {
      if (onError) onError(error);
      return;
    }
    onData((data ?? []).map(fromRow));
  };
  void fetchOnce();
  const timer = window.setInterval(() => void fetchOnce(), 5000);
  return () => {
    alive = false;
    window.clearInterval(timer);
  };
}

export async function createIncident(incident: SubmittedIncident) {
  const { error } = await withAuthTokenLockRetry(() =>
    supabase.from('incidents').insert({
      id: incident.id,
      submitted_at: incident.submittedAt,
      student_ids: incident.studentIds,
      students: incident.students,
      datetime_local: incident.datetimeLocal,
      location: incident.location,
      infraction_type: incident.infractionType,
      severity: incident.severity,
      description: incident.description,
      actions_taken: incident.actionsTaken,
      actions_other: incident.actionsOther,
      media: incident.media,
      send_email_notifications: incident.sendEmailNotifications,
      student_notification_emails: incident.studentNotificationEmails,
      parent_notification_emails: incident.parentNotificationEmails,
      student_email_template: incident.studentEmailTemplate,
      parent_email_template: incident.parentEmailTemplate,
      email_status: incident.emailStatus,
      email_queued_count: incident.emailQueuedCount,
      email_error: incident.emailError,
      recorded_by_email: incident.recordedByEmail || null,
    }),
  );
  if (error) throw error;
}

export async function updateIncident(incident: SubmittedIncident) {
  const { error } = await withAuthTokenLockRetry(() =>
    supabase
      .from('incidents')
      .update({
        student_ids: incident.studentIds,
        students: incident.students,
        datetime_local: incident.datetimeLocal,
        location: incident.location,
        infraction_type: incident.infractionType,
        severity: incident.severity,
        description: incident.description,
        actions_taken: incident.actionsTaken,
        actions_other: incident.actionsOther,
        media: incident.media,
        send_email_notifications: incident.sendEmailNotifications,
        student_notification_emails: incident.studentNotificationEmails,
        parent_notification_emails: incident.parentNotificationEmails,
        student_email_template: incident.studentEmailTemplate,
        parent_email_template: incident.parentEmailTemplate,
        email_status: incident.emailStatus,
        email_queued_count: incident.emailQueuedCount,
        email_error: incident.emailError,
        recorded_by_email: incident.recordedByEmail || null,
      })
      .eq('id', incident.id),
  );
  if (error) throw error;
}

export async function deleteIncident(id: string) {
  const { error } = await withAuthTokenLockRetry(() => supabase.from('incidents').delete().eq('id', id));
  if (error) throw error;
}

export async function fetchIncidentMedia(id: string) {
  const { data, error } = await withAuthTokenLockRetry(() =>
    supabase.from('incidents').select('media').eq('id', id).single(),
  );
  if (error) throw error;
  return (data?.media ?? []) as SubmittedIncident['media'];
}

