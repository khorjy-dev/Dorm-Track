import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Keep explicit error so setup issues are obvious in dev.
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars missing: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');

function isAuthTokenLockRaceError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const message = 'message' in err ? String((err as { message?: unknown }).message ?? '') : '';
  if (!message) return false;
  return message.includes('lock-sb-') && message.includes('stole it');
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function withAuthTokenLockRetry<T>(fn: () => PromiseLike<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isAuthTokenLockRaceError(err) || i === attempts - 1) {
        throw err;
      }
      // Small backoff gives the winning request time to release token lock.
      await sleep(120 * (i + 1));
    }
  }
  throw lastError;
}

