import { getEndDateDefault, calculateComboDates } from '@/lib/booking/activity-validation'
import type { OperatorDefaults } from '@/lib/hooks/use-operator-defaults'
import type { BookingPreFill } from '@/lib/booking/wizard-state'

export { getDatesInRange as expandDateRange } from '@/lib/utils/date'

export function computeDateRange(
  courses: string[],
  startDate: string,
): { startDate: string; endDate: string } {
  if (courses.length === 0) return { startDate, endDate: startDate }

  if (courses.includes('OW') && courses.includes('AOW')) {
    const { aowDates } = calculateComboDates(startDate)
    return { startDate, endDate: aowDates[1] }
  }

  let maxEnd = startDate
  let currentStart = startDate
  for (const code of courses) {
    const end = getEndDateDefault(code, currentStart)
    if (end > maxEnd) maxEnd = end
    currentStart = end // chain sequential courses
  }
  return { startDate, endDate: maxEnd }
}

function applyTemplateResourceHints(
  pref: BookingPreFill,
  hints: Array<{ resourceType: string; resourceId: string }> | undefined,
): BookingPreFill {
  if (!hints?.length) return pref
  let next = { ...pref }
  for (const h of hints) {
    const slug = h.resourceId
    if (!slug) continue
    switch (h.resourceType) {
      case 'Instructor':
        if (!next.instructorSlug) next = { ...next, instructorSlug: slug }
        break
      case 'Venue':
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

export function buildPreFill(
  courses: string[],
  startDate: string,
  defaults: OperatorDefaults,
  templateResourceHints?: Array<{ resourceType: string; resourceId: string }>,
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
