import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import { COURSE_CODES, type CourseCode } from '../../../../convex/shared/courseCodes'

describe('CourseCode single source of truth', () => {
  it('COURSE_CODES has no duplicates', () => {
    const unique = new Set(COURSE_CODES)
    expect(unique.size).toBe(COURSE_CODES.length)
  })

  it('COURSE_CODES matches expected snapshot (forces deliberate updates)', () => {
    expect([...COURSE_CODES]).toEqual([
      'DSD',
      'TRY_DIVE',
      'OW',
      'AOW',
      'RESCUE',
      'DM',
      'FD',
      'REFRESH',
      'SPECIALTY',
    ])
  })

  it('no inline CourseCode type definitions exist outside canonical file', () => {
    let grepResult: string
    try {
      grepResult = execFileSync('grep', [
        '-rn',
        '--exclude-dir=node_modules',
        '--exclude-dir=.overstory',
        '--exclude-dir=__tests__',
        'type CourseCode\\s*=',
        '--include=*.ts',
        '--include=*.tsx',
        '.',
      ], { encoding: 'utf-8', cwd: process.cwd() }).trim()
    } catch {
      return
    }

    const violations = grepResult
      .split('\n')
      .filter(Boolean)
      .filter((line) => !line.includes('convex/shared/courseCodes.ts'))
      .filter((line) => !line.includes('export { type CourseCode'))
      .filter((line) => !line.includes('import { type CourseCode'))

    expect(violations, `Found inline CourseCode definitions:\n${violations.join('\n')}`).toEqual([])
  })

  it('no inline courseCode v.literal validators exist outside canonical file', () => {
    let grepResult: string
    try {
      grepResult = execFileSync('grep', [
        '-rn',
        '--exclude-dir=node_modules',
        '--exclude-dir=.overstory',
        '--exclude-dir=__tests__',
        "v\\.literal('DSD')",
        '--include=*.ts',
        '--include=*.tsx',
        '.',
      ], { encoding: 'utf-8', cwd: process.cwd() }).trim()
    } catch {
      return
    }

    const violations = grepResult
      .split('\n')
      .filter(Boolean)
      .filter((line) => !line.includes('convex/shared/courseCodes.ts'))

    expect(violations, `Found inline courseCode validators:\n${violations.join('\n')}`).toEqual([])
  })

  it('course-catalog.ts re-exports from canonical source', async () => {
    const catalog = await import('../../constants/course-catalog')
    expect(catalog.COURSE_CODES).toBe(COURSE_CODES)

    const code: CourseCode = catalog.COURSE_CODES[0]
    expect(code).toBe('DSD')
  })
})
