import type { StudentOption } from '../types/student';

export const STUDENT_OPTIONS: StudentOption[] = [
  { id: 's1', label: 'Alice Kim (301)' },
  { id: 's2', label: 'Ben Ortiz (302)' },
  { id: 's3', label: 'Chris Lee (303)' },
  { id: 's4', label: 'Dana Smith (304)' },
];

const STUDENT_LABEL_BY_ID = new Map(STUDENT_OPTIONS.map((s) => [s.id, s.label]));

export function resolveStudentLabel(value: string): string {
  return STUDENT_LABEL_BY_ID.get(value) ?? value;
}

