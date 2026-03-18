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

  it('generates correct day count for OW (confined + open water days)', () => {
    const days = generateDays(['OW'], '2026-03-15')
    // OW: 1 confined + 4 dives at 3/day = ~2 open days → 3 days total
    expect(days.length).toBeGreaterThanOrEqual(3)
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

    // Should auto-fill: confined on day 0, dives 1+2 on day 1
    const poolDay = result[0]
    expect(poolDay.dives.some((d) => d.isConfined && d.courseCode === 'OW')).toBe(true)

    const day1 = result[1]
    expect(day1.dives.some((d) => d.diveNumber === 1)).toBe(true)
    expect(day1.dives.some((d) => d.diveNumber === 2)).toBe(true)
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
    const day1 = result[1]
    expect(day1.dives.filter((d) => d.diveNumber === 2).length).toBe(1)
    // Confined still just 1
    expect(result[0].dives.length).toBe(1)
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
  it('removes orphan dives when predecessor is missing', () => {
    // Simulate: OW confined + dive 1 scheduled, but dive 2 is missing and dive 3 exists
    const days: DayConfig[] = [
      {
        ...makeDayConfig('2026-03-15', 'pool'),
        dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }],
      },
      {
        ...makeDayConfig('2026-03-16', 'boat'),
        dives: [
          { courseCode: 'OW', diveNumber: 1, isConfined: false },
          { courseCode: 'OW', diveNumber: 3, isConfined: false }, // skipped 2!
        ],
      },
    ]
    const result = cascadeRemoveOrphans(days, ['OW'])
    const allDives = result.flatMap((d) => d.dives)
    // Dive 3 should be removed (orphan — dive 2 is missing)
    expect(allDives.some((d) => d.diveNumber === 3)).toBe(false)
    // Confined and dive 1 should remain
    expect(allDives.some((d) => d.diveNumber === 0)).toBe(true)
    expect(allDives.some((d) => d.diveNumber === 1)).toBe(true)
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
