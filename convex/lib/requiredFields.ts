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
  DiveSite: ['name', 'placeName', 'country', 'diveSiteTypes'],
}
