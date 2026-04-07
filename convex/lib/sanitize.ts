/**
 * Input sanitization layer for user-provided strings.
 *
 * Scope: data hygiene only — trim whitespace, NFC unicode normalization,
 * strip zero-width characters and null bytes, cap string lengths.
 *
 * Does NOT strip HTML/XSS (React's JSX escaping handles output encoding).
 */

/**
 * Characters to strip: null bytes, soft hyphens, invisible formatters, direction overrides.
 *
 * Deliberately EXCLUDED (safe/required characters):
 * - U+200C (ZWNJ) — required for Farsi, Persian, and Indic scripts
 * - U+200D (ZWJ)  — required for compound emoji (e.g. 👨‍👩‍👧‍👦)
 * - U+FE00–U+FE0F (Variation Selectors) — control emoji presentation (❤️ vs ❤)
 */
const STRIP_RE =
  /[\u0000\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF0-\uFFF8\uFFF9-\uFFFB]/g

/**
 * Sanitize a single string value:
 * 1. NFC normalize (compose accented characters)
 * 2. Strip zero-width / invisible control characters
 * 3. Trim leading/trailing whitespace
 * 4. Truncate to maxLength (if provided)
 */
export function sanitizeString(input: string, maxLength?: number): string {
  let s = input.normalize('NFC')
  s = s.replace(STRIP_RE, '')
  s = s.trim()
  if (maxLength !== undefined && s.length > maxLength) {
    // Grapheme-safe truncation: Array.from splits on codepoints, avoiding
    // broken surrogate pairs from naive .slice() on astral characters.
    const chars = Array.from(s)
    if (chars.length > maxLength) {
      s = chars.slice(0, maxLength).join('')
    }
  }
  return s
}

/**
 * Field configuration for sanitizeFields. Maps field names to their max lengths.
 */
export type FieldConfig = Record<string, number>

/**
 * Sanitize all string fields in an object according to the provided config.
 * Non-string fields and fields not in the config are passed through unchanged.
 * Fields present in the config but not in the object are skipped.
 *
 * Returns a new object (does not mutate the input).
 */
export function sanitizeFields<T extends Record<string, unknown>>(
  obj: T,
  fieldConfigs: FieldConfig,
): T {
  const result = { ...obj }
  for (const [key, maxLength] of Object.entries(fieldConfigs)) {
    if (key in result && typeof result[key] === 'string') {
      ;(result as Record<string, unknown>)[key] = sanitizeString(
        result[key] as string,
        maxLength,
      )
    }
  }
  return result
}

// ── Standard field-length presets ──────────────────────────────────────────────

/** Names: business, first, last, emergency contact */
export const NAME_MAX = 200
/** Email addresses (RFC 5321) */
export const EMAIL_MAX = 254
/** Phone numbers */
export const PHONE_MAX = 30
/** Short text: nationality, passport, nickname, subject, category */
export const SHORT_TEXT_MAX = 100
/** Long text: allergies, notes */
export const LONG_TEXT_MAX = 2000
export const CONFIG_JSON_MAX = 10_000
/** Support messages */
export const SUPPORT_MESSAGE_MAX = 5000

// ── Pre-built field configs for common mutation shapes ─────────────────────────

export const USER_FIELDS: FieldConfig = {
  businessName: NAME_MAX,
  firstName: NAME_MAX,
  lastName: NAME_MAX,
  name: NAME_MAX,
  nickname: SHORT_TEXT_MAX,
  phone: PHONE_MAX,
  email: EMAIL_MAX,
}

export const PROFILE_FIELDS: FieldConfig = {
  name: NAME_MAX,
  placeName: NAME_MAX,
  country: SHORT_TEXT_MAX,
  email: EMAIL_MAX,
  phone: PHONE_MAX,
}

export const CUSTOMER_FIELDS: FieldConfig = {
  legalFirstName: NAME_MAX,
  legalLastName: NAME_MAX,
  preferredName: NAME_MAX,
  email: EMAIL_MAX,
  phone: PHONE_MAX,
  nationality: SHORT_TEXT_MAX,
  passportNumber: SHORT_TEXT_MAX,
  passportIssuingCountry: SHORT_TEXT_MAX,
  emergencyContactName: NAME_MAX,
  emergencyContactPhone: PHONE_MAX,
  emergencyContactRelation: SHORT_TEXT_MAX,
  agency: SHORT_TEXT_MAX,
  agencyID: SHORT_TEXT_MAX,
  allergies: LONG_TEXT_MAX,
}

export const SUPPORT_FIELDS: FieldConfig = {
  subject: SHORT_TEXT_MAX,
  category: SHORT_TEXT_MAX,
  message: SUPPORT_MESSAGE_MAX,
}

export const PORTAL_SAFETY_FIELDS: FieldConfig = {
  bloodType: SHORT_TEXT_MAX,
  allergies: LONG_TEXT_MAX,
  medications: LONG_TEXT_MAX,
  insurancePolicyNumber: SHORT_TEXT_MAX,
}

export const PORTAL_WAIVER_FIELDS: FieldConfig = {
  insurancePolicyNumber: SHORT_TEXT_MAX,
}

export const PORTAL_EQUIPMENT_FIELDS: FieldConfig = {
  prescriptionStrength: SHORT_TEXT_MAX,
}

export const PORTAL_EQUIPMENT_CHECKLIST_FIELDS: FieldConfig = {
  maskPrescription: SHORT_TEXT_MAX,
}

export const BOOKING_TEMPLATE_FIELDS: FieldConfig = {
  name: NAME_MAX,
}

export const THEME_FIELDS: FieldConfig = {
  slug: SHORT_TEXT_MAX,
  name: NAME_MAX,
  config: CONFIG_JSON_MAX,
}

export const PORTAL_CONTACT_FIELDS: FieldConfig = {
  legalFirstName: NAME_MAX,
  legalLastName: NAME_MAX,
  preferredName: NAME_MAX,
  email: EMAIL_MAX,
  phone: PHONE_MAX,
  nationality: SHORT_TEXT_MAX,
  passportNumber: SHORT_TEXT_MAX,
  passportIssuingCountry: SHORT_TEXT_MAX,
  emergencyContactName: NAME_MAX,
  emergencyContactPhone: PHONE_MAX,
  emergencyContactRelation: SHORT_TEXT_MAX,
  agency: SHORT_TEXT_MAX,
  agencyID: SHORT_TEXT_MAX,
  allergies: LONG_TEXT_MAX,
}

/** Max length for medical answer string values (detail/notes fields). */
export const MEDICAL_ANSWER_MAX = LONG_TEXT_MAX

/**
 * Sanitize a passport number:
 * 1. NFC normalize + strip invisible chars (via sanitizeString)
 * 2. Strip everything except A-Z, 0-9, and hyphen
 * 3. Uppercase
 * 4. Truncate to 20 characters
 */
export function sanitizePassport(input: string): string {
  let s = sanitizeString(input)
  s = s.toUpperCase()
  s = s.replace(/[^A-Z0-9-]/g, '')
  if (s.length > 20) {
    s = s.slice(0, 20)
  }
  return s
}

/**
 * Sanitize medical questionnaire answers:
 * - Boolean values pass through untouched
 * - String values get sanitizeString() with MEDICAL_ANSWER_MAX length cap
 * Returns a new object (does not mutate).
 */
export function sanitizeMedicalAnswers(
  answers: Record<string, boolean | string>,
): Record<string, boolean | string> {
  const result: Record<string, boolean | string> = {}
  for (const [key, value] of Object.entries(answers)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value, MEDICAL_ANSWER_MAX)
    } else {
      result[key] = value
    }
  }
  return result
}

/** Draft state is a JSON blob — cap at a generous limit */
export const DRAFT_STATE_MAX = 50_000
