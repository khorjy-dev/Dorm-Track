const STORAGE_KEY = 'dormtrack_infraction_types_v1';

export const DEFAULT_INFRACTION_TYPES = [
  'Curfew',
  'Noise',
  'Missing from room',
  'Guest violation',
  'Other',
];

export function loadInfractionTypes(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INFRACTION_TYPES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_INFRACTION_TYPES;
    const cleaned = parsed.map((x) => String(x).trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : DEFAULT_INFRACTION_TYPES;
  } catch {
    return DEFAULT_INFRACTION_TYPES;
  }
}

export function saveInfractionTypes(types: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
}

