// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

const ARCH_DIR = resolve(__dirname)

const SOURCE_WALKING_GRANDFATHERED = new Set<string>([
  'business-contact-language-key.test.ts',
  'credential-specialty-ratings-required.test.ts',
  'dashboard-session-boundary.test.ts',
  'entity-helper-usage.test.ts',
  'entity-role-mine-shape.test.ts',
  'functional-marker-placement.test.ts',
  'gas-mix-host-owned.test.ts',
  'language-find.test.ts',
  'membership-helper.test.ts',
  'new-stakeholder.test.ts',
  'no-blind-unique-on-entity-tables.test.ts',
  'no-orphan-personal-orgs.test.ts',
  'org-child-tables.test.ts',
  'org-uniqueness.test.ts',
  'proxy-no-role-claim.test.ts',
  'query-budget.test.ts',
  'role-config-completeness.test.ts',
  'role-kinds.test.ts',
  'role-registry-sealed.test.ts',
  'role-table-map-sealed.test.ts',
  'row-factory-contract.test.ts',
  'seed-rebind-slug-only.test.ts',
  'select-truth-contract.test.ts',
  'soft-delete-ttl.test.ts',
  'test-fixtures.test.ts',
  'users-insert-sealed.test.ts',
])

const NON_SOURCE_WALKING = new Set<string>([
  '_lock-test-meta.test.ts',
  'role-payload-contract.test.ts',
])

interface MetaCheck {
  exportsDetector: boolean
  hasFixtureNegative: boolean
  hasCanonicalBugComment: boolean
}

export function checkLockTestPattern(content: string): MetaCheck {
  const exportsDetector =
    /export\s+function\s+detectViolations\s*\(/.test(content) ||
    /export\s+(const|function)\s+detect\w*\s*[=(]/.test(content)
  const hasFixtureNegative =
    /canonical-bug\b/.test(content) &&
    /detectViolations\s*\(/.test(content) &&
    /(toContainEqual|toEqual|toContain|toMatchObject)/.test(content)
  const hasCanonicalBugComment = /canonical-bug\b/.test(content)
  return { exportsDetector, hasFixtureNegative, hasCanonicalBugComment }
}

describe('lock-test meta — every new architecture test must follow the detector + fixture pattern', () => {
  const all = readdirSync(ARCH_DIR).filter((f) => f.endsWith('.test.ts'))
  const newTests = all.filter(
    (f) => !SOURCE_WALKING_GRANDFATHERED.has(f) && !NON_SOURCE_WALKING.has(f),
  )

  for (const file of newTests) {
    it(`${file}: exports detectViolations + has canonical-bug fixture negative`, () => {
      const content = readFileSync(resolve(ARCH_DIR, file), 'utf8')
      const check = checkLockTestPattern(content)
      expect(check.exportsDetector, `${file} must export a detectViolations function`).toBe(true)
      expect(
        check.hasCanonicalBugComment,
        `${file} must include a "canonical-bug:" comment naming the bug it guards`,
      ).toBe(true)
      expect(
        check.hasFixtureNegative,
        `${file} must include at least one fixture-driven negative test that exercises detectViolations on a fixture string demonstrating the violation`,
      ).toBe(true)
    })
  }

  it('grandfathered list is the only exemption pathway and shrinks over time', () => {
    const arch = readdirSync(ARCH_DIR).filter((f) => f.endsWith('.test.ts'))
    for (const f of [...SOURCE_WALKING_GRANDFATHERED, ...NON_SOURCE_WALKING]) {
      expect(arch, `Stale entry in meta allowlist: ${f}`).toContain(f)
    }
  })
})
