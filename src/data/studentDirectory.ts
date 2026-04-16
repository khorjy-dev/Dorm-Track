import { supabase, withAuthTokenLockRetry } from '../lib/supabase';
import type { StudentRecord } from '../types/student';

export function subscribeStudents(onData: (students: StudentRecord[]) => void, onError?: (err: unknown) => void) {
  let alive = true;

  const fetchOnce = async () => {
    const { data, error } = await withAuthTokenLockRetry(() =>
      supabase
        .from('students')
        .select('*')
        .order('first_name', { ascending: true }),
    );

    if (!alive) return;
    if (error) {
      if (onError) onError(error);
      return;
    }

    const students: StudentRecord[] = (data ?? []).map((row: any) => ({
      id: row.id,
      studentId: row.student_id ?? '',
      gradeLevel: (row.grade_level as StudentRecord['gradeLevel']) ?? '9',
      firstName: row.first_name ?? '',
      lastName: row.last_name ?? '',
      studentEmail: row.student_email ?? '',
      parentName: row.parent_name ?? '',
      parentEmail: row.parent_email ?? '',
      roomNumber: row.room_number ?? '',
      active: row.active ?? true,
    }));
    onData(students);
  };

  void fetchOnce();
  const timer = window.setInterval(() => void fetchOnce(), 5000);
  return () => {
    alive = false;
    window.clearInterval(timer);
  };
}

export async function createStudent(input: Omit<StudentRecord, 'id'>) {
  const { error } = await supabase.from('students').insert({
    student_id: input.studentId,
    grade_level: input.gradeLevel,
    first_name: input.firstName,
    last_name: input.lastName,
    student_email: input.studentEmail,
    parent_name: input.parentName,
    parent_email: input.parentEmail,
    room_number: input.roomNumber.trim() || null,
    active: input.active,
  });
  if (error) throw error;
}

export async function updateStudent(id: string, input: Omit<StudentRecord, 'id'>) {
  const { error } = await supabase
    .from('students')
    .update({
      student_id: input.studentId,
      grade_level: input.gradeLevel,
      first_name: input.firstName,
      last_name: input.lastName,
      student_email: input.studentEmail,
      parent_name: input.parentName,
      parent_email: input.parentEmail,
      room_number: input.roomNumber.trim() || null,
      active: input.active,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteStudent(id: string) {
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) throw error;
}

