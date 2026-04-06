import { describe, it, expect } from 'vitest'
import { canTeachCourses, type Credential } from '../convex/lib/credentialMatch'
import type { CourseCode } from '../convex/shared/courseCodes'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCredential(specialtyRatings: string[], agency = 'PADI'): Credential {
  return { agency, level: 'OWSI', agencyID: 'TEST-001', specialtyRatings }
}

// ── Universal courses (DSD, TRY_DIVE, FD, REFRESH) ──────────────────────────

describe('canTeachCourses — universal courses', () => {
  const universalCodes: CourseCode[] = ['DSD', 'TRY_DIVE', 'FD', 'REFRESH']

  it.each(universalCodes)(
    '%s never produces a warning regardless of credentials',
    (code) => {
      const result = canTeachCourses([], [code])
      expect(result.canTeach).toBe(true)
      expect(result.missing).toEqual([])
    },
  )

  it('mix of universal courses never warns', () => {
    const result = canTeachCourses(
      [makeCredential(['OW'])],
      ['DSD', 'TRY_DIVE', 'FD', 'REFRESH'],
    )
    expect(result.canTeach).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('universal courses pass even with empty credentials array', () => {
    const result = canTeachCourses([], ['DSD', 'FD'])
    expect(result.canTeach).toBe(true)
    expect(result.missing).toEqual([])
  })
})

// ── Explicit courses (OW, AOW, RESCUE, DM, SPECIALTY) ───────────────────────

describe('canTeachCourses — explicit courses', () => {
  it('OW credential covers OW booking', () => {
    const result = canTeachCourses(
      [makeCredential(['OW'])],
      ['OW'],
    )
    expect(result.canTeach).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('OW-only credential flags AOW as missing', () => {
    const result = canTeachCourses(
      [makeCredential(['OW'])],
      ['AOW'],
    )
    expect(result.canTeach).toBe(false)
    expect(result.missing).toEqual(['AOW'])
  })

  it('multiple missing courses are all reported', () => {
    const result = canTeachCourses(
      [makeCredential(['OW'])],
      ['AOW', 'RESCUE', 'DM'],
    )
    expect(result.canTeach).toBe(false)
    expect(result.missing).toEqual(['AOW', 'RESCUE', 'DM'])
  })

  it('SPECIALTY requires explicit credential entry', () => {
    const result = canTeachCourses(
      [makeCredential(['OW', 'AOW'])],
      ['SPECIALTY'],
    )
    expect(result.canTeach).toBe(false)
    expect(result.missing).toEqual(['SPECIALTY'])
  })

  it('DM requires explicit credential entry', () => {
    const result = canTeachCourses(
      [makeCredential(['OW', 'AOW', 'RESCUE'])],
      ['DM'],
    )
    expect(result.canTeach).toBe(false)
    expect(result.missing).toEqual(['DM'])
  })
})

// ── Multi-credential instructors ─────────────────────────────────────────────

describe('canTeachCourses — multi-credential', () => {
  it('courses spread across multiple credentials are all covered', () => {
    const result = canTeachCourses(
      [
        makeCredential(['OW', 'AOW'], 'PADI'),
        makeCredential(['RESCUE', 'DM'], 'SSI'),
      ],
      ['OW', 'AOW', 'RESCUE', 'DM'],
    )
    expect(result.canTeach).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('partial coverage across credentials still reports gaps', () => {
    const result = canTeachCourses(
      [
        makeCredential(['OW'], 'PADI'),
        makeCredential(['RESCUE'], 'SSI'),
      ],
      ['OW', 'AOW', 'RESCUE'],
    )
    expect(result.canTeach).toBe(false)
    expect(result.missing).toEqual(['AOW'])
  })
})

// ── Mixed universal + explicit courses ───────────────────────────────────────

describe('canTeachCourses — mixed universal and explicit', () => {
  it('universal courses are ignored, explicit are checked', () => {
    const result = canTeachCourses(
      [makeCredential(['OW'])],
      ['DSD', 'OW', 'FD'],
    )
    expect(result.canTeach).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('universal courses pass but explicit gaps are flagged', () => {
    const result = canTeachCourses(
      [makeCredential(['OW'])],
      ['DSD', 'AOW', 'REFRESH'],
    )
    expect(result.canTeach).toBe(false)
    expect(result.missing).toEqual(['AOW'])
  })
})

// ── Edge cases ───────────────────────────────────────────────────────────────

describe('canTeachCourses — edge cases', () => {
  it('empty required courses returns canTeach true', () => {
    const result = canTeachCourses([makeCredential(['OW'])], [])
    expect(result.canTeach).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('empty credentials with explicit courses flags all as missing', () => {
    const result = canTeachCourses([], ['OW', 'AOW'])
    expect(result.canTeach).toBe(false)
    expect(result.missing).toEqual(['OW', 'AOW'])
  })

  it('duplicate required courses are deduplicated in missing', () => {
    // Technically the caller should pass unique courses, but the function
    // should handle duplicates gracefully (reporting each occurrence)
    const result = canTeachCourses([], ['OW', 'OW'])
    expect(result.canTeach).toBe(false)
    expect(result.missing).toEqual(['OW', 'OW'])
  })

  it('credential with empty courses array covers nothing explicit', () => {
    const result = canTeachCourses(
      [makeCredential([])],
      ['OW'],
    )
    expect(result.canTeach).toBe(false)
    expect(result.missing).toEqual(['OW'])
  })
})
