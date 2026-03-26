import React from 'react';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import IncidentLoggerApp, { type SubmittedIncident } from './IncidentLoggerApp';
import { AuthProvider, useAuth } from './auth/AuthContext';
import StaffLoginPage from './pages/StaffLoginPage';
import StaffReviewPage from './pages/StaffReviewPage';
import StudentDirectoryPage from './pages/StudentDirectoryPage';
import AllStudentsPage from './pages/AllStudentsPage';
import InfractionTypesPage from './pages/InfractionTypesPage';
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

type View = 'create' | 'review' | 'students' | 'allStudents' | 'infractions';

function AuthRoot() {
  const { user, logout, has } = useAuth();
  const [incidents, setIncidents] = React.useState<SubmittedIncident[]>([]);
  const [students, setStudents] = React.useState<StudentRecord[]>([]);
  const [infractionTypes, setInfractionTypes] = React.useState<string[]>(DEFAULT_INFRACTION_TYPES);
  const [studentLoadError, setStudentLoadError] = React.useState<string | null>(null);
  const [emailNotice, setEmailNotice] = React.useState<string | null>(null);
  const [view, setView] = React.useState<View>(() => {
    // Default view picked after login.
    return 'create';
  });

  React.useEffect(() => {
    if (!user) return;
    const unsub = subscribeStudents(
      (rows) => {
        setStudents(rows.filter((s) => s.active));
        setStudentLoadError(null);
      },
      (err) => {
        setStudentLoadError(displayError(err, 'Failed to load student directory.'));
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
      (rows) => setIncidents(rows),
      () => {
        // keep UI alive; optionally surface later
      },
    );
    return () => unsub();
  }, [user]);

  React.useEffect(() => {
    if (!user) return;
    const defaultView: View = has('incident:create') ? 'create' : 'review';
    setView(defaultView);
  }, [user, has]);

  const handleIncidentSubmitted = (incident: SubmittedIncident) => {
    void createIncident(incident)
      .then(() => {
        // list auto-refreshes via subscribeIncidents
      })
      .catch((err) => {
        setEmailNotice(`Incident save error: ${displayError(err, 'Failed to save incident.')}`);
      });

    if (!incident.sendEmailNotifications) {
      setEmailNotice('Email notifications are disabled for this incident.');
      if (has('incident:review')) setView('review');
      return;
    }

    const studentsById = new Map(students.map((s) => [s.id, s] as const));
    void queueInfractionEmails(incident, studentsById)
      .then((count) => {
        void updateIncident({
          ...incident,
          emailStatus: 'queued',
          emailQueuedCount: count,
          emailError: '',
        });
        if (count > 0) {
          setEmailNotice(`Queued ${count} email notification(s).`);
        } else {
          setEmailNotice('No recipient email addresses found for selected students.');
        }
      })
      .catch((err) => {
        const msg = displayError(err, 'Failed to queue email notifications.');
        void updateIncident({
          ...incident,
          emailStatus: 'queue_failed',
          emailQueuedCount: 0,
          emailError: msg,
        });
        setEmailNotice(`Email queue error: ${msg}`);
      });

    // After submitting, staff can review; RA stays in create view.
    if (has('incident:review')) setView('review');
  };

  const handleDeleteIncident = (id: string) => {
    void deleteIncident(id);
  };

  const handleUpdateIncident = (updatedIncident: SubmittedIncident) => {
    void updateIncident(updatedIncident);
  };

  const studentOptions = students.length > 0 ? students.map(toStudentOption) : STUDENT_OPTIONS;
  const studentLabelById = new Map<string, string>(studentOptions.map((s) => [s.id, s.label] as const));

  if (!user) return <StaffLoginPage />;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f6f7fb' }}>
      <Paper elevation={1} sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">DormTrack</Typography>
            <Typography variant="body2" color="text.secondary">
              Signed in as <b>{user.email}</b> ({user.role})
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {has('incident:create') && (
              <Button variant={view === 'create' ? 'contained' : 'outlined'} onClick={() => setView('create')}>
                Log incident
              </Button>
            )}
            {has('incident:review') && (
              <Button variant={view === 'review' ? 'contained' : 'outlined'} onClick={() => setView('review')}>
                Review incidents
              </Button>
            )}
            {has('staff:manage') && (
              <Button
                variant={view === 'infractions' ? 'contained' : 'outlined'}
                onClick={() => setView('infractions')}
              >
                Infraction types
              </Button>
            )}
            {has('staff:manage') && (
              <Button
                variant={view === 'allStudents' ? 'contained' : 'outlined'}
                onClick={() => setView('allStudents')}
              >
                Student list
              </Button>
            )}
            {has('staff:manage') && (
              <Button variant={view === 'students' ? 'contained' : 'outlined'} onClick={() => setView('students')}>
                Manage students
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
      </Box>
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
