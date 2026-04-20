export const PROFILE_REQUIRED = ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth'] as const

export const SETTINGS_REQUIRED = ['appLanguage'] as const

const DIVE_STAFF_REQUIRED = ['name', 'address', 'credential', 'teachingLanguages'] as const

export const ROLE_REQUIRED: Record<string, readonly string[]> = {
  DiveCenter: ['name', 'address', 'associations', 'customerLanguages'],
  Agent: ['name', 'address', 'associations', 'customerLanguages'],
  Instructor: DIVE_STAFF_REQUIRED,
  Boat: ['name', 'address', 'diveSite', 'fleet'],
  Equipment: ['name', 'address', 'gearInventory'],
  Pool: ['name', 'address'],
  Compressor: ['name', 'address', 'gasMixes'],
  DiveSite: ['name', 'address', 'diveSiteTypes'],
}
