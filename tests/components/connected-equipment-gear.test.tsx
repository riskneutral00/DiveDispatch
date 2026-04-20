// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../helpers/render'
import { ConnectedEquipmentGear } from '@/components/inventory/connected-equipment-gear'

const mockAddItem = vi.fn()
const mockUpdateItem = vi.fn()
const mockRemoveItem = vi.fn()
const mockBulkSet = vi.fn()
const mockRenameGroup = vi.fn()

let groupedReturn: unknown = {}

function dispatchMutation(args: Record<string, unknown>) {
  if ('inventoryId' in args && Object.keys(args).length === 1) {
    return mockRemoveItem(args)
  }
  if ('inventoryId' in args) {
    return mockUpdateItem(args)
  }
  if ('cells' in args) {
    return mockBulkSet(args)
  }
  if ('previousManufacturer' in args) {
    return mockRenameGroup(args)
  }
  return mockAddItem(args)
}

// mock-ok: component-level jsdom render test. Backend behavior of equipmentInventory mutations is covered by tests/equipmentInventory.test.ts (convex-test + makeT). This suite asserts UI wiring: mutation call args triggered by user interaction.
vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: () => groupedReturn,
    useMutation: () => dispatchMutation,
  }
})

beforeEach(() => {
  HTMLDialogElement.prototype.show = vi.fn()
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

function makeInventoryRow(overrides: Partial<{
  _id: string
  inventoryUnitId: string
  gearType: string
  manufacturer: string
  size: string
  totalUnits: number
}> = {}) {
  return {
    _id: 'inv-1',
    inventoryUnitId: 'unit-1',
    gearType: 'mask',
    manufacturer: 'Scubapro',
    totalUnits: 3,
    ...overrides,
  }
}

describe('ConnectedEquipmentGear', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    groupedReturn = {}
  })

  it('shows loading card while inventory query is undefined', () => {
    groupedReturn = undefined
    render(<ConnectedEquipmentGear />)
    expect(screen.getByText(/Loading/i)).toBeInTheDocument()
  })

  it('renders gear-type tabs for each gear type', () => {
    render(<ConnectedEquipmentGear />)
    expect(screen.getByRole('tab', { name: /Wetsuit/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Mask/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Regulator/i })).toBeInTheDocument()
  })

  it('calls addItem mutation when saving a new mask draft with required fields', async () => {
    mockAddItem.mockResolvedValueOnce('inv-new')
    groupedReturn = {}

    render(<ConnectedEquipmentGear />)

    fireEvent.click(screen.getByRole('tab', { name: /Mask/i }))

    const manufacturerSelect = await screen.findByLabelText(/Manufacturer/i)
    fireEvent.change(manufacturerSelect, { target: { value: 'ScubaPro' } })

    const saveBtn = await screen.findByLabelText(/^Save$/i)
    fireEvent.click(saveBtn)

    await vi.waitFor(() => {
      expect(mockAddItem).toHaveBeenCalled()
    })
    const callArg = mockAddItem.mock.calls[0]![0]
    expect(callArg.gearType).toBe('mask')
    expect(callArg.manufacturer).toBe('ScubaPro')
    expect(callArg.totalUnits).toBeGreaterThanOrEqual(1)
  })

  it('calls removeItem mutation after confirming removal of an existing mask item', async () => {
    mockRemoveItem.mockResolvedValueOnce(undefined)
    groupedReturn = {
      mask: [
        makeInventoryRow({ _id: 'inv-1', inventoryUnitId: 'unit-1', manufacturer: 'Scubapro' }),
        makeInventoryRow({ _id: 'inv-2', inventoryUnitId: 'unit-2', manufacturer: 'Aqualung' }),
      ],
    }

    render(<ConnectedEquipmentGear />)

    fireEvent.click(screen.getByRole('tab', { name: /Mask/i }))

    const trashButtons = await screen.findAllByLabelText(/^Remove$/i)
    fireEvent.click(trashButtons[0]!)

    const allRemoveButtons = await screen.findAllByRole('button', { name: /^Remove$/i, hidden: true })
    const confirmBtn = allRemoveButtons[allRemoveButtons.length - 1]!
    fireEvent.click(confirmBtn)

    await vi.waitFor(() => {
      expect(mockRemoveItem).toHaveBeenCalledWith({ inventoryId: 'inv-1' })
    })
  })
})
