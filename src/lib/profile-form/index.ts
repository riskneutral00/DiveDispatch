export type { BaseProfileSectionProps } from './types'

export type { ProfileLocationValue, ContactFormState, PersonalContactFormState } from './location'
export {
  nullableProfileLocation,
  locationFromProfileDoc,
  contactFieldsFromProfile,
  defaultFromMe,
  locationToPayload,
  INITIAL_CONTACT_FORM,
  INITIAL_PERSONAL_CONTACT_FORM,
  contactFromProfile,
  contactToPayload,
  personalContactFromProfile,
  personalContactToPayload,
} from './location'

export { buildParentContactDefaults } from './create-override'
export { useInheritedContactDefaults } from './inherited-defaults'

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

export type { FormBlock } from './merged-states'
export {
  customerLanguagesBlock,
  teachingLanguagesBlock,
  composeBlocks,
} from './merged-states'

