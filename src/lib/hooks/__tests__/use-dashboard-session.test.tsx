// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { SessionIdentity } from '../use-session-identity'
import type { Doc } from '@/lib/convex-generated'

const mockUseSessionIdentity = vi.fn(() => makeIdentity({ status: 'loading' }))

vi.mock('../use-session-identity', () => ({
  useSessionIdentity: () => mockUseSessionIdentity(),
}))

import { useDashboardSession } from '../use-dashboard-session'

type UserDoc = Doc<'users'>
type RoleDoc = Doc<'userRoles'>

function makeIdentity(partial: Partial<SessionIdentity>): SessionIdentity {
  return {
    user: undefined,
    roles: undefined,
    defaultRole: null,
    defaultRoleKey: null,
    slug: null,
    status: 'loading',
    isAuthLoading: false,
    isAuthenticated: false,
    ...partial,
  }
}

const fakeUser = { _id: 'u1', slug: 'matt-lee' } as unknown as UserDoc
const dcRole = { role: 'DiveCenter' } as unknown as RoleDoc
const instructorRole = { role: 'Instructor' } as unknown as RoleDoc

describe('useDashboardSession', () => {
  beforeEach(() => {
    mockUseSessionIdentity.mockReset()
  })

  it('status is loading when underlying identity is loading', () => {
    mockUseSessionIdentity.mockReturnValue(makeIdentity({ status: 'loading' }))
    const { result } = renderHook(() => useDashboardSession())
    expect(result.current.status).toBe('loading')
    expect(result.current.redirectPath).toBeNull()
  })

  it('status is unauthenticated when identity is unauthenticated', () => {
    mockUseSessionIdentity.mockReturnValue(
      makeIdentity({
        status: 'unauthenticated',
        user: null,
        roles: [],
      }),
    )
    const { result } = renderHook(() => useDashboardSession())
    expect(result.current.status).toBe('unauthenticated')
    expect(result.current.redirectPath).toBe('/sign-up')
  })

  it('status is no-role when identity is ready but defaultRoleKey is missing', () => {
    mockUseSessionIdentity.mockReturnValue(
      makeIdentity({
        status: 'ready',
        user: fakeUser,
        roles: [],
        slug: 'matt-lee',
        defaultRoleKey: null,
        defaultRole: null,
      }),
    )
    const { result } = renderHook(() => useDashboardSession())
    expect(result.current.status).toBe('no-role')
    expect(result.current.redirectPath).toBe('/sign-up')
  })

  it('status is ready and computes redirectPath when slug + defaultRoleKey exist', () => {
    mockUseSessionIdentity.mockReturnValue(
      makeIdentity({
        status: 'ready',
        user: fakeUser,
        roles: [dcRole],
        slug: 'matt-lee',
        defaultRoleKey: 'dive-center',
        defaultRole: 'DiveCenter',
      }),
    )
    const { result } = renderHook(() => useDashboardSession())
    expect(result.current.status).toBe('ready')
    expect(result.current.redirectPath).toBe('/matt-lee/dive-center/dashboard')
  })

  it('hasRole returns true for held clerkRole and false for unheld', () => {
    mockUseSessionIdentity.mockReturnValue(
      makeIdentity({
        status: 'ready',
        user: fakeUser,
        roles: [dcRole, instructorRole],
        slug: 'matt-lee',
        defaultRoleKey: 'dive-center',
        defaultRole: 'DiveCenter',
      }),
    )
    const { result } = renderHook(() => useDashboardSession())
    expect(result.current.hasRole('DiveCenter')).toBe(true)
    expect(result.current.hasRole('Instructor')).toBe(true)
    expect(result.current.hasRole('Agent')).toBe(false)
  })

  it('validateSlug returns ok / mismatch / unknown', () => {
    mockUseSessionIdentity.mockReturnValue(
      makeIdentity({
        status: 'ready',
        user: fakeUser,
        roles: [dcRole],
        slug: 'matt-lee',
        defaultRoleKey: 'dive-center',
        defaultRole: 'DiveCenter',
      }),
    )
    const { result } = renderHook(() => useDashboardSession())
    expect(result.current.validateSlug('matt-lee')).toBe('ok')
    expect(result.current.validateSlug('wrong-slug')).toBe('mismatch')
    expect(result.current.validateSlug(undefined)).toBe('unknown')
  })

  it('validateRoleKey returns ok / mismatch / unknown', () => {
    mockUseSessionIdentity.mockReturnValue(
      makeIdentity({
        status: 'ready',
        user: fakeUser,
        roles: [dcRole],
        slug: 'matt-lee',
        defaultRoleKey: 'dive-center',
        defaultRole: 'DiveCenter',
      }),
    )
    const { result } = renderHook(() => useDashboardSession())
    expect(result.current.validateRoleKey('dive-center')).toBe('ok')
    expect(result.current.validateRoleKey('agent')).toBe('mismatch')
    expect(result.current.validateRoleKey(undefined)).toBe('unknown')
  })

  it('exposes the underlying identity for downstream consumers', () => {
    const identity = makeIdentity({
      status: 'ready',
      user: fakeUser,
      roles: [dcRole],
      slug: 'matt-lee',
      defaultRoleKey: 'dive-center',
      defaultRole: 'DiveCenter',
    })
    mockUseSessionIdentity.mockReturnValue(identity)
    const { result } = renderHook(() => useDashboardSession())
    expect(result.current.identity).toBe(identity)
    expect(result.current.user).toBe(fakeUser)
    expect(result.current.roles).toBe(identity.roles)
    expect(result.current.slug).toBe('matt-lee')
    expect(result.current.defaultRoleKey).toBe('dive-center')
    expect(result.current.defaultClerkRole).toBe('DiveCenter')
  })
})
