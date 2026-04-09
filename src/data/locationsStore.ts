import { supabase, withAuthTokenLockRetry } from '../lib/supabase';
import { DEFAULT_LOCATIONS } from './locations';

type Row = { id: string; name: string; position: number };

export function subscribeLocations(onData: (locations: string[]) => void, onError?: (err: unknown) => void) {
  let alive = true;
  const fetchOnce = async () => {
    const { data, error } = await withAuthTokenLockRetry(() =>
      supabase.from('incident_locations').select('id,name,position').order('position', { ascending: true }),
    );
    if (!alive) return;
    if (error) {
      if (onError) onError(error);
      return;
    }
    const names = ((data ?? []) as Row[]).map((r) => r.name).filter(Boolean);
    onData(names.length > 0 ? names : DEFAULT_LOCATIONS);
  };

  void fetchOnce();
  const timer = window.setInterval(() => void fetchOnce(), 5000);
  return () => {
    alive = false;
    window.clearInterval(timer);
  };
}

export async function replaceLocations(locations: string[]) {
  const cleaned = locations.map((x) => x.trim()).filter(Boolean);
  const next = cleaned.length > 0 ? cleaned : DEFAULT_LOCATIONS;
  const { error: deleteError } = await supabase.from('incident_locations').delete().gt('position', 0);
  if (deleteError) throw deleteError;
  const rows = next.map((name, idx) => ({ name, position: idx + 1 }));
  const { error } = await supabase.from('incident_locations').insert(rows);
  if (error) throw error;
}

