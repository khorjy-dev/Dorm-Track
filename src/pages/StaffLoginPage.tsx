import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useAuth } from '../auth/AuthContext';

export default function StaffLoginPage() {
  const {
    loginWithGoogle,
    loading,
    authError,
    refreshAuth,
    clearAuthError,
    logout,
    notAuthorizedMessage,
    clearNotAuthorizedMessage,
  } = useAuth();
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [slowNotice, setSlowNotice] = React.useState(false);
  const [retryNotice, setRetryNotice] = React.useState(false);
  const [oauthError, setOauthError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('error_code') || params.get('error');
    if (!code) return;

    setIsRedirecting(false);
    setRetryNotice(true);
    setOauthError(code);

    params.delete('error');
    params.delete('error_code');
    params.delete('error_description');
    const next = params.toString();
    const cleanUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, '', cleanUrl);
  }, []);

  React.useEffect(() => {
    if (!isRedirecting) {
      setSlowNotice(false);
      setRetryNotice(false);
      return;
    }
    const t = window.setTimeout(() => setSlowNotice(true), 5000);
    const fallback = window.setTimeout(() => {
      setIsRedirecting(false);
      setRetryNotice(true);
    }, 15000);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(fallback);
    };
  }, [isRedirecting]);

  const handleGoogleLogin = async () => {
    if (isRedirecting) return;
    setIsRedirecting(true);
    setRetryNotice(false);
    try {
      await loginWithGoogle();
    } catch {
      setIsRedirecting(false);
      setRetryNotice(true);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f6f7fb' }}>
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Paper elevation={1} sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Incident Track
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Sign in with your school Google account to access staff features.
          </Typography>

          <Box sx={{ display: 'grid', gap: 1.5 }}>
            {notAuthorizedMessage ? (
              <Alert severity="error" onClose={clearNotAuthorizedMessage}>
                {notAuthorizedMessage}
              </Alert>
            ) : null}
            {authError ? (
              <Alert
                severity="warning"
                onClose={clearAuthError}
                action={
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Button color="inherit" size="small" onClick={() => void refreshAuth()}>
                      Retry
                    </Button>
                    <Button color="inherit" size="small" onClick={() => void logout()}>
                      Sign out
                    </Button>
                  </Stack>
                }
              >
                {authError}
              </Alert>
            ) : null}
            <Button
              variant="contained"
              onClick={handleGoogleLogin}
              disabled={loading || isRedirecting}
              sx={{ px: 3 }}
              startIcon={isRedirecting ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {isRedirecting ? 'Redirecting to Google...' : loading ? 'Signing in...' : 'Continue with Google'}
            </Button>
            {slowNotice ? (
              <Typography variant="caption" color="text.secondary">
                Google sign-in is taking longer than usual. Please keep this tab open.
              </Typography>
            ) : null}
            {retryNotice ? (
              <Typography variant="caption" color="error.main">
                Redirect did not start. Please click Continue with Google again.
              </Typography>
            ) : null}
            {oauthError ? (
              <Typography variant="caption" color="error.main">
                Sign-in request failed ({oauthError}). Please retry in a few seconds.
              </Typography>
            ) : null}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

