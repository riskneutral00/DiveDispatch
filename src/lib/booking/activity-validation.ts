import { getCourseByCode, type CourseCode, COMBO_COURSES, COURSE_CODES } from '@/lib/constants/course-catalog'
import { addDays } from '@/lib/utils/date'
import { buildDiveSequence } from '@/lib/booking/generate-days'

export function validatePrerequisites(courseCodes: string[]): string[] {
  const warnings: string[] = []
  const codeSet = new Set(courseCodes)

  for (const code of courseCodes) {
    const course = getCourseByCode(code as CourseCode)
    if (!course?.prerequisites?.length) continue

    for (const prereq of course.prerequisites) {
      if (!codeSet.has(prereq)) {
        const prereqCourse = getCourseByCode(prereq as CourseCode)
        const prereqName = prereqCourse?.name ?? prereq
        warnings.push(
          `${course.name} requires ${prereqName} certification. Proof will be required.`,
        )
      }
    }
  }

  return warnings
}

export function validateCourseCombo(courseCodes: string[]): string[] {
  if (courseCodes.length < 2) return []

  const warnings: string[] = []
  const hasDSD = courseCodes.includes('DSD') || courseCodes.includes('TRY_DIVE')
  const certCourses = courseCodes.filter(
    (c) => c !== 'DSD' && c !== 'TRY_DIVE' && c !== 'OW' && c !== 'REFRESH',
  )

  if (hasDSD && certCourses.length > 0) {
    warnings.push(
      `Discover Scuba + ${certCourses.join(', ')} doesn't make sense. DSD is for non-divers trying scuba once.`,
    )
  }

  return warnings
}

export function validatePrerequisiteOrder(
  courses: { activityCode: string; dates: string[] }[],
): string[] {
  if (courses.length < 2) return []

  const errors: string[] = []

  const positionalErrorPairs = new Set<string>()
  for (let i = 0; i < courses.length; i++) {
    const entry = courses[i]
    if (!entry.activityCode) continue

    const course = getCourseByCode(entry.activityCode as CourseCode)
    if (!course?.prerequisites?.length) continue

    for (const prereqCode of course.prerequisites) {
      const prereqIndex = courses.findIndex(
        (c, idx) => idx !== i && c.activityCode === prereqCode,
      )
      if (prereqIndex === -1) continue // missing entirely — handled by validateMissingPrerequisites

      if (prereqIndex > i) {
        const prereqCourse = getCourseByCode(prereqCode as CourseCode)
        const prereqName = prereqCourse?.name ?? prereqCode
        errors.push(
          `${course.name} requires ${prereqName} — move ${prereqName} before ${course.name}.`,
        )
        positionalErrorPairs.add(`${entry.activityCode}:${prereqCode}`)
      }
    }
  }

  for (const entry of courses) {
    if (!entry.activityCode || entry.dates.length < 1) continue

    const course = getCourseByCode(entry.activityCode as CourseCode)
    if (!course?.prerequisites?.length) continue

    const entryStart = entry.dates[0]

    for (const prereqCode of course.prerequisites) {
      const prereqEntry = courses.find(
        (c) => c.activityCode === prereqCode && c !== entry && c.dates.length >= 1,
      )
      if (!prereqEntry) continue
      if (positionalErrorPairs.has(`${entry.activityCode}:${prereqCode}`)) continue

      const prereqStart = prereqEntry.dates[0]
      if (prereqStart > entryStart) {
        const prereqCourse = getCourseByCode(prereqCode as CourseCode)
        const prereqName = prereqCourse?.name ?? prereqCode
        errors.push(
          `${prereqName} must be scheduled before ${course.name} — move ${prereqName} earlier.`,
        )
      }
    }
  }

  return errors
}

export function validateCourseDateOverlap(
  courses: { activityCode: string; dates: string[] }[],
): string[] {
  if (courses.length < 2) return []

  const errors: string[] = []

  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      const a = courses[i]
      const b = courses[j]

      if (!a.activityCode || !b.activityCode) continue
      if (a.dates.length < 1 || b.dates.length < 1) continue

      const aStart = a.dates[0]
      const aEnd = a.dates[1] ?? a.dates[0]
      const bStart = b.dates[0]
      const bEnd = b.dates[1] ?? b.dates[0]

      if (aStart <= bEnd && bStart <= aEnd) {
        const isComboTransition = isRecognizedComboTransition(
          a.activityCode, aEnd, b.activityCode, bStart,
        ) || isRecognizedComboTransition(
          b.activityCode, bEnd, a.activityCode, aStart,
        )
        if (!isComboTransition) {
          errors.push(
            `${a.activityCode} (${aStart}–${aEnd}) overlaps with ${b.activityCode} (${bStart}–${bEnd}).`,
          )
        }
      }
    }
  }

  return errors
}

export function getEndDateDefault(courseCode: string, startDate: string): string {
  const course = getCourseByCode(courseCode as CourseCode)
  if (!course) return startDate
  const days = course.minDays
  if (days <= 1) return startDate
  return addDays(startDate, days - 1)
}

export function validateNoDuplicateCourses(
  courses: { activityCode: string }[],
): string[] {
  const errors: string[] = []
  const seen = new Set<string>()

  for (const entry of courses) {
    if (!entry.activityCode) continue
    if (seen.has(entry.activityCode)) {
      const course = getCourseByCode(entry.activityCode as CourseCode)
      const name = course?.name ?? entry.activityCode
      errors.push(`Duplicate course: ${name} appears more than once.`)
    }
    seen.add(entry.activityCode)
  }

  return errors
}

function isRecognizedComboTransition(
  codeA: string, endA: string, codeB: string, startB: string,
): boolean {
  if (endA !== startB) return false
  return Object.values(COMBO_COURSES).some(
    (combo) => combo.codes[0] === codeA && combo.codes[1] === codeB,
  )
}

export function validateStartDateNotInPast(
  courses: { activityCode: string; dates: string[] }[],
  today: string,
): string[] {
  const errors: string[] = []

  for (const entry of courses) {
    if (!entry.activityCode || entry.dates.length === 0) continue
    if (entry.dates[0] < today) {
      const course = getCourseByCode(entry.activityCode as CourseCode)
      const name = course?.name ?? entry.activityCode
      errors.push(`${name} starts ${entry.dates[0]} — cannot start before today.`)
    }
  }

  return errors
}

export function calculateComboDates(
  startDate: string,
): { owDates: [string, string]; aowDates: [string, string] } {
  const owEnd = getEndDateDefault('OW', startDate)
  const aowEnd = getEndDateDefault('AOW', owEnd)
  return {
    owDates: [startDate, owEnd],
    aowDates: [owEnd, aowEnd],
  }
}

const CERT_COURSES = new Set<string>(['OW', 'AOW', 'RESCUE', 'DM', 'FD', 'REFRESH', 'SPECIALTY'])
const INTRO_COURSES = new Set<string>(['DSD', 'TRY_DIVE'])

export function getUnavailableCodes(
  allEntries: { activityCode: string }[],
  currentIndex: number,
): Set<string> {
  const allCodes = allEntries.map((e) => e.activityCode).filter(Boolean)
  const priorCodes = allCodes.slice(0, currentIndex)
  const priorSet = new Set(priorCodes)
  const unavailable = new Set<string>()

  for (const code of priorCodes) {
    const course = getCourseByCode(code as CourseCode)
    if (course && !course.repeatable) unavailable.add(code)
  }

  for (const code of priorCodes) {
    const course = getCourseByCode(code as CourseCode)
    for (const prereq of course?.prerequisites ?? []) unavailable.add(prereq)
  }

  const hasCert = priorCodes.some((c) => CERT_COURSES.has(c))
  const hasIntro = priorCodes.some((c) => INTRO_COURSES.has(c))
  if (hasCert) INTRO_COURSES.forEach((c) => unavailable.add(c))
  if (hasIntro) {
    CERT_COURSES.forEach((c) => { if (c !== 'OW') unavailable.add(c) })
  }

  if (currentIndex > 0) {
    for (const code of COURSE_CODES) {
      if (unavailable.has(code)) continue
      if (priorSet.has(code)) continue // already in booking — don't re-block
      const course = getCourseByCode(code)
      if (!course?.prerequisites?.length) continue
      const allPrereqsMet = course.prerequisites.every((p) => priorSet.has(p))
      if (!allPrereqsMet) unavailable.add(code)
    }
  }

  return unavailable
}

export function detectReferralWarnings(
  dives: ReadonlyArray<{ courseCode: string; diveNumber: number; isConfined: boolean }>,
  courseCodes: string[],
): string[] {
  if (dives.length === 0 || courseCodes.length === 0) return []

  const sequence = buildDiveSequence(courseCodes)
  const warnings: string[] = []

  for (const code of courseCodes) {
    const selectedForCourse = dives.filter(d => d.courseCode === code)
    if (selectedForCourse.length === 0) continue

    const firstInSequence = sequence.find(s => s.courseCode === code)
    if (!firstInSequence) continue

    let earliestIdx = Infinity
    for (const dv of selectedForCourse) {
      const idx = sequence.findIndex(s =>
        s.courseCode === dv.courseCode && s.diveNumber === dv.diveNumber && s.isConfined === dv.isConfined)
      if (idx >= 0 && idx < earliestIdx) earliestIdx = idx
    }

    const firstIdx = sequence.findIndex(s =>
      s.courseCode === firstInSequence.courseCode &&
      s.diveNumber === firstInSequence.diveNumber &&
      s.isConfined === firstInSequence.isConfined)

    if (earliestIdx > firstIdx) {
      const earliestDive = sequence[earliestIdx]
      const label = earliestDive.isConfined ? 'confined session' : `dive ${earliestDive.diveNumber}`
      warnings.push(`Starting ${label}. Customer is a referral.`)
    }
  }

  return warnings
}
