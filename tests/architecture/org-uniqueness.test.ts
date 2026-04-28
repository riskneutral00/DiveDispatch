import { describe, it, expect } from 'vitest'
import { internal } from '../../convex/_generated/api'
import { ALL_STAKEHOLDERS } from '../../convex/seedData'
import { ALL_INSTRUCTORS } from '../../convex/seedData'
import { makeT } from '../helpers/convex-helpers'

type OrgShape = { _id: string; slug: string; name: string }

function canonicalOrgSlugs(): Set<string> {
  return new Set([
    ...ALL_STAKEHOLDERS.map((s) => s.organization?.slug ?? s.user.slug),
    ...ALL_INSTRUCTORS.map((s) => s.user.slug),
  ])
}

function detectViolations(orgs: OrgShape[], canonical: Set<string>): string[] {
  const violations: string[] = []

  if (orgs.length !== canonical.size) {
    violations.push(
      `org count ${orgs.length} !== canonical count ${canonical.size} (canonical: ${[...canonical].join(', ')})`,
    )
  }

  const slugs = orgs.map((o) => o.slug)
  if (new Set(slugs).size !== slugs.length) {
    const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i)
    violations.push(`duplicate slug(s): ${[...new Set(dupes)].join(', ')}`)
  }

  const names = orgs.map((o) => o.name)
  if (new Set(names).size !== names.length) {
    const dupes = names.filter((n, i) => names.indexOf(n) !== i)
    violations.push(`duplicate name(s): ${[...new Set(dupes)].join(', ')}`)
  }

  for (const org of orgs) {
    if (!canonical.has(org.slug)) {
      violations.push(`unknown org slug "${org.slug}" (name="${org.name}") — not in ALL_STAKEHOLDERS`)
    }
  }

  return violations
}

describe('architecture: one org per stakeholder canonical slug', () => {
  it('after seedAll, organizations exactly mirror ALL_STAKEHOLDERS canonical slugs', async () => {
    const t = makeT()

    await t.action(internal.seed.seedAll, {})

    const orgs = await t.run(async (ctx) => {
      const rows = await ctx.db.query('organizations').collect()
      return rows.map((r) => ({ _id: r._id as string, slug: r.slug, name: r.name }))
    })

    const violations = detectViolations(orgs, canonicalOrgSlugs())
    expect(
      violations,
      `org-uniqueness invariant broken:\n  ${violations.join('\n  ')}\n` +
        `seen orgs: ${JSON.stringify(orgs.map((o) => ({ slug: o.slug, name: o.name })))}`,
    ).toEqual([])
  })

  it('detector catches the duplicate-by-name regression class (sea-fun parallel-row shape)', async () => {
    const t = makeT()

    await t.action(internal.seed.seedAll, {})

    const orgsAfterCorruption = await t.run(async (ctx) => {
      const seeded = await ctx.db.query('organizations').collect()
      const seaFun = seeded.find((o) => o.name === 'Sea Fun Divers')
      if (!seaFun) {
        throw new Error('test fixture invariant: ALL_STAKEHOLDERS must include Sea Fun Divers')
      }
      const now = Date.now()
      await ctx.db.insert('organizations', {
        slug: `${seaFun.slug}-${crypto.randomUUID().slice(0, 8)}`,
        name: seaFun.name,
        clerkOrgId: `org_sea-fun-duplicate-${crypto.randomUUID().slice(0, 8)}`,
        createdAt: now,
        updatedAt: now,
      })
      const rows = await ctx.db.query('organizations').collect()
      return rows.map((r) => ({ _id: r._id as string, slug: r.slug, name: r.name }))
    })

    const violations = detectViolations(orgsAfterCorruption, canonicalOrgSlugs())
    expect(violations.length).toBeGreaterThan(0)
    expect(violations.some((v) => v.includes('duplicate name'))).toBe(true)
  })
})
