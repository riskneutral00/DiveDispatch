import { describe, it, expect } from 'vitest'
import {
  generateDays,
  generateDaysFromDates,
  buildDiveSequence,
  distributeDives,
  autoFillPredecessors,
  ensureSufficientDays,
  cascadeRemoveOrphans,
  countNonConfined,
  sortByPrerequisites,
  getAvailableDives,
} from '../src/lib/booking/generate-days'
import type { DayConfig, DiveSlot } from '../src/lib/booking/wizard-state'

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
    expect(generateDays([], '2026-03-15')).toEqual([])
  })

  it('returns empty for empty start date', () => {
    expect(generateDays(['OW'], '')).toEqual([])
  })

  it('generates exactly 3 days for OW (1 pool + 2 boat)', () => {
    // A1: Tighten from >= 3 to === 3. OW = 1 confined + 4 open at 3/day = 1 pool + 2 boat
    const days = generateDays(['OW'], '2026-03-15')
    expect(days.length).toBe(3)
  })

  it('first day is pool when course has confined requirement', () => {
    const days = generateDays(['OW'], '2026-03-15')
    expect(days[0].venueType).toBe('pool')
  })

  it('non-confined courses skip pool day', () => {
    const days = generateDays(['AOW'], '2026-03-15')
    expect(days.every((d) => d.venueType !== 'pool')).toBe(true)
  })

  it('distributes dives across days', () => {
    const days = generateDays(['OW'], '2026-03-15')
    const totalDives = days.reduce((sum, d) => sum + d.dives.length, 0)
    expect(totalDives).toBe(5) // 1 confined + 4 open
  })

  it('confined dives placed on pool day only', () => {
    const days = generateDays(['OW'], '2026-03-15')
    const poolDay = days.find((d) => d.venueType === 'pool')
    expect(poolDay).toBeDefined()
    expect(poolDay!.dives.some((d) => d.isConfined)).toBe(true)

    const boatDays = days.filter((d) => d.venueType === 'boat')
    for (const d of boatDays) {
      expect(d.dives.every((dv) => !dv.isConfined)).toBe(true)
    }
  })

  it('respects endDate when provided (expands day count)', () => {
    const days = generateDays(['OW'], '2026-03-15', 3, '2026-03-19')
    expect(days.length).toBe(5) // 15,16,17,18,19
    expect(days[0].date).toBe('2026-03-15')
    expect(days[4].date).toBe('2026-03-19')
  })

  it('uses default divesPerDay of 3', () => {
    const days = generateDays(['OW'], '2026-03-15')
    const boatDays = days.filter((d) => d.venueType === 'boat')
    for (const d of boatDays) {
      // Non-confined dives per day should not exceed 3
      expect(countNonConfined(d.dives)).toBeLessThanOrEqual(3)
    }
  })

  it('generates DSD as single-day booking', () => {
    const days = generateDays(['DSD'], '2026-03-15')
    expect(days.length).toBe(1)
    expect(days[0].venueType).toBe('pool')
    expect(days[0].dives.length).toBe(1)
  })

  it('generates days for FD (0 mandated dives) with synthetic dive slots', () => {
    const days = generateDays(['FD'], '2026-03-20', 3, '2026-03-21')
    expect(days.length).toBe(2)
    expect(days[0].venueType).toBe('boat')
    expect(days[0].dives.length).toBe(1)
    expect(days[0].dives[0]).toEqual({ courseCode: 'FD', diveNumber: 1, isConfined: false })
    expect(days[1].dives[0]).toEqual({ courseCode: 'FD', diveNumber: 1, isConfined: false })
  })

  it('generates single day for FD without endDate', () => {
    const days = generateDays(['FD'], '2026-03-20')
    expect(days.length).toBe(1)
    expect(days[0].venueType).toBe('boat')
    expect(days[0].dives[0].courseCode).toBe('FD')
  })

  // A2: AOW alone = exactly 2 days (no confined, 5 dives at 3/day = ceil(5/3) = 2)
  it('generates exactly 2 days for AOW alone', () => {
    const days = generateDays(['AOW'], '2026-03-20')
    expect(days.length).toBe(2)
    expect(days.every((d) => d.venueType === 'boat')).toBe(true)
  })

  // A2: O+A without endDate = exactly 4 days (1 pool + 3 boat)
  it('O+A generates exactly 4 days (1 pool + 3 boat)', () => {
    const days = generateDays(['OW', 'AOW'], '2026-03-20')
    expect(days.length).toBe(4)
    expect(days[0].venueType).toBe('pool')
    expect(days.filter((d) => d.venueType === 'boat').length).toBe(3)
  })

  // A4: All OW dives placed before any AOW dive in O+A distribution
  it('O+A: all OW dives precede AOW dives in distribution', () => {
    const days = generateDays(['OW', 'AOW'], '2026-03-20')
    const allDives = days.flatMap((d) => d.dives)
    const lastOWIdx = allDives.reduce((acc, d, i) => (d.courseCode === 'OW' && !d.isConfined ? i : acc), -1)
    const firstAOWIdx = allDives.findIndex((d) => d.courseCode === 'AOW')
    expect(firstAOWIdx).toBeGreaterThan(lastOWIdx)
  })

  // A3: O+A transition day — the boat day containing the last OW dive also contains the first AOW dive
  it('O+A: transition day has both OW and AOW dives', () => {
    const days = generateDays(['OW', 'AOW'], '2026-03-20')
    // Find the boat day that has at least one OW dive AND at least one AOW dive
    const transitionDay = days.find(
      (d) =>
        d.venueType === 'boat' &&
        d.dives.some((dv) => dv.courseCode === 'OW') &&
        d.dives.some((dv) => dv.courseCode === 'AOW'),
    )
    expect(transitionDay).toBeDefined()
  })

  // A5: Pool day gets only confined dives from distributeDives
  it('pool day contains only confined dives', () => {
    const days = generateDays(['OW'], '2026-03-15')
    const poolDay = days.find((d) => d.venueType === 'pool')
    expect(poolDay).toBeDefined()
    expect(poolDay!.dives.every((d) => d.isConfined)).toBe(true)
  })

  // Per-day non-confined dive limit: each day ≤ 3 non-confined dives (default divesPerDay)
  it('no day exceeds 3 non-confined dives (O+A distribution)', () => {
    const days = generateDays(['OW', 'AOW'], '2026-03-20')
    for (const day of days) {
      expect(countNonConfined(day.dives)).toBeLessThanOrEqual(3)
    }
  })
})

// ── generateDaysFromDates ───────────────────────────────────────────────────

describe('generateDaysFromDates', () => {
  it('creates days from explicit date array', () => {
    const days = generateDaysFromDates(['OW'], ['2026-03-15', '2026-03-17', '2026-03-20'])
    expect(days.length).toBe(3)
    expect(days[0].date).toBe('2026-03-15')
    expect(days[1].date).toBe('2026-03-17')
    expect(days[2].date).toBe('2026-03-20')
  })

  it('sorts dates even if given out of order', () => {
    const days = generateDaysFromDates(['OW'], ['2026-03-20', '2026-03-15', '2026-03-17'])
    expect(days.map((d) => d.date)).toEqual(['2026-03-15', '2026-03-17', '2026-03-20'])
  })

  it('first date is pool when course requires confined', () => {
    const days = generateDaysFromDates(['OW'], ['2026-03-15', '2026-03-16'])
    expect(days[0].venueType).toBe('pool')
    expect(days[1].venueType).toBe('boat')
  })

  it('distributes dives across provided dates', () => {
    const days = generateDaysFromDates(['OW'], ['2026-03-15', '2026-03-16', '2026-03-17'])
    const totalDives = days.reduce((sum, d) => sum + d.dives.length, 0)
    expect(totalDives).toBe(5) // 1 confined + 4 open
  })

  it('returns empty for empty dates', () => {
    expect(generateDaysFromDates(['OW'], [])).toEqual([])
  })

  it('returns empty for empty courses', () => {
    expect(generateDaysFromDates([], ['2026-03-15'])).toEqual([])
  })
})

// ── distributeDives ─────────────────────────────────────────────────────────

describe('distributeDives', () => {
  it('places confined dives on pool day', () => {
    const days: DayConfig[] = [
      makeDayConfig('2026-03-15', 'pool'),
      makeDayConfig('2026-03-16', 'boat'),
    ]
    const result = distributeDives(days, ['OW'])
    const poolDay = result.find((d) => d.venueType === 'pool')!
    expect(poolDay.dives.some((d) => d.isConfined)).toBe(true)
  })

  it('does not place non-confined dives on pool day', () => {
    const days: DayConfig[] = [
      makeDayConfig('2026-03-15', 'pool'),
      makeDayConfig('2026-03-16', 'boat'),
      makeDayConfig('2026-03-17', 'boat'),
    ]
    const result = distributeDives(days, ['OW'])
    const poolDay = result.find((d) => d.venueType === 'pool')!
    // Only confined dives on pool day
    expect(poolDay.dives.every((d) => d.isConfined)).toBe(true)
  })

  it('distributes non-confined dives across boat days', () => {
    const days: DayConfig[] = [
      makeDayConfig('2026-03-15', 'pool'),
      makeDayConfig('2026-03-16', 'boat', 3),
      makeDayConfig('2026-03-17', 'boat', 3),
    ]
    const result = distributeDives(days, ['OW'])
    const boatDays = result.filter((d) => d.venueType === 'boat')
    const totalNonConfined = boatDays.reduce((sum, d) => sum + countNonConfined(d.dives), 0)
    expect(totalNonConfined).toBe(4) // OW has 4 open-water dives
  })

  it('respects divesPerDay limit per boat day', () => {
    const days: DayConfig[] = [
      makeDayConfig('2026-03-15', 'pool'),
      makeDayConfig('2026-03-16', 'boat', 2),
      makeDayConfig('2026-03-17', 'boat', 2),
      makeDayConfig('2026-03-18', 'boat', 2),
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
      makeDayConfig('2026-03-15', 'pool'),
      makeDayConfig('2026-03-16', 'boat', 3),
    ]
    const result = distributeDives(days, ['OW'])
    const boatDay = result.find((d) => d.venueType === 'boat')!
    // Should overflow: all 4 dives on the single boat day
    expect(boatDay.dives.filter((d) => !d.isConfined).length).toBe(4)
  })

  it('handles AOW-only (no pool day needed)', () => {
    const days: DayConfig[] = [
      makeDayConfig('2026-03-15', 'boat', 3),
      makeDayConfig('2026-03-16', 'boat', 3),
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
      makeDayConfig('2026-03-15', 'pool'),
      makeDayConfig('2026-03-16', 'boat'),
      makeDayConfig('2026-03-17', 'boat'),
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
      { ...makeDayConfig('2026-03-15', 'pool'), dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }] },
      { ...makeDayConfig('2026-03-16', 'boat'), dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }] },
      makeDayConfig('2026-03-17', 'boat'),
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
    const days: DayConfig[] = [makeDayConfig('2026-03-15', 'pool')]
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
      makeDayConfig('2026-03-15', 'pool'),
      makeDayConfig('2026-03-16', 'boat', 3),
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
      { ...makeDayConfig('2026-03-15', 'pool'), dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }] },
      { ...makeDayConfig('2026-03-16', 'boat', 3), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      { ...makeDayConfig('2026-03-17', 'boat', 3), dives: [
        { courseCode: 'OW', diveNumber: 4, isConfined: false },
      ] },
    ]
    const result = ensureSufficientDays(days, ['OW'])
    expect(result.length).toBe(3)
  })

  it('appended days have sequential dates', () => {
    const days: DayConfig[] = [
      makeDayConfig('2026-03-15', 'pool'),
      makeDayConfig('2026-03-16', 'boat', 2),
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
        ...makeDayConfig('2026-03-15', 'pool'),
        dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }],
      },
      {
        ...makeDayConfig('2026-03-16', 'boat'),
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
        ...makeDayConfig('2026-03-15', 'pool'),
        dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }],
      },
      {
        ...makeDayConfig('2026-03-16', 'boat'),
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
      makeDayConfig('2026-03-20', 'pool'),
      makeDayConfig('2026-03-21', 'boat'),
    ]
    const available = getAvailableDives(0, days, ['OW'])
    expect(available.some((s) => s.isConfined && s.courseCode === 'OW')).toBe(true)
  })

  it('does not show confined dives on boat days', () => {
    const days: DayConfig[] = [
      makeDayConfig('2026-03-20', 'pool'),
      makeDayConfig('2026-03-21', 'boat'),
    ]
    const available = getAvailableDives(1, days, ['OW'])
    expect(available.some((s) => s.isConfined)).toBe(false)
  })

  it('respects predecessor ordering: AOW dives unavailable until all OW dives placed', () => {
    // Day 1 pool: OW C placed. Day 2 boat: OW 1-3 placed. Day 3 boat: nothing placed.
    const days: DayConfig[] = [
      { ...makeDayConfig('2026-03-20', 'pool'), dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }] },
      { ...makeDayConfig('2026-03-21', 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      makeDayConfig('2026-03-22', 'boat'),
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
      { ...makeDayConfig('2026-03-20', 'pool'), dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }] },
      { ...makeDayConfig('2026-03-21', 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      { ...makeDayConfig('2026-03-22', 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 4, isConfined: false },
      ] },
      makeDayConfig('2026-03-23', 'boat'),
    ]
    // Day 3 (index 2): OW-4 is here, so AOW-1 should be available on day 3 or later
    const day3Available = getAvailableDives(2, days, ['OW', 'AOW'])
    expect(day3Available.some((s) => s.courseCode === 'AOW' && s.diveNumber === 1)).toBe(true)

    // Day 4 (index 3): AOW dives also available
    const day4Available = getAvailableDives(3, days, ['OW', 'AOW'])
    expect(day4Available.some((s) => s.courseCode === 'AOW')).toBe(true)
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

  it('3. O+A 5-day spread: ordering holds', () => {
    const days = generateDays(['OW', 'AOW'], '2026-03-20', 3, '2026-03-24')
    expect(days.length).toBe(5)
    assertDiveOrder(days, { courseCode: 'OW', diveNumber: 4 }, { courseCode: 'AOW', diveNumber: 1 })
  })

  it('4. O+A 4-day default: OW-4 same day or before AOW-1', () => {
    const days = generateDays(['OW', 'AOW'], '2026-03-20', 3, '2026-03-23')
    expect(days.length).toBe(4)
    assertDiveOrder(days, { courseCode: 'OW', diveNumber: 4 }, { courseCode: 'AOW', diveNumber: 1 })
  })

  it('5. OW-only 3 days: confined on day 1, open water on days 2-3', () => {
    const days = generateDays(['OW'], '2026-03-20')
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
    // Set up a 4-day O+A with all dives placed
    const days = generateDays(['OW', 'AOW'], '2026-03-20', 3, '2026-03-23')
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
      { ...makeDayConfig('2026-03-20', 'pool'), dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }] },
      { ...makeDayConfig('2026-03-21', 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      { ...makeDayConfig('2026-03-22', 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 4, isConfined: false },
      ] },
      makeDayConfig('2026-03-23', 'boat'),
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
      { ...makeDayConfig('2026-03-20', 'pool'), dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }] },
      { ...makeDayConfig('2026-03-21', 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      makeDayConfig('2026-03-22', 'boat'),
    ]
    const day2Available = getAvailableDives(1, days, ['OW', 'AOW'])
    expect(day2Available.some((s) => s.courseCode === 'AOW')).toBe(false)
    // OW-1, OW-2, OW-3 are active + OW-4 is available (all predecessors met)
    expect(day2Available.filter((s) => s.courseCode === 'OW').length).toBe(4)
  })

  it('10. Toggle ON/OFF round-trip preserves ordering invariant', () => {
    // Start with full 4-day O+A
    const days = generateDays(['OW', 'AOW'], '2026-03-20', 3, '2026-03-23')
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

// ── Highwater Mark Availability ──────────────────────────────────────────────

describe('highwater mark availability', () => {
  it('1. pool day shows all OW dives', () => {
    const days: DayConfig[] = [
      makeDayConfig('2026-03-20', 'pool'),
      makeDayConfig('2026-03-21', 'boat'),
      makeDayConfig('2026-03-22', 'boat'),
    ]
    const available = getAvailableDives(0, days, ['OW'])
    expect(available.length).toBe(5) // OW C + OW 1-4
    expect(available.some(s => s.isConfined)).toBe(true)
    expect(available.some(s => s.diveNumber === 4)).toBe(true)
  })

  it('2. boat day shows non-confined OW dives', () => {
    const days: DayConfig[] = [
      makeDayConfig('2026-03-20', 'pool'),
      makeDayConfig('2026-03-21', 'boat'),
      makeDayConfig('2026-03-22', 'boat'),
    ]
    const available = getAvailableDives(1, days, ['OW'])
    expect(available.length).toBe(4) // OW 1-4 (no OW C — confined blocked on boat)
    expect(available.some(s => s.isConfined)).toBe(false)
  })

  it('3. highwater excludes earlier dives on later days', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig('2026-03-20', 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
      ] },
      makeDayConfig('2026-03-21', 'boat'),
      makeDayConfig('2026-03-22', 'boat'),
    ]
    const available = getAvailableDives(1, days, ['OW'])
    // Highwater from Day 0 = 2 (OW-2 seq idx). Only OW 3, OW 4 available.
    expect(available.map(s => s.diveNumber).sort()).toEqual([3, 4])
  })

  it('4. transfer student: Day 0 has [OW 4], Day 1 gets AOW', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig('2026-03-20', 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 4, isConfined: false },
      ] },
      makeDayConfig('2026-03-21', 'boat'),
      makeDayConfig('2026-03-22', 'boat'),
      makeDayConfig('2026-03-23', 'boat'),
    ]
    const available = getAvailableDives(1, days, ['OW', 'AOW'])
    // Highwater = 4 (OW-4). Only AOW 1-5 available (all OW below highwater)
    expect(available.every(s => s.courseCode === 'AOW')).toBe(true)
    expect(available.length).toBe(5)
  })

  it('5. AOW blocked until all OW placed (course prereq)', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig('2026-03-20', 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 0, isConfined: true },
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
      ] },
      { ...makeDayConfig('2026-03-21', 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      makeDayConfig('2026-03-22', 'boat'),
    ]
    const available = getAvailableDives(2, days, ['OW', 'AOW'])
    // OW 4 available but unplaced → AOW blocked
    expect(available.some(s => s.courseCode === 'OW' && s.diveNumber === 4)).toBe(true)
    expect(available.some(s => s.courseCode === 'AOW')).toBe(false)
  })

  it('6. AOW available once all OW placed', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig('2026-03-20', 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 0, isConfined: true },
      ] },
      { ...makeDayConfig('2026-03-21', 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
        { courseCode: 'OW', diveNumber: 2, isConfined: false },
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      { ...makeDayConfig('2026-03-22', 'boat'), dives: [
        { courseCode: 'OW', diveNumber: 4, isConfined: false },
      ] },
      makeDayConfig('2026-03-23', 'boat'),
    ]
    // Day 2 (index 2): OW 4 placed here, AOW 1 should be available
    const day2 = getAvailableDives(2, days, ['OW', 'AOW'])
    expect(day2.some(s => s.courseCode === 'AOW' && s.diveNumber === 1)).toBe(true)
    // Day 3 (index 3): All AOW available
    const day3 = getAvailableDives(3, days, ['OW', 'AOW'])
    expect(day3.filter(s => s.courseCode === 'AOW').length).toBe(5)
  })

  it('7. same-day: any combination within a day', () => {
    const days: DayConfig[] = [
      { ...makeDayConfig('2026-03-20', 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
      ] },
      makeDayConfig('2026-03-21', 'boat'),
      makeDayConfig('2026-03-22', 'boat'),
    ]
    const available = getAvailableDives(0, days, ['OW'])
    // OW C, OW 2, OW 4 still available (plus OW 1, OW 3 already on this day)
    expect(available.some(s => s.isConfined)).toBe(true)
    expect(available.some(s => s.diveNumber === 2)).toBe(true)
    expect(available.some(s => s.diveNumber === 4)).toBe(true)
  })

  it('8. gaps allowed in cascade: deselect OW C keeps OW 1-4', () => {
    const days = generateDays(['OW', 'AOW'], '2026-03-20', 3, '2026-03-23')
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
      { ...makeDayConfig('2026-03-20', 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 3, isConfined: false },
      ] },
      { ...makeDayConfig('2026-03-21', 'boat'), dives: [
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
      { ...makeDayConfig('2026-03-20', 'pool'), dives: [
        { courseCode: 'OW', diveNumber: 1, isConfined: false },
      ] },
      { ...makeDayConfig('2026-03-21', 'boat'), dives: [
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
