const STRIP_RE =
  /[\u0000\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF0-\uFFF8\uFFF9-\uFFFB]/g

export function sanitizeString(input: string, maxLength?: number): string {
  let s = input.normalize('NFC')
  s = s.replace(STRIP_RE, '')
  s = s.trim()
  if (maxLength !== undefined && s.length > maxLength) {
    const chars = Array.from(s)
    if (chars.length > maxLength) {
      s = chars.slice(0, maxLength).join('')
    }
  }
  return s
}

export type FieldConfig = Record<string, number>

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

export const NAME_MAX = 200
export const EMAIL_MAX = 254
export const PHONE_MAX = 30
export const SHORT_TEXT_MAX = 100
export const LONG_TEXT_MAX = 2000
export const CONFIG_JSON_MAX = 10_000
export const SUPPORT_MESSAGE_MAX = 5000

export const USER_FIELDS: FieldConfig = {
  firstName: NAME_MAX,
  lastName: NAME_MAX,
  name: NAME_MAX,
  nickname: SHORT_TEXT_MAX,
  phone: PHONE_MAX,
  email: EMAIL_MAX,
  dateOfBirth: SHORT_TEXT_MAX,
}

export const PROFILE_FIELDS: FieldConfig = {
  name: NAME_MAX,
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

export const MEDICAL_ANSWER_MAX = LONG_TEXT_MAX

export function sanitizePassport(input: string): string {
  let s = sanitizeString(input)
  s = s.toUpperCase()
  s = s.replace(/[^A-Z0-9-]/g, '')
  if (s.length > 20) {
    s = s.slice(0, 20)
  }
  return s
}

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

export const DRAFT_STATE_MAX = 50_000
