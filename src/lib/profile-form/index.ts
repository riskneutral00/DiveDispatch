// ── Barrel export — single import point for all profile-form utilities ────────
// Import from '@/lib/profile-form' — never from individual submodules.

// Types
export type { BaseProfileSectionProps } from './types'

// Location & contact utilities
export type { ProfileLocationValue, ContactFormState } from './location'
export {
  nullableProfileLocation,
  locationFromProfileDoc,
  contactFieldsFromProfile,
  defaultFromMe,
  locationToPayload,
  INITIAL_CONTACT_FORM,
  contactFromProfile,
  contactToPayload,
} from './location'

// Language utilities
export type { Language } from '@/lib/types/language'
export {
  languageEntrySchema,
  customerLanguagesFieldSchema,
  teachingLanguagesFieldSchema,
  languagesFromProfile,
  languagesToPayload,
} from './languages'

// Toast copy
export {
  FORM_SAVE_SUCCESS_TOAST,
  FORM_SAVE_FAILED_TOAST,
  FORM_VALIDATION_WARNING_TOAST,
  FORM_SECONDARY_SAVE_WARNING_TITLE,
} from './save-feedback'
