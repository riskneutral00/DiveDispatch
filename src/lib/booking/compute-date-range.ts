// ── Date Range Computation ────────────────────────────────────────────────────
// Pure functions for computing booking date ranges from course selections.
// No React or Convex dependencies.

import { getEndDateDefault, calculateComboDates } from '@/lib/booking/course-validation'
import { getDatesInRange } from '@/lib/utils/date'
import type { OperatorDefaults } from '@/lib/hooks/use-operator-defaults'
import type { BookingPreFill } from '@/lib/booking/wizard-state'

// Re-export for backwards compatibility at existing import sites
export { getDatesInRange as expandDateRange } from '@/lib/utils/date'

/**
 * Compute the start/end date range for a set of courses starting on a given date.
 * Handles O+A combo specially; otherwise chains courses sequentially.
 */
export function computeDateRange(
  courses: string[],
  startDate: string,
): { startDate: string; endDate: string } {
  if (courses.length === 0) return { startDate, endDate: startDate }

  // O+A combo
  if (courses.includes('OW') && courses.includes('AOW')) {
    const { aowDates } = calculateComboDates(startDate)
    return { startDate, endDate: aowDates[1] }
  }

  // Single or multiple sequential courses — take the max end date
  let maxEnd = startDate
  let currentStart = startDate
  for (const code of courses) {
    const end = getEndDateDefault(code, currentStart)
    if (end > maxEnd) maxEnd = end
    currentStart = end // chain sequential courses
  }
  return { startDate, endDate: maxEnd }
}

/**
 * Build a BookingPreFill from courses, a start date, and operator defaults.
 */
export function buildPreFill(
  courses: string[],
  startDate: string,
  defaults: OperatorDefaults,
): BookingPreFill {
  const { endDate } = computeDateRange(courses, startDate)
  return {
    courses,
    startDate,
    endDate,
    agency: defaults.agency,
    instructorSlug: defaults.preferredInstructorSlug,
    venueSlug: defaults.preferredVenueSlug,
    boatSlug: defaults.preferredBoatSlug,
    equipmentSlug: defaults.preferredEquipmentSlug,
    compressorSlug: defaults.preferredCompressorSlug,
  }
}

