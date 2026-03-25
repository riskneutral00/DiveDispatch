import { describe, it, expect } from 'vitest'
import {
  generateDays,
  generateDaysFromDates,
  buildDiveSequence,
  distributeDives,
  autoFillPredecessors,
  autoDistributeFromDive,
  ensureSufficientDays,
  cascadeRemoveOrphans,
  countNonConfined,
  sortByPrerequisites,
  getAvailableDives,
} from '../src/lib/booking/generate-days'
import type { DayConfig, DiveSlot } from '../src/lib/booking/wizard-state'
import { testDate } from './helpers/dates'
import { addDays } from '../src/lib/utils/date'

// ── buildDiveSequence ──────────────────────────────────────────────────────

describe('buildDiveSequence', () => {
  it('returns OW sequence: 1 confined + 4 open-water dives', () => {
    const seq = buildDiveSequence(['OW'])
    expect(seq.length).toBe(5)
    expect(seq[0]).toMatchObject({ courseCode: 'OW', diveNumber: 0, isConfined: true })
    expect(seq[1]).toMatchObject({ courseCode: 'OW', diveNumber: 1, isConfined: false })
    expect(seq[4]).toMatchObject({ courseCode: 'OW', diveNumber: 4, isConfined: false })
  })

  it('returns AOW sequence: 5 open-water dives, no confined', () => {
    const seq = buildDiveSequence(['AOW'])
    expect(seq.length).toBe(5)
    expect(seq.every((s) => !s.isConfined)).toBe(true)
    expect(seq[0]).toMatchObject({ courseCode: 'AOW', diveNumber: 1 })
    expect(seq[4]).toMatchObject({ courseCode: 'AOW', diveNumber: 5 })
  })

  it('returns DSD sequence: 1 confined dive', () => {
    const seq = buildDiveSequence(['DSD'])
    expect(seq.length).toBe(1)
    expect(seq[0]).toMatchObject({ courseCode: 'DSD', isConfined: true })
  })

  it('concatenates multiple courses in order', () => {
    const seq = buildDiveSequence(['OW', 'AOW'])
    expect(seq.length).toBe(10) // 5 OW + 5 AOW
    // OW should come first
    expect(seq[0].courseCode).toBe('OW')
    expect(seq[5].courseCode).toBe('AOW')
  })

  it('returns empty array for empty input', () => {
    expect(buildDiveSequence([])).toEqual([])
  })

  it('returns empty for courses with zero dives (FD, TD)', () => {
    // FD and TD have minDives=0 in DiveDispatch catalog — they have no dive sequence
    const seq = buildDiveSequence(['FD'])
    expect(seq.length).toBe(0)
  })
})

// ── generateDays ────────────────────────────────────────────────────────────

describe('generateDays', () => {
  it('returns empty for no courses', () => {
    expect(generateDays([], testDate(5))).toEqual([])
  })

  it('returns empty for empty start date', () => {
    expect(generateDays(['OW'], '')).toEqual([])
  })

  it('generates exactly 2 days for OW (1 pool absorbs 3 OW + 1 boat)', () => {
    // Pool day absorbs confined + up to 3 non-confined. OW = 4 non-confined, overflow 1 → 1 boat day
    const days = generateDays(['OW'], testDate(5))
    expect(days.length).toBe(2)
  })

  it('first day is pool when course has confined requirement', () => {
    const days = generateDays(['OW'], testDate(5))
    expect(days[0].venueType).toBe('pool')
  })

  it('non-confined courses skip pool day', () => {
    const days = generateDays(['AOW'], testDate(5))
    expect(days.every((d) => d.venueType !== 'pool')).toBe(true)
  })

  it('generateDays returns empty dives (operator fills via ghost pills)', () => {
    const days = generateDays(['OW'], testDate(5))
    const totalDives = days.reduce((sum, d) => sum + d.dives.length, 0)
    expect(totalDives).toBe(0)
  })

  it('distributeDives places confined on pool day, open on boat days', () => {
    const days = distributeDives(generateDays(['OW'], testDate(5)), ['OW'])
    const poolDay = days.find((d) => d.venueType === 'pool')
    expect(poolDay?.venueType).toBe('pool')
    expect(poolDay!.dives.some((d) => d.isConfined)).toBe(true)

    const boatDays = days.filter((d) => d.venueType === 'boat')
    for (const d of boatDays) {
      expect(d.dives.every((dv) => !dv.isConfined)).toBe(true)
    }
  })

  it('respects endDate when provided (expands day count)', () => {
    const days = generateDays(['OW'], testDate(5), 3, addDays(testDate(5), 4))
    expect(days.length).toBe(5) // 5 consecutive days
    expect(days[0].date).toBe(testDate(5))
    expect(days[4].date).toBe(addDays(testDate(5), 4))
  })

  it('uses default divesPerDay of 3', () => {
    const days = generateDays(['OW'], testDate(5))
    const boatDays = days.filter((d) => d.venueType === 'boat')
    for (const d of boatDays) {
      // Non-confined dives per day should not exceed 3
      expect(countNonConfined(d.dives)).toBeLessThanOrEqual(3)
    }
  })

  it('generates DSD as single-day booking (empty — operator selects confined pill)', () => {
    const days = generateDays(['DSD'], testDate(5))
    expect(days.length).toBe(1)
    expect(days[0].venueType).toBe('pool')
    expect(days[0].dives.length).toBe(0) // empty, operator selects
  })

  it('generates days for FD (0 mandated dives) with synthetic dive slots', () => {
    const days = generateDays(['FD'], testDate(10), 3, addDays(testDate(10), 1))
    expect(days.length).toBe(2)
    expect(days[0].venueType).toBe('boat')
    expect(days[0].dives.length).toBe(1)
    expect(days[0].dives[0]).toEqual({ courseCode: 'FD', diveNumber: 1, isConfined: false })
    expect(days[1].dives[0]).toEqual({ courseCode: 'FD', diveNumber: 1, isConfined: false })
  })

  it('generates single day for FD without endDate', () => {
    const days = generateDays(['FD'], testDate(10))
    expect(days.length).toBe(1)
    expect(days[0].venueType).toBe('boat')
    expect(days[0].dives[0].courseCode).toBe('FD')
  })

  // A2: AOW alone = exactly 2 days (no confined, 5 dives at 3/day = ceil(5/3) = 2)
  it('generates exactly 2 days for AOW alone', () => {
    const days = generateDays(['AOW'], testDate(10))
    expect(days.length).toBe(2)
    expect(days.every((d) => d.venueType === 'boat')).toBe(true)
  })

  // O+A without endDate: pool absorbs 3 non-confined, overflow 6 → ceil(6/3)=2 boat → 3 days total
  it('O+A generates exactly 3 days (1 pool + 2 boat)', () => {
    const days = generateDays(['OW', 'AOW'], testDate(10))
    expect(days.length).toBe(3)
    expect(days[0].venueType).toBe('pool')
    expect(days.filter((d) => d.venueType === 'boat').length).toBe(2)
  })

  // distributeDives still orders OW before AOW
  it('O+A distributeDives: all OW dives precede AOW dives', () => {
    const days = distributeDives(generateDays(['OW', 'AOW'], testDate(10)), ['OW', 'AOW'])
    const allDives = days.flatMap((d) => d.dives)
    const lastOWIdx = allDives.reduce((acc, d, i) => (d.courseCode === 'OW' && !d.isConfined ? i : acc), -1)
    const firstAOWIdx = allDives.findIndex((d) => d.courseCode === 'AOW')
    if (firstAOWIdx >= 0) expect(firstAOWIdx).toBeGreaterThan(lastOWIdx)
  })

  // distributeDives: O+A transition day has both OW and AOW dives
  it('O+A distributeDives: transition day has both OW and AOW dives', () => {
    const days = distributeDives(generateDays(['OW', 'AOW'], testDate(10)), ['OW', 'AOW'])
    const transitionDay = days.find(
      (d) =>
        d.venueType === 'boat' &&
        d.dives.some((dv) => dv.courseCode === 'OW') &&
        d.dives.some((dv) => dv.courseCode === 'AOW'),
    )
    expect(transitionDay?.venueType).toBe('boat')
  })

  // Pool day starts empty (operator fills via ghost pills)
  it('pool day starts empty', () => {
    const days = generateDays(['OW'], testDate(5))
    const poolDay = days.find((d) => d.venueType === 'pool')
    expect(poolDay?.venueType).toBe('pool')
    expect(poolDay!.dives.length).toBe(0)
  })

  // Per-day non-confined dive limit: each day ≤ 3 non-confined dives (default divesPerDay)
  it('no day exceeds 3 non-confined dives (O+A distribution)', () => {
    const days = generateDays(['OW', 'AOW'], testDate(10))
    for (const day of days) {
      expect(countNonConfined(day.dives)).toBeLessThanOrEqual(3)
    }
  })
})

// ── generateDaysFromDates ───────────────────────────────────────────────────

describe('generateDaysFromDates', () => {
  it('creates days from explicit date array', () => {
    const days = generateDaysFromDates(['OW'], [testDate(5), testDate(7), testDate(10)])
    expect(days.length).toBe(3)
    expect(days[0].date).toBe(testDate(5))
    expect(days[1].date).toBe(testDate(7))
    expect(days[2].date).toBe(testDate(10))
  })

  it('sorts dates even if given out of order', () => {
    const days = generateDaysFromDates(['OW'], [testDate(10), testDate(5), testDate(7)])
    expect(days.map((d) => d.date)).toEqual([testDate(5), testDate(7), testDate(10)])
  })

  it('first date is pool when course requires confined', () => {
    const days = generateDaysFromDates(['OW'], [testDate(5), testDate(6)])
    expect(days[0].venueType).toBe('pool')
    expect(days[1].venueType).toBe('boat')
  })

  it('returns empty dives (operator fills via ghost pills)', () => {
    const days = generateDaysFromDates(['OW'], [testDate(5), testDate(6), testDate(7)])
    const totalDives = days.reduce((sum, d) => sum + d.dives.length, 0)
    expect(totalDives).toBe(0)
  })

  it('returns empty for empty dates', () => {
    expect(generateDaysFromDates(['OW'], [])).toEqual([])
  })

  it('returns empty for empty courses', () => {
    expect(generateDaysFromDates([], [testDate(5)])).toEqual([])
  })
})

// ── distributeDives ─────────────────────────────────────────────────────────

describe('distributeDives', () => {
  it('places confined dives on pool day', () => {
    const days: DayConfig[] = [
      makeDayConfig(testDate(5), 'pool'),
      makeDayConfig(testDate(6), 'boat'),
    ]
    const result = distributeDives(days, ['OW'])
    const poolDay = result.find((d) => d.venueType === 'pool')!
    expect(poolDay.dives.some((d) => d.isConfined)).toBe(true)
  })

  it('does not place non-confined dives on pool day', () => {
    const days: DayConfig[] = [
      makeDayConfig(testDate(5), 'pool'),
      makeDayConfig(testDate(6), 'boat'),
      makeDayConfig(testDate(7), 'boat'),
    ]
    const result = distributeDives(days, ['OW'])
    const poolDay = result.find((d) => d.venueType === 'pool')!
    // Only confined dives on pool day
    expect(poolDay.dives.every((d) => d.isConfined)).toBe(true)
  })

  it('distributes non-confined dives across boat days', () => {
    const days: DayConfig[] = [
      makeDayConfig(testDate(5), 'pool'),
      makeDayConfig(testDate(6), 'boat', 3),
      makeDayConfig(testDate(7), 'boat', 3),
    ]
    const result = distributeDives(days, ['OW'])
    const boatDays = result.filter((d) => d.venueType === 'boat')
    const totalNonConfined = boatDays.reduce((sum, d) => sum + countNonConfined(d.dives), 0)
    expect(totalNonConfined).toBe(4) // OW has 4 open-water dives
  })

  it('respects divesPerDay limit per boat day', () => {
    const days: DayConfig[] = [
      makeDayConfig(testDate(5), 'pool'),
      makeDayConfig(testDate(6), 'boat', 2),
      makeDayConfig(testDate(7), 'boat', 2),
      makeDayConfig(testDate(8), 'boat', 2),
    ]
    const result = distributeDives(days, ['OW'])
    const boatDays = result.filter((d) => d.venueType === 'boat')
    for (const d of boatDays) {
      expect(countNonConfined(d.dives)).toBeLessThanOrEqual(2)
    }
  })

  it('overflows to last day when not enough boat days', () => {
    // OW needs 4 open-water dives, but only 1 boat day with limit 3
    const days: DayConfig[] = [
      makeDayConfig(testDate(5), 'pool'),
      makeDayConfig(testDate(6), 'boat', 3),
    ]
    const result = distributeDives(days, ['OW'])
    const boatDay = result.find((d) => d.venueType === 'boat')!
    // Should overflow: all 4 dives on the single boat day
    expect(boatDay.dives.filter((d) => !d.isConfined).length).toBe(4)
  })

  it('handles AOW-only (no pool day needed)', () => {
    const days: DayConfig[] = [
      makeDayConfig(testDate(5), 'boat', 3),
      makeDayConfig(testDate(6), 'boat', 3),
    ]
    const result = distributeDives(days, ['AOW'])
    const totalDives = result.reduce((sum, d) => sum + d.dives.length, 0)
    expect(totalDives).toBe(5) // AOW has 5 dives
  })
})

// ── autoFillPredecessors ────────────────────────────────────────────────────

describe('autoFillPredecessors', () => {
  it('fills earlier dives when a later dive is selected', () => {
    const sequence = buildDiveSequence(['OW'])
    const days: DayConfig[] = [
      makeDayConfig(testDate(5), 'pool'),
      makeDayConfig(testDate(6), 'boat'),
      makeDayConfig(testDate(7), 'boat'),
    ]
    // User selects OW dive 3 on day 2 (dayIndex=2)
    const diveSlot: DiveSlot = { courseCode: 'OW', diveNumber: 3, isConfined: false }
    const result = autoFillPredecessors(2, diveSlot, days, sequence, 3)

    // Should auto-fill: confined on day 0; OW-1/OW-2 also on pool day (relaxed restriction)
    const poolDay = result[0]
    expect(poolDay.dives.some((d) => d.isConfined && d.courseCode === 'OW')).toBe(true)

    const allFilled = result.flatMap((d) => d.dives)
    expect(allFilled.some((d) => d.diveNumber === 1)).toBe(true)
    expect(allFilled.some((d) => d.diveNumber === 2)).toBe(true)
  })

  it('skips already-assigned dives', () => {
    const sequence = buildDiveSequence(['OW'])
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(5), 'pool'), dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }] },
      { ...makeDayConfig(testDate(6), 'boat'), dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }] },
      makeDayConfig(testDate(7), 'boat'),
    ]
    const diveSlot: DiveSlot = { courseCode: 'OW', diveNumber: 3, isConfined: false }
    const result = autoFillPredecessors(2, diveSlot, days, sequence, 3)

    // Only OW-2 should be auto-filled (confined and OW-1 already exist)
    const allDives = result.flatMap((d) => d.dives)
    expect(allDives.filter((d) => d.diveNumber === 2).length).toBe(1)
    // Confined still just 1
    expect(allDives.filter((d) => d.isConfined).length).toBe(1)
  })

  it('returns unchanged days when dayIndex is 0', () => {
    const sequence = buildDiveSequence(['OW'])
    const days: DayConfig[] = [makeDayConfig(testDate(5), 'pool')]
    const diveSlot: DiveSlot = { courseCode: 'OW', diveNumber: 0, isConfined: true }
    const result = autoFillPredecessors(0, diveSlot, days, sequence, 3)
    expect(result).toBe(days)
  })
})

// ── ensureSufficientDays ────────────────────────────────────────────────────

describe('ensureSufficientDays', () => {
  it('appends days when dives overflow', () => {
    // OW needs 4 non-confined dives but we only have 1 boat day with 3/day limit
    const days: DayConfig[] = [
      makeDayConfig(testDate(5), 'pool'),
      makeDayConfig(testDate(6), 'boat', 3),
    ]
    // No dives scheduled yet
    const result = ensureSufficientDays(days, ['OW'])
    // Should add at least 1 more day
    expect(result.length).toBeGreaterThan(2)
    // New days should be boat type
    expect(result[result.length - 1].venueType).toBe('boat')
    // New days should be auto-appended
    expect(result[result.length - 1].isAutoAppended).toBe(true)
  })

  it('does not append when enough days exist', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(5), 'pool'), dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }] },
      { ...makeDayConfig(testDate(6), 'boat', 3), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      { ...makeDayConfig(testDate(7), 'boat', 3), dives: [
        { courseCode: 'OW', diveNumber: 4, isConfined: false },
      ] },
    ]
    const result = ensureSufficientDays(days, ['OW'])
    expect(result.length).toBe(3)
  })

  it('appended days have sequential dates', () => {
    const days: DayConfig[] = [
      makeDayConfig(testDate(5), 'pool'),
      makeDayConfig(testDate(6), 'boat', 2),
    ]
    const result = ensureSufficientDays(days, ['OW'])
    for (let i = 1; i < result.length; i++) {
      expect(result[i].date > result[i - 1].date).toBe(true)
    }
  })
})

// ── cascadeRemoveOrphans ────────────────────────────────────────────────────

describe('cascadeRemoveOrphans', () => {
  it('allows within-course gaps: missing dive does not remove later dives', () => {
    // Simulate: OW confined + dive 1 scheduled, dive 2 missing, dive 3 exists
    // Under highwater rules, within-course gaps are allowed
    const days: DayConfig[] = [
      {
        ...makeDayConfig(testDate(5), 'pool'),
        dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }],
      },
      {
        ...makeDayConfig(testDate(6), 'boat'),
        dives: [
          { courseCode: 'OW', diveNumber: 1, isConfined: false },
          { courseCode: 'OW', diveNumber: 3, isConfined: false }, // skipped 2
        ],
      },
    ]
    const result = cascadeRemoveOrphans(days, ['OW'])
    const allDives = result.flatMap((d) => d.dives)
    // All dives remain — gaps within a course are allowed
    expect(allDives.some((d) => d.diveNumber === 0)).toBe(true)
    expect(allDives.some((d) => d.diveNumber === 1)).toBe(true)
    expect(allDives.some((d) => d.diveNumber === 3)).toBe(true)
  })

  it('returns unchanged days when no orphans', () => {
    const days: DayConfig[] = [
      {
        ...makeDayConfig(testDate(5), 'pool'),
        dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }],
      },
      {
        ...makeDayConfig(testDate(6), 'boat'),
        dives: [
          { courseCode: 'OW', diveNumber: 1, isConfined: false },
          { courseCode: 'OW', diveNumber: 2, isConfined: false },
        ],
      },
    ]
    const result = cascadeRemoveOrphans(days, ['OW'])
    const totalDives = result.reduce((sum, d) => sum + d.dives.length, 0)
    expect(totalDives).toBe(3)
  })
})

// ── countNonConfined ────────────────────────────────────────────────────────

describe('countNonConfined', () => {
  it('counts only non-confined dives', () => {
    const dives: DiveSlot[] = [
      { courseCode: 'OW', diveNumber: 0, isConfined: true },
      { courseCode: 'OW', diveNumber: 1, isConfined: false },
      { courseCode: 'OW', diveNumber: 2, isConfined: false },
    ]
    expect(countNonConfined(dives)).toBe(2)
  })

  it('returns 0 for all confined', () => {
    const dives: DiveSlot[] = [
      { courseCode: 'DSD', diveNumber: 0, isConfined: true },
    ]
    expect(countNonConfined(dives)).toBe(0)
  })

  it('returns 0 for empty array', () => {
    expect(countNonConfined([])).toBe(0)
  })
})

// ── sortByPrerequisites ───────────────────────────────────────────────────

describe('sortByPrerequisites', () => {
  it('returns OW before AOW', () => {
    expect(sortByPrerequisites(['AOW', 'OW'])).toEqual(['OW', 'AOW'])
  })

  it('preserves order when already correct', () => {
    expect(sortByPrerequisites(['OW', 'AOW'])).toEqual(['OW', 'AOW'])
  })

  it('handles full chain: DM, OW, RESCUE, AOW → OW, AOW, RESCUE, DM', () => {
    expect(sortByPrerequisites(['DM', 'OW', 'RESCUE', 'AOW'])).toEqual(['OW', 'AOW', 'RESCUE', 'DM'])
  })

  it('returns single code unchanged', () => {
    expect(sortByPrerequisites(['OW'])).toEqual(['OW'])
  })

  it('handles independent courses in original order', () => {
    expect(sortByPrerequisites(['DSD', 'FD'])).toEqual(['DSD', 'FD'])
  })
})

// ── getAvailableDives ─────────────────────────────────────────────────────

describe('getAvailableDives', () => {
  it('returns confined dive on pool day when nothing is placed', () => {
    const days: DayConfig[] = [
      makeDayConfig(testDate(10), 'pool'),
      makeDayConfig(testDate(11), 'boat'),
    ]
    const available = getAvailableDives(0, days, ['OW'])
    expect(available.some((s) => s.isConfined && s.courseCode === 'OW')).toBe(true)
  })

  it('shows all dives including confined on boat days (venue is per-dive)', () => {
    const days: DayConfig[] = [
      makeDayConfig(testDate(10), 'pool'),
      makeDayConfig(testDate(11), 'boat'),
    ]
    const available = getAvailableDives(1, days, ['OW'])
    // Confined is available on boat days — venue is per-dive now
    expect(available.some((s) => s.isConfined)).toBe(true)
  })

  it('respects predecessor ordering: AOW dives unavailable until all OW dives placed', () => {
    // Day 1 pool: OW C placed. Day 2 boat: OW 1-3 placed. Day 3 boat: nothing placed.
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(10), 'pool'), dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }] },
      { ...makeDayConfig(testDate(11), 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      makeDayConfig(testDate(12), 'boat'),
    ]
    // Day 2: OW-4 not placed yet, so no AOW dives should be available
    const day2Available = getAvailableDives(1, days, ['OW', 'AOW'])
    expect(day2Available.some((s) => s.courseCode === 'AOW')).toBe(false)

    // Day 3: OW-4 not placed yet (only OW 1-3 on day 2), so AOW still unavailable
    const day3Available = getAvailableDives(2, days, ['OW', 'AOW'])
    expect(day3Available.some((s) => s.courseCode === 'AOW')).toBe(false)
    // But OW-4 should be available on day 3
    expect(day3Available.some((s) => s.courseCode === 'OW' && s.diveNumber === 4)).toBe(true)
  })

  it('shows AOW dives once all OW dives are placed', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(10), 'pool'), dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }] },
      { ...makeDayConfig(testDate(11), 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      { ...makeDayConfig(testDate(12), 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 4, isConfined: false },
      ] },
      makeDayConfig(testDate(13), 'boat'),
    ]
    // Day 3 (index 2): OW-4 is here, so AOW-1 should be available on day 3 or later
    const day3Available = getAvailableDives(2, days, ['OW', 'AOW'])
    expect(day3Available.some((s) => s.courseCode === 'AOW' && s.diveNumber === 1)).toBe(true)

    // Day 4 (index 3): AOW dives also available
    const day4Available = getAvailableDives(3, days, ['OW', 'AOW'])
    expect(day4Available.some((s) => s.courseCode === 'AOW')).toBe(true)
  })

  it('caps non-confined ghost pills when day already has 3 non-confined dives', () => {
    const days: DayConfig[] = [
      {
        ...makeDayConfig(testDate(10), 'boat'),
        dives: [
          { courseCode: 'OW', diveNumber: 1, isConfined: false },
          { courseCode: 'OW', diveNumber: 2, isConfined: false },
          { courseCode: 'OW', diveNumber: 3, isConfined: false },
        ],
      },
    ]
    const available = getAvailableDives(0, days, ['OW'])
    // OW-4 should be capped (day already has 3 non-confined)
    const ow4 = available.find((s) => s.courseCode === 'OW' && s.diveNumber === 4)
    expect(ow4).toMatchObject({ courseCode: 'OW', diveNumber: 4, capped: true })
    // Already-selected dives should NOT be capped
    const ow1 = available.find((s) => s.courseCode === 'OW' && s.diveNumber === 1)
    expect(ow1?.courseCode).toBe('OW')
    expect(ow1!.capped).toBeUndefined()
  })

  it('confined excluded by sequence rule when non-confined dives selected (not capping)', () => {
    // Once OW 1-3 are selected, Confined is past in the sequence — it won't
    // appear at all (filtered by sequential rule, not by capping).
    const days: DayConfig[] = [
      {
        ...makeDayConfig(testDate(10), 'boat'),
        dives: [
          { courseCode: 'OW', diveNumber: 1, isConfined: false },
          { courseCode: 'OW', diveNumber: 2, isConfined: false },
          { courseCode: 'OW', diveNumber: 3, isConfined: false },
        ],
      },
    ]
    const available = getAvailableDives(0, days, ['OW'])
    const confined = available.find((s) => s.isConfined)
    expect(confined).toBeUndefined()
  })

  it('does not cap when under limit', () => {
    const days: DayConfig[] = [
      {
        ...makeDayConfig(testDate(10), 'boat'),
        dives: [
          { courseCode: 'OW', diveNumber: 1, isConfined: false },
          { courseCode: 'OW', diveNumber: 2, isConfined: false },
        ],
      },
    ]
    const available = getAvailableDives(0, days, ['OW'])
    const ow3 = available.find((s) => s.courseCode === 'OW' && s.diveNumber === 3)
    expect(ow3?.courseCode).toBe('OW')
    expect(ow3!.capped).toBeUndefined()
  })

  it('respects custom divesPerDay', () => {
    const days: DayConfig[] = [
      {
        ...makeDayConfig(testDate(10), 'boat', 2),
        dives: [
          { courseCode: 'OW', diveNumber: 1, isConfined: false },
          { courseCode: 'OW', diveNumber: 2, isConfined: false },
        ],
      },
    ]
    const available = getAvailableDives(0, days, ['OW'])
    const ow3 = available.find((s) => s.courseCode === 'OW' && s.diveNumber === 3)
    expect(ow3).toMatchObject({ courseCode: 'OW', diveNumber: 3, capped: true })
  })

  it('already-selected dives are never capped', () => {
    const days: DayConfig[] = [
      {
        ...makeDayConfig(testDate(10), 'boat'),
        dives: [
          { courseCode: 'OW', diveNumber: 1, isConfined: false },
          { courseCode: 'OW', diveNumber: 2, isConfined: false },
          { courseCode: 'OW', diveNumber: 3, isConfined: false },
        ],
      },
    ]
    const available = getAvailableDives(0, days, ['OW'])
    const selectedDives = available.filter((s) =>
      !s.isConfined && [1, 2, 3].includes(s.diveNumber),
    )
    for (const d of selectedDives) {
      expect(d.capped).toBeUndefined()
    }
  })

  // ── Sequence enforcement: confined follows same rules as numbered dives ──

  it('confined unavailable on same day when OW 1 is already selected', () => {
    const days: DayConfig[] = [
      {
        ...makeDayConfig(testDate(10), 'boat'),
        dives: [
          { courseCode: 'OW', diveNumber: 1, isConfined: false },
        ],
      },
    ]
    const available = getAvailableDives(0, days, ['OW'])
    const confined = available.find((s) => s.isConfined && s.courseCode === 'OW')
    expect(confined).toBeUndefined()
  })

  it('confined unavailable on later days when OW 1 is on Day 1', () => {
    const days: DayConfig[] = [
      {
        ...makeDayConfig(testDate(10), 'boat'),
        dives: [
          { courseCode: 'OW', diveNumber: 1, isConfined: false },
        ],
      },
      makeDayConfig(testDate(11), 'boat'),
    ]
    const day2Available = getAvailableDives(1, days, ['OW'])
    const confined = day2Available.find((s) => s.isConfined && s.courseCode === 'OW')
    expect(confined).toBeUndefined()
  })

  it('OW 1 unavailable on Day 2 when OW 3 is on Day 1', () => {
    const days: DayConfig[] = [
      {
        ...makeDayConfig(testDate(10), 'boat'),
        dives: [
          { courseCode: 'OW', diveNumber: 1, isConfined: false },
          { courseCode: 'OW', diveNumber: 2, isConfined: false },
          { courseCode: 'OW', diveNumber: 3, isConfined: false },
        ],
      },
      makeDayConfig(testDate(11), 'boat'),
    ]
    const day2Available = getAvailableDives(1, days, ['OW'])
    expect(day2Available.some((s) => s.courseCode === 'OW' && s.diveNumber === 1)).toBe(false)
    expect(day2Available.some((s) => s.courseCode === 'OW' && s.diveNumber === 2)).toBe(false)
    expect(day2Available.some((s) => s.courseCode === 'OW' && s.diveNumber === 3)).toBe(false)
    // Only OW 4 should be available
    expect(day2Available.some((s) => s.courseCode === 'OW' && s.diveNumber === 4)).toBe(true)
  })

  it('first pick on Day 1 can be any dive (referral flexibility)', () => {
    const days: DayConfig[] = [
      makeDayConfig(testDate(10), 'boat'),
    ]
    const available = getAvailableDives(0, days, ['OW'])
    // All OW dives should be available: Confined, OW 1-4
    expect(available.some((s) => s.isConfined && s.courseCode === 'OW')).toBe(true)
    expect(available.some((s) => s.courseCode === 'OW' && s.diveNumber === 1)).toBe(true)
    expect(available.some((s) => s.courseCode === 'OW' && s.diveNumber === 4)).toBe(true)
  })

  it('O+A combo: AOW dives follow OW in one continuous sequence', () => {
    const days: DayConfig[] = [
      {
        ...makeDayConfig(testDate(10), 'boat'),
        dives: [
          { courseCode: 'OW', diveNumber: 1, isConfined: false },
          { courseCode: 'OW', diveNumber: 2, isConfined: false },
          { courseCode: 'OW', diveNumber: 3, isConfined: false },
        ],
      },
      {
        ...makeDayConfig(testDate(11), 'boat'),
        dives: [
          { courseCode: 'OW', diveNumber: 4, isConfined: false },
        ],
      },
      makeDayConfig(testDate(12), 'boat'),
    ]
    const day3Available = getAvailableDives(2, days, ['OW', 'AOW'])
    // No OW dives or confined should appear
    expect(day3Available.some((s) => s.courseCode === 'OW')).toBe(false)
    // Only AOW 1+ should be available
    expect(day3Available.some((s) => s.courseCode === 'AOW' && s.diveNumber === 1)).toBe(true)
    expect(day3Available.some((s) => s.courseCode === 'AOW' && s.diveNumber === 2)).toBe(false) // only next sequential
  })

  // ── Deselection scenarios: what's available after removing a dive ────────

  it('after deselecting OW 3: OW 3 is available as ghost pill on Day 1', () => {
    // Scenario: O+A booking started from OW 2 (referral). OW 2-4 auto-filled on Day 1.
    // User deselects OW 3 → OW 4 also removed from Day 1 (cascade).
    // OW 3 should still be available as a ghost pill on Day 1 (next in sequence after OW 2).
    const days: DayConfig[] = [
      {
        ...makeDayConfig(testDate(10), 'boat'),
        dives: [
          { courseCode: 'OW', diveNumber: 2, isConfined: false },
          // OW 3 was deselected, OW 4 cascaded off this day
        ],
      },
      makeDayConfig(testDate(11), 'boat'),
    ]
    const day1Available = getAvailableDives(0, days, ['OW', 'AOW'])
    // OW 3 should be the next available ghost pill on Day 1
    expect(day1Available.some((s) => s.courseCode === 'OW' && s.diveNumber === 3)).toBe(true)
  })

  it('after deselecting OW 3: OW 3 is also available on Day 2', () => {
    const days: DayConfig[] = [
      {
        ...makeDayConfig(testDate(10), 'boat'),
        dives: [
          { courseCode: 'OW', diveNumber: 2, isConfined: false },
        ],
      },
      makeDayConfig(testDate(11), 'boat'),
    ]
    const day2Available = getAvailableDives(1, days, ['OW', 'AOW'])
    // OW 3 should be available on Day 2 (next after highwater OW 2)
    expect(day2Available.some((s) => s.courseCode === 'OW' && s.diveNumber === 3)).toBe(true)
  })

  it('OW 4 is NOT available before OW 3 is placed somewhere', () => {
    // After deselecting OW 3, only OW 2 remains. OW 4 should NOT be selectable
    // because it requires OW 3 first (sequential rule).
    const days: DayConfig[] = [
      {
        ...makeDayConfig(testDate(10), 'boat'),
        dives: [
          { courseCode: 'OW', diveNumber: 2, isConfined: false },
        ],
      },
      makeDayConfig(testDate(11), 'boat'),
    ]
    // Day 1: only OW 3 should be next, NOT OW 4
    const day1Available = getAvailableDives(0, days, ['OW', 'AOW'])
    expect(day1Available.some((s) => s.courseCode === 'OW' && s.diveNumber === 4)).toBe(false)

    // Day 2: same — only OW 3 is next
    const day2Available = getAvailableDives(1, days, ['OW', 'AOW'])
    expect(day2Available.some((s) => s.courseCode === 'OW' && s.diveNumber === 4)).toBe(false)
  })

  it('no day should show more than 3 non-confined dives after redistribution', () => {
    // After deselecting OW 3 from Day 1 (which had OW 2-4), the redistributed
    // dives on Day 2 must not exceed the 3-per-day cap.
    const days: DayConfig[] = [
      {
        ...makeDayConfig(testDate(10), 'boat'),
        dives: [
          { courseCode: 'OW', diveNumber: 2, isConfined: false },
        ],
      },
      {
        ...makeDayConfig(testDate(11), 'boat'),
        dives: [
          { courseCode: 'OW', diveNumber: 3, isConfined: false },
          { courseCode: 'OW', diveNumber: 4, isConfined: false },
          { courseCode: 'AOW', diveNumber: 1, isConfined: false },
        ],
      },
      makeDayConfig(testDate(12), 'boat'),
    ]
    // Day 2 has exactly 3 non-confined — at the cap
    expect(countNonConfined(days[1].dives)).toBe(3)
    // OW 4 should be capped on Day 2 (already at 3), NOT a 4th non-confined
    const day2Available = getAvailableDives(1, days, ['OW', 'AOW'])
    const uncapped = day2Available.filter(s => !s.isConfined && !('capped' in s && (s as Record<string, unknown>).capped))
    // All non-selected dives should be capped since day is at limit
    const unselectedUncapped = uncapped.filter(s => {
      return !days[1].dives.some(d => d.courseCode === s.courseCode && d.diveNumber === s.diveNumber)
    })
    expect(unselectedUncapped).toHaveLength(0)
  })
})

// ── Prerequisite Ordering Invariants ──────────────────────────────────────

describe('prerequisite ordering invariants', () => {
  /**
   * Walk all days in order. Assert beforeSlot appears on the same day or
   * an earlier day than afterSlot. Fails if afterSlot is scheduled but
   * beforeSlot is not.
   */
  function assertDiveOrder(
    days: DayConfig[],
    before: { courseCode: string; diveNumber: number },
    after: { courseCode: string; diveNumber: number },
  ) {
    let beforeDay = -1
    let afterDay = -1
    for (let d = 0; d < days.length; d++) {
      if (beforeDay < 0 && days[d].dives.some((dv) => dv.courseCode === before.courseCode && dv.diveNumber === before.diveNumber)) {
        beforeDay = d
      }
      if (days[d].dives.some((dv) => dv.courseCode === after.courseCode && dv.diveNumber === after.diveNumber)) {
        afterDay = d
      }
    }
    if (afterDay >= 0 && beforeDay < 0) {
      throw new Error(`${after.courseCode}-${after.diveNumber} is scheduled (day ${afterDay}) but ${before.courseCode}-${before.diveNumber} is not`)
    }
    if (beforeDay >= 0 && afterDay >= 0) {
      expect(beforeDay).toBeLessThanOrEqual(afterDay)
    }
  }

  it('1. O+A default: OW dives before AOW dives', () => {
    const seq = buildDiveSequence(['OW', 'AOW'])
    // OW confined before OW-1, OW-4 before AOW-1, AOW-1 before AOW-5
    const owSlots = seq.filter((s) => s.courseCode === 'OW')
    const aowSlots = seq.filter((s) => s.courseCode === 'AOW')
    expect(owSlots.length).toBe(5)
    expect(aowSlots.length).toBe(5)
    // All OW before any AOW in the sequence
    const lastOWIdx = seq.findLastIndex((s) => s.courseCode === 'OW')
    const firstAOWIdx = seq.findIndex((s) => s.courseCode === 'AOW')
    expect(lastOWIdx).toBeLessThan(firstAOWIdx)
  })

  it('2. O+A reversed input: same ordering', () => {
    const seq = buildDiveSequence(['AOW', 'OW'])
    const lastOWIdx = seq.findLastIndex((s) => s.courseCode === 'OW')
    const firstAOWIdx = seq.findIndex((s) => s.courseCode === 'AOW')
    expect(lastOWIdx).toBeLessThan(firstAOWIdx)
  })

  it('3. O+A 5-day spread: ordering holds with distributeDives', () => {
    const days = distributeDives(generateDays(['OW', 'AOW'], testDate(10), 3, addDays(testDate(10), 4)), ['OW', 'AOW'])
    expect(days.length).toBe(5)
    assertDiveOrder(days, { courseCode: 'OW', diveNumber: 4 }, { courseCode: 'AOW', diveNumber: 1 })
  })

  it('4. O+A 4-day default: OW-4 same day or before AOW-1 with distributeDives', () => {
    const days = distributeDives(generateDays(['OW', 'AOW'], testDate(10), 3, addDays(testDate(10), 3)), ['OW', 'AOW'])
    expect(days.length).toBe(4)
    assertDiveOrder(days, { courseCode: 'OW', diveNumber: 4 }, { courseCode: 'AOW', diveNumber: 1 })
  })

  it('5. OW-only: distributeDives places confined before open water', () => {
    const days = distributeDives(generateDays(['OW'], testDate(10)), ['OW'])
    expect(days[0].venueType).toBe('pool')
    expect(days[0].dives.some((d) => d.isConfined)).toBe(true)
    const allDives = days.flatMap((d) => d.dives)
    expect(allDives.some((d) => d.courseCode === 'AOW')).toBe(false)
    assertDiveOrder(days, { courseCode: 'OW', diveNumber: 0 }, { courseCode: 'OW', diveNumber: 1 })
    assertDiveOrder(days, { courseCode: 'OW', diveNumber: 3 }, { courseCode: 'OW', diveNumber: 4 })
  })

  it('6. Full chain: DM, OW, RESCUE, AOW → OW → AOW → RESCUE → DM', () => {
    const seq = buildDiveSequence(['DM', 'OW', 'RESCUE', 'AOW'])
    const courseOrder = seq.reduce<string[]>((acc, s) => {
      if (acc.length === 0 || acc[acc.length - 1] !== s.courseCode) acc.push(s.courseCode)
      return acc
    }, [])
    expect(courseOrder).toEqual(['OW', 'AOW', 'RESCUE', 'DM'])
  })

  it('7. cascadeRemoveOrphans: removing OW-2 keeps OW-C, OW-1, OW-3, OW-4; removes all AOW', () => {
    // Set up a 4-day O+A with all dives placed via distributeDives
    const days = distributeDives(generateDays(['OW', 'AOW'], testDate(10), 3, addDays(testDate(10), 3)), ['OW', 'AOW'])
    // Remove OW-2 from wherever it is
    const daysWithout2 = days.map((d) => ({
      ...d,
      dives: d.dives.filter((dv) => !(dv.courseCode === 'OW' && dv.diveNumber === 2)),
    }))
    const result = cascadeRemoveOrphans(daysWithout2, ['OW', 'AOW'])
    const remaining = result.flatMap((d) => d.dives)
    // OW-C, OW-1, OW-3, OW-4 remain (gaps allowed within course)
    expect(remaining.some((d) => d.courseCode === 'OW' && d.diveNumber === 0)).toBe(true)
    expect(remaining.some((d) => d.courseCode === 'OW' && d.diveNumber === 1)).toBe(true)
    expect(remaining.some((d) => d.courseCode === 'OW' && d.diveNumber === 3)).toBe(true)
    expect(remaining.some((d) => d.courseCode === 'OW' && d.diveNumber === 4)).toBe(true)
    // All AOW removed (course prereq: OW has unplaced dive)
    expect(remaining.some((d) => d.courseCode === 'AOW')).toBe(false)
  })

  it('8. autoFillPredecessors preserves order: adding AOW-3 auto-fills AOW-1 and AOW-2', () => {
    // 4-day O+A with all OW dives placed but NO AOW dives
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(10), 'pool'), dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }] },
      { ...makeDayConfig(testDate(11), 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      { ...makeDayConfig(testDate(12), 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 4, isConfined: false },
      ] },
      makeDayConfig(testDate(13), 'boat'),
    ]
    const fullSequence = buildDiveSequence(['OW', 'AOW'])
    const diveSlot: DiveSlot = { courseCode: 'AOW', diveNumber: 3, isConfined: false }
    const result = autoFillPredecessors(3, diveSlot, days, fullSequence, 3)

    // AOW-1 and AOW-2 should be auto-filled on day 3 (index 2) or earlier
    const aow1Day = result.findIndex((d) => d.dives.some((dv) => dv.courseCode === 'AOW' && dv.diveNumber === 1))
    const aow2Day = result.findIndex((d) => d.dives.some((dv) => dv.courseCode === 'AOW' && dv.diveNumber === 2))
    expect(aow1Day).toBeGreaterThanOrEqual(0)
    expect(aow2Day).toBeGreaterThanOrEqual(0)
    expect(aow1Day).toBeLessThanOrEqual(3)
    expect(aow2Day).toBeLessThanOrEqual(3)

    // OW-4 must still be on same day or before AOW-1
    assertDiveOrder(result, { courseCode: 'OW', diveNumber: 4 }, { courseCode: 'AOW', diveNumber: 1 })
  })

  it('9. getAvailableDives respects order: no AOW on day 2 when OW-4 not placed', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(10), 'pool'), dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }] },
      { ...makeDayConfig(testDate(11), 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      makeDayConfig(testDate(12), 'boat'),
    ]
    const day2Available = getAvailableDives(1, days, ['OW', 'AOW'])
    expect(day2Available.some((s) => s.courseCode === 'AOW')).toBe(false)
    // OW-1, OW-2, OW-3 are active + OW-4 is available (all predecessors met)
    expect(day2Available.filter((s) => s.courseCode === 'OW').length).toBe(4)
  })

  it('10. Toggle ON/OFF round-trip preserves ordering invariant', () => {
    // Start with full 4-day O+A (using distributeDives to pre-fill)
    const days = distributeDives(generateDays(['OW', 'AOW'], testDate(10), 3, addDays(testDate(10), 3)), ['OW', 'AOW'])
    assertDiveOrder(days, { courseCode: 'OW', diveNumber: 4 }, { courseCode: 'AOW', diveNumber: 1 })

    // Toggle OFF OW-3: cascade keeps OW-4 (gap OK), removes all AOW (course prereq)
    const daysWithoutOW3 = days.map((d) => ({
      ...d,
      dives: d.dives.filter((dv) => !(dv.courseCode === 'OW' && dv.diveNumber === 3)),
    }))
    const afterRemove = cascadeRemoveOrphans(daysWithoutOW3, ['OW', 'AOW'])
    const remainingAfterRemove = afterRemove.flatMap((d) => d.dives)
    expect(remainingAfterRemove.some((d) => d.courseCode === 'OW' && d.diveNumber === 3)).toBe(false)
    expect(remainingAfterRemove.some((d) => d.courseCode === 'OW' && d.diveNumber === 4)).toBe(true) // gap OK
    expect(remainingAfterRemove.some((d) => d.courseCode === 'AOW')).toBe(false)

    // Toggle ON OW-3 on day 2 (index 1): auto-fill predecessors (all already placed)
    const daysWithOW3 = afterRemove.map((d, i) =>
      i === 1 ? { ...d, dives: [...d.dives, { courseCode: 'OW', diveNumber: 3, isConfined: false }] } : d,
    )
    const fullSeq = buildDiveSequence(['OW', 'AOW'])
    const afterAdd = autoFillPredecessors(1, { courseCode: 'OW', diveNumber: 3, isConfined: false }, daysWithOW3, fullSeq, 3)
    const remainingAfterAdd = afterAdd.flatMap((d) => d.dives)
    expect(remainingAfterAdd.some((d) => d.courseCode === 'OW' && d.diveNumber === 3)).toBe(true)
    // Ordering invariant still holds
    assertDiveOrder(afterAdd, { courseCode: 'OW', diveNumber: 0 }, { courseCode: 'OW', diveNumber: 1 })
    assertDiveOrder(afterAdd, { courseCode: 'OW', diveNumber: 1 }, { courseCode: 'OW', diveNumber: 3 })
  })
})

// ── Deselect + cascadeRemoveOrphans regression (handleToggleDive fix) ────────

describe('deselect → cascadeRemoveOrphans (regression)', () => {
  it('deselect OW-3 from day with OW-2,3,4: no out-of-sequence OW-4, AOW removed', () => {
    // Simulate: O+A auto-filled, then user deselects OW-3 on its day.
    // handleToggleDive removes OW-3 + later same-day dives, then calls cascadeRemoveOrphans.
    const days = distributeDives(generateDays(['OW', 'AOW'], testDate(10), 3, addDays(testDate(10), 3)), ['OW', 'AOW'])
    const sequence = buildDiveSequence(['OW', 'AOW'])

    // Find the day containing OW-3
    const ow3DayIdx = days.findIndex(d =>
      d.dives.some(dv => dv.courseCode === 'OW' && dv.diveNumber === 3 && !dv.isConfined))
    expect(ow3DayIdx).toBeGreaterThanOrEqual(0)

    const ow3SeqIdx = sequence.findIndex(s =>
      s.courseCode === 'OW' && s.diveNumber === 3 && !s.isConfined)

    // Simulate handleToggleDive: remove OW-3 + all later dives from the same day
    const afterRemove = days.map((d, i) => {
      if (i !== ow3DayIdx) return d
      const kept = d.dives.filter(dv => {
        const dvIdx = sequence.findIndex(s =>
          s.courseCode === dv.courseCode && s.diveNumber === dv.diveNumber && s.isConfined === dv.isConfined)
        return dvIdx < ow3SeqIdx
      })
      return { ...d, dives: kept }
    })

    // Apply cascadeRemoveOrphans (the fix)
    const result = cascadeRemoveOrphans(afterRemove, ['OW', 'AOW'])
    const allDives = result.flatMap(d => d.dives)

    // OW-3 gone (deselected)
    expect(allDives.some(d => d.courseCode === 'OW' && d.diveNumber === 3)).toBe(false)
    // AOW removed (OW prerequisite incomplete)
    expect(allDives.some(d => d.courseCode === 'AOW')).toBe(false)
    // OW-C, OW-1, OW-2 survive
    expect(allDives.some(d => d.courseCode === 'OW' && d.diveNumber === 0)).toBe(true)
    expect(allDives.some(d => d.courseCode === 'OW' && d.diveNumber === 1)).toBe(true)
    expect(allDives.some(d => d.courseCode === 'OW' && d.diveNumber === 2)).toBe(true)
    // OW-4 survives (within-course gaps allowed) but NOT before any existing OW dive
    if (allDives.some(d => d.courseCode === 'OW' && d.diveNumber === 4)) {
      const ow4DayIdx = result.findIndex(d =>
        d.dives.some(dv => dv.courseCode === 'OW' && dv.diveNumber === 4))
      const ow2DayIdx = result.findIndex(d =>
        d.dives.some(dv => dv.courseCode === 'OW' && dv.diveNumber === 2))
      expect(ow4DayIdx).toBeGreaterThanOrEqual(ow2DayIdx)
    }
  })
})

// ── Highwater Mark Availability ──────────────────────────────────────────────

describe('highwater mark availability', () => {
  it('1. pool day shows all OW dives', () => {
    const days: DayConfig[] = [
      makeDayConfig(testDate(10), 'pool'),
      makeDayConfig(testDate(11), 'boat'),
      makeDayConfig(testDate(12), 'boat'),
    ]
    const available = getAvailableDives(0, days, ['OW'])
    expect(available.length).toBe(5) // OW C + OW 1-4
    expect(available.some(s => s.isConfined)).toBe(true)
    expect(available.some(s => s.diveNumber === 4)).toBe(true)
  })

  it('2. boat day shows all OW dives including confined (venue is per-dive)', () => {
    const days: DayConfig[] = [
      makeDayConfig(testDate(10), 'pool'),
      makeDayConfig(testDate(11), 'boat'),
      makeDayConfig(testDate(12), 'boat'),
    ]
    const available = getAvailableDives(1, days, ['OW'])
    expect(available.length).toBe(5) // OW C + OW 1-4 (confined available — venue is per-dive)
    expect(available.some(s => s.isConfined)).toBe(true)
  })

  it('3. highwater excludes earlier dives; sequential allows only next', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(10), 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
      ] },
      makeDayConfig(testDate(11), 'boat'),
      makeDayConfig(testDate(12), 'boat'),
    ]
    const available = getAvailableDives(1, days, ['OW'])
    // Highwater from Day 0 = OW-2. Sequential: only OW-3 is next.
    // Confined is past in sequence — not available.
    expect(available.some(s => s.isConfined)).toBe(false)
    const nonConfined = available.filter(s => !s.isConfined)
    expect(nonConfined.map(s => s.diveNumber)).toEqual([3])
  })

  it('4. transfer student: Day 0 has [OW 4], Day 1 gets AOW 1 (next in global sequence)', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(10), 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 4, isConfined: false },
      ] },
      makeDayConfig(testDate(11), 'boat'),
      makeDayConfig(testDate(12), 'boat'),
      makeDayConfig(testDate(13), 'boat'),
    ]
    const available = getAvailableDives(1, days, ['OW', 'AOW'])
    // Highwater = OW-4. Global sequence: only AOW-1 is next
    expect(available.every(s => s.courseCode === 'AOW')).toBe(true)
    expect(available.length).toBe(1)
    expect(available[0].diveNumber).toBe(1)
  })

  it('5. AOW blocked until all OW placed (course prereq)', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(10), 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 0, isConfined: true },
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
      ] },
      { ...makeDayConfig(testDate(11), 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      makeDayConfig(testDate(12), 'boat'),
    ]
    const available = getAvailableDives(2, days, ['OW', 'AOW'])
    // OW 4 available but unplaced → AOW blocked
    expect(available.some(s => s.courseCode === 'OW' && s.diveNumber === 4)).toBe(true)
    expect(available.some(s => s.courseCode === 'AOW')).toBe(false)
  })

  it('6. AOW available once all OW placed', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(10), 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 0, isConfined: true },
      ] },
      { ...makeDayConfig(testDate(11), 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      { ...makeDayConfig(testDate(12), 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 4, isConfined: false },
      ] },
      makeDayConfig(testDate(13), 'boat'),
    ]
    // Day 2 (index 2): OW 4 placed here, AOW 1 should be available (next in global sequence)
    const day2 = getAvailableDives(2, days, ['OW', 'AOW'])
    expect(day2.some(s => s.courseCode === 'AOW' && s.diveNumber === 1)).toBe(true)
    // Day 3 (index 3): Only AOW 1 is next (global sequence continues from OW-4)
    const day3 = getAvailableDives(3, days, ['OW', 'AOW'])
    const aowDives = day3.filter(s => s.courseCode === 'AOW')
    expect(aowDives.length).toBe(1)
    expect(aowDives[0].diveNumber).toBe(1)
  })

  it('7. sequential: with OW-1,2,3 selected, only OW-4 is next', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(10), 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      makeDayConfig(testDate(11), 'boat'),
    ]
    const available = getAvailableDives(0, days, ['OW'])
    // OW-1,2,3 already selected → only OW-4 is next; Confined is past in sequence
    const unselected = available.filter(s => !s.isConfined && ![1, 2, 3].includes(s.diveNumber))
    expect(unselected.length).toBe(1)
    expect(unselected[0].diveNumber).toBe(4)
    expect(available.some(s => s.isConfined)).toBe(false)
  })

  it('8. gaps allowed in cascade: deselect OW C keeps OW 1-4', () => {
    const days = distributeDives(generateDays(['OW', 'AOW'], testDate(10), 3, addDays(testDate(10), 3)), ['OW', 'AOW'])
    // Remove OW C
    const daysWithoutC = days.map(d => ({
      ...d,
      dives: d.dives.filter(dv => !(dv.courseCode === 'OW' && dv.diveNumber === 0 && dv.isConfined)),
    }))
    const result = cascadeRemoveOrphans(daysWithoutC, ['OW', 'AOW'])
    const remaining = result.flatMap(d => d.dives)
    // OW 1-4 remain (gaps allowed)
    expect(remaining.some(d => d.courseCode === 'OW' && d.diveNumber === 1)).toBe(true)
    expect(remaining.some(d => d.courseCode === 'OW' && d.diveNumber === 2)).toBe(true)
    expect(remaining.some(d => d.courseCode === 'OW' && d.diveNumber === 3)).toBe(true)
    expect(remaining.some(d => d.courseCode === 'OW' && d.diveNumber === 4)).toBe(true)
    // All AOW removed (course prereq: OW has unplaced dive)
    expect(remaining.some(d => d.courseCode === 'AOW')).toBe(false)
  })

  it('9. cross-day violation cascaded', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(10), 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      { ...makeDayConfig(testDate(11), 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
      ] },
    ]
    const result = cascadeRemoveOrphans(days, ['OW'])
    // OW 1 on Day 1 has idx 1 ≤ highwater 3 from Day 0 → removed
    expect(result[0].dives.some(d => d.diveNumber === 3)).toBe(true)
    expect(result[1].dives.some(d => d.diveNumber === 1)).toBe(false)
  })

  it('10. no cascade when gaps exist but ordering valid', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(10), 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
      ] },
      { ...makeDayConfig(testDate(11), 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
        { courseCode: 'OW', diveNumber: 4, isConfined: false },
      ] },
    ]
    const result = cascadeRemoveOrphans(days, ['OW'])
    // All remain — OW 3, OW 4 both > highwater 1 from Day 0
    const remaining = result.flatMap(d => d.dives)
    expect(remaining.length).toBe(3)
    expect(remaining.some(d => d.diveNumber === 1)).toBe(true)
    expect(remaining.some(d => d.diveNumber === 3)).toBe(true)
    expect(remaining.some(d => d.diveNumber === 4)).toBe(true)
  })
})

// ── Sequential Dive Selection ────────────────────────────────────────────────

describe('sequential dive selection', () => {
  it('no dives selected → all dives available (referral first pick)', () => {
    const days: DayConfig[] = [
      makeDayConfig(testDate(5), 'pool'),
      makeDayConfig(testDate(6), 'boat'),
    ]
    const available = getAvailableDives(0, days, ['OW'])
    // All 5 OW dives available (confined + 1-4)
    expect(available.length).toBe(5)
  })

  it('OW-1 selected → only OW-2 is next (forward only)', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(5), 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
      ] },
      makeDayConfig(testDate(6), 'boat'),
    ]
    const available = getAvailableDives(0, days, ['OW'])
    const unselectedNonConfined = available.filter(s => !s.isConfined && s.diveNumber !== 1)
    expect(unselectedNonConfined.length).toBe(1)
    expect(unselectedNonConfined[0].diveNumber).toBe(2)
  })

  it('OW-3 selected as referral → only OW-4 is next', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(5), 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      makeDayConfig(testDate(6), 'boat'),
    ]
    const available = getAvailableDives(0, days, ['OW'])
    const unselectedNonConfined = available.filter(s => !s.isConfined && s.diveNumber !== 3)
    expect(unselectedNonConfined.length).toBe(1)
    expect(unselectedNonConfined[0].diveNumber).toBe(4)
  })

  it('OW-4 selected as referral → no more non-confined dives available', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(5), 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 4, isConfined: false },
      ] },
      makeDayConfig(testDate(6), 'boat'),
    ]
    const available = getAvailableDives(0, days, ['OW'])
    const unselectedNonConfined = available.filter(s => !s.isConfined && s.diveNumber !== 4)
    expect(unselectedNonConfined.length).toBe(0)
  })

  it('confined unavailable when non-confined dive is selected (sequence rule)', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(5), 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
    ]
    const available = getAvailableDives(0, days, ['OW'])
    expect(available.some(s => s.isConfined)).toBe(false)
  })

  it('cross-day: OW-1,2 on day 1 → day 2 only shows OW-3', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(5), 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
      ] },
      makeDayConfig(testDate(6), 'boat'),
    ]
    const available = getAvailableDives(1, days, ['OW'])
    const nonConfined = available.filter(s => !s.isConfined)
    expect(nonConfined.length).toBe(1)
    expect(nonConfined[0].diveNumber).toBe(3)
  })

  it('O+A: OW-4 selected → AOW-1 available (course prereq met)', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(5), 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      { ...makeDayConfig(testDate(6), 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 4, isConfined: false },
      ] },
      makeDayConfig(testDate(7), 'boat'),
    ]
    const available = getAvailableDives(2, days, ['OW', 'AOW'])
    // All OW dives placed → AOW should be available
    expect(available.some(s => s.courseCode === 'AOW')).toBe(true)
  })
})

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeDayConfig(
  date: string,
  venueType: 'pool' | 'boat' | 'shore',
  divesPerDay = 3,
): DayConfig {
  return {
    date,
    venueType,
    dives: [],
    divesPerDay,
    startTime: '08:00',
    endTime: '17:00',
    timezone: 'Asia/Bangkok',
  }
}

// ── autoDistributeFromDive ─────────────────────────────────────────────────

describe('autoDistributeFromDive', () => {
  it('auto-distributes remaining OW dives when starting from Confined', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(10), 'pool'), dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }] },
      makeDayConfig(testDate(11), 'boat'),
      makeDayConfig(testDate(12), 'boat'),
    ]
    const result = autoDistributeFromDive(days, { courseCode: 'OW', diveNumber: 0, isConfined: true }, ['OW'])
    // Day 1 (pool): Confined + OW 1-3 (confined doesn't count toward cap)
    expect(result[0].dives).toHaveLength(4)
    // Day 2 (boat): OW 4
    expect(result[1].dives.some(d => d.courseCode === 'OW' && d.diveNumber === 4)).toBe(true)
  })

  it('auto-distributes from referral starting point (OW 3)', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(10), 'boat'), dives: [{ courseCode: 'OW', diveNumber: 3, isConfined: false }] },
      makeDayConfig(testDate(11), 'boat'),
    ]
    const result = autoDistributeFromDive(days, { courseCode: 'OW', diveNumber: 3, isConfined: false }, ['OW'])
    // Day 1: OW 3 (already there) + OW 4 (auto-filled)
    expect(result[0].dives).toHaveLength(2)
    expect(result[0].dives[1]).toMatchObject({ courseCode: 'OW', diveNumber: 4 })
    // No Confined, OW 1, or OW 2 placed anywhere
    const allDives = result.flatMap(d => d.dives)
    expect(allDives.some(d => d.diveNumber === 0)).toBe(false)
    expect(allDives.some(d => d.diveNumber === 1)).toBe(false)
    expect(allDives.some(d => d.diveNumber === 2)).toBe(false)
  })

  it('respects 3-per-day non-confined cap during auto-fill', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(10), 'boat'), dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }] },
      makeDayConfig(testDate(11), 'boat'),
    ]
    const result = autoDistributeFromDive(days, { courseCode: 'OW', diveNumber: 1, isConfined: false }, ['OW'])
    // Day 1: OW 1 + OW 2 + OW 3 = 3 non-confined (cap)
    expect(countNonConfined(result[0].dives)).toBe(3)
    // Day 2: OW 4
    expect(result[1].dives.some(d => d.diveNumber === 4)).toBe(true)
  })

  it('distributes O+A combo across days from Confined', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(10), 'pool'), dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }] },
      makeDayConfig(testDate(11), 'boat'),
      makeDayConfig(testDate(12), 'boat'),
      makeDayConfig(testDate(13), 'boat'),
    ]
    const result = autoDistributeFromDive(days, { courseCode: 'OW', diveNumber: 0, isConfined: true }, ['OW', 'AOW'])
    const allDives = result.flatMap(d => d.dives)
    // All 10 dives placed (1 confined + 4 OW + 5 AOW)
    expect(allDives).toHaveLength(10)
    // No day exceeds 3 non-confined
    for (const day of result) {
      expect(countNonConfined(day.dives)).toBeLessThanOrEqual(3)
    }
  })
})

// ── divesPerDay boundary tests ──────────────────────────────────────────────

describe('autoDistributeFromDive — divesPerDay boundaries', () => {
  it('divesPerDay=1: distributes one non-confined dive per day', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(10), 'boat', 1), dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }] },
      makeDayConfig(testDate(11), 'boat', 1),
      makeDayConfig(testDate(12), 'boat', 1),
      makeDayConfig(testDate(13), 'boat', 1),
    ]
    const result = autoDistributeFromDive(days, { courseCode: 'OW', diveNumber: 1, isConfined: false }, ['OW'])
    // Each day should have exactly 1 non-confined dive
    expect(countNonConfined(result[0].dives)).toBe(1)
    expect(countNonConfined(result[1].dives)).toBe(1)
    expect(countNonConfined(result[2].dives)).toBe(1)
  })

  it('divesPerDay=4: allows 4 non-confined dives per day', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig(testDate(10), 'boat', 4), dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }] },
      makeDayConfig(testDate(11), 'boat', 4),
    ]
    const result = autoDistributeFromDive(days, { courseCode: 'OW', diveNumber: 1, isConfined: false }, ['OW'])
    // Day 1 should hold all 4 OW non-confined dives (OW 1-4)
    expect(countNonConfined(result[0].dives)).toBe(4)
    // Day 2 should be empty (all fit on day 1)
    expect(result[1].dives).toHaveLength(0)
  })
})

// ── Venue sort order (global dive sequence, not alphabetical) ──────────────

describe('buildDiveSequence sort order', () => {
  it('orders OW dives before AOW dives (not alphabetical)', () => {
    const sequence = buildDiveSequence(['OW', 'AOW'])
    const codes = sequence.map(s => `${s.courseCode}:${s.diveNumber}`)
    // OW comes before AOW in the sequence (even though "AOW" < "OW" alphabetically)
    const lastOWIdx = codes.findLastIndex(c => c.startsWith('OW'))
    const firstAOWIdx = codes.findIndex(c => c.startsWith('AOW'))
    expect(lastOWIdx).toBeLessThan(firstAOWIdx)
  })

  it('O+A combo: Confined → OW 1-4 → AOW 1-5 in that order', () => {
    const sequence = buildDiveSequence(['OW', 'AOW'])
    expect(sequence[0]).toMatchObject({ courseCode: 'OW', diveNumber: 0, isConfined: true })
    expect(sequence[1]).toMatchObject({ courseCode: 'OW', diveNumber: 1, isConfined: false })
    expect(sequence[4]).toMatchObject({ courseCode: 'OW', diveNumber: 4, isConfined: false })
    expect(sequence[5]).toMatchObject({ courseCode: 'AOW', diveNumber: 1, isConfined: false })
    expect(sequence[9]).toMatchObject({ courseCode: 'AOW', diveNumber: 5, isConfined: false })
  })
})
