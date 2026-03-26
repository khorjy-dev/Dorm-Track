import { supabase } from '../lib/supabase';
import { DEFAULT_INFRACTION_TYPES } from './infractionTypes';

type Row = { id: string; name: string; position: number };

export function subscribeInfractionTypes(onData: (types: string[]) => void, onError?: (err: unknown) => void) {
  let alive = true;
  const fetchOnce = async () => {
    const { data, error } = await supabase
      .from('infraction_types')
      .select('id,name,position')
      .order('position', { ascending: true });
    if (!alive) return;
    if (error) {
      if (onError) onError(error);
      return;
    }
    const names = ((data ?? []) as Row[]).map((r) => r.name).filter(Boolean);
    onData(names.length > 0 ? names : DEFAULT_INFRACTION_TYPES);
  };
  void fetchOnce();
  const timer = window.setInterval(() => void fetchOnce(), 5000);
  return () => {
    alive = false;
    window.clearInterval(timer);
  };
}

export async function replaceInfractionTypes(types: string[]) {
  const cleaned = types.map((x) => x.trim()).filter(Boolean);
  const next = cleaned.length > 0 ? cleaned : DEFAULT_INFRACTION_TYPES;
  // Delete everything, then re-insert in the desired order.
  // Supabase/PostgREST requires a WHERE clause for DELETE, so use a predicate
  // that should always match for this table.
  const { error: deleteError } = await supabase.from('infraction_types').delete().gt('position', 0);
  if (deleteError) throw deleteError;
  const rows = next.map((name, idx) => ({ name, position: idx + 1 }));
  const { error } = await supabase.from('infraction_types').insert(rows);
  if (error) throw error;
}

