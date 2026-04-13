const SUPABASE_ERR_KEYS = ['message', 'error_description', 'details', 'hint', 'code'] as const;

function collectSupabaseParts(err: object): string[] {
  const o = err as Record<string, unknown>;
  const parts: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (t && !parts.includes(t)) parts.push(t);
  };
  for (const key of SUPABASE_ERR_KEYS) {
    const v = o[key];
    if (typeof v === 'string') push(v);
  }
  if (typeof o.error === 'string') push(o.error);
  return parts;
}

/**
 * Turn a Supabase/PostgREST `{ error }` payload into a real `Error` so callers always get a string
 * message (plain error objects often have an empty `message` after failed JSON parse).
 */
export function errorFromSupabaseResult(error: unknown): Error {
  if (error instanceof Error) {
    const parts = collectSupabaseParts(error);
    if (parts.length > 0) return new Error(parts.join(' — '));
    if (error.message.trim()) return error;
    return new Error('Database request failed');
  }
  if (error !== null && typeof error === 'object') {
    const parts = collectSupabaseParts(error);
    return new Error(parts.join(' — ') || 'Database request failed');
  }
  if (typeof error === 'string' && error.trim()) {
    return new Error(error.trim());
  }
  return new Error('Database request failed');
}

/**
 * Supabase PostgREST errors are often plain objects; `message` alone may be empty.
 */
export function messageFromUnknown(err: unknown, fallback: string): string {
  if (typeof err === 'string' && err.trim()) return err.trim();

  if (err !== null && typeof err === 'object') {
    const parts = collectSupabaseParts(err);
    if (parts.length > 0) return parts.join(' — ');
  }

  if (err instanceof Error && err.message.trim()) {
    return err.message.trim();
  }

  return fallback;
}
