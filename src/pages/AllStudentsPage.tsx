import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { StudentRecord } from '../types/student';
import { deleteStudent, updateStudent } from '../data/studentDirectory';

type SortField =
  | 'studentId'
  | 'gradeLevel'
  | 'name'
  | 'studentEmail'
  | 'parentName'
  | 'parentEmail';

export default function AllStudentsPage(props: { students: StudentRecord[] }) {
  const { students } = props;
  const [query, setQuery] = React.useState('');
  const [editing, setEditing] = React.useState<StudentRecord | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sortField, setSortField] = React.useState<SortField>('name');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
      return (
        fullName.includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.studentEmail.toLowerCase().includes(q) ||
        s.parentName.toLowerCase().includes(q) ||
        s.parentEmail.toLowerCase().includes(q) ||
        s.gradeLevel.toLowerCase().includes(q)
      );
    });
  }, [query, students]);

  const sorted = React.useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const getVal = (s: StudentRecord) => {
        switch (sortField) {
          case 'studentId':
            return s.studentId;
          case 'gradeLevel':
            return Number(s.gradeLevel);
          case 'name':
            return `${s.firstName} ${s.lastName}`.trim();
          case 'studentEmail':
            return s.studentEmail;
          case 'parentName':
            return s.parentName;
          case 'parentEmail':
            return s.parentEmail;
          default:
            return `${s.firstName} ${s.lastName}`.trim();
        }
      };
      const va = getVal(a);
      const vb = getVal(b);
      const result =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb));
      return sortDirection === 'asc' ? result : -result;
    });
    return rows;
  }, [filtered, sortDirection, sortField]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDirection('asc');
  };

  const SortHeader = (props: { field: SortField; label: string }) => (
    <TableCell sx={{ whiteSpace: 'nowrap' }}>
      <TableSortLabel
        active={sortField === props.field}
        direction={sortField === props.field ? sortDirection : 'asc'}
        onClick={() => handleSort(props.field)}
      >
        {props.label}
      </TableSortLabel>
    </TableCell>
  );

  const handleDelete = async (id: string) => {
    const ok = window.confirm('Delete this student? This cannot be undone.');
    if (!ok) return;
    try {
      setError(null);
      await deleteStudent(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete student.';
      setError(msg);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const { id, ...payload } = editing;
      await updateStudent(id, payload);
      setEditing(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update student.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Paper elevation={1} sx={{ p: 2.5 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Student list
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Full student directory from Firestore.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          label="Search Students"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, student ID, grade, email..."
          fullWidth
          sx={{ mb: 2 }}
        />

        {sorted.length === 0 ? (
          <Card variant="outlined" sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No students found.
            </Typography>
          </Card>
        ) : (
          <>
            {isMobile ? (
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {sorted.map((s) => (
                  <Card key={s.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      {s.firstName} {s.lastName}
                    </Typography>
                    <Typography variant="body2"><b>ID:</b> {s.studentId}</Typography>
                    <Typography variant="body2"><b>Grade:</b> {s.gradeLevel}</Typography>
                    <Typography variant="body2"><b>Student Email:</b> {s.studentEmail}</Typography>
                    <Typography variant="body2"><b>Parent:</b> {s.parentName}</Typography>
                    <Typography variant="body2"><b>Parent Email:</b> {s.parentEmail}</Typography>
                    <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => setEditing(s)}>
                        Edit
                      </Button>
                      <Button size="small" variant="outlined" color="error" onClick={() => void handleDelete(s.id)}>
                        Delete
                      </Button>
                    </Box>
                  </Card>
                ))}
              </Box>
            ) : (
              <TableContainer component={Card} variant="outlined">
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow>
                      <SortHeader field="studentId" label="Student ID" />
                      <SortHeader field="gradeLevel" label="Grade" />
                      <SortHeader field="name" label="Name" />
                      <SortHeader field="studentEmail" label="Student Email" />
                      <SortHeader field="parentName" label="Parent Name" />
                      <SortHeader field="parentEmail" label="Parent Email" />
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sorted.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.studentId}</TableCell>
                        <TableCell>{s.gradeLevel}</TableCell>
                        <TableCell>{`${s.firstName} ${s.lastName}`}</TableCell>
                        <TableCell sx={{ wordBreak: 'break-word' }}>{s.studentEmail}</TableCell>
                        <TableCell sx={{ wordBreak: 'break-word' }}>{s.parentName}</TableCell>
                        <TableCell sx={{ wordBreak: 'break-word' }}>{s.parentEmail}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <Button size="small" variant="outlined" onClick={() => setEditing(s)} sx={{ mr: 1 }}>
                            Edit
                          </Button>
                          <Button size="small" variant="outlined" color="error" onClick={() => void handleDelete(s.id)}>
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </Paper>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Edit student</DialogTitle>
        <DialogContent>
          {editing && (
            <React.Fragment>
              <TextField
                label="Student ID"
                value={editing.studentId}
                onChange={(e) => setEditing((prev) => (prev ? { ...prev, studentId: e.target.value } : prev))}
                fullWidth
                margin="dense"
              />
              <TextField
                select
                label="Grade Level"
                value={editing.gradeLevel}
                onChange={(e) =>
                  setEditing((prev) =>
                    prev ? { ...prev, gradeLevel: e.target.value as StudentRecord['gradeLevel'] } : prev,
                  )
                }
                fullWidth
                margin="dense"
              >
                <MenuItem value="7">7</MenuItem>
                <MenuItem value="8">8</MenuItem>
                <MenuItem value="9">9</MenuItem>
                <MenuItem value="10">10</MenuItem>
                <MenuItem value="11">11</MenuItem>
                <MenuItem value="12">12</MenuItem>
              </TextField>
              <TextField
                label="First Name"
                value={editing.firstName}
                onChange={(e) => setEditing((prev) => (prev ? { ...prev, firstName: e.target.value } : prev))}
                fullWidth
                margin="dense"
              />
              <TextField
                label="Last Name"
                value={editing.lastName}
                onChange={(e) => setEditing((prev) => (prev ? { ...prev, lastName: e.target.value } : prev))}
                fullWidth
                margin="dense"
              />
              <TextField
                label="Student Email"
                value={editing.studentEmail}
                onChange={(e) => setEditing((prev) => (prev ? { ...prev, studentEmail: e.target.value } : prev))}
                fullWidth
                margin="dense"
              />
              <TextField
                label="Parent Name"
                value={editing.parentName}
                onChange={(e) => setEditing((prev) => (prev ? { ...prev, parentName: e.target.value } : prev))}
                fullWidth
                margin="dense"
              />
              <TextField
                label="Parent Email"
                value={editing.parentEmail}
                onChange={(e) => setEditing((prev) => (prev ? { ...prev, parentEmail: e.target.value } : prev))}
                fullWidth
                margin="dense"
              />
            </React.Fragment>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button onClick={() => void handleSaveEdit()} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

