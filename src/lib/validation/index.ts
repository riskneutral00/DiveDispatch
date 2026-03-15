// ── Validation — barrel export ────────────────────────────────────────────────

export {
  customerContactSchema,
  makeCustomerContactSchema,
  medicalAnswersSchema,
  waiverSchema,
  makeWaiverSchema,
  equipmentSizingSchema,
  bookingDetailsSchema,
  diverEntrySchema,
  profileFieldsSchema,
} from './schemas'

export type {
  CustomerContactData,
  MedicalAnswersData,
  WaiverData,
  EquipmentSizingData,
  BookingDetailsData,
  DiverEntryData,
  ProfileFieldsData,
} from './schemas'

export { useFormValidation } from './useFormValidation'
export type { UseFormValidationReturn, ValidationResult } from './useFormValidation'
