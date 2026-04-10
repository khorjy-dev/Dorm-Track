import React from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';

type StaffRole = 'staff' | 'admin';

type AllowlistRow = {
  email: string;
  role: StaffRole;
  created_at: string;
};

function toErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) return message;
  }
  return fallback;
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<AllowlistRow[]>([]);
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<StaffRole>('staff');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [removeEmail, setRemoveEmail] = React.useState<string | null>(null);
  const [rowRoleDraft, setRowRoleDraft] = React.useState<Record<string, StaffRole>>({});

  const loadUsers = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('staff_email_allowlist')
        .select('email, role, created_at')
        .order('email', { ascending: true });
      if (queryError) throw queryError;
      const nextRows = (data ?? []) as AllowlistRow[];
      setRows(nextRows);
      const nextDraft: Record<string, StaffRole> = {};
      nextRows.forEach((row) => {
        nextDraft[row.email] = row.role;
      });
      setRowRoleDraft(nextDraft);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load allowlisted users.'));
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Email is required.');
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error: upsertError } = await supabase
        .from('staff_email_allowlist')
        .upsert([{ email: normalizedEmail, role }], { onConflict: 'email' });
      if (upsertError) throw upsertError;

      setNotice(`Saved ${normalizedEmail} as ${role}.`);
      setEmail('');
      setRole('staff');
      await loadUsers();
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to save user role.'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (targetEmail: string) => {
    const currentEmail = user?.email?.trim().toLowerCase() ?? '';
    if (targetEmail === currentEmail) {
      setError('You cannot remove your own admin access from this page.');
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error: deleteError } = await supabase.from('staff_email_allowlist').delete().eq('email', targetEmail);
      if (deleteError) throw deleteError;

      setNotice(`Removed ${targetEmail} from allowlist.`);
      await loadUsers();
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to remove user.'));
    } finally {
      setBusy(false);
    }
  };

  const handleRoleSave = async (targetEmail: string) => {
    const nextRole = rowRoleDraft[targetEmail];
    if (!nextRole) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error: updateError } = await supabase
        .from('staff_email_allowlist')
        .update({ role: nextRole })
        .eq('email', targetEmail);
      if (updateError) throw updateError;
      setNotice(`Updated ${targetEmail} to ${nextRole}.`);
      await loadUsers();
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to update user role.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Paper elevation={1} sx={{ p: 2 }}>
        <Typography variant="h6">Manage Users</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Add an email and assign a role. Only admins can access this page.
        </Typography>

        <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={1.5} onSubmit={handleSubmit}>
          <TextField
            type="email"
            label="Staff Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            disabled={busy}
            placeholder="name@school.org"
          />
          <FormControl sx={{ minWidth: 140 }} disabled={busy}>
            <InputLabel id="role-select-label">Role</InputLabel>
            <Select
              labelId="role-select-label"
              value={role}
              label="Role"
              onChange={(e) => setRole(e.target.value as StaffRole)}
            >
              <MenuItem value="staff">Staff</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>
          <Button type="submit" variant="contained" disabled={busy}>
            Save User
          </Button>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert severity="success" sx={{ mt: 2 }} onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        )}
      </Paper>

      <Paper elevation={1} sx={{ p: 2, mt: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          spacing={1}
          sx={{ mb: 1 }}
        >
          <Typography variant="subtitle1">Allowlisted Users</Typography>
          <Button variant="outlined" onClick={() => void loadUsers()} disabled={busy} sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' } }}>
            Refresh
          </Button>
        </Stack>

        <TableContainer
          sx={{
            width: '100%',
            maxWidth: '100%',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Table
            size="small"
            sx={{
              tableLayout: 'fixed',
              width: '100%',
              minWidth: { xs: 0, sm: 520 },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: { xs: '38%', sm: '40%' } }}>Email</TableCell>
                <TableCell sx={{ width: { xs: '28%', sm: 160 } }}>Role</TableCell>
                <TableCell align="right" sx={{ width: { xs: '34%', sm: 'auto' } }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.email}>
                  <TableCell
                    sx={{
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      verticalAlign: 'top',
                    }}
                  >
                    {row.email}
                  </TableCell>
                  <TableCell sx={{ minWidth: 0, verticalAlign: 'top' }}>
                    <FormControl size="small" fullWidth disabled={busy}>
                      <Select
                        value={rowRoleDraft[row.email] ?? row.role}
                        onChange={(e) =>
                          setRowRoleDraft((prev) => ({ ...prev, [row.email]: e.target.value as StaffRole }))
                        }
                      >
                        <MenuItem value="staff">Staff</MenuItem>
                        <MenuItem value="admin">Admin</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell align="right" sx={{ verticalAlign: 'top' }}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={0.75}
                      alignItems={{ xs: 'stretch', sm: 'flex-end' }}
                      justifyContent="flex-end"
                    >
                      <Button
                        variant="outlined"
                        size="small"
                        fullWidth
                        sx={{ display: { xs: 'flex', sm: 'inline-flex' }, width: { xs: '100%', sm: 'auto' } }}
                        disabled={busy || (rowRoleDraft[row.email] ?? row.role) === row.role}
                        onClick={() => void handleRoleSave(row.email)}
                      >
                        Save Role
                      </Button>
                      <Button
                        color="error"
                        variant="text"
                        size="small"
                        fullWidth
                        sx={{ display: { xs: 'flex', sm: 'inline-flex' }, width: { xs: '100%', sm: 'auto' } }}
                        disabled={busy || row.email === (user?.email?.trim().toLowerCase() ?? '')}
                        onClick={() => setRemoveEmail(row.email)}
                      >
                        Remove
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography variant="body2" color="text.secondary">
                    No users found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </TableContainer>
      </Paper>

      <Dialog open={Boolean(removeEmail)} onClose={() => setRemoveEmail(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove User?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {removeEmail ? `This will remove ${removeEmail} from the allowlist.` : 'Remove this user?'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveEmail(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              const target = removeEmail;
              setRemoveEmail(null);
              if (target) void handleRemove(target);
            }}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
