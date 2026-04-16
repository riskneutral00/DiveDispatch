// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../helpers/render'
import { DiverEquipmentWidget } from '@/components/booking/diver-equipment-widget'
import { testDate } from '../helpers/dates'

const useQueryMock = vi.fn()

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: (...args: unknown[]) => useQueryMock(...args),
    useMutation: () => vi.fn(),
  }
})

describe('DiverEquipmentWidget feedback states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty-state message when equipment profile is missing', () => {
    useQueryMock.mockReturnValueOnce(null)
    render(<DiverEquipmentWidget visibleRange={{ start: testDate(-14), end: testDate(-7) }} />)
    expect(screen.getByText('Equipment profile not set up.')).toBeInTheDocument()
  })

  it('shows empty-state message when there are no bookings in range', () => {
    useQueryMock.mockReturnValueOnce({
      bookings: [],
      gearSizingEntries: [],
      inventory: [],
      manufacturersByGearType: {},
    })
    render(<DiverEquipmentWidget visibleRange={{ start: testDate(-14), end: testDate(-7) }} />)
    expect(screen.getByText('No bookings in this date range.')).toBeInTheDocument()
  })
})
