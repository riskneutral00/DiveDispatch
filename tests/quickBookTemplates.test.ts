import { describe, it, expect } from 'vitest'
import { COURSE_TEMPLATES, type QuickBookTemplate } from '../src/lib/booking/quick-book-templates'

describe('COURSE_TEMPLATES', () => {
  it('has expected template count', () => {
    expect(COURSE_TEMPLATES.length).toBeGreaterThanOrEqual(4)
  })

  it('has unique IDs', () => {
    const ids = COURSE_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has unique labels', () => {
    const labels = COURSE_TEMPLATES.map((t) => t.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('every template has non-empty courses array', () => {
    for (const t of COURSE_TEMPLATES) {
      expect(t.courses.length).toBeGreaterThan(0)
    }
  })

  it('includes O+A combo template', () => {
    const combo = COURSE_TEMPLATES.find((t) => t.id === 'ow-aow')
    expect(combo).toBeDefined()
    expect(combo!.courses).toContain('OW')
    expect(combo!.courses).toContain('AOW')
  })

  it('DSD template has exactly one course', () => {
    const dsd = COURSE_TEMPLATES.find((t) => t.id === 'dsd')
    expect(dsd!.courses).toEqual(['DSD'])
  })

  it('all template IDs are lowercase kebab-case', () => {
    for (const t of COURSE_TEMPLATES) {
      expect(t.id).toMatch(/^[a-z][a-z0-9-]*$/)
    }
  })

  it('OW template has exactly one course', () => {
    const ow = COURSE_TEMPLATES.find((t) => t.id === 'ow')
    expect(ow!.courses).toEqual(['OW'])
  })

  it('all course codes in templates are valid COURSE_CODES', () => {
    const VALID = new Set(['DSD', 'TRY_DIVE', 'OW', 'AOW', 'RESCUE', 'DM', 'FD', 'REFRESH', 'SPECIALTY'])
    for (const t of COURSE_TEMPLATES) {
      for (const c of t.courses) {
        expect(VALID.has(c), `${c} not in COURSE_CODES`).toBe(true)
      }
    }
  })

  it('FD template exists with single course', () => {
    const fd = COURSE_TEMPLATES.find((t) => t.id === 'fd')
    expect(fd).toBeDefined()
    expect(fd!.courses).toEqual(['FD'])
  })
})
