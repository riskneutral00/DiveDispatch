// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const REPO_ROOT = resolve(__dirname, '../..')
const PROXY_FILE = resolve(REPO_ROOT, 'src/proxy.ts')
const SEED_CLERK_FILE = resolve(REPO_ROOT, 'scripts/seed-clerk.ts')

describe('architecture: auth-edge does not read role from JWT publicMetadata', () => {
  it('src/proxy.ts has no publicMetadata.role / claimsRole / ROLE_BY_CLERK_ROLE references', () => {
    const source = readFileSync(PROXY_FILE, 'utf-8')
    const offending: string[] = []
    source.split('\n').forEach((line, i) => {
      if (/publicMetadata[^}]*\brole\b/.test(line)) {
        offending.push(`${i + 1}: ${line.trim()}`)
      }
      if (/\bclaimsRole\b/.test(line)) {
        offending.push(`${i + 1}: ${line.trim()}`)
      }
      if (/\bROLE_BY_CLERK_ROLE\b/.test(line)) {
        offending.push(`${i + 1}: ${line.trim()}`)
      }
    })
    expect(
      offending,
      `Proxy must not read role from JWT publicMetadata. Role precedence is derived at runtime from Convex via deriveDefaultRole.\n  Offending lines:\n  ${offending.join('\n  ')}`,
    ).toEqual([])
  })

  it('src/proxy.ts still reads claimsSlug for cross-slug guard (regression sentinel)', () => {
    const source = readFileSync(PROXY_FILE, 'utf-8')
    expect(
      source,
      'proxy.ts must still read slug from publicMetadata for the cross-slug redirect guard',
    ).toMatch(/publicMetadata.*\bslug\b/)
  })

  it('scripts/seed-clerk.ts does not write user.role into Clerk publicMetadata', () => {
    const source = readFileSync(SEED_CLERK_FILE, 'utf-8')
    const offending: string[] = []
    source.split('\n').forEach((line, i) => {
      if (/role:\s*user\.role/.test(line)) {
        offending.push(`${i + 1}: ${line.trim()}`)
      }
    })
    expect(
      offending,
      `seed-clerk.ts must not write role into Clerk publicMetadata. SeedUser has no role field; role precedence is computed at runtime from Convex.\n  Offending lines:\n  ${offending.join('\n  ')}`,
    ).toEqual([])
  })
})
