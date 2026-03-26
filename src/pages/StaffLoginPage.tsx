import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
} from '@mui/material';
import { useAuth } from '../auth/AuthContext';

export default function StaffLoginPage() {
  const { loginWithGoogle, loading } = useAuth();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f6f7fb' }}>
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Paper elevation={1} sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            DormTrack
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Sign in with your school Google account to access staff features.
          </Typography>

          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Sign in with Google to access dorm staff features.
            </Typography>

            <Button
              variant="contained"
              onClick={loginWithGoogle}
              disabled={loading}
              sx={{ px: 3 }}
            >
              {loading ? 'Signing in...' : 'Continue with Google'}
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

