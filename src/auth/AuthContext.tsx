import React from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { hasPermission } from './permissions';
import type { Permission, Role } from './permissions';

export type AuthUser = {
  email: string;
  role: Role;
};

type AuthContextValue = {
  user: AuthUser | null;
  /**
   * Shown on the login screen after we reject a Google session because the account email is not in
   * `staff_email_allowlist`. Session is cleared — this is only a message for the user.
   */
  notAuthorizedMessage: string | null;
  clearNotAuthorizedMessage: () => void;
  /** Role lookup failed (network/RLS); user is not admitted until resolved. */
  authError: string | null;
  clearAuthError: () => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  has: (permission: Permission) => boolean;
  loading: boolean;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

const ROLE_VALUES: Role[] = ['staff', 'admin'];
const authRedirectUrl = import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin;

function normalizeRole(raw: unknown, fallback: Role): Role {
  if (typeof raw !== 'string') return fallback;
  const value = raw.trim().toLowerCase();
  if (ROLE_VALUES.includes(value as Role)) return value as Role;
  return fallback;
}

/**
 * Returns null if the signed-in email is not in `staff_email_allowlist` (not allowlisted).
 */
async function fetchRoleForEmail(email: string): Promise<Role | null> {
  const emailLower = email.trim().toLowerCase();
  const { data, error } = await supabase.from('staff_email_allowlist').select('role').eq('email', emailLower).maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return normalizeRole(data.role, 'staff');
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), ms);
    promise
      .then((value) => resolve(value))
      .catch((err) => reject(err))
      .finally(() => window.clearTimeout(timer));
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notAuthorizedMessage, setNotAuthorizedMessage] = React.useState<string | null>(null);
  const [authError, setAuthError] = React.useState<string | null>(null);

  const clearNotAuthorizedMessage = React.useCallback(() => setNotAuthorizedMessage(null), []);

  const applySession = React.useCallback(async (session: Session | null, cancelled: () => boolean) => {
    setAuthError(null);
    const supaUser = session?.user;
    if (!supaUser?.id || !supaUser?.email) {
      if (cancelled()) return;
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const role = await fetchRoleForEmail(supaUser.email);
      if (cancelled()) return;

      if (role === null) {
        setNotAuthorizedMessage(
          `This email is not authorized to use DormTrack: ${supaUser.email}. Your school email must be added to the staff allowlist in the database. Ask an administrator.`,
        );
        setUser(null);
        try {
          await supabase.auth.signOut();
        } catch {
          // Session should still be cleared for UX; ignore sign-out errors.
        }
        return;
      }

      setNotAuthorizedMessage(null);
      setUser({ email: supaUser.email, role });
    } catch (err) {
      if (cancelled()) return;
      setUser(null);
      const message = err instanceof Error ? err.message : 'Failed to verify access.';
      setAuthError(message);
      // eslint-disable-next-line no-console
      console.error('Failed to load role from Supabase:', err);
    } finally {
      if (!cancelled()) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    void withTimeout(supabase.auth.getSession(), 8000)
      .then(({ data }) => applySession(data.session, isCancelled))
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setAuthError('Could not reach sign-in service. Please refresh the page.');
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session, isCancelled);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const refreshAuth = React.useCallback(async () => {
    setAuthError(null);
    setLoading(true);
    try {
      const { data } = await withTimeout(supabase.auth.getSession(), 8000);
      await applySession(data.session, () => false);
    } catch {
      setLoading(false);
      setAuthError('Could not verify your session. Try again in a moment.');
    }
  }, [applySession]);

  const clearAuthError = React.useCallback(() => setAuthError(null), []);

  const loginWithGoogle = React.useCallback(async () => {
    setNotAuthorizedMessage(null);
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: authRedirectUrl },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Google sign-in failed:', err);
      const message =
        err instanceof Error ? err.message : 'Google sign-in failed. Check console for details.';
      alert(message);
    }
  }, []);

  const logout = React.useCallback(async () => {
    setAuthError(null);
    setNotAuthorizedMessage(null);
    await supabase.auth.signOut();
  }, []);

  const value = React.useMemo<AuthContextValue>(() => {
    return {
      user,
      notAuthorizedMessage,
      clearNotAuthorizedMessage,
      authError,
      clearAuthError,
      loginWithGoogle,
      logout,
      refreshAuth,
      has: (permission: Permission) => (user ? hasPermission(user.role, permission) : false),
      loading,
    };
  }, [
    authError,
    clearAuthError,
    clearNotAuthorizedMessage,
    loading,
    loginWithGoogle,
    logout,
    notAuthorizedMessage,
    refreshAuth,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
