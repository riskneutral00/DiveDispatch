// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, relative } from 'path'
import { glob } from 'glob'

const REPO_ROOT = resolve(__dirname, '../..')

const LOCAL_SEED_USER_RE = /^\s*async\s+function\s+seedUser\s*\(/m
const DIRECT_CONVEX_TEST_RE = /\bconvexTest\s*\(\s*schema\b/

const FIXTURES_HOME = 'tests/fixtures/seedUsers.ts'
const MAKE_T_HOME = 'tests/helpers/convex-helpers.ts'

const KNOWN_LOCAL_SEED_USER = new Set<string>([
  'tests/wave8Invariants.test.ts',
  'tests/referralDraft.test.ts',
  'tests/auditTrail.test.ts',
  'tests/hardening/inventory-invariants.test.ts',
  'tests/walkthrough/22-accept-reservation.test.ts',
  'tests/walkthrough/12-itinerary-resources.test.ts',
  'tests/walkthrough/06-onboarding-preferences.test.ts',
  'tests/walkthrough/05-onboarding-profile.test.ts',
  'tests/walkthrough/04-profile-setup.test.ts',
])

describe('architecture: test fixtures are single-sourced', () => {
  it('no NEW test file declares a local seedUser function', async () => {
    const files = await glob('tests/**/*.test.ts', {
      cwd: REPO_ROOT,
      ignore: ['tests/architecture/**'],
      absolute: true,
    })
    const newOffenders: string[] = []
    const fixedOffenders: string[] = []
    const seen = new Set<string>()
    for (const file of files) {
      const rel = relative(REPO_ROOT, file)
      const source = readFileSync(file, 'utf-8')
      if (LOCAL_SEED_USER_RE.test(source)) {
        seen.add(rel)
        if (!KNOWN_LOCAL_SEED_USER.has(rel)) {
          newOffenders.push(rel)
        }
      }
    }
    for (const known of KNOWN_LOCAL_SEED_USER) {
      if (!seen.has(known)) fixedOffenders.push(known)
    }
    const errors: string[] = []
    if (newOffenders.length > 0) {
      errors.push(
        `New test file(s) declaring a local seedUser function:\n  ${newOffenders.join('\n  ')}\n\n` +
          `Import { seedUserWithOrg } from './fixtures' instead. ` +
          `Canonical home: ${FIXTURES_HOME}.`,
      )
    }
    if (fixedOffenders.length > 0) {
      errors.push(
        `Known offender(s) no longer declare seedUser locally — remove from KNOWN_LOCAL_SEED_USER in this test:\n  ${fixedOffenders.join('\n  ')}`,
      )
    }
    expect(errors, errors.join('\n\n')).toEqual([])
  })

  it('no test file calls convexTest(schema, ...) directly — use makeT()', async () => {
    const files = await glob('tests/**/*.test.ts', {
      cwd: REPO_ROOT,
      ignore: ['tests/architecture/**'],
      absolute: true,
    })
    const offenders: string[] = []
    for (const file of files) {
      const rel = relative(REPO_ROOT, file)
      const source = readFileSync(file, 'utf-8')
      if (DIRECT_CONVEX_TEST_RE.test(source)) {
        offenders.push(rel)
      }
    }
    expect(
      offenders,
      `Test files calling convexTest(schema, ...) directly:\n  ${offenders.join('\n  ')}\n\n` +
        `Import { makeT } from '${MAKE_T_HOME.replace(/^tests\//, './').replace(/\.ts$/, '')}' instead.`,
    ).toEqual([])
  })
})
