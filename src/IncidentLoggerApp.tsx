import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Collapse,
  Container,
  IconButton,
  MenuItem,
  Paper,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import DeleteIcon from '@mui/icons-material/Delete';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import { DEFAULT_ACTIONS_TAKEN } from './data/actionsTaken';
import { resolveStudentLabel, STUDENT_OPTIONS } from './data/students';
import {
  defaultParentNotificationEmails,
  defaultStudentNotificationEmails,
} from './data/incidentEmailQueue';
import type { StudentOption, StudentRecord } from './types/student';
import { formatSeverityLabel, SEVERITY_OPTIONS, type Severity } from './utils/severity';
import { severityChipColor } from './utils/severityChipColor';
import { messageFromUnknown } from './utils/errorMessage';

export type { Severity };

type MediaKind = 'image' | 'video';

type MediaItem = {
  id: string;
  file: File;
  previewUrl: string;
  kind: MediaKind;
};

export type IncidentMediaMeta = {
  id: string;
  fileName: string;
  kind: MediaKind;
  // Stored as a data URL so other staff users can view the attachment later.
  // Note: this can be large; tighten/replace with storage (Supabase Storage) in production.
  dataUrl?: string;
};

export type SubmittedIncident = {
  id: string;
  submittedAt: string; // ISO
  studentIds: string[];
  students: string[];
  datetimeLocal: string;
  location: string;
  infractionType: string;
  severity: Severity;
  description: string;
  actionsTaken: string[];
  actionsOther: string;
  media: IncidentMediaMeta[];
  sendEmailNotifications: boolean;
  studentNotificationEmails: string;
  parentNotificationEmails: string;
  studentEmailTemplate: string;
  parentEmailTemplate: string;
  emailStatus: 'not_requested' | 'queued' | 'queue_failed' | 'sent';
  emailQueuedCount: number;
  emailError: string;
  /** Set by App from the signed-in user when saving; empty in the logger form. */
  recordedByEmail: string;
};

type IncidentFormState = {
  students: string[]; // student ids
  datetimeLocal: string; // value for <input type="datetime-local">
  location: string;
  infractionType: string;
  severity: Severity;
  description: string;
  actionsTaken: string[];
  actionsOther: string;
  media: MediaItem[];
  sendEmailNotifications: boolean;
  studentNotificationEmails: string;
  parentNotificationEmails: string;
  studentEmailTemplate: string;
  parentEmailTemplate: string;
};

const locationOptions = ['3rd Floor Hallway', 'Common Room', 'Outside Entrance', 'Student Room'] as const;

const severityOptions = SEVERITY_OPTIONS;

function toLocalDatetimeInput(d: Date) {
  // Creates "YYYY-MM-DDTHH:mm" in local time for datetime-local.
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function makeId(prefix = 'm') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

const DEFAULT_STUDENT_EMAIL_TEMPLATE =
  'Hello {{name}},\n\nAn infraction has been logged.\nStudents: {{students}}\nDate/Time: {{datetime}}\nLocation: {{location}}\nType: {{infractionType}}\nSeverity: {{severity}}\nDescription: {{description}}\nActions: {{actions}}';

const DEFAULT_PARENT_EMAIL_TEMPLATE =
  'Hello {{name}},\n\nThis is to notify you that a student infraction has been logged.\nStudents: {{students}}\nDate/Time: {{datetime}}\nLocation: {{location}}\nType: {{infractionType}}\nSeverity: {{severity}}\nDescription: {{description}}\nActions: {{actions}}';

export default function IncidentLoggerApp(props: {
  onIncidentSubmitted?: (incident: SubmittedIncident) => Promise<void> | void;
  studentOptions?: StudentOption[];
  /** Directory rows for selected students — used to pre-fill notification recipient fields. */
  studentRecords?: StudentRecord[];
  infractionTypes?: string[];
  locationOptions?: string[];
  /** Action chips on the Details step (from admin-managed list). */
  actionsTakenOptions?: string[];
}) {
  const {
    onIncidentSubmitted,
    studentOptions = STUDENT_OPTIONS,
    studentRecords = [],
    infractionTypes = ['Other'],
    locationOptions: locationOptionsProp = locationOptions as unknown as string[],
    actionsTakenOptions: actionsTakenOptionsProp = DEFAULT_ACTIONS_TAKEN,
  } = props;
  const actionsTakenOptions = actionsTakenOptionsProp.filter(Boolean);
  const actionsTakenOptionsKey = actionsTakenOptions.join('\0');
  const studentLabelById = React.useMemo(() => {
    return new Map(studentOptions.map((s) => [s.id, s.label]));
  }, [studentOptions]);

  const studentsById = React.useMemo(
    () => new Map(studentRecords.map((s) => [s.id, s] as const)),
    [studentRecords],
  );
  const studentsByIdRef = React.useRef(studentsById);
  studentsByIdRef.current = studentsById;
  const notificationRecipientsSyncedForKey = React.useRef<string>('');

  const [activeStep, setActiveStep] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState<IncidentFormState>({
    students: [],
    datetimeLocal: toLocalDatetimeInput(new Date()),
    location: '',
    infractionType: '',
    severity: 'level_1',
    description: '',
    actionsTaken: [],
    actionsOther: '',
    media: [],
    sendEmailNotifications: false,
    studentNotificationEmails: '',
    parentNotificationEmails: '',
    studentEmailTemplate: DEFAULT_STUDENT_EMAIL_TEMPLATE,
    parentEmailTemplate: DEFAULT_PARENT_EMAIL_TEMPLATE,
  });

  const steps = ['Basics', 'Details', 'Media', 'Review'] as const;

  React.useEffect(() => {
    // Cleanup object URLs on unmount.
    return () => {
      form.media.forEach((m) => URL.revokeObjectURL(m.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedStudentsKey = [...form.students].sort().join(',');
  React.useEffect(() => {
    if (activeStep !== 1) return;
    if (selectedStudentsKey === notificationRecipientsSyncedForKey.current) return;
    notificationRecipientsSyncedForKey.current = selectedStudentsKey;
    const map = studentsByIdRef.current;
    const involved = form.students.map((id) => map.get(id)).filter((s): s is StudentRecord => Boolean(s));
    setForm((prev) => ({
      ...prev,
      studentNotificationEmails: defaultStudentNotificationEmails(involved),
      parentNotificationEmails: defaultParentNotificationEmails(involved),
    }));
  }, [activeStep, selectedStudentsKey]);

  React.useEffect(() => {
    setForm((prev) => {
      const filtered = prev.actionsTaken.filter((a) => actionsTakenOptions.includes(a));
      const stillOther = filtered.includes('Other');
      if (filtered.length === prev.actionsTaken.length && stillOther === prev.actionsTaken.includes('Other')) {
        return prev;
      }
      return {
        ...prev,
        actionsTaken: filtered,
        actionsOther: stillOther ? prev.actionsOther : '',
      };
    });
  }, [actionsTakenOptionsKey]);

  const canProceedBasics =
    form.students.length > 0 &&
    form.datetimeLocal.trim().length > 0 &&
    form.location.trim().length > 0 &&
    form.infractionType.trim().length > 0;

  const handleNext = () => setActiveStep((s) => Math.min(s + 1, steps.length - 1));
  const handleBack = () => setActiveStep((s) => Math.max(s - 1, 0));

  const onSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Convert attached files to data URLs so they can be rendered later by other staff users.
      // This is a prototype approach; for production use Supabase Storage instead.
      const mediaToRevoke = form.media;
      const mediaWithData: IncidentMediaMeta[] =
        form.media.length === 0
          ? []
          : await Promise.all(
              form.media.map(async (m) => {
                const dataUrl = await fileToDataUrl(m.file);
                return {
                  id: m.id,
                  fileName: m.file.name,
                  kind: m.kind,
                  dataUrl,
                };
              }),
            );

      const incident: SubmittedIncident = {
        id: makeId('incident'),
        submittedAt: new Date().toISOString(),
        studentIds: form.students,
        students: form.students.map((id) => studentLabelById.get(id) ?? resolveStudentLabel(id)),
        datetimeLocal: form.datetimeLocal,
        location: form.location,
        infractionType: form.infractionType,
        severity: form.severity,
        description: form.description,
        actionsTaken: form.actionsTaken,
        actionsOther: form.actionsOther,
        media: mediaWithData,
        sendEmailNotifications: form.sendEmailNotifications,
        studentNotificationEmails: form.studentNotificationEmails,
        parentNotificationEmails: form.parentNotificationEmails,
        studentEmailTemplate: form.studentEmailTemplate,
        parentEmailTemplate: form.parentEmailTemplate,
        emailStatus: form.sendEmailNotifications ? 'not_requested' : 'not_requested',
        emailQueuedCount: 0,
        emailError: '',
        recordedByEmail: '',
      };

      if (onIncidentSubmitted) {
        await onIncidentSubmitted(incident);
      } else {
        alert('Incident submitted (mock).');
      }

      // Clean up local object URLs (we also store permanent data URLs now).
      mediaToRevoke.forEach((m) => URL.revokeObjectURL(m.previewUrl));

      notificationRecipientsSyncedForKey.current = '';
      setActiveStep(0);
      setForm({
        students: [],
        datetimeLocal: toLocalDatetimeInput(new Date()),
        location: '',
        infractionType: '',
        severity: 'level_1',
        description: '',
        actionsTaken: [],
        actionsOther: '',
        media: [],
        sendEmailNotifications: false,
        studentNotificationEmails: '',
        parentNotificationEmails: '',
        studentEmailTemplate: DEFAULT_STUDENT_EMAIL_TEMPLATE,
        parentEmailTemplate: DEFAULT_PARENT_EMAIL_TEMPLATE,
      });
    } catch (err) {
      setSubmitError(
        messageFromUnknown(err, 'Failed to prepare incident data for submit.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f6f7fb' }}>
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Paper elevation={1} sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6">Incident Track</Typography>
            <Typography variant="body2" color="text.secondary">
              Incident Logging
            </Typography>
          </Box>

          <Stepper activeStep={activeStep} sx={{ mb: 2 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {activeStep === 0 && (
            <BasicsStep
              form={form}
              setForm={setForm}
              studentsOptions={studentOptions}
              locationOptions={locationOptionsProp}
              infractionTypes={infractionTypes}
              canProceed={canProceedBasics}
              onNext={handleNext}
            />
          )}

          {activeStep === 1 && (
            <DetailsStep
              form={form}
              setForm={setForm}
              onBack={handleBack}
              onNext={handleNext}
              actionsTakenOptions={actionsTakenOptions}
            />
          )}

          {activeStep === 2 && <MediaStep form={form} setForm={setForm} onBack={handleBack} onNext={handleNext} />}

          {activeStep === 3 && (
            <ReviewStep
              form={form}
              onBack={handleBack}
              onSubmit={onSubmit}
              studentLabelById={studentLabelById}
              isSubmitting={isSubmitting}
              submitError={submitError}
            />
          )}
        </Paper>
      </Container>
    </Box>
  );
}

function BasicsStep(props: {
  form: IncidentFormState;
  setForm: React.Dispatch<React.SetStateAction<IncidentFormState>>;
  studentsOptions: StudentOption[];
  locationOptions: string[];
  infractionTypes: readonly string[];
  canProceed: boolean;
  onNext: () => void;
}) {
  const { form, setForm, studentsOptions, locationOptions, infractionTypes, canProceed, onNext } = props;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Start with who was involved, when it happened, and where.
      </Typography>

      <Autocomplete
        multiple
        options={studentsOptions}
        value={studentsOptions.filter((s) => form.students.includes(s.id))}
        onChange={(_, newValue) => {
          setForm((prev) => ({
            ...prev,
            students: newValue.map((s) => s.id),
          }));
        }}
        getOptionLabel={(option) => option.label}
        renderTags={(tagValue, getTagProps) =>
          tagValue.map((option, index) => (
            <Chip label={option.label} size="small" {...getTagProps({ index })} />
          ))
        }
        renderInput={(params) => (
          <TextField {...params} label="Students Involved" placeholder="Search and Select" required />
        )}
        sx={{ mb: 2 }}
      />

      <Box sx={{ display: 'grid', gap: 2, mb: 2 }}>
        <Box>
          <TextField
            label="Date & Time"
            type="datetime-local"
            value={form.datetimeLocal}
            onChange={(e) => setForm((prev) => ({ ...prev, datetimeLocal: e.target.value }))}
            required
            fullWidth
          />
        </Box>

        <Box>
          <TextField
            select
            label="Location"
            value={form.location}
            onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
            required
            fullWidth
          >
            <MenuItem value="" disabled>
              Select location
            </MenuItem>
            {locationOptions.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Infraction Type
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {infractionTypes.map((t) => {
          const active = form.infractionType === t;
          return (
            <Button
              key={t}
              variant={active ? 'contained' : 'outlined'}
              onClick={() => setForm((prev) => ({ ...prev, infractionType: t }))}
              size="small"
              sx={{ borderRadius: '999px' }}
            >
              {t}
            </Button>
          );
        })}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button variant="contained" onClick={onNext} disabled={!canProceed} sx={{ px: 3 }}>
          Next
        </Button>
      </Box>
    </Box>
  );
}

function DetailsStep(props: {
  form: IncidentFormState;
  setForm: React.Dispatch<React.SetStateAction<IncidentFormState>>;
  onBack: () => void;
  onNext: () => void;
  actionsTakenOptions: string[];
}) {
  const { form, setForm, onBack, onNext, actionsTakenOptions } = props;

  const toggleAction = (value: string) => {
    setForm((prev) => {
      const exists = prev.actionsTaken.includes(value);
      const next = exists ? prev.actionsTaken.filter((a) => a !== value) : [...prev.actionsTaken, value];
      return {
        ...prev,
        actionsTaken: next,
        actionsOther: value === 'Other' && !next.includes('Other') ? '' : prev.actionsOther,
      };
    });
  };

  const needsOther = form.actionsTaken.includes('Other');

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Add a brief description and note any immediate actions taken.
      </Typography>

      <TextField
        label="Description"
        required
        multiline
        minRows={4}
        value={form.description}
        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
        fullWidth
        sx={{ mb: 2 }}
        placeholder="Briefly describe what happened, who was present, and any immediate actions taken..."
      />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Severity
      </Typography>
      <ToggleButtonGroup
        exclusive
        value={form.severity}
        onChange={(_, v) => {
          if (!v) return;
          setForm((prev) => ({ ...prev, severity: v }));
        }}
        sx={{ mb: 2 }}
      >
        {severityOptions.map((s) => (
          <ToggleButton key={s} value={s}>
            {formatSeverityLabel(s)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Actions Taken
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {actionsTakenOptions.map((a) => {
          const active = form.actionsTaken.includes(a);
          return (
            <Button
              key={a}
              variant={active ? 'contained' : 'outlined'}
              onClick={() => toggleAction(a)}
              size="small"
              sx={{ borderRadius: '999px' }}
            >
              {a}
            </Button>
          );
        })}
      </Box>

      {needsOther && (
        <TextField
          label="Other Actions (Details)"
          value={form.actionsOther}
          onChange={(e) => setForm((prev) => ({ ...prev, actionsOther: e.target.value }))}
          fullWidth
          placeholder="Describe the other action taken..."
          sx={{ mb: 1 }}
        />
      )}

      <Typography variant="subtitle2" sx={{ mb: 1.25, mt: 0.5 }}>
        Notifications
      </Typography>

      <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
        Email templates and sending
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
        <Button
          variant={form.sendEmailNotifications ? 'contained' : 'outlined'}
          onClick={() => setForm((prev) => ({ ...prev, sendEmailNotifications: true }))}
          size="small"
        >
          Email ON
        </Button>
        <Button
          variant={!form.sendEmailNotifications ? 'contained' : 'outlined'}
          onClick={() => setForm((prev) => ({ ...prev, sendEmailNotifications: false }))}
          size="small"
        >
          Email OFF
        </Button>
      </Box>

      <Collapse in={form.sendEmailNotifications} timeout="auto" unmountOnExit>
        <Box sx={{ display: 'grid', gap: 1.25, mb: 1, pt: 0.25 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {`Use placeholders: {{name}}, {{students}}, {{datetime}}, {{location}}, {{infractionType}}, {{severity}}, {{description}}, {{actions}}`}
          </Typography>
          <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>
            Notification recipients
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -0.5 }}>
            Pulled from the student directory for the students you selected (when you open this step or change
            students). Edit anytime. Separate multiple addresses with commas.
          </Typography>
          <TextField
            label="Student notification recipients"
            value={form.studentNotificationEmails}
            onChange={(e) => setForm((prev) => ({ ...prev, studentNotificationEmails: e.target.value }))}
            fullWidth
            placeholder="student1@school.org, student2@school.org"
            helperText="Student template is sent to each address listed here."
            multiline
            minRows={2}
            variant="outlined"
          />
          <TextField
            label="Parent notification recipients"
            value={form.parentNotificationEmails}
            onChange={(e) => setForm((prev) => ({ ...prev, parentNotificationEmails: e.target.value }))}
            fullWidth
            placeholder="parent1@email.com"
            helperText="Parent template is sent to each address listed here."
            multiline
            minRows={2}
            variant="outlined"
          />
          <Typography variant="subtitle2" sx={{ mt: 0.5 }}>
            Email templates
          </Typography>
          <TextField
            label="Student Email Template"
            value={form.studentEmailTemplate}
            onChange={(e) => setForm((prev) => ({ ...prev, studentEmailTemplate: e.target.value }))}
            multiline
            minRows={3}
            fullWidth
          />
          <TextField
            label="Parent Email Template"
            value={form.parentEmailTemplate}
            onChange={(e) => setForm((prev) => ({ ...prev, parentEmailTemplate: e.target.value }))}
            multiline
            minRows={3}
            fullWidth
            helperText="Use the same placeholders as above."
          />
        </Box>
      </Collapse>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button variant="outlined" onClick={onBack} sx={{ px: 3 }}>
          Back
        </Button>
        <Button variant="contained" onClick={onNext} sx={{ px: 3 }}>
          Next
        </Button>
      </Box>
    </Box>
  );
}

function MediaStep(props: {
  form: IncidentFormState;
  setForm: React.Dispatch<React.SetStateAction<IncidentFormState>>;
  onBack: () => void;
  onNext: () => void;
}) {
  const { form, setForm, onBack, onNext } = props;

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const nextItems: MediaItem[] = Array.from(files).map((file) => {
      const kind: MediaKind = file.type.startsWith('video/') ? 'video' : 'image';
      return {
        id: makeId('media'),
        file,
        previewUrl: URL.createObjectURL(file),
        kind,
      };
    });

    setForm((prev) => ({
      ...prev,
      media: [...prev.media, ...nextItems],
    }));
  };

  const removeMedia = (id: string) => {
    setForm((prev) => {
      const hit = prev.media.find((m) => m.id === id);
      if (hit) URL.revokeObjectURL(hit.previewUrl);
      return { ...prev, media: prev.media.filter((m) => m.id !== id) };
    });
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Optional: attach photos or videos for context.
      </Typography>

      <Box
        onDrop={onDrop}
        onDragOver={onDragOver}
        sx={{
          border: '2px dashed',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'rgba(0,0,0,0.02)',
          p: 2,
          mb: 2,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Drag & drop files here, or use the upload buttons.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, mt: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Button variant="outlined" component="label" startIcon={<PhotoCameraOutlinedIcon />}>
              Upload from device
              <input hidden type="file" multiple accept="image/*,video/*" onChange={(e) => addFiles(e.target.files)} />
            </Button>
          </Box>

          <Box sx={{ flex: 1 }}>
            <Button variant="outlined" component="label" startIcon={<PhotoCameraOutlinedIcon />}>
              Take photo/video
              <input
                hidden
                type="file"
                accept="image/*,video/*"
                capture="environment"
                onChange={(e) => addFiles(e.target.files)}
              />
            </Button>
          </Box>
        </Box>
      </Box>

      {form.media.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Attached media ({form.media.length})
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
            {form.media.map((m) => (
              <Box key={m.id}>
                <Card variant="outlined">
                  {m.kind === 'image' ? (
                    <CardMedia component="img" height="110" image={m.previewUrl} alt="Incident attachment" />
                  ) : (
                    <Box sx={{ bgcolor: '#000', height: 110, display: 'flex', alignItems: 'center' }}>
                      <video
                        src={m.previewUrl}
                        controls
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </Box>
                  )}

                  <CardContent sx={{ p: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.file.name}
                      </Typography>
                      <IconButton size="small" onClick={() => removeMedia(m.id)} aria-label="Remove Media">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        </>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button variant="outlined" onClick={onBack} sx={{ px: 3 }}>
          Back
        </Button>
        <Button variant="contained" onClick={onNext} sx={{ px: 3 }}>
          Next
        </Button>
      </Box>
    </Box>
  );
}

function ReviewStep(props: {
  form: IncidentFormState;
  onBack: () => void;
  onSubmit: () => void | Promise<void>;
  studentLabelById: Map<string, string>;
  isSubmitting: boolean;
  submitError: string | null;
}) {
  const { form, onBack, onSubmit, studentLabelById, isSubmitting, submitError } = props;

  const severityLabel = formatSeverityLabel(form.severity);
  const studentLabels = form.students.map((s) => studentLabelById.get(s) ?? s);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Review before submitting.
      </Typography>

      <Box sx={{ display: 'grid', gap: 1.5 }}>
        {submitError ? <Alert severity="error">{submitError}</Alert> : null}
        <SummaryRow label="Students" value={studentLabels.length ? studentLabels.join(', ') : 'None'} />
        <SummaryRow label="When" value={form.datetimeLocal || 'Not set'} />
        <SummaryRow label="Location" value={form.location || 'Not set'} />
        <SummaryRow label="Infraction Type" value={form.infractionType || 'Not set'} />
        <SummaryRow
          label="Severity"
          value={<Chip size="small" label={severityLabel} color={severityChipColor(form.severity)} />}
        />
        <SummaryRow
          label="Actions Taken"
          value={form.actionsTaken.length ? form.actionsTaken.join(', ') : 'None'}
        />
        {form.actionsOther?.trim() && <SummaryRow label="Other Actions" value={form.actionsOther} />}
        <SummaryRow label="Description" value={form.description?.trim() ? form.description : 'No description added'} />
        <SummaryRow label="Email Notifications" value={form.sendEmailNotifications ? 'Enabled' : 'Disabled'} />
        {form.sendEmailNotifications ? (
          <>
            <SummaryRow
              label="Student recipients"
              value={form.studentNotificationEmails.trim() || '(none — no student emails will be sent)'}
            />
            <SummaryRow
              label="Parent recipients"
              value={form.parentNotificationEmails.trim() || '(none — no parent emails will be sent)'}
            />
          </>
        ) : null}
        <SummaryRow
          label="Media"
          value={form.media.length ? `${form.media.length} file(s) attached` : 'No media attached'}
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button variant="outlined" onClick={onBack} sx={{ px: 3 }}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            void onSubmit();
          }}
          disabled={isSubmitting}
          sx={{ px: 3 }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit incident'}
        </Button>
      </Box>
    </Box>
  );
}

function SummaryRow(props: { label: string; value: React.ReactNode }) {
  return (
    <Box
      sx={{
        p: 1.25,
        borderRadius: 2,
        bgcolor: 'rgba(0,0,0,0.02)',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {props.label}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
        {props.value}
      </Typography>
    </Box>
  );
}

