export const PRIMARY_INSTRUCTOR_MAX = 4

export const HELPER_DM_RATIO = 2

export const HELPER_INSTRUCTOR_RATIO = 4

export const BOOKING_MAX_CUSTOMERS = 12

export type RatioResult = {
  valid: boolean
  message?: string
}

export function validateRatio(
  diverCount: number,
  instructorCount: number,
  dmCount: number,
): RatioResult {
  if (diverCount > BOOKING_MAX_CUSTOMERS) {
    return {
      valid: false,
      message: `Maximum ${BOOKING_MAX_CUSTOMERS} customers per booking`,
    }
  }

  if (diverCount === 0) return { valid: true }

  if (instructorCount < 1) {
    return {
      valid: false,
      message: 'At least 1 instructor is required',
    }
  }

  const helperInstructors = Math.max(0, instructorCount - 1)
  const capacity =
    PRIMARY_INSTRUCTOR_MAX +
    helperInstructors * HELPER_INSTRUCTOR_RATIO +
    dmCount * HELPER_DM_RATIO

  if (diverCount > capacity) {
    return {
      valid: false,
      message: `${diverCount} divers exceeds staff capacity of ${capacity}. Add more instructors or DiveMasters.`,
    }
  }

  return { valid: true }
}
