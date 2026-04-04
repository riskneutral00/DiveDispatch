'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Trash2, Package } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Dialog } from '@/components/ui/dialog'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/spinner'

const GEAR_TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'wetsuit', label: 'Wetsuit' },
  { value: 'bcd', label: 'BCD' },
  { value: 'fins', label: 'Fins' },
  { value: 'mask', label: 'Mask' },
  { value: 'regulator', label: 'Regulator' },
]

const ADD_GEAR_TYPE_OPTIONS = [
  { value: 'wetsuit', label: 'Wetsuit' },
  { value: 'bcd', label: 'BCD' },
  { value: 'fins', label: 'Fins' },
  { value: 'mask', label: 'Mask' },
  { value: 'regulator', label: 'Regulator' },
]

// ── Types ──────────────────────────────────────────────────────────────────

export interface InventoryRow {
  _id: string
  inventoryUnitId: string
  gearType: string
  manufacturer?: string
  size?: string
  diopter?: number
  isPrescription?: boolean
  totalUnits: number
}

interface EquipmentInventoryTableProps {
  items: InventoryRow[]
  isLoading: boolean
  onAddItem: (item: {
    gearType: string
    manufacturer?: string
    size?: string
    diopter?: number
    isPrescription?: boolean
    totalUnits: number
  }) => Promise<void>
  onUpdateUnits: (inventoryId: string, totalUnits: number) => Promise<void>
  onRemoveItem: (inventoryId: string) => Promise<void>
}

// ── Main Component ─────────────────────────────────────────────────────────

export function EquipmentInventoryTable({
  items,
  isLoading,
  onAddItem,
  onUpdateUnits,
  onRemoveItem,
}: EquipmentInventoryTableProps) {
  const t = useTranslations('common')
  const [filterType, setFilterType] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<InventoryRow | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const filteredItems = filterType
    ? items.filter((item) => item.gearType === filterType)
    : items

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError('')
    try {
      await onRemoveItem(deleteTarget._id)
      setDeleteTarget(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('active reservations')) {
        setDeleteError('Cannot remove — active reservations exist for this item.')
      } else {
        setDeleteError(message)
      }
    } finally {
      setIsDeleting(false)
    }
  }, [deleteTarget, onRemoveItem])

  return (
    <div className="space-y-3">
      <FormSectionHeader
        label="Inventory"
        action={
          <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={16} />
            Add Item
          </Button>
        }
      />

      <SimpleSelect
        value={filterType}
        onChange={setFilterType}
        options={GEAR_TYPE_OPTIONS}
        aria-label="Filter by gear type"
      />

      {isLoading ? (
        <Card>
          <div className="flex items-center justify-center py-12">
            <Spinner label={t('loadingInventory')} />
          </div>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            message={
              filterType
                ? `No ${filterType} items found.`
                : 'No inventory items yet. Add your first item to get started.'
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-primary">
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--color-glass-border)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <th scope="col" className="text-left px-4 py-3 font-medium" style={{ width: 100 }}>Type</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium">Manufacturer</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium" style={{ width: 80 }}>Size</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium" style={{ width: 60 }}>Rx</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium" style={{ width: 90 }}>Units</th>
                  <th scope="col" className="px-4 py-3" style={{ width: 44 }}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <InventoryTableRow
                    key={item._id}
                    item={item}
                    onUpdateUnits={onUpdateUnits}
                    onDeleteClick={() => {
                      setDeleteError('')
                      setDeleteTarget(item)
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AddItemDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={onAddItem}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove Item"
        size="sm"
      >
        <p className="text-sm mb-4 text-primary">
          Remove{' '}
          <strong>
            {deleteTarget?.manufacturer ? `${deleteTarget.manufacturer} ` : ''}
            {deleteTarget?.gearType}
            {deleteTarget?.size ? ` (${deleteTarget.size})` : ''}
          </strong>
          ? This cannot be undone.
        </p>
        {deleteError && (
          <p className="text-sm mb-3" style={{ color: 'var(--color-destructive)' }}>
            {deleteError}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            loading={isDeleting}
            onClick={handleDelete}
          >
            Remove
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

// ── Table Row ──────────────────────────────────────────────────────────────

function InventoryTableRow({
  item,
  onUpdateUnits,
  onDeleteClick,
}: {
  item: InventoryRow
  onUpdateUnits: (inventoryId: string, totalUnits: number) => Promise<void>
  onDeleteClick: () => void
}) {
  const [localUnits, setLocalUnits] = useState(String(item.totalUnits))
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const commitUnits = useCallback(async () => {
    const parsed = parseInt(localUnits, 10)
    if (isNaN(parsed) || parsed < 1 || parsed === item.totalUnits) {
      setLocalUnits(String(item.totalUnits))
      return
    }
    setIsSaving(true)
    setSaveError('')
    try {
      await onUpdateUnits(item._id, parsed)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : String(err))
      setLocalUnits(String(item.totalUnits))
    } finally {
      setIsSaving(false)
    }
  }, [localUnits, item._id, item.totalUnits, onUpdateUnits])

  const gearLabel = item.gearType.charAt(0).toUpperCase() + item.gearType.slice(1)

  return (
    <tr style={{ borderBottom: '1px solid var(--color-glass-border)' }}>
      <td className="px-4 py-2.5">
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            background: 'var(--color-glass-bg)',
            border: '1px solid var(--color-glass-border)',
          }}
        >
          {gearLabel}
        </span>
      </td>
      <td className="px-4 py-2.5" style={{ color: item.manufacturer ? undefined : 'var(--color-text-secondary)' }}>
        {item.manufacturer || '—'}
      </td>
      <td className="px-4 py-2.5" style={{ color: item.size ? undefined : 'var(--color-text-secondary)' }}>
        {item.size || '—'}
      </td>
      <td className="px-4 py-2.5" style={{ color: item.diopter != null ? undefined : 'var(--color-text-secondary)' }}>
        {item.diopter != null ? item.diopter : '—'}
      </td>
      <td className="px-4 py-2.5">
        <input
          type="number"
          min={1}
          value={localUnits}
          onChange={(e) => setLocalUnits(e.target.value)}
          onBlur={commitUnits}
          onKeyDown={(e) => { if (e.key === 'Enter') commitUnits() }}
          disabled={isSaving}
          aria-label={`Total units for ${item.gearType} ${item.size ?? ''}`}
          className="w-16 text-sm text-center px-2 py-1 rounded-lg glass"
          style={{
            color: 'var(--color-text-primary)',
            border: saveError ? '1px solid var(--color-destructive)' : '1px solid var(--color-glass-border)',
            background: 'var(--color-glass-bg)',
            outline: 'none',
          }}
        />
      </td>
      <td className="px-4 py-2.5 text-center">
        <button
          onClick={onDeleteClick}
          aria-label={`Remove ${item.gearType} ${item.size ?? ''}`}
          className="p-2 rounded-lg cursor-pointer"
          style={{
            color: 'var(--color-text-secondary)',
            minWidth: 44,
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
          }}
        >
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  )
}

// ── Add Item Dialog ────────────────────────────────────────────────────────

function AddItemDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: EquipmentInventoryTableProps['onAddItem']
}) {
  const [gearType, setGearType] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [size, setSize] = useState('')
  const [isPrescription, setIsPrescription] = useState(false)
  const [diopter, setDiopter] = useState('')
  const [totalUnits, setTotalUnits] = useState('1')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setGearType('')
    setManufacturer('')
    setSize('')
    setIsPrescription(false)
    setDiopter('')
    setTotalUnits('1')
    setError('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!gearType) {
      setError('Gear type is required')
      return
    }
    const units = parseInt(totalUnits, 10)
    if (isNaN(units) || units < 1) {
      setError('Units must be at least 1')
      return
    }

    setIsAdding(true)
    setError('')
    try {
      await onAdd({
        gearType,
        ...(manufacturer ? { manufacturer } : {}),
        ...(size ? { size } : {}),
        ...(isPrescription ? { isPrescription: true } : {}),
        ...(isPrescription && diopter ? { diopter: parseFloat(diopter) } : {}),
        totalUnits: units,
      })
      handleClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Add Inventory Item" size="sm">
      <div className="space-y-4">
        <SimpleSelect
          label="Gear Type"
          value={gearType}
          onChange={setGearType}
          options={ADD_GEAR_TYPE_OPTIONS}
          placeholder="Select gear type"
          required
        />
        <Input
          label="Manufacturer"
          value={manufacturer}
          onChange={(e) => setManufacturer(e.target.value)}
          placeholder="e.g. ScubaPro, Aqua Lung"
        />
        <Input
          label="Size"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          placeholder="e.g. M, EU 42"
        />
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="add-prescription"
            checked={isPrescription}
            onChange={(e) => setIsPrescription(e.target.checked)}
            className="w-5 h-5 accent-[var(--color-primary)]"
          />
          <label htmlFor="add-prescription" className="text-sm text-primary">
            Prescription mask
          </label>
        </div>
        {isPrescription && (
          <Input
            label="Diopter"
            type="number"
            step="0.5"
            value={diopter}
            onChange={(e) => setDiopter(e.target.value)}
            placeholder="e.g. -3.5"
          />
        )}
        <Input
          label="Total Units"
          type="number"
          min={1}
          value={totalUnits}
          onChange={(e) => setTotalUnits(e.target.value)}
          required
        />
        {error && (
          <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" loading={isAdding} onClick={handleSubmit}>
            Add Item
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
