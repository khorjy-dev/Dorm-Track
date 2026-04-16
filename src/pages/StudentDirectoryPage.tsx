import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { createStudent } from '../data/studentDirectory';

type GradeLevel = '7' | '8' | '9' | '10' | '11' | '12';

const REQUIRED_HEADERS = [
  'student_id',
  'grade_level',
  'first_name',
  'last_name',
  'student_email',
  'parent_name',
  'parent_email',
] as const;

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

export default function StudentDirectoryPage() {
  const [studentId, setStudentId] = React.useState('');
  const [gradeLevel, setGradeLevel] = React.useState<GradeLevel>('9');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [studentEmail, setStudentEmail] = React.useState('');
  const [parentName, setParentName] = React.useState('');
  const [parentEmail, setParentEmail] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const canSave =
    studentId.trim() &&
    gradeLevel &&
    firstName.trim() &&
    lastName.trim() &&
    studentEmail.trim() &&
    parentName.trim() &&
    parentEmail.trim();

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await createStudent({
        studentId: studentId.trim(),
        gradeLevel,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        studentEmail: studentEmail.trim(),
        parentName: parentName.trim(),
        parentEmail: parentEmail.trim(),
        roomNumber: '',
        active: true,
      });
      setStudentId('');
      setGradeLevel('9');
      setFirstName('');
      setLastName('');
      setStudentEmail('');
      setParentName('');
      setParentEmail('');
      setMessage('Student created.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create student.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const raw = await file.text();
      const lines = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        throw new Error('CSV must include a header row and at least one data row.');
      }

      const headers = parseCsvLine(lines[0]).map(normalizeHeader);
      const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
      if (missing.length > 0) {
        throw new Error(`CSV missing required column(s): ${missing.join(', ')}`);
      }

      const headerIndex = new Map(headers.map((h, idx) => [h, idx]));
      const getValue = (row: string[], key: string) =>
        (row[headerIndex.get(key) ?? -1] ?? '').trim();

      let created = 0;
      for (let i = 1; i < lines.length; i += 1) {
        const row = parseCsvLine(lines[i]);
        const grade = getValue(row, 'grade_level') as GradeLevel;
        if (!['7', '8', '9', '10', '11', '12'].includes(grade)) {
          throw new Error(`Invalid grade_level at row ${i + 1}: "${grade}"`);
        }

        await createStudent({
          studentId: getValue(row, 'student_id'),
          gradeLevel: grade,
          firstName: getValue(row, 'first_name'),
          lastName: getValue(row, 'last_name'),
          studentEmail: getValue(row, 'student_email'),
          parentName: getValue(row, 'parent_name'),
          parentEmail: getValue(row, 'parent_email'),
          roomNumber: headerIndex.has('room_number') ? getValue(row, 'room_number') : '',
          active: true,
        });
        created += 1;
      }

      setMessage(`CSV upload complete. Added ${created} student(s).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to import CSV.';
      setError(msg);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Paper elevation={1} sx={{ p: 2.5 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Add Student
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Add students to Firestore so incident forms can select real names.
        </Typography>

        <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Bulk Upload via CSV
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Required columns: student_id, grade_level, first_name, last_name, student_email, parent_name, parent_email
          </Typography>
          <Button component="label" variant="outlined" disabled={saving}>
            {saving ? 'Uploading...' : 'Upload CSV'}
            <input
              ref={fileInputRef}
              hidden
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvUpload}
            />
          </Button>
        </Card>

        <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField
                label="Student ID"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                fullWidth
                required
              />
              <TextField
                select
                label="Grade Level"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value as '7' | '8' | '9' | '10' | '11' | '12')}
                fullWidth
                required
              >
                <MenuItem value="7">7</MenuItem>
                <MenuItem value="8">8</MenuItem>
                <MenuItem value="9">9</MenuItem>
                <MenuItem value="10">10</MenuItem>
                <MenuItem value="11">11</MenuItem>
                <MenuItem value="12">12</MenuItem>
              </TextField>
            </Box>

            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField
                label="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                fullWidth
                required
              />
              <TextField
                label="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                fullWidth
                required
              />
            </Box>

            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField
                label="Student Email"
                type="email"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                fullWidth
                required
              />
            </Box>

            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField
                label="Parent Name"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                fullWidth
                required
              />
              <TextField
                label="Parent Email"
                type="email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                fullWidth
                required
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 0.5 }}>
              <Button variant="contained" disabled={!canSave || saving} onClick={handleSave}>
                {saving ? 'Saving...' : 'Add student'}
              </Button>
            </Box>
          </Box>
          {message && <Alert sx={{ mt: 1.5 }} severity="success">{message}</Alert>}
          {error && <Alert sx={{ mt: 1.5 }} severity="error">{error}</Alert>}
        </Card>
      </Paper>
    </Container>
  );
}

