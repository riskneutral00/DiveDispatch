// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const REPO_ROOT = resolve(__dirname, '../..')
const ORG_FILE = resolve(REPO_ROOT, 'convex/organizations.ts')

describe("architecture: findSeedRebindCandidate matches by slug only (no name fallback)", () => {
  it('does not reference q.field(\'name\') anywhere in convex/organizations.ts', () => {
    const source = readFileSync(ORG_FILE, 'utf-8')
    const offending: string[] = []
    const lines = source.split('\n')
    lines.forEach((line, i) => {
      if (/q\.field\(\s*['"]name['"]\s*\)/.test(line)) {
        offending.push(`${i + 1}: ${line.trim()}`)
      }
    })
    expect(
      offending,
      `Name-based filtering reintroduced in convex/organizations.ts:\n  ${offending.join('\n  ')}\n\n` +
        `findSeedRebindCandidate must match by slug only. Use the creatorTokenIdentifier rebind path for the name-was-needed cases.`,
    ).toEqual([])
  })

  it('upsertFromWebhook creator-rebind branch patches only clerkOrgId and updatedAt (preserves Convex name + slug)', () => {
    const source = readFileSync(ORG_FILE, 'utf-8')
    const branchStart = source.indexOf('if (rebindByCreator) {')
    expect(branchStart, 'creator-rebind branch missing in upsertFromWebhook').toBeGreaterThan(-1)
    const branchEnd = source.indexOf('orgId = rebindByCreator._id', branchStart)
    expect(branchEnd, 'creator-rebind orgId assignment missing').toBeGreaterThan(branchStart)
    const branch = source.slice(branchStart, branchEnd)
    expect(branch).toMatch(/clerkOrgId:\s*args\.clerkOrgId/)
    expect(branch).toMatch(/updatedAt:\s*now/)
    expect(branch, 'creator-rebind branch must NOT overwrite Convex name from Clerk webhook payload').not.toMatch(
      /name:\s*args\.name/,
    )
    expect(branch, 'creator-rebind branch must NOT overwrite Convex slug from Clerk webhook payload').not.toMatch(
      /slug:\s*args\.slug/,
    )
  })

  it('upsertFromWebhook seed-rebind-by-slug fallback patches only clerkOrgId and updatedAt', () => {
    const source = readFileSync(ORG_FILE, 'utf-8')
    const branchStart = source.indexOf('if (seedRebindCandidate) {')
    expect(branchStart, 'seed-rebind-by-slug branch missing in upsertFromWebhook').toBeGreaterThan(-1)
    const branchEnd = source.indexOf('orgId = seedRebindCandidate._id', branchStart)
    expect(branchEnd, 'seed-rebind-by-slug orgId assignment missing').toBeGreaterThan(branchStart)
    const branch = source.slice(branchStart, branchEnd)
    expect(branch).toMatch(/clerkOrgId:\s*args\.clerkOrgId/)
    expect(branch).toMatch(/updatedAt:\s*now/)
    expect(branch, 'seed-rebind-by-slug branch must NOT overwrite Convex name from Clerk webhook payload').not.toMatch(
      /name:\s*args\.name/,
    )
    expect(branch, 'seed-rebind-by-slug branch must NOT overwrite Convex slug from Clerk webhook payload').not.toMatch(
      /slug:\s*args\.slug/,
    )
  })
})
