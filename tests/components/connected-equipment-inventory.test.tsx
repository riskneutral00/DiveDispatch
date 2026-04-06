// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../helpers/render'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Single shared spy for all useMutation calls — ConnectedEquipmentInventory
// calls useMutation 3 times (add/update/remove). Tests verify the table
// passes the correct callbacks rather than testing which mutation fn is called.
const mockMutate = vi.fn()
let mockGrouped: unknown = undefined

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: () => mockGrouped,
    useMutation: () => mockMutate,
  }
})

// jsdom doesn't implement HTMLDialogElement methods
beforeEach(() => {
  HTMLDialogElement.prototype.show ??= function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.showModal ??= function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function () {
    this.removeAttribute('open')
  }
  document.documentElement.removeAttribute('data-dialog-open')
})

// ─── Import after mocks ───────────────────────────────────────────────────────
import { ConnectedEquipmentInventory } from '@/components/inventory/connected-equipment-inventory'

beforeEach(() => {
  vi.clearAllMocks()
  mockGrouped = undefined
  mockMutate.mockResolvedValue(undefined)
})

describe('ConnectedEquipmentInventory', () => {
  it('shows loading state while query is pending', () => {
    mockGrouped = undefined
    render(<ConnectedEquipmentInventory />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows empty state when inventory is empty', () => {
    mockGrouped = {}
    render(<ConnectedEquipmentInventory />)
    expect(screen.getByText(/No inventory yet/)).toBeInTheDocument()
  })

  it('renders inventory rows from grouped query result', () => {
    mockGrouped = {
      wetsuit: [
        {
          _id: 'inv1',
          inventoryUnitId: 'u1',
          gearType: 'wetsuit',
          manufacturer: 'ScubaPro',
          size: 'M',
          totalUnits: 5,
        },
      ],
      bcd: [
        {
          _id: 'inv2',
          inventoryUnitId: 'u2',
          gearType: 'bcd',
          manufacturer: 'Mares',
          totalUnits: 3,
        },
      ],
    }
    render(<ConnectedEquipmentInventory />)
    expect(screen.getByText('ScubaPro')).toBeInTheDocument()
    expect(screen.getByText('Mares')).toBeInTheDocument()
  })

  it('renders Add Item button for interacting with inventory', () => {
    mockGrouped = {}
    render(<ConnectedEquipmentInventory />)
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument()
  })
})
