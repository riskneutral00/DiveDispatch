// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockCurrentUser = vi.fn<() => { user: Record<string, unknown> | null; isLoading: boolean }>()
vi.mock('@/lib/hooks/use-current-user', () => ({
  useCurrentUser: () => mockCurrentUser(),
}))

let mockWizardPrefs: Record<string, unknown> | null | undefined = undefined

vi.mock('@/lib/hooks/use-wizard-preferences', () => ({
  useWizardPreferences: () => ({
    prefs: mockWizardPrefs,
    isLoading: mockWizardPrefs === undefined,
  }),
}))

let queryCallIndex = 0
const queryReturns: (unknown | undefined)[] = [undefined, undefined, undefined]

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
  queryReturns[2] = undefined
  mockWizardPrefs = undefined
})

describe('useOperatorDefaults', () => {
  it('returns empty defaults when preferences are null', () => {
    mockCurrentUser.mockReturnValue({
      user: { slug: 'test' },
      isLoading: false,
    })
    mockWizardPrefs = null
    queryReturns[0] = [{ role: 'DiveCenter' }]
    queryReturns[1] = { associations: [{ agency: 'PADI', number: '123' }] }

    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.defaults.agency).toBe('')
    expect(result.current.defaults.preferredInstructorSlug).toBe('')
  })

  it('returns correct agency from DiveCenter associations[0]', () => {
    mockCurrentUser.mockReturnValue({
      user: { slug: 'test' },
      isLoading: false,
    })
    mockWizardPrefs = {
      preferredInstructorSlugs: ['instr-1'],
      preferredVenueSlugs: [],
      preferredBoatSlugs: [],
      preferredEquipmentSlugs: [],
      preferredCompressorSlugs: [],
    }
    queryReturns[0] = [{ role: 'DiveCenter' }]
    queryReturns[1] = {
      associations: [{ agency: 'PADI', number: '12345' }, { agency: 'SSI', number: '999' }],
    }

    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.defaults.agency).toBe('PADI')
    expect(result.current.defaults.preferredInstructorSlug).toBe('instr-1')
  })

  it('returns all preferred slugs from stakeholderPreferences', () => {
    mockCurrentUser.mockReturnValue({
      user: { slug: 'test' },
      isLoading: false,
    })
    mockWizardPrefs = {
      preferredInstructorSlugs: ['instr-a', 'instr-b'],
      preferredVenueSlugs: ['venue-x'],
      preferredBoatSlugs: ['boat-1'],
      preferredEquipmentSlugs: ['equip-1'],
      preferredCompressorSlugs: ['comp-1'],
    }
    queryReturns[0] = [{ role: 'DiveCenter' }]
    queryReturns[1] = { associations: [{ agency: 'PADI', number: '1' }] }

    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.defaults.preferredInstructorSlug).toBe('instr-a')
    expect(result.current.defaults.preferredInstructorSlugs).toEqual(['instr-a', 'instr-b'])
    expect(result.current.defaults.preferredVenueSlug).toBe('venue-x')
    expect(result.current.defaults.preferredBoatSlug).toBe('boat-1')
    expect(result.current.defaults.preferredEquipmentSlug).toBe('equip-1')
    expect(result.current.defaults.preferredCompressorSlug).toBe('comp-1')
  })

  it('isLoading true while user is loading', () => {
    mockCurrentUser.mockReturnValue({ user: null, isLoading: true })

    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.isLoading).toBe(true)
  })

  it('isLoading false once all queries resolved', () => {
    mockCurrentUser.mockReturnValue({
      user: { slug: 'test' },
      isLoading: false,
    })
    mockWizardPrefs = {
      preferredInstructorSlugs: [],
      preferredVenueSlugs: [],
      preferredBoatSlugs: [],
      preferredEquipmentSlugs: [],
      preferredCompressorSlugs: [],
    }
    queryReturns[0] = [{ role: 'DiveCenter' }]
    queryReturns[1] = { associations: [] }

    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.isLoading).toBe(false)
  })
})
