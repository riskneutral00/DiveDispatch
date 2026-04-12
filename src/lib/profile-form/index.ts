export type { BaseProfileSectionProps } from './types'

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

export type { Language } from '@/lib/types/language'
export {
  languageEntrySchema,
  customerLanguagesFieldSchema,
  teachingLanguagesFieldSchema,
  languagesFromProfile,
  languagesToPayload,
  INITIAL_CUSTOMER_LANGUAGES,
  INITIAL_TEACHING_LANGUAGES,
} from './languages'

