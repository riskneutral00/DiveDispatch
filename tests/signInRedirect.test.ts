import { describe, it, expect } from 'vitest'
import { resolveSignInRedirect } from '../src/lib/utils/sign-in-redirect'

describe('resolveSignInRedirect', () => {
  it('returns redirect to role dashboard when user has roles', () => {
    const result = resolveSignInRedirect({
      isAuthenticated: true,
      user: { slug: 'alice' },
      userRoles: [{ role: 'DiveCenter' }],
    })
    expect(result.action).toBe('redirect')
    if (result.action === 'redirect') {
      expect(result.path).toContain('/alice/')
    }
  })

  it('returns redirect to sign-up when authenticated but no user record', () => {
    const result = resolveSignInRedirect({
      isAuthenticated: true,
      user: null,
      userRoles: undefined,
    })
    expect(result).toEqual({ action: 'redirect', path: '/sign-up' })
  })

  it('returns none when not authenticated', () => {
    const result = resolveSignInRedirect({
      isAuthenticated: false,
      user: null,
      userRoles: undefined,
    })
    expect(result).toEqual({ action: 'none' })
  })

  it('returns none when user exists but has no roles', () => {
    const result = resolveSignInRedirect({
      isAuthenticated: true,
      user: { slug: 'alice' },
      userRoles: [],
    })
    expect(result).toEqual({ action: 'none' })
  })

  it('returns none when user is undefined (loading state)', () => {
    const result = resolveSignInRedirect({
      isAuthenticated: true,
      user: undefined,
      userRoles: undefined,
    })
    expect(result).toEqual({ action: 'none' })
  })

  it('uses default role for multi-role user', () => {
    const result = resolveSignInRedirect({
      isAuthenticated: true,
      user: { slug: 'bob' },
      userRoles: [{ role: 'DiveCenter' }, { role: 'Instructor' }],
    })
    expect(result.action).toBe('redirect')
    if (result.action === 'redirect') {
      expect(result.path).toContain('/bob/')
    }
  })
})
