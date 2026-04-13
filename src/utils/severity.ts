export type Severity = 'level_1' | 'level_2' | 'level_3' | 'level_4';

export const SEVERITY_OPTIONS: Severity[] = ['level_1', 'level_2', 'level_3', 'level_4'];

const LEGACY_MAP: Record<string, Severity> = {
  low: 'level_1',
  medium: 'level_2',
  high: 'level_4',
};

export function normalizeSeverityFromDb(raw: string | null | undefined): Severity {
  const s = (raw ?? '').trim();
  if (s === 'level_1' || s === 'level_2' || s === 'level_3' || s === 'level_4') return s;
  const mapped = LEGACY_MAP[s];
  if (mapped) return mapped;
  return 'level_1';
}

export function formatSeverityLabel(severity: Severity | string): string {
  const n = normalizeSeverityFromDb(severity);
  const num = n.replace('level_', '');
  return `Level ${num}`;
}
