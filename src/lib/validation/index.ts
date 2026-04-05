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
  bookingSessionsSchema,
  makeBookingDiversSchema,
} from './schemas'

export type {
  CustomerContactData,
  MedicalAnswersData,
  WaiverData,
  EquipmentSizingData,
  BookingDetailsData,
  DiverEntryData,
  ProfileFieldsData,
  BookingSessionsData,
  BookingDiversData,
} from './schemas'

export { useFormValidation } from './useFormValidation'
export type { UseFormValidationReturn, ValidationResult } from './useFormValidation'
