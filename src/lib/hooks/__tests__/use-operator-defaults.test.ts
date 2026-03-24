// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCurrentUser = vi.fn<() => { user: Record<string, unknown> | null; isLoading: boolean }>()
vi.mock('@/lib/hooks/use-current-user', () => ({
  useCurrentUser: () => mockCurrentUser(),
}))

// Track useQuery calls by index — hook calls useQuery 3 times:
// [0] stakeholderPreferences.mine, [1] diveCenters.mine, [2] agents.mine
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

// Import AFTER mocks
import { useOperatorDefaults } from '../use-operator-defaults'

beforeEach(() => {
  vi.clearAllMocks()
  queryCallIndex = 0
  queryReturns[0] = undefined
  queryReturns[1] = undefined
  queryReturns[2] = undefined
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useOperatorDefaults', () => {
  it('returns empty defaults when preferences are null', () => {
    mockCurrentUser.mockReturnValue({
      user: { role: 'DiveCenter', slug: 'test' },
      isLoading: false,
    })
    // prefs=null, dcProfile has associations, agentProfile skipped
    queryReturns[0] = null
    queryReturns[1] = { associations: [{ agency: 'PADI', number: '123' }] }

    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.defaults.agency).toBe('')
    expect(result.current.defaults.preferredInstructorSlug).toBe('')
  })

  it('returns correct agency from DiveCenter associations[0]', () => {
    mockCurrentUser.mockReturnValue({
      user: { role: 'DiveCenter', slug: 'test' },
      isLoading: false,
    })
    queryReturns[0] = {
      preferredInstructorSlugs: ['instr-1'],
      preferredVenueSlugs: [],
      preferredBoatSlugs: [],
      preferredEquipmentSlugs: [],
      preferredCompressorSlugs: [],
    }
    queryReturns[1] = {
      associations: [{ agency: 'PADI', number: '12345' }, { agency: 'SSI', number: '999' }],
    }

    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.defaults.agency).toBe('PADI')
    expect(result.current.defaults.preferredInstructorSlug).toBe('instr-1')
  })

  it('returns all preferred slugs from stakeholderPreferences', () => {
    mockCurrentUser.mockReturnValue({
      user: { role: 'DiveCenter', slug: 'test' },
      isLoading: false,
    })
    queryReturns[0] = {
      preferredInstructorSlugs: ['instr-a', 'instr-b'],
      preferredVenueSlugs: ['venue-x'],
      preferredBoatSlugs: ['boat-1'],
      preferredEquipmentSlugs: ['equip-1'],
      preferredCompressorSlugs: ['comp-1'],
    }
    queryReturns[1] = { associations: [{ agency: 'PADI', number: '1' }] }

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
      user: { role: 'DiveCenter', slug: 'test' },
      isLoading: false,
    })
    queryReturns[0] = {
      preferredInstructorSlugs: [],
      preferredVenueSlugs: [],
      preferredBoatSlugs: [],
      preferredEquipmentSlugs: [],
      preferredCompressorSlugs: [],
    }
    queryReturns[1] = { associations: [] }

    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.isLoading).toBe(false)
  })
})
