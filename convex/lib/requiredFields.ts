// Config-driven required fields for profile completeness checks.
// Each layer is checked independently: profile (users table), user account prefs on users table (SETTINGS_REQUIRED), role (role-specific table).
//
// Contact / languages: PROFILE_REQUIRED is `users` (personal). Role rows may also store business email/phone
// (schema-required on insert) without being listed here. Agent `customerLanguages` completeness reads
// `users.customerLanguages` — see profileCompleteness.

export const PROFILE_REQUIRED = ['firstName', 'lastName', 'email', 'phone'] as const

export const SETTINGS_REQUIRED = ['appLanguage'] as const

export const ROLE_REQUIRED: Record<string, readonly string[]> = {
  DiveCenter: ['name', 'placeName', 'country', 'associations', 'customerLanguages'],
  Agent: ['name', 'placeName', 'country', 'associations', 'customerLanguages'],
  Instructor: ['name', 'placeName', 'country', 'credential', 'teachingLanguages'],
  DiveMaster: ['name', 'placeName', 'country', 'credential', 'teachingLanguages'],
  Boat: ['name', 'placeName', 'diveSite', 'fleet'],
  Equipment: ['name', 'placeName'],
  Pool: ['name', 'placeName'],
  Compressor: ['name', 'placeName'],
}
