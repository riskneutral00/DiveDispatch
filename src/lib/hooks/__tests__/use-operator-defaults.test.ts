// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

let mockSession: {
  user: Record<string, unknown> | null
  roles: { role: string }[] | undefined
  status: 'loading' | 'unauthenticated' | 'ready'
} = { user: null, roles: undefined, status: 'loading' }

vi.mock('@/lib/hooks/use-session-identity', () => ({
  useSessionIdentity: () => ({
    user: mockSession.user,
    roles: mockSession.roles,
    defaultRole: null,
    defaultRoleKey: null,
    slug: (mockSession.user as { slug?: string } | null)?.slug ?? null,
    status: mockSession.status,
    isAuthLoading: false,
    isAuthenticated: mockSession.user != null,
  }),
}))

let mockWizardPrefs: Record<string, unknown> | null | undefined = undefined

vi.mock('@/lib/hooks/use-wizard-preferences', () => ({
  useWizardPreferences: () => ({
    prefs: mockWizardPrefs,
    isLoading: mockWizardPrefs === undefined,
  }),
}))

let queryCallIndex = 0
const queryReturns: (unknown | undefined)[] = [undefined, undefined]

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: (_ref: unknown, args: unknown) => {
      if (args === 'skip') return undefined
      return queryReturns[queryCallIndex++]
    },
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  }
})

import { useOperatorDefaults } from '../use-operator-defaults'

beforeEach(() => {
  vi.clearAllMocks()
  queryCallIndex = 0
  queryReturns[0] = undefined
  queryReturns[1] = undefined
  mockWizardPrefs = undefined
  mockSession = { user: null, roles: undefined, status: 'loading' }
})

describe('useOperatorDefaults', () => {
  it('returns empty defaults when preferences are null', () => {
    mockSession = { user: { slug: 'test' }, roles: [{ role: 'DiveCenter' }], status: 'ready' }
    mockWizardPrefs = null
    queryReturns[0] = { associations: [{ agency: 'PADI', number: '123' }] }

    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.defaults.agency).toBe('')
    expect(result.current.defaults.preferredInstructorSlug).toBe('')
  })

  it('returns correct agency from DiveCenter associations[0]', () => {
    mockSession = { user: { slug: 'test' }, roles: [{ role: 'DiveCenter' }], status: 'ready' }
    mockWizardPrefs = {
      preferredInstructorSlugs: ['instr-1'],
      preferredVenueSlugs: [],
      preferredBoatSlugs: [],
      preferredEquipmentSlugs: [],
      preferredCompressorSlugs: [],
    }
    queryReturns[0] = {
      associations: [{ agency: 'PADI', number: '12345' }, { agency: 'SSI', number: '999' }],
    }

    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.defaults.agency).toBe('PADI')
    expect(result.current.defaults.preferredInstructorSlug).toBe('instr-1')
  })

  it('returns all preferred slugs from stakeholderPreferences', () => {
    mockSession = { user: { slug: 'test' }, roles: [{ role: 'DiveCenter' }], status: 'ready' }
    mockWizardPrefs = {
      preferredInstructorSlugs: ['instr-a', 'instr-b'],
      preferredVenueSlugs: ['venue-x'],
      preferredBoatSlugs: ['boat-1'],
      preferredEquipmentSlugs: ['equip-1'],
      preferredCompressorSlugs: ['comp-1'],
    }
    queryReturns[0] = { associations: [{ agency: 'PADI', number: '1' }] }

    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.defaults.preferredInstructorSlug).toBe('instr-a')
    expect(result.current.defaults.preferredInstructorSlugs).toEqual(['instr-a', 'instr-b'])
    expect(result.current.defaults.preferredVenueSlug).toBe('venue-x')
    expect(result.current.defaults.preferredBoatSlug).toBe('boat-1')
    expect(result.current.defaults.preferredEquipmentSlug).toBe('equip-1')
    expect(result.current.defaults.preferredCompressorSlug).toBe('comp-1')
  })

  it('isLoading true while user is loading', () => {
    mockSession = { user: null, roles: undefined, status: 'loading' }

    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.isLoading).toBe(true)
  })

  it('isLoading false once all queries resolved', () => {
    mockSession = { user: { slug: 'test' }, roles: [{ role: 'DiveCenter' }], status: 'ready' }
    mockWizardPrefs = {
      preferredInstructorSlugs: [],
      preferredVenueSlugs: [],
      preferredBoatSlugs: [],
      preferredEquipmentSlugs: [],
      preferredCompressorSlugs: [],
    }
    queryReturns[0] = { associations: [] }

    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.isLoading).toBe(false)
  })
})
