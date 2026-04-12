import { getCourseByCode, type CourseCode, type CourseCatalogEntry } from '@/lib/constants/course-catalog'
import { addDays, diffDays } from '@/lib/utils/date'
import type { DayConfig, DiveSlot } from '@/lib/booking/wizard-state'

export function sortByPrerequisites(courseCodes: string[]): string[] {
  if (courseCodes.length <= 1) return courseCodes

  const inDegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  for (const code of courseCodes) {
    inDegree.set(code, 0)
    if (!dependents.has(code)) dependents.set(code, [])
  }

  for (const code of courseCodes) {
    const entry = getCourseByCode(code as CourseCode)
    if (!entry?.prerequisites) continue
    for (const prereq of entry.prerequisites) {
      if (courseCodes.includes(prereq)) {
        inDegree.set(code, (inDegree.get(code) ?? 0) + 1)
        if (!dependents.has(prereq)) dependents.set(prereq, [])
        dependents.get(prereq)!.push(code)
      }
    }
  }

  const queue = courseCodes.filter((c) => (inDegree.get(c) ?? 0) === 0)
  const result: string[] = []

  while (queue.length > 0) {
    const node = queue.shift()!
    result.push(node)
    for (const dep of dependents.get(node) ?? []) {
      const newDeg = (inDegree.get(dep) ?? 1) - 1
      inDegree.set(dep, newDeg)
      if (newDeg === 0) queue.push(dep)
    }
  }

  for (const code of courseCodes) {
    if (!result.includes(code)) result.push(code)
  }

  return result
}

export interface DiveSlotDef {
  courseCode: string
  diveNumber: number
  isConfined: boolean
  label: string
  capped?: boolean
}

export function buildDiveSequence(courseCodes: string[]): DiveSlotDef[] {
  const slots: DiveSlotDef[] = []
  const sorted = sortByPrerequisites(courseCodes)

  for (const code of sorted) {
    const entry = getCourseByCode(code as CourseCode)
    if (!entry) continue

    const totalDives = getDiveCount(entry)
    if (totalDives === 0) continue

    if (entry.requiresConfined) {
      slots.push({
        courseCode: code,
        diveNumber: 0,
        isConfined: true,
        label: `${code} C`,
      })
    }

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

function getDiveCount(entry: CourseCatalogEntry): number {
  switch (entry.code) {
    case 'OW': return 5
    case 'AOW': return 5
    case 'DSD': return 1
    case 'TRY_DIVE': return 1
    case 'RESCUE': return 4
    case 'DM': return 6
    case 'SPECIALTY': return 2
    case 'REFRESH': return 1
    case 'FD': return 0
    default: return 0
  }
}

export function generateDays(
  courseCodes: string[],
  startDate: string,
  defaultDivesPerDay = 3,
  endDate?: string,
): DayConfig[] {
  if (!startDate || courseCodes.length === 0) return []

  const hasConfined = courseCodes.some((c) => getCourseByCode(c as CourseCode)?.requiresConfined)
  const sequence = buildDiveSequence(courseCodes)
  if (sequence.length === 0) {
    const validCourses = courseCodes.filter((c) => getCourseByCode(c as CourseCode))
    if (validCourses.length === 0) return []

    let dayCount: number
    if (endDate && endDate >= startDate) {
      dayCount = diffDays(endDate, startDate) + 1
    } else {
      dayCount = 1
    }

    return Array.from({ length: dayCount }, (_, i) => ({
      date: addDays(startDate, i),
      venueType: 'boat' as const,
      dives: validCourses.map((code) => ({
        courseCode: code,
        diveNumber: 1,
        isConfined: false,
      })),
      divesPerDay: defaultDivesPerDay,
      startTime: '08:00',
      endTime: '17:00',
      timezone: 'Asia/Bangkok',
    }))
  }

  let dayCount: number
  if (endDate && endDate >= startDate) {
    dayCount = diffDays(endDate, startDate) + 1
  } else {
    const nonConfined = sequence.filter((s) => !s.isConfined).length
    if (hasConfined) {
      const overflow = Math.max(0, nonConfined - defaultDivesPerDay)
      dayCount = 1 + Math.ceil(overflow / defaultDivesPerDay)
    } else {
      dayCount = Math.max(1, Math.ceil(nonConfined / defaultDivesPerDay))
    }
  }

  const result: DayConfig[] = []
  for (let i = 0; i < dayCount; i++) {
    result.push({
      date: addDays(startDate, i),
      venueType: hasConfined && i === 0 ? 'pool' : 'boat',
      dives: [],
      divesPerDay: defaultDivesPerDay,
      startTime: '08:00',
      endTime: '17:00',
      timezone: 'Asia/Bangkok',
    })
  }

  return result
}

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

  return days
}

export function distributeDives(days: DayConfig[], courseCodes: string[]): DayConfig[] {
  if (days.length === 0 || courseCodes.length === 0) return days

  const sequence = buildDiveSequence(courseCodes)
  if (sequence.length === 0) {
    const validCourses = courseCodes.filter((c) => getCourseByCode(c as CourseCode))
    if (validCourses.length === 0) return days
    return days.map((d) => ({
      ...d,
      dives: validCourses.map((code) => ({
        courseCode: code,
        diveNumber: 1,
        isConfined: false,
      })),
    }))
  }

  const confined = sequence.filter((s) => s.isConfined)
  const nonConfined = sequence.filter((s) => !s.isConfined)

  const result = days.map((d) => ({ ...d, dives: [] as DiveSlot[] }))

  const poolDayIdx = result.findIndex((d) => d.venueType === 'pool')
  if (poolDayIdx >= 0 && confined.length > 0) {
    result[poolDayIdx].dives = confined.map((s) => ({
      courseCode: s.courseCode,
      diveNumber: s.diveNumber,
      isConfined: s.isConfined,
    }))
  }

  const openDayIndices = result
    .map((d, i) => (d.venueType !== 'pool' ? i : -1))
    .filter((i) => i >= 0)

  if (openDayIndices.length === 0 && nonConfined.length > 0) {
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

export function countNonConfined(dives: DiveSlot[]): number {
  return dives.filter((d) => !d.isConfined).length
}

export function cascadeRemoveOrphans(days: DayConfig[], courseCodes: string[]): DayConfig[] {
  const sequence = buildDiveSequence(courseCodes)
  if (sequence.length === 0) return days

  const seqIdx = new Map<string, number>()
  sequence.forEach((s, i) => seqIdx.set(`${s.courseCode}:${s.diveNumber}:${s.isConfined}`, i))

  let result = days.map(d => ({ ...d, dives: [...d.dives] }))
  let changed = true

  while (changed) {
    changed = false
    const allSelected = new Set(
      result.flatMap(d => d.dives.map(dv => `${dv.courseCode}:${dv.diveNumber}:${dv.isConfined}`)),
    )
    const invalidKeys = new Set<string>()

    let prevHighwater = -1
    for (let d = 0; d < result.length; d++) {
      for (const dv of result[d].dives) {
        const idx = seqIdx.get(`${dv.courseCode}:${dv.diveNumber}:${dv.isConfined}`) ?? -1
        if (idx >= 0 && idx <= prevHighwater) {
          invalidKeys.add(`${dv.courseCode}:${dv.diveNumber}:${dv.isConfined}`)
        }
      }
      for (const dv of result[d].dives) {
        const idx = seqIdx.get(`${dv.courseCode}:${dv.diveNumber}:${dv.isConfined}`) ?? -1
        if (idx > prevHighwater) prevHighwater = idx
      }
    }

    for (const code of courseCodes) {
      const entry = getCourseByCode(code as CourseCode)
      if (!entry?.prerequisites) continue
      for (const prereq of entry.prerequisites) {
        if (!courseCodes.includes(prereq)) continue
        const prereqDives = sequence.filter(s => s.courseCode === prereq)
        const hasUnplaced = prereqDives.some(s =>
          !allSelected.has(`${s.courseCode}:${s.diveNumber}:${s.isConfined}`),
        )
        if (hasUnplaced) {
          for (const s of sequence.filter(s => s.courseCode === code)) {
            const key = `${s.courseCode}:${s.diveNumber}:${s.isConfined}`
            if (allSelected.has(key)) invalidKeys.add(key)
          }
        }
      }
    }

    if (invalidKeys.size > 0) {
      changed = true
      result = result.map(d => ({
        ...d,
        dives: d.dives.filter(dv =>
          !invalidKeys.has(`${dv.courseCode}:${dv.diveNumber}:${dv.isConfined}`),
        ),
      }))
    }
  }

  return result
}

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

  function getDiveDay(courseCode: string, diveNumber: number, isConfined: boolean): number {
    for (let rd = 0; rd < result.length; rd++) {
      if (result[rd].dives.some((dv) => dv.courseCode === courseCode && dv.diveNumber === diveNumber && dv.isConfined === isConfined)) {
        return rd
      }
    }
    return -1
  }

  let predIdx = 0

  for (let d = 0; d < dayIndex && predIdx < predecessors.length; d++) {
    const isPoolDay = result[d].venueType === 'pool'
    const dayLimit = result[d].divesPerDay || divesPerDay
    while (predIdx < predecessors.length) {
      const pred = predecessors[predIdx]
      if (isPoolDay && !pred.isConfined && countNonConfined(result[d].dives) >= dayLimit) break
      if (!isPoolDay && !pred.isConfined && countNonConfined(result[d].dives) >= dayLimit) break

      const predSeqIdx = fullSequence.findIndex(
        (s) => s.courseCode === pred.courseCode && s.diveNumber === pred.diveNumber && s.isConfined === pred.isConfined,
      )
      let minDay = 0
      let canPlace = true
      for (let i = 0; i < predSeqIdx; i++) {
        const s = fullSequence[i]
        const sDay = getDiveDay(s.courseCode, s.diveNumber, s.isConfined)
        if (sDay < 0) { canPlace = false; break } // Predecessor not yet placed
        if (sDay > minDay) minDay = sDay
      }
      if (!canPlace || d < minDay) break

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

export function autoDistributeFromDive(
  days: DayConfig[],
  startingDive: DiveSlot,
  courseCodes: string[],
): DayConfig[] {
  const sequence = buildDiveSequence(courseCodes)
  const startIdx = sequence.findIndex(s =>
    s.courseCode === startingDive.courseCode &&
    s.diveNumber === startingDive.diveNumber &&
    s.isConfined === startingDive.isConfined,
  )
  if (startIdx < 0) return days

  const remaining = sequence.slice(startIdx + 1)
  if (remaining.length === 0) return days

  const result = days.map(d => ({ ...d, dives: [...d.dives] }))

  const startDayIdx = result.findIndex(d =>
    d.dives.some(dv =>
      dv.courseCode === startingDive.courseCode &&
      dv.diveNumber === startingDive.diveNumber &&
      dv.isConfined === startingDive.isConfined,
    ),
  )
  if (startDayIdx < 0) return days

  let slotIdx = 0
  for (let d = startDayIdx; d < result.length && slotIdx < remaining.length; d++) {
    const divesPerDay = result[d].divesPerDay || 3
    while (slotIdx < remaining.length) {
      const dive = remaining[slotIdx]
      if (!dive.isConfined && countNonConfined(result[d].dives) >= divesPerDay) break
      result[d].dives.push({
        courseCode: dive.courseCode,
        diveNumber: dive.diveNumber,
        isConfined: dive.isConfined,
      })
      slotIdx++
    }
  }

  return result
}

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

export function getAvailableDives(
  dayIndex: number,
  days: DayConfig[],
  courseCodes: string[],
): DiveSlotDef[] {
  const fullSequence = buildDiveSequence(courseCodes)
  if (fullSequence.length === 0) return []

  const day = days[dayIndex]
  if (!day) return []

  const assignedDay = new Map<string, number>()
  for (let d = 0; d < days.length; d++) {
    for (const dv of days[d].dives) {
      assignedDay.set(`${dv.courseCode}:${dv.diveNumber}:${dv.isConfined}`, d)
    }
  }

  let highwater = -1
  for (let d = 0; d < dayIndex; d++) {
    for (const dv of days[d].dives) {
      const idx = fullSequence.findIndex(s =>
        s.courseCode === dv.courseCode && s.diveNumber === dv.diveNumber && s.isConfined === dv.isConfined)
      if (idx > highwater) highwater = idx
    }
  }

  const candidates = fullSequence.filter((slot, slotIdx) => {
    const key = `${slot.courseCode}:${slot.diveNumber}:${slot.isConfined}`
    const assigned = assignedDay.get(key)

    if (assigned !== undefined && assigned !== dayIndex) return false

    if (slotIdx <= highwater) return false

    if (slot.isConfined && dayIndex !== 0) return false

    return true
  })

  const allSelectedDives = days.flatMap(d => d.dives)

  let globalMaxSeqIndex = -1
  for (const dv of allSelectedDives) {
    const idx = fullSequence.findIndex(s =>
      s.courseCode === dv.courseCode && s.diveNumber === dv.diveNumber && s.isConfined === dv.isConfined)
    if (idx > globalMaxSeqIndex) globalMaxSeqIndex = idx
  }

  const sequentialCandidates = candidates.filter(slot => {
    const key = `${slot.courseCode}:${slot.diveNumber}:${slot.isConfined}`
    const isAlreadySelected = assignedDay.get(key) !== undefined

    if (isAlreadySelected) return true

    if (globalMaxSeqIndex === -1) return true

    const slotIdx = fullSequence.findIndex(s =>
      s.courseCode === slot.courseCode && s.diveNumber === slot.diveNumber && s.isConfined === slot.isConfined)
    return slotIdx === globalMaxSeqIndex + 1
  })

  const blockedCourses = new Set<string>()
  for (const code of courseCodes) {
    const entry = getCourseByCode(code as CourseCode)
    if (!entry?.prerequisites) continue
    for (const prereq of entry.prerequisites) {
      if (!courseCodes.includes(prereq)) continue
      const hasUnplaced = sequentialCandidates.some(s =>
        s.courseCode === prereq &&
        assignedDay.get(`${s.courseCode}:${s.diveNumber}:${s.isConfined}`) === undefined,
      )
      if (hasUnplaced) blockedCourses.add(code)
    }
  }

  const eligible = sequentialCandidates.filter(s => !blockedCourses.has(s.courseCode))

  const nonConfinedOnDay = countNonConfined(day.dives)
  const dayLimit = day.divesPerDay || 3
  if (nonConfinedOnDay >= dayLimit) {
    return eligible.map(s => {
      if (s.isConfined) return s
      const key = `${s.courseCode}:${s.diveNumber}:${s.isConfined}`
      if (assignedDay.get(key) === dayIndex) return s // already selected — not capped
      return { ...s, capped: true }
    })
  }

  return eligible
}
