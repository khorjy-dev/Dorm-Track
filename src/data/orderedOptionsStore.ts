import { supabase, withAuthTokenLockRetry } from '../lib/supabase';

type Row = { name: string };

export function subscribeOrderedOptions(
  tableName: string,
  fallbackItems: string[],
  onData: (items: string[]) => void,
  onError?: (err: unknown) => void,
) {
  let alive = true;

  const fetchOnce = async () => {
    const { data, error } = await withAuthTokenLockRetry(() =>
      supabase.from(tableName).select('name,position').order('position', { ascending: true }),
    );

    if (!alive) return;
    if (error) {
      if (onError) onError(error);
      return;
    }

    const names = ((data ?? []) as Row[]).map((row) => row.name).filter(Boolean);
    onData(names.length > 0 ? names : fallbackItems);
  };

  void fetchOnce();
  const timer = window.setInterval(() => void fetchOnce(), 5000);

  return () => {
    alive = false;
    window.clearInterval(timer);
  };
}

export async function replaceOrderedOptions(tableName: string, items: string[], fallbackItems: string[]) {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
  const next = cleaned.length > 0 ? cleaned : fallbackItems;

  const { error: deleteError } = await supabase.from(tableName).delete().gt('position', 0);
  if (deleteError) throw deleteError;

  const rows = next.map((name, index) => ({ name, position: index + 1 }));
  const { error } = await supabase.from(tableName).insert(rows);
  if (error) throw error;
}
