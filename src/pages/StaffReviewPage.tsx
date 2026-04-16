import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
  TextField,
  Button,
  MenuItem,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import type { Severity, SubmittedIncident } from '../IncidentLoggerApp';
import { formatSeverityLabel, SEVERITY_OPTIONS } from '../utils/severity';
import { severityChipColor } from '../utils/severityChipColor';
import { fetchIncidentMedia } from '../data/incidentStore';

type EditDraft = {
  datetimeLocal: string;
  location: string;
  severity: Severity;
  description: string;
  studentsCsv: string;
};

export default function StaffReviewPage(props: {
  incidents: SubmittedIncident[];
  onDeleteIncident: (id: string) => void;
  onUpdateIncident: (incident: SubmittedIncident) => void;
  resolveStudent: (value: string) => string;
}) {
  const { incidents, onDeleteIncident, onUpdateIncident, resolveStudent } = props;

  const [dateFrom, setDateFrom] = React.useState<string>('');
  const [dateTo, setDateTo] = React.useState<string>('');
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [studentFilter, setStudentFilter] = React.useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = React.useState<Severity | ''>('');
  const [editingIncidentId, setEditingIncidentId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<EditDraft | null>(null);
  const [detailsIncidentId, setDetailsIncidentId] = React.useState<string | null>(null);
  const [deleteConfirmIncidentId, setDeleteConfirmIncidentId] = React.useState<string | null>(null);
  const [detailsMediaById, setDetailsMediaById] = React.useState<Record<string, SubmittedIncident['media']>>({});
  const [detailsMediaLoading, setDetailsMediaLoading] = React.useState(false);

  const allStudentIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const inc of incidents) {
      for (const s of inc.students) set.add(resolveStudent(s));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [incidents, resolveStudent]);

  const filteredIncidents = React.useMemo(() => {
    const from = dateFrom?.trim();
    const to = dateTo?.trim();
    const query = searchTerm.trim().toLowerCase();

    return incidents.filter((inc) => {
      const datePart = (inc.datetimeLocal || '').slice(0, 10); // YYYY-MM-DD
      const displayStudents = inc.students.map(resolveStudent);
      const searchIndex = [
        inc.location,
        inc.description,
        inc.recordedByEmail,
        formatSeverityLabel(inc.severity),
        displayStudents.join(' '),
      ]
        .join(' ')
        .toLowerCase();

      if (from && datePart < from) return false;
      if (to && datePart > to) return false;

      if (studentFilter && !displayStudents.includes(studentFilter)) return false;
      if (severityFilter && inc.severity !== severityFilter) return false;
      if (query && !searchIndex.includes(query)) return false;
      return true;
    });
  }, [incidents, dateFrom, dateTo, searchTerm, studentFilter, severityFilter, resolveStudent]);

  const editingIncident = React.useMemo(
    () => incidents.find((x) => x.id === editingIncidentId) ?? null,
    [editingIncidentId, incidents],
  );

  const detailsIncident = React.useMemo(
    () => incidents.find((x) => x.id === detailsIncidentId) ?? null,
    [detailsIncidentId, incidents],
  );

  React.useEffect(() => {
    if (!detailsIncidentId) return;
    if (detailsMediaById[detailsIncidentId]) return;

    setDetailsMediaLoading(true);
    void fetchIncidentMedia(detailsIncidentId)
      .then((media) => {
        setDetailsMediaById((prev) => ({ ...prev, [detailsIncidentId]: media }));
      })
      .catch(() => {
        setDetailsMediaById((prev) => ({ ...prev, [detailsIncidentId]: [] }));
      })
      .finally(() => setDetailsMediaLoading(false));
  }, [detailsIncidentId, detailsMediaById]);

  const openEdit = (incident: SubmittedIncident) => {
    setEditingIncidentId(incident.id);
    setDraft({
      datetimeLocal: incident.datetimeLocal,
      location: incident.location,
      severity: incident.severity,
      description: incident.description,
      studentsCsv: incident.students.join(', '),
    });
  };

  const closeEdit = () => {
    setEditingIncidentId(null);
    setDraft(null);
  };

  const closeDetails = () => {
    setDetailsIncidentId(null);
    setDetailsMediaLoading(false);
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirmIncidentId(null);
  };

  const confirmDelete = () => {
    if (!deleteConfirmIncidentId) return;
    onDeleteIncident(deleteConfirmIncidentId);
    setDeleteConfirmIncidentId(null);
  };

  const saveEdit = () => {
    if (!editingIncident || !draft) return;
    const students = draft.studentsCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const updated: SubmittedIncident = {
      ...editingIncident,
      datetimeLocal: draft.datetimeLocal,
      location: draft.location,
      severity: draft.severity,
      description: draft.description,
      students: students.map(resolveStudent),
    };

    onUpdateIncident(updated);
    closeEdit();
  };

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Paper elevation={1} sx={{ p: 2.5 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Submitted incidents
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            mb: 2,
          }}
        >
          <TextField
            label="Date From"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Date To"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type, location, description, student, or recorder"
            sx={{ gridColumn: { xs: '1 / -1', sm: '1 / -1' } }}
          />

          <Box sx={{ gridColumn: { xs: '1 / -1', sm: '1 / -1' } }}>
            <Autocomplete
              options={allStudentIds}
              value={studentFilter}
              onChange={(_, newValue) => setStudentFilter(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Student"
                  placeholder="Filter by student (optional)"
                />
              )}
              clearOnEscape
              sx={{ maxWidth: 520 }}
            />
          </Box>

          <Box sx={{ maxWidth: 280 }}>
            <TextField
              select
              label="Severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as Severity | '')}
              fullWidth
            >
              <MenuItem value="">All levels</MenuItem>
              {SEVERITY_OPTIONS.map((s) => (
                <MenuItem key={s} value={s}>
                  {formatSeverityLabel(s)}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setSearchTerm('');
                setStudentFilter(null);
                setSeverityFilter('');
              }}
              disabled={!dateFrom && !dateTo && !searchTerm && !studentFilter && !severityFilter}
            >
              Clear filters
            </Button>
          </Box>
        </Box>

        {incidents.length === 0 ? (
          <Card variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
            <Typography variant="body2" color="text.secondary">
              No incidents submitted yet.
            </Typography>
          </Card>
        ) : (
          <>
            {filteredIncidents.length === 0 ? (
              <Card variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
                <Typography variant="body2" color="text.secondary">
                  No incidents match your filters.
                </Typography>
              </Card>
            ) : (
              <List disablePadding>
                {filteredIncidents
                  .slice()
                  .sort((a, b) => (a.submittedAt > b.submittedAt ? -1 : 1))
                  .map((inc) => (
                    <React.Fragment key={inc.id}>
                      <ListItem
                        alignItems="flex-start"
                        onClick={() => setDetailsIncidentId(inc.id)}
                        sx={{ py: 2, cursor: 'pointer' }}
                        role="button"
                        tabIndex={0}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                              <Typography variant="subtitle2">Incident</Typography>
                              <Chip
                                size="small"
                                label={formatSeverityLabel(inc.severity)}
                                color={severityChipColor(inc.severity)}
                              />
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'grid', gap: 0.25, mt: 0.5 }}>
                              <Typography variant="body2">
                                <b>When:</b> {inc.datetimeLocal}
                              </Typography>
                              {inc.recordedByEmail.trim() ? (
                                <Typography variant="body2">
                                  <b>Recorded By:</b> {inc.recordedByEmail}
                                </Typography>
                              ) : null}
                              <Typography variant="body2">
                                <b>Where:</b> {inc.location}
                              </Typography>
                              <Typography variant="body2">
                                <b>Students:</b> {inc.students.map(resolveStudent).join(', ')}
                              </Typography>
                              <Typography variant="body2">
                                <b>Actions:</b> {inc.actionsTaken.join(', ') || 'None'}
                              </Typography>
                              <Typography variant="body2">
                                <b>Email Status:</b>{' '}
                                {inc.sendEmailNotifications
                                  ? inc.emailStatus === 'sent'
                                    ? `Sent (${inc.emailQueuedCount})`
                                    : inc.emailStatus === 'queued'
                                      ? `Queued (${inc.emailQueuedCount})`
                                      : inc.emailStatus === 'queue_failed'
                                        ? `Failed${inc.emailError ? ` - ${inc.emailError}` : ''}`
                                        : 'Pending'
                                  : 'Disabled'}
                              </Typography>
                              {inc.media.length > 0 && (
                                <Typography variant="body2">
                                  <b>Media:</b> {inc.media.length} attachment(s)
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ml: 1 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(inc);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmIncidentId(inc.id);
                            }}
                          >
                            Delete
                          </Button>
                        </Box>
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))}
              </List>
            )}
          </>
        )}
      </Paper>

      <Dialog open={Boolean(editingIncident && draft)} onClose={closeEdit} fullWidth maxWidth="sm">
        <DialogTitle>Edit Incident</DialogTitle>
        <DialogContent>
          {draft && (
            <Box sx={{ display: 'grid', gap: 1.5, mt: 0.5 }}>
              <TextField
                label="When"
                type="datetime-local"
                value={draft.datetimeLocal}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, datetimeLocal: e.target.value } : prev))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Location"
                value={draft.location}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, location: e.target.value } : prev))}
                fullWidth
              />
              <TextField
                select
                label="Severity"
                value={draft.severity}
                onChange={(e) =>
                  setDraft((prev) => (prev ? { ...prev, severity: e.target.value as Severity } : prev))
                }
                fullWidth
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {formatSeverityLabel(s)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Students (Comma-Separated)"
                value={draft.studentsCsv}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, studentsCsv: e.target.value } : prev))}
                fullWidth
              />
              <TextField
                label="Description"
                value={draft.description}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                multiline
                minRows={3}
                fullWidth
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>Cancel</Button>
          <Button onClick={saveEdit} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(detailsIncident)} onClose={closeDetails} fullWidth maxWidth="md">
        <DialogTitle>Incident Details</DialogTitle>
        <DialogContent dividers>
          {!detailsIncident ? null : (
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              {/** Media is loaded lazily for faster review list loading. */}
              {(() => {
                const detailsMedia = detailsIncidentId ? detailsMediaById[detailsIncidentId] : undefined;
                const media = detailsMedia ?? detailsIncident.media ?? [];
                return (
                  <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Typography variant="h6">Incident</Typography>
                <Chip
                  size="small"
                  label={formatSeverityLabel(detailsIncident.severity)}
                  color={severityChipColor(detailsIncident.severity)}
                />
              </Box>

              <Divider />

              <Typography variant="body2">
                <b>ID:</b> {detailsIncident.id}
              </Typography>
              <Typography variant="body2">
                <b>Submitted By:</b> {detailsIncident.recordedByEmail.trim() || 'Unknown'}
              </Typography>
              <Typography variant="body2">
                <b>Submitted At:</b> {detailsIncident.submittedAt}
              </Typography>
              <Typography variant="body2">
                <b>When:</b> {detailsIncident.datetimeLocal}
              </Typography>
              <Typography variant="body2">
                <b>Where:</b> {detailsIncident.location}
              </Typography>
              <Typography variant="body2">
                <b>Students:</b> {detailsIncident.students.map(resolveStudent).join(', ')}
              </Typography>

              <Typography variant="body2">
                <b>Actions:</b> {detailsIncident.actionsTaken.join(', ') || 'None'}
              </Typography>
              {detailsIncident.actionsOther?.trim() ? (
                <Typography variant="body2">
                  <b>Other Actions:</b> {detailsIncident.actionsOther}
                </Typography>
              ) : null}

              <Typography variant="body2">
                <b>Description:</b>
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {detailsIncident.description?.trim() ? detailsIncident.description : 'No description added'}
              </Typography>

              <Divider />

              <Typography variant="body2">
                <b>Email Notifications:</b> {detailsIncident.sendEmailNotifications ? 'Enabled' : 'Disabled'}
              </Typography>
              {detailsIncident.sendEmailNotifications ? (
                <Typography variant="body2">
                  <b>Email Status:</b>{' '}
                  {detailsIncident.emailStatus === 'sent'
                    ? `Sent (${detailsIncident.emailQueuedCount})`
                    : detailsIncident.emailStatus === 'queued'
                      ? `Queued (${detailsIncident.emailQueuedCount})`
                      : detailsIncident.emailStatus === 'queue_failed'
                        ? `Failed${detailsIncident.emailError ? ` - ${detailsIncident.emailError}` : ''}`
                        : detailsIncident.emailStatus === 'not_requested'
                          ? 'Not requested'
                          : 'Pending'}
                </Typography>
              ) : null}

              {detailsIncident.sendEmailNotifications ? (
                <>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    <b>Student notification recipients:</b>
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {detailsIncident.studentNotificationEmails?.trim() || '—'}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    <b>Parent notification recipients:</b>
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {detailsIncident.parentNotificationEmails?.trim() || '—'}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    <b>Student Email Template:</b>
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {detailsIncident.studentEmailTemplate}
                  </Typography>

                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    <b>Parent Email Template:</b>
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {detailsIncident.parentEmailTemplate}
                  </Typography>
                </>
              ) : null}

              <Divider />

              <Box sx={{ display: 'grid', gap: 1 }}>
                <Typography variant="body2">
                  <b>Media:</b>{' '}
                  {detailsMediaLoading
                    ? 'Loading...'
                    : media.length
                      ? `${media.length} attachment(s)`
                      : 'None'}
                </Typography>

                {media.length ? (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                      gap: 1.5,
                    }}
                  >
                    {media.map((m, idx) => {
                      const mm = m as unknown as { kind?: string; fileName?: string; dataUrl?: string };
                      const src = mm.dataUrl;
                      const fileName = mm.fileName ?? `attachment_${idx + 1}`;
                      const kind = mm.kind === 'video' ? 'video' : 'image';

                      return (
                        <Card key={`${m.id}-${idx}`} variant="outlined">
                          {src ? (
                            kind === 'image' ? (
                              <CardMedia
                                component="img"
                                image={src}
                                alt={fileName}
                                sx={{ width: '100%', height: 200, objectFit: 'cover' }}
                              />
                            ) : (
                              <Box sx={{ bgcolor: '#000', width: '100%', height: 200 }}>
                                <video
                                  src={src}
                                  controls
                                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                              </Box>
                            )
                          ) : (
                            <Box sx={{ p: 2 }}>
                              <Typography variant="body2" color="text.secondary">
                                Media preview not stored
                              </Typography>
                            </Box>
                          )}
                          <CardContent sx={{ p: 1 }}>
                            <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {fileName}
                            </Typography>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                ) : null}
              </Box>
                  </>
                );
              })()}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDetails}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteConfirmIncidentId)} onClose={closeDeleteConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Record?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Do you want to delete record?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteConfirm}>No</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            Yes
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

