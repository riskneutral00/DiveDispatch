/**
 * Keeps docs/CASCADE_CHECKLIST.md present and structurally valid for onboarding.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import path from 'path'

const CHECKLIST = path.resolve(__dirname, '../docs/CASCADE_CHECKLIST.md')

describe('CASCADE_CHECKLIST.md', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(CHECKLIST), 'docs/CASCADE_CHECKLIST.md must exist').toBe(true)
    const body = readFileSync(CHECKLIST, 'utf8')
    expect(body).toContain('# User deletion cascade')
    expect(body).toContain('cleanupDeletedUserData')
    expect(body).toContain('cancelOneBookingForDeletedUser')
    expect(body).toContain('CASCADE_BATCH_SIZE')
    expect(body).toContain('tests/userDeletionCascade.test.ts')
  })
})
