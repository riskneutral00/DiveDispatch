// ── Smart Day Generator ──────────────────────────────────────────────────────
// Ported from prototype's generate-days.ts, adapted for DiveDispatch's type
// system and course catalog. Pure functions — no React, no Convex.

import { getCourseByCode, type CourseCode, type CourseCatalogEntry } from '@/lib/constants/course-catalog'
import { addDays, diffDays } from '@/lib/utils/date'
import type { DayConfig, DiveSlot } from '@/lib/booking/wizard-state'

// ── Dive Sequence Types ──────────────────────────────────────────────────────

export interface DiveSlotDef {
  courseCode: string
  diveNumber: number
  isConfined: boolean
  label: string
}

// ── buildDiveSequence ────────────────────────────────────────────────────────

/**
 * Build the full ordered dive module sequence from course codes.
 * Uses the course catalog to determine: confined dives first, then numbered
 * open-water dives. Courses with zero dives (FD, TD, Snorkel) are skipped.
 */
export function buildDiveSequence(courseCodes: string[]): DiveSlotDef[] {
  const slots: DiveSlotDef[] = []

  for (const code of courseCodes) {
    const entry = getCourseByCode(code as CourseCode)
    if (!entry) continue

    // Determine total dives: minDays for agency courses without explicit sequence,
    // or synthesize from requiresConfined + open-water dives
    const totalDives = getDiveCount(entry)
    if (totalDives === 0) continue

    // Confined dive first (diveNumber 0)
    if (entry.requiresConfined) {
      slots.push({
        courseCode: code,
        diveNumber: 0,
        isConfined: true,
        label: `${code} C`,
      })
    }

    // Open-water dives
    const openWaterCount = entry.requiresConfined ? totalDives - 1 : totalDives
    for (let i = 1; i <= openWaterCount; i++) {
      slots.push({
        courseCode: code,
        diveNumber: i,
        isConfined: false,
        label: `${code}-${i}`,
      })
    }
  }

  return slots
}

/** Get total dive count for a course entry. */
function getDiveCount(entry: CourseCatalogEntry): number {
  // DiveDispatch catalog uses minDays and requiresConfined to imply dives.
  // OW: minDays 3, requiresConfined → 1 confined + 4 open = 5 dives
  // AOW: minDays 2, no confined → 5 open dives
  // DSD: minDays 1, requiresConfined → 1 confined dive
  // FD/REFRESH: variable — FD has 0 mandated dives
  switch (entry.code) {
    case 'OW': return 5   // 1 confined + 4 open-water
    case 'AOW': return 5  // 5 adventure dives
    case 'DSD': return 1  // 1 confined
    case 'TRY_DIVE': return 1
    case 'RESCUE': return 4
    case 'DM': return 6
    case 'SPECIALTY': return 2
    case 'REFRESH': return 1
    case 'FD': return 0   // No mandated sequence
    default: return 0
  }
}

// ── generateDays ─────────────────────────────────────────────────────────────

/**
 * Auto-generates day configs from course codes and a start date.
 * Confined day placed first. Dives distributed at divesPerDay per boat day.
 */
export function generateDays(
  courseCodes: string[],
  startDate: string,
  defaultDivesPerDay = 3,
  endDate?: string,
): DayConfig[] {
  if (!startDate || courseCodes.length === 0) return []

  const hasConfined = courseCodes.some((c) => getCourseByCode(c as CourseCode)?.requiresConfined)
  const sequence = buildDiveSequence(courseCodes)
  if (sequence.length === 0) return []

  // Calculate day count
  let dayCount: number
  if (endDate && endDate >= startDate) {
    dayCount = diffDays(endDate, startDate) + 1
  } else {
    const nonConfined = sequence.filter((s) => !s.isConfined).length
    const confinedDays = hasConfined ? 1 : 0
    dayCount = confinedDays + Math.ceil(nonConfined / defaultDivesPerDay)
  }

  const result: DayConfig[] = []
  for (let i = 0; i < dayCount; i++) {
    result.push({
      date: addDays(startDate, i),
      venueType: hasConfined && i === 0 ? 'pool' : 'boat',
      dives: [],
      divesPerDay: defaultDivesPerDay,
      startTime: hasConfined && i === 0 ? '09:00' : '08:00',
      endTime: hasConfined && i === 0 ? '14:00' : '17:00',
      timezone: 'Asia/Bangkok',
    })
  }

  return distributeDives(result, courseCodes)
}

// ── generateDaysFromDates ────────────────────────────────────────────────────

/**
 * Generate days from an explicit date array (non-sequential dates supported).
 * Sorts dates, places confined day first, distributes dives.
 */
export function generateDaysFromDates(courseCodes: string[], dates: string[]): DayConfig[] {
  if (dates.length === 0 || courseCodes.length === 0) return []

  const sorted = [...dates].sort()
  const hasConfined = courseCodes.some((c) => getCourseByCode(c as CourseCode)?.requiresConfined)

  const days: DayConfig[] = sorted.map((date, i) => ({
    date,
    venueType: hasConfined && i === 0 ? ('pool' as const) : ('boat' as const),
    dives: [],
    divesPerDay: 3,
    startTime: hasConfined && i === 0 ? '09:00' : '08:00',
    endTime: hasConfined && i === 0 ? '14:00' : '17:00',
    timezone: 'Asia/Bangkok',
  }))

  return distributeDives(days, courseCodes)
}

// ── distributeDives ──────────────────────────────────────────────────────────

/**
 * Auto-distribute dive modules across generated days.
 * Confined dives go on pool day. Non-confined dives fill boat days sequentially
 * respecting divesPerDay limit. Overflow cascades to last day.
 */
export function distributeDives(days: DayConfig[], courseCodes: string[]): DayConfig[] {
  if (days.length === 0 || courseCodes.length === 0) return days

  const sequence = buildDiveSequence(courseCodes)
  if (sequence.length === 0) return days

  const confined = sequence.filter((s) => s.isConfined)
  const nonConfined = sequence.filter((s) => !s.isConfined)

  const result = days.map((d) => ({ ...d, dives: [] as DiveSlot[] }))

  // Place confined dives on pool day
  const poolDayIdx = result.findIndex((d) => d.venueType === 'pool')
  if (poolDayIdx >= 0 && confined.length > 0) {
    result[poolDayIdx].dives = confined.map((s) => ({
      courseCode: s.courseCode,
      diveNumber: s.diveNumber,
      isConfined: s.isConfined,
    }))
  }

  // Place non-confined dives on non-pool days
  const openDayIndices = result
    .map((d, i) => (d.venueType !== 'pool' ? i : -1))
    .filter((i) => i >= 0)

  if (openDayIndices.length === 0 && nonConfined.length > 0) {
    // No open days — overflow to last day
    const lastIdx = result.length - 1
    result[lastIdx].dives = [
      ...result[lastIdx].dives,
      ...nonConfined.map((s) => ({
        courseCode: s.courseCode,
        diveNumber: s.diveNumber,
        isConfined: s.isConfined,
      })),
    ]
    return result
  }

  let slotIdx = 0
  for (const dayIdx of openDayIndices) {
    if (slotIdx >= nonConfined.length) break
    const divesPerDay = result[dayIdx].divesPerDay || 3
    const batch = nonConfined.slice(slotIdx, slotIdx + divesPerDay)
    result[dayIdx].dives = batch.map((s) => ({
      courseCode: s.courseCode,
      diveNumber: s.diveNumber,
      isConfined: s.isConfined,
    }))
    slotIdx += batch.length
  }

  // Overflow remaining to last open day
  if (slotIdx < nonConfined.length) {
    const lastOpenIdx = openDayIndices[openDayIndices.length - 1]
    const remaining = nonConfined.slice(slotIdx).map((s) => ({
      courseCode: s.courseCode,
      diveNumber: s.diveNumber,
      isConfined: s.isConfined,
    }))
    result[lastOpenIdx].dives = [...result[lastOpenIdx].dives, ...remaining]
  }

  return result
}

// ── countNonConfined ─────────────────────────────────────────────────────────

/** Count only non-confined dives (confined dives don't count toward per-day limit). */
export function countNonConfined(dives: DiveSlot[]): number {
  return dives.filter((d) => !d.isConfined).length
}

// ── cascadeRemoveOrphans ─────────────────────────────────────────────────────

/**
 * Remove orphaned dives whose prerequisite chain is broken after a deselect.
 * If dive N is missing but dive N+1 exists, remove N+1 and all subsequent.
 */
export function cascadeRemoveOrphans(days: DayConfig[], courseCodes: string[]): DayConfig[] {
  const sequence = buildDiveSequence(courseCodes)
  if (sequence.length === 0) return days

  const allSelected = new Set(
    days.flatMap((d) => d.dives.map((dv) => `${dv.courseCode}:${dv.diveNumber}:${dv.isConfined}`)),
  )

  // Walk the sequence — once we hit a gap, everything after is invalid
  const invalidKeys = new Set<string>()
  let gapFound = false

  for (const slot of sequence) {
    const key = `${slot.courseCode}:${slot.diveNumber}:${slot.isConfined}`
    if (!allSelected.has(key) && !slot.isConfined) {
      gapFound = true
    }
    if (gapFound && !slot.isConfined && allSelected.has(key)) {
      invalidKeys.add(key)
    }
  }

  if (invalidKeys.size === 0) return days

  return days.map((d) => ({
    ...d,
    dives: d.dives.filter(
      (dv) => !invalidKeys.has(`${dv.courseCode}:${dv.diveNumber}:${dv.isConfined}`),
    ),
  }))
}

// ── autoFillPredecessors ─────────────────────────────────────────────────────

/**
 * When a later dive is selected, auto-fill all unscheduled predecessor dives
 * into earlier days. Respects per-day limits.
 */
export function autoFillPredecessors(
  dayIndex: number,
  diveSlot: DiveSlot,
  days: DayConfig[],
  fullSequence: DiveSlotDef[],
  divesPerDay: number,
): DayConfig[] {
  if (dayIndex === 0) return days

  const slotPos = fullSequence.findIndex(
    (s) =>
      s.courseCode === diveSlot.courseCode &&
      s.diveNumber === diveSlot.diveNumber &&
      s.isConfined === diveSlot.isConfined,
  )

  if (slotPos <= 0) return days

  const allAssigned = new Set(
    days.flatMap((d) => d.dives.map((dv) => `${dv.courseCode}:${dv.diveNumber}:${dv.isConfined}`)),
  )

  const predecessors = fullSequence
    .slice(0, slotPos)
    .filter((s) => !allAssigned.has(`${s.courseCode}:${s.diveNumber}:${s.isConfined}`))

  if (predecessors.length === 0) return days

  const result = days.map((d) => ({ ...d, dives: [...d.dives] }))
  let predIdx = 0

  for (let d = 0; d < dayIndex && predIdx < predecessors.length; d++) {
    const isPoolDay = result[d].venueType === 'pool'
    const dayLimit = result[d].divesPerDay || divesPerDay
    while (predIdx < predecessors.length) {
      const pred = predecessors[predIdx]
      // Pool days only accept confined dives
      if (isPoolDay && !pred.isConfined) break
      // Non-pool days check divesPerDay limit for non-confined dives
      if (!isPoolDay && !pred.isConfined && countNonConfined(result[d].dives) >= dayLimit) break
      result[d].dives.push({
        courseCode: pred.courseCode,
        diveNumber: pred.diveNumber,
        isConfined: pred.isConfined,
      })
      predIdx++
    }
  }

  return result
}

// ── ensureSufficientDays ─────────────────────────────────────────────────────

/**
 * Append boat days when remaining unscheduled dives overflow the existing days.
 */
export function ensureSufficientDays(days: DayConfig[], courseCodes: string[]): DayConfig[] {
  const sequence = buildDiveSequence(courseCodes)
  const nonConfinedTotal = sequence.filter((s) => !s.isConfined).length
  if (nonConfinedTotal === 0) return days

  const scheduledNonConfined = days.flatMap((d) => d.dives).filter((d) => !d.isConfined).length
  const remaining = nonConfinedTotal - scheduledNonConfined
  if (remaining <= 0) return days

  const lastDay = days[days.length - 1]
  const divesPerDay = lastDay?.divesPerDay || 3
  const daysNeeded = Math.ceil(remaining / divesPerDay)

  // Count empty non-pool days at the tail that could receive non-confined dives
  const lastFilledIdx = days.reduce((acc, d, i) => (d.dives.length > 0 ? i : acc), -1)
  const tailDays = days.slice(lastFilledIdx + 1)
  const emptyOpenTailDays = tailDays.filter((d) => d.venueType !== 'pool').length

  if (daysNeeded <= emptyOpenTailDays) return days

  const extraDays = daysNeeded - emptyOpenTailDays
  const result = [...days]
  for (let i = 0; i < extraDays; i++) {
    const prevDate = result[result.length - 1]?.date ?? '2026-01-01'
    result.push({
      date: addDays(prevDate, 1),
      venueType: 'boat',
      dives: [],
      isAutoAppended: true,
      divesPerDay,
      startTime: lastDay?.startTime ?? '08:00',
      endTime: lastDay?.endTime ?? '17:00',
      timezone: lastDay?.timezone ?? 'Asia/Bangkok',
    })
  }
  return result
}
