export const PROFILE_REQUIRED = ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth'] as const

export const SETTINGS_REQUIRED = ['appLanguage'] as const

const DIVE_STAFF_REQUIRED = ['name', 'placeName', 'country', 'credential', 'teachingLanguages'] as const

export const ROLE_REQUIRED: Record<string, readonly string[]> = {
  DiveCenter: ['name', 'placeName', 'country', 'associations', 'customerLanguages'],
  Agent: ['name', 'placeName', 'country', 'associations', 'customerLanguages'],
  Instructor: DIVE_STAFF_REQUIRED,
  DiveMaster: DIVE_STAFF_REQUIRED,
  Boat: ['name', 'placeName', 'diveSite', 'fleet'],
  Equipment: ['name', 'placeName'],
  Pool: ['name', 'placeName'],
  Compressor: ['name', 'placeName', 'gasMixes'],
  DiveSite: ['name', 'placeName', 'country', 'diveSiteTypes'],
}
