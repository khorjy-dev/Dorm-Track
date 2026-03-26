export type StudentRecord = {
  id: string; // Firestore doc id
  studentId: string; // school student number/id
  gradeLevel: '7' | '8' | '9' | '10' | '11' | '12';
  firstName: string;
  lastName: string;
  studentEmail: string;
  parentName: string;
  parentEmail: string;
  roomNumber: string;
  active: boolean;
};

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

