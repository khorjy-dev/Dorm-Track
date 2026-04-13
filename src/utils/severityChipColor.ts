import type { Severity } from './severity';
import { normalizeSeverityFromDb } from './severity';

export function severityChipColor(severity: Severity | string): 'success' | 'info' | 'warning' | 'error' {
  const s = normalizeSeverityFromDb(severity);
  if (s === 'level_1') return 'success';
  if (s === 'level_2') return 'info';
  if (s === 'level_3') return 'warning';
  return 'error';
}
