/**
 * Shared language options for all profile forms and preferences editors.
 *
 * Superset of every per-form LANGUAGES / FOCUSED_LANGUAGES array that
 * previously lived inside individual dashboard components.
 *
 * Shape: { code: ISO-639 language code, label: human-readable name }
 */
export const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'th', label: 'Thai' },
  { code: 'zh', label: 'Chinese (Mandarin)' },
  { code: 'yue', label: 'Cantonese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ru', label: 'Russian' },
  { code: 'it', label: 'Italian' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'ar', label: 'Arabic' },
  { code: 'he', label: 'Hebrew' },
  { code: 'sv', label: 'Swedish' },
  { code: 'pl', label: 'Polish' },
] as const
