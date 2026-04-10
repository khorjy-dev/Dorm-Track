import type { SubmittedIncident } from '../IncidentLoggerApp';
import type { StudentRecord } from '../types/student';
import { supabase, withAuthTokenLockRetry } from '../lib/supabase';

type Recipient = {
  email: string;
  name: string;
  relation: 'student' | 'parent';
};

export function defaultStudentNotificationEmails(involved: StudentRecord[]): string {
  const emails = [...new Set(involved.map((s) => s.studentEmail.trim()).filter(Boolean))];
  return emails.join(', ');
}

export function defaultParentNotificationEmails(involved: StudentRecord[]): string {
  const emails = [...new Set(involved.map((s) => s.parentEmail.trim()).filter(Boolean))];
  return emails.join(', ');
}

/** Split user-editable recipient field (comma/semicolon/newline). Dedupe, preserve order. */
export function parseNotificationEmailList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\n]+/)) {
    const e = part.trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push(part.trim());
  }
  return out;
}

function nameForRecipient(
  email: string,
  relation: 'student' | 'parent',
  involved: StudentRecord[],
): string {
  const e = email.trim().toLowerCase();
  if (relation === 'student') {
    const s = involved.find((x) => x.studentEmail.trim().toLowerCase() === e);
    if (s) return `${s.firstName} ${s.lastName}`.trim();
  } else {
    const s = involved.find((x) => x.parentEmail.trim().toLowerCase() === e);
    if (s) {
      const pn = s.parentName.trim();
      if (pn) return pn;
      return `${s.firstName} ${s.lastName}`.trim() || 'Parent';
    }
  }
  const names = involved.map((s) => `${s.firstName} ${s.lastName}`.trim()).filter(Boolean);
  return names.length ? names.join(', ') : 'Recipient';
}

function buildRecipientsFromIncident(incident: SubmittedIncident, involved: StudentRecord[]): Recipient[] {
  const out: Recipient[] = [];
  for (const email of parseNotificationEmailList(incident.studentNotificationEmails)) {
    out.push({
      email,
      name: nameForRecipient(email, 'student', involved),
      relation: 'student',
    });
  }
  for (const email of parseNotificationEmailList(incident.parentNotificationEmails)) {
    out.push({
      email,
      name: nameForRecipient(email, 'parent', involved),
      relation: 'parent',
    });
  }
  return out;
}

export async function queueInfractionEmails(incident: SubmittedIncident, studentsById: Map<string, StudentRecord>) {
  const involved = incident.studentIds
    .map((id) => studentsById.get(id))
    .filter((s): s is StudentRecord => Boolean(s));

  const recipients = buildRecipientsFromIncident(incident, involved);
  if (recipients.length === 0) return 0;

  const commonVars = {
    students: incident.students.join(', '),
    datetime: incident.datetimeLocal,
    location: incident.location,
    infractionType: incident.infractionType,
    severity: incident.severity.toUpperCase(),
    description: incident.description || 'N/A',
    actions: incident.actionsTaken.join(', ') || 'None',
  };

  const replaceVars = (template: string, name: string) =>
    template
      .replaceAll('{{name}}', name)
      .replaceAll('{{students}}', commonVars.students)
      .replaceAll('{{datetime}}', commonVars.datetime)
      .replaceAll('{{location}}', commonVars.location)
      .replaceAll('{{infractionType}}', commonVars.infractionType)
      .replaceAll('{{severity}}', commonVars.severity)
      .replaceAll('{{description}}', commonVars.description)
      .replaceAll('{{actions}}', commonVars.actions);

  const subject = `Dorm infraction notice: ${incident.infractionType}`;

  const payload = recipients.map((r) => ({
    to_email: r.email,
    message: {
      subject,
      text:
        r.relation === 'student'
          ? replaceVars(incident.studentEmailTemplate, r.name)
          : replaceVars(incident.parentEmailTemplate, r.name),
    },
    metadata: {
      incidentId: incident.id,
      relation: r.relation,
      source: 'dormtrack-web',
    },
  }));

  const { error } = await withAuthTokenLockRetry(() => supabase.from('mail').insert(payload));
  if (error) throw error;

  return recipients.length;
}
