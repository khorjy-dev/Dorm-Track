import React from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
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

  const loadUsers = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('staff_email_allowlist')
        .select('email, role, created_at')
        .order('email', { ascending: true });
      if (queryError) throw queryError;
      setRows((data ?? []) as AllowlistRow[]);
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

  return (
    <Box sx={{ p: 2 }}>
      <Paper elevation={1} sx={{ p: 2 }}>
        <Typography variant="h6">Manage users</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Add an email and assign a role. Only admins can access this page.
        </Typography>

        <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={1.5} onSubmit={handleSubmit}>
          <TextField
            type="email"
            label="Staff email"
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
              <MenuItem value="staff">staff</MenuItem>
              <MenuItem value="admin">admin</MenuItem>
            </Select>
          </FormControl>
          <Button type="submit" variant="contained" disabled={busy}>
            Save user
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
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1">Allowlisted users</Typography>
          <Button variant="outlined" onClick={() => void loadUsers()} disabled={busy}>
            Refresh
          </Button>
        </Stack>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.email}>
                <TableCell>{row.email}</TableCell>
                <TableCell>{row.role}</TableCell>
                <TableCell align="right">
                  <Button
                    color="error"
                    variant="text"
                    size="small"
                    disabled={busy || row.email === (user?.email?.trim().toLowerCase() ?? '')}
                    onClick={() => void handleRemove(row.email)}
                  >
                    Remove
                  </Button>
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
      </Paper>
    </Box>
  );
}
