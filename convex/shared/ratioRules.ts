/**
 * Instructor-to-student ratio rules for booking validation.
 *
 * Pure constants + validation — no DB calls, no side effects.
 *
 * Ratios:
 *   Primary instructor: max 4 customers (1:4)
 *   Helper DiveMaster: covers 2 additional customers (1:2)
 *   Helper Instructor: covers 4 additional customers (1:4)
 *   Absolute max per booking: 12 customers
 */

/** Max customers a single (primary) instructor can supervise. */
export const PRIMARY_INSTRUCTOR_MAX = 4

/** Additional customers each helper DiveMaster can cover. */
export const HELPER_DM_RATIO = 2

/** Additional customers each helper Instructor can cover. */
export const HELPER_INSTRUCTOR_RATIO = 4

/** Absolute maximum customers per booking regardless of staff. */
export const BOOKING_MAX_CUSTOMERS = 12

export type RatioResult = {
  valid: boolean
  message?: string
}

/**
 * Validate instructor-to-student ratio.
 *
 * @param diverCount  Number of customers/divers on the booking
 * @param instructorCount  Number of Instructor resources assigned (including primary)
 * @param dmCount  Number of DiveMaster resources assigned (helpers only)
 */
export function validateRatio(
  diverCount: number,
  instructorCount: number,
  dmCount: number,
): RatioResult {
  // Hard cap: no booking may exceed 12 customers
  if (diverCount > BOOKING_MAX_CUSTOMERS) {
    return {
      valid: false,
      message: `Maximum ${BOOKING_MAX_CUSTOMERS} customers per booking`,
    }
  }

  // No divers = no ratio issue
  if (diverCount === 0) return { valid: true }

  // Must have at least 1 instructor
  if (instructorCount < 1) {
    return {
      valid: false,
      message: 'At least 1 instructor is required',
    }
  }

  // Primary instructor covers up to PRIMARY_INSTRUCTOR_MAX
  // Additional instructors each cover HELPER_INSTRUCTOR_RATIO more
  // Each DM covers HELPER_DM_RATIO more
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
