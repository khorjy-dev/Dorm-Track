const SUPABASE_ERR_KEYS = ['message', 'error_description', 'details', 'hint', 'code'] as const;

function collectSupabaseParts(err: object, depth = 0): string[] {
  if (depth > 4) return [];
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
  const nested = o.error;
  if (nested !== null && typeof nested === 'object') {
    for (const p of collectSupabaseParts(nested as object, depth + 1)) {
      if (!parts.includes(p)) parts.push(p);
    }
  }
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
 * `Error` is checked explicitly because `typeof err === 'object'` misses some edge cases.
 */
export function messageFromUnknown(err: unknown, fallback: string): string {
  if (typeof err === 'string' && err.trim()) return err.trim();

  if (err instanceof Error) {
    const fromParts = collectSupabaseParts(err);
    if (fromParts.length > 0) return fromParts.join(' — ');
    if (err.message.trim()) return err.message.trim();
  }

  if (err !== null && typeof err === 'object') {
    const parts = collectSupabaseParts(err);
    if (parts.length > 0) return parts.join(' — ');
  }

  if (err !== undefined && err !== null) {
    try {
      return `${fallback} (${String(err)})`;
    } catch {
      return fallback;
    }
  }

  return fallback;
}
