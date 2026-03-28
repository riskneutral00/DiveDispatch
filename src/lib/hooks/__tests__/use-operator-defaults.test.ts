// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCurrentUser = vi.fn<() => { user: Record<string, unknown> | null; isLoading: boolean }>()
vi.mock('@/lib/hooks/use-current-user', () => ({
  useCurrentUser: () => mockCurrentUser(),
}))

// Track useQuery calls by index — hook calls useQuery 4 times:
// [0] userRoles.myRoles, [1] stakeholderPreferences.mine, [2] diveCenters.mine, [3] agents.mine
let queryCallIndex = 0
const queryReturns: (unknown | undefined)[] = [undefined, undefined, undefined, undefined]

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

// Import AFTER mocks
import { useOperatorDefaults } from '../use-operator-defaults'

beforeEach(() => {
  vi.clearAllMocks()
  queryCallIndex = 0
  queryReturns[0] = undefined
  queryReturns[1] = undefined
  queryReturns[2] = undefined
  queryReturns[3] = undefined
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useOperatorDefaults', () => {
  it('returns empty defaults when preferences are null', () => {
    mockCurrentUser.mockReturnValue({
      user: { slug: 'test' },
      isLoading: false,
    })
    // [0] userRoles, [1] prefs=null, [2] dcProfile, [3] agentProfile skipped
    queryReturns[0] = [{ role: 'DiveCenter' }]
    queryReturns[1] = null
    queryReturns[2] = { associations: [{ agency: 'PADI', number: '123' }] }

    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.defaults.agency).toBe('')
    expect(result.current.defaults.preferredInstructorSlug).toBe('')
  })

  it('returns correct agency from DiveCenter associations[0]', () => {
    mockCurrentUser.mockReturnValue({
      user: { slug: 'test' },
      isLoading: false,
    })
    queryReturns[0] = [{ role: 'DiveCenter' }]
    queryReturns[1] = {
      preferredInstructorSlugs: ['instr-1'],
      preferredVenueSlugs: [],
      preferredBoatSlugs: [],
      preferredEquipmentSlugs: [],
      preferredCompressorSlugs: [],
    }
    queryReturns[2] = {
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
    queryReturns[0] = [{ role: 'DiveCenter' }]
    queryReturns[1] = {
      preferredInstructorSlugs: ['instr-a', 'instr-b'],
      preferredVenueSlugs: ['venue-x'],
      preferredBoatSlugs: ['boat-1'],
      preferredEquipmentSlugs: ['equip-1'],
      preferredCompressorSlugs: ['comp-1'],
    }
    queryReturns[2] = { associations: [{ agency: 'PADI', number: '1' }] }

    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.defaults.preferredInstructorSlug).toBe('instr-a')
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
    queryReturns[0] = [{ role: 'DiveCenter' }]
    queryReturns[1] = {
      preferredInstructorSlugs: [],
      preferredVenueSlugs: [],
      preferredBoatSlugs: [],
      preferredEquipmentSlugs: [],
      preferredCompressorSlugs: [],
    }
    queryReturns[2] = { associations: [] }

    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.isLoading).toBe(false)
  })
})
