import type { SubmittedIncident } from '../IncidentLoggerApp';
import type { StudentRecord } from '../types/student';
import { supabase } from '../lib/supabase';

type Recipient = {
  email: string;
  name: string;
  relation: 'student' | 'parent';
};

function buildRecipients(students: StudentRecord[]): Recipient[] {
  const out: Recipient[] = [];
  for (const s of students) {
    if (s.studentEmail?.trim()) {
      out.push({
        email: s.studentEmail.trim(),
        name: `${s.firstName} ${s.lastName}`.trim(),
        relation: 'student',
      });
    }
    if (s.parentEmail?.trim()) {
      out.push({
        email: s.parentEmail.trim(),
        name: s.parentName.trim() || `${s.firstName} ${s.lastName} Parent`,
        relation: 'parent',
      });
    }
  }
  return out;
}

export async function queueInfractionEmails(incident: SubmittedIncident, studentsById: Map<string, StudentRecord>) {
  const involved = incident.studentIds
    .map((id) => studentsById.get(id))
    .filter((s): s is StudentRecord => Boolean(s));

  const recipients = buildRecipients(involved);
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

  const { error } = await supabase.from('mail').insert(payload);
  if (error) throw error;

  return recipients.length;
}

