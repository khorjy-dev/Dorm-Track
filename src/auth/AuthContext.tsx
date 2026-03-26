import React from 'react';
import { supabase } from '../lib/supabase';
import { hasPermission } from './permissions';
import type { Permission, Role } from './permissions';

export type AuthUser = {
  email: string;
  role: Role;
};

type AuthContextValue = {
  user: AuthUser | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  has: (permission: Permission) => boolean;
  loading: boolean;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

const ROLE_VALUES: Role[] = ['ra', 'staff', 'admin'];

function normalizeRole(raw: unknown, fallback: Role): Role {
  if (typeof raw !== 'string') return fallback;
  if (ROLE_VALUES.includes(raw as Role)) return raw as Role;
  return fallback;
}

async function fetchRoleForUser(uid: string): Promise<Role> {
  const defaultRole = (import.meta.env.VITE_DEFAULT_ROLE as Role) || 'staff';

  // Supabase table: `public.user_roles` with `{ user_id: auth.uid(), role: 'ra' | 'staff' | 'admin' }`
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) throw error;
  return normalizeRole(data?.role, defaultRole);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    setLoading(true);
    // Rely solely on auth state changes to avoid parallel session/token reads.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;

      const supaUser = session?.user;
      if (!supaUser?.id || !supaUser?.email) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const role = await fetchRoleForUser(supaUser.id);
        if (cancelled) return;
        setUser({ email: supaUser.email, role });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to load role from Supabase (auth change):', err);
        const fallbackRole = (import.meta.env.VITE_DEFAULT_ROLE as Role) || 'staff';
        if (cancelled) return;
        setUser({ email: supaUser.email, role: fallbackRole });
      } finally {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const loginWithGoogle = React.useCallback(async () => {
    try {
      // Supabase OAuth uses redirect flow.
      // Ensure Google provider + redirect URLs are configured in Supabase dashboard.
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
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
    await supabase.auth.signOut();
  }, []);

  const value = React.useMemo<AuthContextValue>(() => {
    return {
      user,
      loginWithGoogle,
      logout,
      has: (permission: Permission) => (user ? hasPermission(user.role, permission) : false),
      loading,
    };
  }, [loading, loginWithGoogle, logout, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

