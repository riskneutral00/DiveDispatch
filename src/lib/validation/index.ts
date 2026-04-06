// ── Validation — barrel export ────────────────────────────────────────────────

export { makeCustomerContactSchema, medicalAnswersSchema } from './schemas'
export type { CustomerContactData } from './schemas'

export { useFormValidation } from './useFormValidation'
export type { UseFormValidationReturn, ValidationResult } from './useFormValidation'
