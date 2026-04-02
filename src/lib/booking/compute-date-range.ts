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

/** Map saved template resource rows onto pre-fill slugs (does not override non-empty defaults from operator prefs). */
function applyTemplateResourceHints(
  pref: BookingPreFill,
  hints: Array<{ resourceType: string; resourceSlug: string }> | undefined,
): BookingPreFill {
  if (!hints?.length) return pref
  let next = { ...pref }
  for (const h of hints) {
    const slug = h.resourceSlug
    if (!slug) continue
    switch (h.resourceType) {
      case 'Instructor':
        if (!next.instructorSlug) next = { ...next, instructorSlug: slug }
        break
      case 'Pool':
      case 'DiveSite':
        if (!next.venueSlug) next = { ...next, venueSlug: slug }
        break
      case 'Boat':
        if (!next.boatSlug) next = { ...next, boatSlug: slug }
        break
      case 'Equipment':
        if (!next.equipmentSlug) next = { ...next, equipmentSlug: slug }
        break
      case 'Compressor':
        if (!next.compressorSlug) next = { ...next, compressorSlug: slug }
        break
      default:
        break
    }
  }
  next.templateResourceHints = hints
  return next
}

/**
 * Build a BookingPreFill from courses, a start date, and operator defaults.
 * Optional template hints (e.g. from bookingTemplates.resources) fill gaps after defaults.
 */
export function buildPreFill(
  courses: string[],
  startDate: string,
  defaults: OperatorDefaults,
  templateResourceHints?: Array<{ resourceType: string; resourceSlug: string }>,
): BookingPreFill {
  const { endDate } = computeDateRange(courses, startDate)
  const base: BookingPreFill = {
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
  return applyTemplateResourceHints(base, templateResourceHints)
}

