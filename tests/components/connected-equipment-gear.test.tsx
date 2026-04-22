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
  isPrescription: boolean
  diopter: number
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

  it('calls bulkSetMasksByManufacturer when saving a new mask manufacturer group', async () => {
    mockBulkSet.mockResolvedValueOnce(undefined)
    groupedReturn = {}

    render(<ConnectedEquipmentGear />)

    fireEvent.click(screen.getByRole('tab', { name: /Mask/i }))

    const manufacturerSelect = await screen.findByLabelText(/Manufacturer/i)
    fireEvent.change(manufacturerSelect, { target: { value: 'ScubaPro' } })

    const [fillAllSelect] = await screen.findAllByLabelText(/Fill all with/i)
    fireEvent.change(fillAllSelect!, { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }))

    const saveBtn = await screen.findByRole('button', { name: /^Save$/i })
    fireEvent.click(saveBtn)

    await vi.waitFor(() => {
      expect(mockBulkSet).toHaveBeenCalled()
    })
    const callArg = mockBulkSet.mock.calls[0]![0]
    expect(callArg.manufacturer).toBe('ScubaPro')
    expect(callArg.gearType).toBeUndefined()
    expect(callArg.cells).toBeDefined()
    const nonZeroCells = Object.entries(callArg.cells as Record<string, number>).filter(([, v]) => v > 0)
    expect(nonZeroCells.length).toBeGreaterThan(0)
  })

  it('calls bulkSetMasksByManufacturer with empty cells when removing a mask manufacturer group', async () => {
    mockBulkSet.mockResolvedValueOnce(undefined)
    groupedReturn = {
      mask: [
        makeInventoryRow({ _id: 'inv-1', inventoryUnitId: 'unit-1', manufacturer: 'Scubapro', isPrescription: false }),
        makeInventoryRow({ _id: 'inv-2', inventoryUnitId: 'unit-2', manufacturer: 'Aqualung', isPrescription: true, diopter: -3.0 }),
      ],
    }

    render(<ConnectedEquipmentGear />)

    fireEvent.click(screen.getByRole('tab', { name: /Mask/i }))

    const removeButtons = await screen.findAllByLabelText(/Remove/i)
    fireEvent.click(removeButtons[0]!)

    await screen.findByRole('dialog', { hidden: true })

    const allRemoveButtons = await screen.findAllByRole('button', { name: /^Remove$/i, hidden: true })
    const confirmBtn = allRemoveButtons[allRemoveButtons.length - 1]!
    fireEvent.click(confirmBtn)

    await vi.waitFor(() => {
      expect(mockBulkSet).toHaveBeenCalled()
    })
    const callArg = mockBulkSet.mock.calls[0]![0]
    expect(callArg.cells).toEqual({})
  })

  it('non-matrix draft card stays visible with saved values until Convex refetch arrives', async () => {
    mockAddItem.mockResolvedValueOnce(undefined)
    groupedReturn = {}

    render(<ConnectedEquipmentGear />)

    fireEvent.click(screen.getByRole('tab', { name: /Regulator/i }))

    const manufacturer = await screen.findByLabelText(/Manufacturer/i)
    fireEvent.change(manufacturer, { target: { value: 'ScubaPro' } })
    fireEvent.change(screen.getByLabelText(/Units/i), { target: { value: '3' } })

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))
    await vi.waitFor(() => expect(mockAddItem).toHaveBeenCalled())

    await new Promise((r) => setTimeout(r, 50))
    const selects = screen.queryAllByLabelText(/Manufacturer/i) as HTMLSelectElement[]
    expect(selects.length).toBeGreaterThan(0)
    expect(selects[0]!.value).toBe('ScubaPro')
  })

  it('pending matrix section stays visible after first save while the group is refetching', async () => {
    mockBulkSet.mockResolvedValueOnce(undefined)
    groupedReturn = {}

    render(<ConnectedEquipmentGear />)

    const manufacturerSelect = await screen.findByLabelText(/Manufacturer/i)
    fireEvent.change(manufacturerSelect, { target: { value: 'ScubaPro' } })

    const [fillAllSelect] = await screen.findAllByLabelText(/Fill all with/i)
    fireEvent.change(fillAllSelect!, { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }))

    const saveBtn = await screen.findByRole('button', { name: /^Save$/i })
    fireEvent.click(saveBtn)

    await vi.waitFor(() => {
      expect(mockBulkSet).toHaveBeenCalled()
    })

    expect(screen.getAllByLabelText(/Manufacturer/i).length).toBeGreaterThan(0)
    const firstSelect = screen.getAllByLabelText(/Manufacturer/i)[0] as HTMLSelectElement
    expect(firstSelect.value).toBe('ScubaPro')
  })
})
