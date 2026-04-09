import React from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Snackbar, Stack, Typography } from '@mui/material';
import IncidentLoggerApp, { type SubmittedIncident } from './IncidentLoggerApp';
import { AuthProvider, useAuth } from './auth/AuthContext';
import StaffLoginPage from './pages/StaffLoginPage';
import StaffReviewPage from './pages/StaffReviewPage';
import StudentDirectoryPage from './pages/StudentDirectoryPage';
import AllStudentsPage from './pages/AllStudentsPage';
import InfractionTypesPage from './pages/InfractionTypesPage';
import AdminUsersPage from './pages/AdminUsersPage';
import { subscribeStudents } from './data/studentDirectory';
import { resolveStudentLabel, STUDENT_OPTIONS } from './data/students';
import { toStudentOption, type StudentRecord } from './types/student';
import { DEFAULT_INFRACTION_TYPES } from './data/infractionTypes';
import { queueInfractionEmails } from './data/incidentEmailQueue';
import { createIncident, deleteIncident, subscribeIncidents, updateIncident } from './data/incidentStore';
import { replaceInfractionTypes, subscribeInfractionTypes } from './data/infractionTypesStore';

function displayError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: string }).message;
    if (typeof m === 'string' && m.length > 0) return m;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

type View = 'create' | 'review' | 'students' | 'allStudents' | 'infractions' | 'users';
const VIEW_STORAGE_KEY = 'dormtrack:view';

function isView(value: unknown): value is View {
  return (
    value === 'create' ||
    value === 'review' ||
    value === 'students' ||
    value === 'allStudents' ||
    value === 'infractions' ||
    value === 'users'
  );
}

function AuthRoot() {
  const { user, logout, has, loading } = useAuth();
  const [incidents, setIncidents] = React.useState<SubmittedIncident[]>([]);
  const [students, setStudents] = React.useState<StudentRecord[]>([]);
  const [infractionTypes, setInfractionTypes] = React.useState<string[]>(DEFAULT_INFRACTION_TYPES);
  const [studentLoadError, setStudentLoadError] = React.useState<string | null>(null);
  const [incidentsLoadError, setIncidentsLoadError] = React.useState<string | null>(null);
  const [emailNotice, setEmailNotice] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ message: string; severity: 'info' | 'warning' | 'error' } | null>(null);
  const [view, setView] = React.useState<View>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(VIEW_STORAGE_KEY) : null;
    return isView(stored) ? stored : 'create';
  });

  const setViewAndPersist = React.useCallback((next: View) => {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  }, []);

  React.useEffect(() => {
    if (!user) return;
    const unsub = subscribeStudents(
      (rows) => {
        setStudents(rows.filter((s) => s.active));
        setStudentLoadError(null);
      },
      (err) => {
        const msg = displayError(err, 'Failed to load student directory.');
        setStudentLoadError(msg);
        setToast({ message: msg, severity: 'warning' });
      },
    );
    return () => unsub();
  }, [user]);

  React.useEffect(() => {
    if (!user) return;
    const unsub = subscribeInfractionTypes(
      (types) => setInfractionTypes(types),
      () => {
        // keep defaults when unavailable
      },
    );
    return () => unsub();
  }, [user]);

  React.useEffect(() => {
    if (!user) return;
    const unsub = subscribeIncidents(
      (rows) => {
        setIncidents(rows);
        setIncidentsLoadError(null);
      },
      (err) => {
        const msg = displayError(err, 'Failed to load incidents.');
        setIncidentsLoadError(msg);
        setToast({ message: msg, severity: 'warning' });
      },
    );
    return () => unsub();
  }, [user]);

  React.useEffect(() => {
    if (!user) return;
    const canUseCurrent =
      (view === 'create' && has('incident:create')) ||
      (view === 'review' && has('incident:review')) ||
      ((view === 'students' || view === 'allStudents' || view === 'infractions') && has('staff:manage')) ||
      (view === 'users' && has('users:manage'));
    if (canUseCurrent) return;
    const fallback: View = has('incident:create') ? 'create' : has('incident:review') ? 'review' : 'create';
    setViewAndPersist(fallback);
  }, [user, has, view, setViewAndPersist]);

  const handleIncidentSubmitted = async (incident: SubmittedIncident) => {
    const withRecorder = { ...incident, recordedByEmail: user?.email?.trim() ?? '' };
    await createIncident(withRecorder);
    // Show immediate success and reflect the new row before polling catches up.
    setIncidents((prev) => (prev.some((x) => x.id === withRecorder.id) ? prev : [withRecorder, ...prev]));
    setEmailNotice('Incident successfully logged.');
    setToast({ message: 'Incident successfully logged.', severity: 'info' });

    if (withRecorder.sendEmailNotifications) {
      const studentsById = new Map(students.map((s) => [s.id, s] as const));
      try {
        const count = await queueInfractionEmails(withRecorder, studentsById);
        await updateIncident({
          ...withRecorder,
          emailStatus: 'queued',
          emailQueuedCount: count,
          emailError: '',
        });
        setEmailNotice(
          count > 0
            ? `Incident successfully logged. Queued ${count} email notification(s).`
            : 'Incident successfully logged. No recipient email addresses found for selected students.',
        );
        setToast({
          message:
            count > 0
              ? `Queued ${count} email notification(s).`
              : 'No recipient email addresses found for selected students.',
          severity: 'info',
        });
      } catch (err) {
        const msg = displayError(err, 'Failed to queue email notifications.');
        await updateIncident({
          ...withRecorder,
          emailStatus: 'queue_failed',
          emailQueuedCount: 0,
          emailError: msg,
        });
        setEmailNotice(`Incident successfully logged. Email queue error: ${msg}`);
        setToast({ message: `Email queue error: ${msg}`, severity: 'error' });
      }
    } else {
      setEmailNotice('Incident successfully logged. Email notifications are disabled for this incident.');
      setToast({ message: 'Incident logged. Email notifications are disabled.', severity: 'info' });
    }

    // After submitting, staff can review; RA stays in create view.
    if (has('incident:review')) setViewAndPersist('review');
  };

  const handleDeleteIncident = (id: string) => {
    void deleteIncident(id)
      .then(() => {
        setIncidents((prev) => prev.filter((x) => x.id !== id));
        setEmailNotice('Record has been deleted.');
        setToast({ message: 'Record has been deleted.', severity: 'info' });
      })
      .catch((err) => {
        const msg = displayError(err, 'Failed to delete record.');
        setEmailNotice(`Delete error: ${msg}`);
        setToast({ message: `Delete error: ${msg}`, severity: 'error' });
      });
  };

  const handleUpdateIncident = (updatedIncident: SubmittedIncident) => {
    void updateIncident(updatedIncident);
  };

  const studentOptions = students.length > 0 ? students.map(toStudentOption) : STUDENT_OPTIONS;
  const studentLabelById = new Map<string, string>(studentOptions.map((s) => [s.id, s.label] as const));

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#f6f7fb' }}>
        <Stack spacing={1.5} alignItems="center">
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary">
            Restoring session...
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (!user) return <StaffLoginPage />;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f6f7fb' }}>
      <Paper elevation={1} sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">Incident Track</Typography>
            <Typography variant="body2" color="text.secondary">
              Signed in as <b>{user.email}</b> ({user.role})
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {has('incident:create') && (
              <Button variant={view === 'create' ? 'contained' : 'outlined'} onClick={() => setViewAndPersist('create')}>
                Log incident
              </Button>
            )}
            {has('incident:review') && (
              <Button variant={view === 'review' ? 'contained' : 'outlined'} onClick={() => setViewAndPersist('review')}>
                Review incidents
              </Button>
            )}
            {has('staff:manage') && (
              <Button
                variant={view === 'infractions' ? 'contained' : 'outlined'}
                onClick={() => setViewAndPersist('infractions')}
              >
                Infraction types
              </Button>
            )}
            {has('staff:manage') && (
              <Button
                variant={view === 'allStudents' ? 'contained' : 'outlined'}
                onClick={() => setViewAndPersist('allStudents')}
              >
                Student list
              </Button>
            )}
            {has('staff:manage') && (
              <Button variant={view === 'students' ? 'contained' : 'outlined'} onClick={() => setViewAndPersist('students')}>
                Manage students
              </Button>
            )}
            {has('users:manage') && (
              <Button variant={view === 'users' ? 'contained' : 'outlined'} onClick={() => setViewAndPersist('users')}>
                Manage users
              </Button>
            )}
            <Button variant="text" color="inherit" onClick={logout}>
              Sign out
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Box sx={{ mt: 2 }}>
        {studentLoadError && (
          <Box sx={{ px: 2 }}>
            <Alert severity="warning">{studentLoadError}</Alert>
          </Box>
        )}
        {incidentsLoadError && (
          <Box sx={{ px: 2, mt: 1 }}>
            <Alert severity="warning" onClose={() => setIncidentsLoadError(null)}>
              {incidentsLoadError}
            </Alert>
          </Box>
        )}
        {emailNotice && (
          <Box sx={{ px: 2, mt: 1 }}>
            <Alert severity="info" onClose={() => setEmailNotice(null)}>
              {emailNotice}
            </Alert>
          </Box>
        )}
        {view === 'create' && has('incident:create') && (
          <IncidentLoggerApp
            onIncidentSubmitted={handleIncidentSubmitted}
            studentOptions={studentOptions}
            infractionTypes={infractionTypes}
          />
        )}

        {view === 'review' && has('incident:review') && (
          <StaffReviewPage
            incidents={incidents}
            onDeleteIncident={handleDeleteIncident}
            onUpdateIncident={handleUpdateIncident}
            resolveStudent={(value) => studentLabelById.get(value) ?? resolveStudentLabel(value)}
          />
        )}

        {view === 'students' && has('staff:manage') && <StudentDirectoryPage />}
        {view === 'infractions' && has('staff:manage') && (
          <InfractionTypesPage
            infractionTypes={infractionTypes}
            onChange={(next) => {
              setInfractionTypes(next);
              void replaceInfractionTypes(next).catch((err) => {
                const msg = err && typeof err === 'object' && 'message' in err ? String((err as any).message) : 'Failed to save infraction types.';
                setEmailNotice(`Infraction types save error: ${msg}`);
              });
            }}
          />
        )}
        {view === 'allStudents' && has('staff:manage') && <AllStudentsPage students={students} />}
        {view === 'users' && has('users:manage') && <AdminUsersPage />}
      </Box>
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setToast(null)} severity={toast?.severity ?? 'info'} variant="filled">
          {toast?.message ?? ''}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthRoot />
    </AuthProvider>
  );
}
