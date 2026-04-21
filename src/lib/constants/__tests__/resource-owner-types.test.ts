import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import { RESOURCE_OWNER_TYPES } from '../../../../convex/shared/resourceOwnerTypes'

describe('ResourceOwnerType single source of truth', () => {
  it('RESOURCE_OWNER_TYPES has no duplicates', () => {
    const unique = new Set(RESOURCE_OWNER_TYPES)
    expect(unique.size).toBe(RESOURCE_OWNER_TYPES.length)
  })

  it('RESOURCE_OWNER_TYPES matches expected snapshot (forces deliberate updates)', () => {
    expect([...RESOURCE_OWNER_TYPES]).toEqual([
      'Boat',
      'Equipment',
      'Venue',
      'Compressor',
      'Instructor',
      'Liveaboard',
    ])
  })

  it('no inline ResourceOwnerType definitions exist outside canonical file', () => {
    let grepResult: string
    try {
      grepResult = execFileSync('grep', [
        '-rn',
        '--exclude-dir=node_modules',
        '--exclude-dir=.overstory',
        '--exclude-dir=__tests__',
        "type Resource\\(Owner\\)\\?Type\\s*=",
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
      .filter((line) => !line.includes('convex/shared/resourceOwnerTypes.ts'))
      .filter((line) => !line.includes('export { type ResourceOwnerType'))
      .filter((line) => !line.includes('import { type ResourceOwnerType'))

    expect(violations, `Found inline ResourceOwnerType definitions:\n${violations.join('\n')}`).toEqual([])
  })

})
