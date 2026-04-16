export const GRADE_LEVELS = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const;

export type StudentRecord = {
  id: string; // Supabase row id
  studentId: string; // school student number/id
  gradeLevel: (typeof GRADE_LEVELS)[number];
  firstName: string;
  lastName: string;
  studentEmail: string;
  parentName: string;
  parentEmail: string;
  roomNumber: string;
  active: boolean;
};

export function getGradeLevelSortValue(gradeLevel: StudentRecord['gradeLevel']): number {
  return gradeLevel === 'K' ? 0 : Number(gradeLevel);
}

export type StudentOption = {
  id: string;
  label: string;
};

export function toStudentOption(student: StudentRecord): StudentOption {
  const fullName = `${student.firstName} ${student.lastName}`.trim();
  const roomText = student.roomNumber ? ` (${student.roomNumber})` : '';
  return {
    id: student.id,
    label: `${fullName}${roomText}`,
  };
}

