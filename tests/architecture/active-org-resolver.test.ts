// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, relative } from 'path'

const REPO_ROOT = resolve(__dirname, '../..')
const CONVEX_ROOT = resolve(REPO_ROOT, 'convex')

const EXEMPT_FILES = new Set<string>([
  resolve(CONVEX_ROOT, 'lib/activeOrg.ts'),
  resolve(CONVEX_ROOT, 'lib/userOrg.ts'),
  resolve(CONVEX_ROOT, 'lib/orgCascade.ts'),
  resolve(CONVEX_ROOT, 'lib/auth.ts'),
  resolve(CONVEX_ROOT, 'users.ts'),
  resolve(CONVEX_ROOT, 'userRoles.ts'),
  resolve(CONVEX_ROOT, 'organizations.ts'),
  resolve(CONVEX_ROOT, 'seed.ts'),
  resolve(CONVEX_ROOT, 'lib/userRoleHelpers.ts'),
  resolve(CONVEX_ROOT, 'lib/profileHelpers.ts'),
])

const RESOLVER_FNS = ['getActiveOrg', 'requireOrgAdmin', 'tryGetActiveOrg', 'authorize']

function walkTs(root: string, out: string[] = []): string[] {
  for (const entry of readdirSync(root)) {
    if (entry === '_generated' || entry === 'node_modules') continue
    const full = resolve(root, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      walkTs(full, out)
      continue
    }
    if (!entry.endsWith('.ts')) continue
    if (entry.endsWith('.test.ts')) continue
    out.push(full)
  }
  return out
}

export interface OrgDenormViolation {
  file: string
  line: number
  text: string
}

const ORG_DENORM_OK = /\borg-denorm-ok\s*[:.]/

function fileResolvesActiveOrg(content: string): boolean {
  return RESOLVER_FNS.some((fn) => new RegExp(`\\b${fn}\\s*\\(`).test(content))
}

function isWriteSideAssignment(line: string): boolean {
  return /\.organizationId\s*=/.test(line) ||
    /(patch|insert)\s*\([^)]*organizationId\s*:/.test(line)
}

export function detectViolations(content: string, filePath: string): OrgDenormViolation[] {
  if (EXEMPT_FILES.has(filePath)) return []

  const violations: OrgDenormViolation[] = []
  const lines = content.split('\n')
  const fileHasResolver = fileResolvesActiveOrg(content)

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const prev = i > 0 ? lines[i - 1] : ''
    const readsUserOrgId = /\b(user|me|userDoc|currentUser|actor\.user|sessionUser)\b[^=]*\.organizationId\b/.test(line)
    if (!readsUserOrgId) continue

    if (ORG_DENORM_OK.test(line) || ORG_DENORM_OK.test(prev)) continue
    if (isWriteSideAssignment(line)) continue
    if (fileHasResolver) continue

    violations.push({
      file: filePath,
      line: i + 1,
      text: line.trim(),
    })
  }

  return violations
}

describe('architecture: active-org resolver — advisory audit', () => {
  it('every user.organizationId read in convex outside the resolver layer goes through getActiveOrg or is annotated org-denorm-ok', () => {
    const offenders: OrgDenormViolation[] = []
    for (const file of walkTs(CONVEX_ROOT)) {
      const content = readFileSync(file, 'utf8')
      offenders.push(...detectViolations(content, file))
    }
    if (offenders.length > 0) {
      console.warn(
        `[advisory] active-org-resolver — ${offenders.length} unannotated user.organizationId reads:\n` +
          offenders
            .slice(0, 20)
            .map((o) => `  ${relative(REPO_ROOT, o.file)}:${o.line}: ${o.text}`)
            .join('\n'),
      )
    }
    expect(offenders.length).toBeLessThanOrEqual(50)
  })

  it('canonical-bug: detects unannotated user.organizationId read in a file with no resolver', () => {
    const fixture = `import type { QueryCtx } from './_generated/server'
export async function leaky(ctx: QueryCtx, userId: string) {
  const user = await ctx.db.get(userId as never)
  if (user?.organizationId) {
    return ctx.db.get(user.organizationId)
  }
  return null
}
`
    const out = detectViolations(fixture, '/fake/convex/leaky.ts')
    expect(out.length).toBeGreaterThan(0)
    expect(out[0]).toEqual(expect.objectContaining({ line: 4 }))
  })

  it('canonical-bug: leaves files with getActiveOrg alone', () => {
    const fixture = `import { getActiveOrg } from './lib/activeOrg'
export async function safe(ctx: QueryCtx, userId: string) {
  const { org } = await getActiveOrg(ctx)
  const user = await ctx.db.get(userId as never)
  if (user?.organizationId === org._id) return user
  return null
}
`
    const out = detectViolations(fixture, '/fake/convex/safe.ts')
    expect(out).toEqual([])
  })

  it('canonical-bug: respects org-denorm-ok comment on the line', () => {
    const fixture = `export async function annotated(ctx: QueryCtx, userId: string) {
  const user = await ctx.db.get(userId as never)
  return user?.organizationId // org-denorm-ok: write-side denorm sync target
}
`
    const out = detectViolations(fixture, '/fake/convex/annotated.ts')
    expect(out).toEqual([])
  })
})
