import type { Severity } from '../IncidentLoggerApp';

export function severityChipColor(severity: Severity): 'success' | 'warning' | 'error' {
  if (severity === 'low') return 'success';
  if (severity === 'medium') return 'warning';
  return 'error';
}

