import { describe, it, expect } from 'vitest'
import { resolveSignInRedirect } from '@/lib/utils/sign-in-redirect'

describe('resolveSignInRedirect', () => {
  it('redirects user with DiveCenter role to slug-based dashboard', () => {
    const result = resolveSignInRedirect({
      isAuthenticated: true,
      user: { slug: 'deep-blue' },
      userRoles: [{ role: 'DiveCenter' }],
    })
    expect(result).toEqual({ action: 'redirect', path: '/deep-blue/dive-center' })
  })

  it('redirects user with Instructor role to slug-based dashboard', () => {
    const result = resolveSignInRedirect({
      isAuthenticated: true,
      user: { slug: 'jane-doe' },
      userRoles: [{ role: 'Instructor' }],
    })
    expect(result).toEqual({ action: 'redirect', path: '/jane-doe/instructor' })
  })

  it('redirects user with multiple roles using default role precedence', () => {
    const result = resolveSignInRedirect({
      isAuthenticated: true,
      user: { slug: 'multi-role' },
      userRoles: [{ role: 'Instructor' }, { role: 'DiveCenter' }],
    })
    // DiveCenter has higher precedence than Instructor
    expect(result).toEqual({ action: 'redirect', path: '/multi-role/dive-center' })
  })

  it('redirects authenticated user with no Convex record to /sign-up', () => {
    const result = resolveSignInRedirect({
      isAuthenticated: true,
      user: null,
      userRoles: undefined,
    })
    expect(result).toEqual({ action: 'redirect', path: '/sign-up' })
  })

  it('redirects authenticated user with null record and empty roles to /sign-up', () => {
    const result = resolveSignInRedirect({
      isAuthenticated: true,
      user: null,
      userRoles: [],
    })
    expect(result).toEqual({ action: 'redirect', path: '/sign-up' })
  })

  it('returns no redirect when not authenticated', () => {
    const result = resolveSignInRedirect({
      isAuthenticated: false,
      user: undefined,
      userRoles: undefined,
    })
    expect(result).toEqual({ action: 'none' })
  })

  it('returns no redirect when user query is still loading (undefined)', () => {
    const result = resolveSignInRedirect({
      isAuthenticated: true,
      user: undefined,
      userRoles: undefined,
    })
    expect(result).toEqual({ action: 'none' })
  })

  it('returns no redirect when user exists but roles are still loading', () => {
    const result = resolveSignInRedirect({
      isAuthenticated: true,
      user: { slug: 'loading-user' },
      userRoles: undefined,
    })
    expect(result).toEqual({ action: 'none' })
  })

  it('returns no redirect when user exists but has zero roles', () => {
    const result = resolveSignInRedirect({
      isAuthenticated: true,
      user: { slug: 'no-roles' },
      userRoles: [],
    })
    expect(result).toEqual({ action: 'none' })
  })
})
