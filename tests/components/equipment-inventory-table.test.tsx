// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '../helpers/render'
import userEvent from '@testing-library/user-event'
import {
  EquipmentInventoryTable,
  type InventoryRow,
} from '@/components/inventory/equipment-inventory-table'

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

const MOCK_ITEMS: InventoryRow[] = [
  { _id: '1', inventoryUnitId: 'u1', gearType: 'wetsuit', manufacturer: 'ScubaPro', size: 'M', totalUnits: 5 },
  { _id: '2', inventoryUnitId: 'u2', gearType: 'wetsuit', manufacturer: 'Aqua Lung', size: 'L', totalUnits: 3 },
  { _id: '3', inventoryUnitId: 'u3', gearType: 'bcd', manufacturer: 'Mares', size: 'XL', totalUnits: 6 },
  { _id: '4', inventoryUnitId: 'u4', gearType: 'mask', totalUnits: 10, isPrescription: false },
  { _id: '5', inventoryUnitId: 'u5', gearType: 'mask', diopter: -3.5, isPrescription: true, totalUnits: 1 },
  { _id: '6', inventoryUnitId: 'u6', gearType: 'fins', size: 'EU 42', totalUnits: 5 },
  { _id: '7', inventoryUnitId: 'u7', gearType: 'regulator', manufacturer: 'ScubaPro', totalUnits: 50 },
]

const noop = async () => {}

describe('EquipmentInventoryTable', () => {
  it('renders all items in the table', () => {
    render(
      <EquipmentInventoryTable
        items={MOCK_ITEMS}
        isLoading={false}
        onAddItem={noop}
        onUpdateUnits={noop}
        onRemoveItem={noop}
      />,
    )

    expect(screen.getByText('Aqua Lung')).toBeInTheDocument()
    expect(screen.getByText('Mares')).toBeInTheDocument()
    expect(screen.getByText('EU 42')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(MOCK_ITEMS.length + 1) // +1 for header
  })

  it('shows loading state', () => {
    render(
      <EquipmentInventoryTable
        items={[]}
        isLoading={true}
        onAddItem={noop}
        onUpdateUnits={noop}
        onRemoveItem={noop}
      />,
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows empty state when no items', () => {
    render(
      <EquipmentInventoryTable
        items={[]}
        isLoading={false}
        onAddItem={noop}
        onUpdateUnits={noop}
        onRemoveItem={noop}
      />,
    )

    expect(screen.getByText(/No inventory yet/)).toBeInTheDocument()
  })

  it('filters by gear type', async () => {
    const user = userEvent.setup()
    render(
      <EquipmentInventoryTable
        items={MOCK_ITEMS}
        isLoading={false}
        onAddItem={noop}
        onUpdateUnits={noop}
        onRemoveItem={noop}
      />,
    )

    const select = screen.getByLabelText('Filter by gear type')
    await user.selectOptions(select, 'bcd')

    expect(screen.getByText('Mares')).toBeInTheDocument()
    expect(screen.queryByText('Aqua Lung')).not.toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(2) // header + 1 BCD row
  })

  it('opens add item dialog on button click', async () => {
    const user = userEvent.setup()
    render(
      <EquipmentInventoryTable
        items={[]}
        isLoading={false}
        onAddItem={noop}
        onUpdateUnits={noop}
        onRemoveItem={noop}
      />,
    )

    await user.click(screen.getByText('Add Item'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Add Inventory Item')).toBeInTheDocument()
    expect(screen.getByText('Gear Type')).toBeInTheDocument()
  })

  it('opens delete confirmation on trash click', async () => {
    const user = userEvent.setup()
    render(
      <EquipmentInventoryTable
        items={[MOCK_ITEMS[0]]}
        isLoading={false}
        onAddItem={noop}
        onUpdateUnits={noop}
        onRemoveItem={noop}
      />,
    )

    await user.click(screen.getByLabelText(/Remove wetsuit/))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Remove Item')).toBeInTheDocument()
    expect(within(dialog).getByText(/This cannot be undone/)).toBeInTheDocument()
  })

  it('calls onRemoveItem when delete is confirmed', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn().mockResolvedValue(undefined)

    render(
      <EquipmentInventoryTable
        items={[MOCK_ITEMS[0]]}
        isLoading={false}
        onAddItem={noop}
        onUpdateUnits={noop}
        onRemoveItem={onRemove}
      />,
    )

    await user.click(screen.getByLabelText(/Remove wetsuit/))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    expect(onRemove).toHaveBeenCalledWith('1')
  })

  it('shows filtered empty state for specific gear type', async () => {
    const user = userEvent.setup()
    render(
      <EquipmentInventoryTable
        items={MOCK_ITEMS.filter((i) => i.gearType === 'wetsuit')}
        isLoading={false}
        onAddItem={noop}
        onUpdateUnits={noop}
        onRemoveItem={noop}
      />,
    )

    const select = screen.getByLabelText('Filter by gear type')
    await user.selectOptions(select, 'bcd')

    expect(screen.getByText(/No bcd items found/)).toBeInTheDocument()
  })

  it('renders diopter for prescription masks', () => {
    render(
      <EquipmentInventoryTable
        items={MOCK_ITEMS}
        isLoading={false}
        onAddItem={noop}
        onUpdateUnits={noop}
        onRemoveItem={noop}
      />,
    )

    expect(screen.getByText('-3.5')).toBeInTheDocument()
  })

  it('has accessible table headers', () => {
    render(
      <EquipmentInventoryTable
        items={MOCK_ITEMS}
        isLoading={false}
        onAddItem={noop}
        onUpdateUnits={noop}
        onRemoveItem={noop}
      />,
    )

    const headers = screen.getAllByRole('columnheader')
    const labels = headers.map((h) => h.textContent)
    expect(labels).toContain('Type')
    expect(labels).toContain('Manufacturer')
    expect(labels).toContain('Size')
    expect(labels).toContain('Rx')
    expect(labels).toContain('Units')
  })

  it('inline units input has correct aria-label per item', () => {
    render(
      <EquipmentInventoryTable
        items={[MOCK_ITEMS[0]]}
        isLoading={false}
        onAddItem={noop}
        onUpdateUnits={noop}
        onRemoveItem={noop}
      />,
    )

    expect(screen.getByLabelText('Total units for wetsuit M')).toBeInTheDocument()
  })

  it('calls onUpdateUnits on blur when value changes', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn().mockResolvedValue(undefined)

    render(
      <EquipmentInventoryTable
        items={[MOCK_ITEMS[0]]}
        isLoading={false}
        onAddItem={noop}
        onUpdateUnits={onUpdate}
        onRemoveItem={noop}
      />,
    )

    const input = screen.getByLabelText('Total units for wetsuit M')
    await user.clear(input)
    await user.type(input, '10')
    await user.tab()

    expect(onUpdate).toHaveBeenCalledWith('1', 10)
  })
})
