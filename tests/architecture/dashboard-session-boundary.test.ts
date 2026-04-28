// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const REPO_ROOT = resolve(__dirname, '../..')
const DASHBOARD_SESSION = resolve(
  REPO_ROOT,
  'src/lib/hooks/use-dashboard-session.ts',
)
const GUARDED_REDIRECT = resolve(
  REPO_ROOT,
  'src/lib/hooks/use-guarded-redirect.ts',
)

describe('architecture: dashboard-session policy wraps the identity primitive', () => {
  it('use-dashboard-session.ts imports useSessionIdentity from the identity primitive', () => {
    const source = readFileSync(DASHBOARD_SESSION, 'utf-8')
    expect(source).toMatch(/from\s+['"]\.\/use-session-identity['"]/)
    expect(source).toMatch(/useSessionIdentity\b/)
  })

  it('use-dashboard-session.ts does NOT import from convex/react (no second identity path)', () => {
    const source = readFileSync(DASHBOARD_SESSION, 'utf-8')
    expect(
      source,
      'use-dashboard-session.ts must wrap useSessionIdentity, not subscribe to Convex queries directly',
    ).not.toMatch(/from\s+['"]convex\/react['"]/)
  })

  it('use-dashboard-session.ts does NOT subscribe to api.users.me or api.userRoles.myRoles', () => {
    const source = readFileSync(DASHBOARD_SESSION, 'utf-8')
    expect(source).not.toMatch(/api\.users\.me\b/)
    expect(source).not.toMatch(/api\.userRoles\.myRoles\b/)
    expect(source).not.toMatch(/useQuery\s*\(/)
  })

  it('use-guarded-redirect.ts only imports next/navigation and react (no domain coupling)', () => {
    const source = readFileSync(GUARDED_REDIRECT, 'utf-8')
    expect(source).not.toMatch(/from\s+['"]convex\/react['"]/)
    expect(source).not.toMatch(/api\.users\.me\b/)
    expect(source).not.toMatch(/api\.userRoles\.myRoles\b/)
    expect(source).toMatch(/from\s+['"]next\/navigation['"]/)
  })
})
