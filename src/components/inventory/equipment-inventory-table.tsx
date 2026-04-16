'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Trash2, Package } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { NumberPicker } from '@/components/ui/number-picker'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Dialog } from '@/components/ui/dialog'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/spinner'
import { LoadingCard } from '@/components/ui/loading-card'
import { InlineError } from '@/components/ui/inline-error'
import { cn } from '@/lib/utils/cn'
import { GEAR_TYPES, GEAR_TYPE_LABELS } from '@/lib/constants/gear-sizing'

const GEAR_TYPE_OPTIONS = [
  { value: '', label: 'All' },
  ...GEAR_TYPES.map((gt) => ({ value: gt, label: GEAR_TYPE_LABELS[gt] })),
]

const ADD_GEAR_TYPE_OPTIONS = GEAR_TYPES.map((gt) => ({ value: gt, label: GEAR_TYPE_LABELS[gt] }))

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

export function EquipmentInventoryTable({
  items,
  isLoading,
  onAddItem,
  onUpdateUnits,
  onRemoveItem,
}: EquipmentInventoryTableProps) {
  const t = useTranslations('common')
  const tErrors = useTranslations('errors')
  const tBooking = useTranslations('booking')
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
        setDeleteError(tErrors('activeReservations'))
      } else {
        setDeleteError(message)
      }
    } finally {
      setIsDeleting(false)
    }
  }, [deleteTarget, onRemoveItem, tErrors])

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
        <LoadingCard variant="spinner" message={t('loading')} />
      ) : filteredItems.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            message={
              filterType
                ? tBooking('noItemsFound', { type: filterType })
                : tBooking('noInventory')
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-body text-primary">
              <thead>
                <tr
                  className="glass-divider text-secondary"
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
        title={tBooking('removeItem')}
        size="sm"
        melt={false}
      >
        <p className="text-body mb-4 text-primary">
          Remove{' '}
          <strong>
            {deleteTarget?.manufacturer ? `${deleteTarget.manufacturer} ` : ''}
            {deleteTarget?.gearType}
            {deleteTarget?.size ? ` (${deleteTarget.size})` : ''}
          </strong>
          ? This cannot be undone.
        </p>
        {deleteError && <InlineError className="mb-3">{deleteError}</InlineError>}
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

  const gearLabel = item.gearType.charAt(0).toUpperCase() + item.gearType.slice(1)

  return (
    <tr className="glass-divider reading-plane">
      <td className="px-4 py-2.5">
        <Badge variant="default" size="sm">{gearLabel}</Badge>
      </td>
      <td className={cn("px-4 py-2.5", item.manufacturer ? "text-primary" : "text-secondary")}>
        {item.manufacturer || '—'}
      </td>
      <td className={cn("px-4 py-2.5", item.size ? "text-primary" : "text-secondary")}>
        {item.size || '—'}
      </td>
      <td className={cn("px-4 py-2.5", item.diopter != null ? "text-primary" : "text-secondary")}>
        {item.diopter != null ? item.diopter : '—'}
      </td>
      <td className="px-4 py-2.5">
        <NumberPicker
          min={1}
          max={500}
          value={localUnits === '' ? undefined : Number(localUnits)}
          onChange={async (v) => {
            if (v === undefined || v === item.totalUnits) return
            setLocalUnits(String(v))
            setIsSaving(true)
            setSaveError('')
            try {
              await onUpdateUnits(item._id, v)
            } catch (err) {
              setSaveError(err instanceof Error ? err.message : String(err))
              setLocalUnits(String(item.totalUnits))
            } finally {
              setIsSaving(false)
            }
          }}
          disabled={isSaving}
          error={saveError || undefined}
          aria-label={`Total units for ${item.gearType} ${item.size ?? ''}`}
          className="w-20"
        />
      </td>
      <td className="px-4 py-2.5 text-center">
        <IconButton
          variant="ghost"
          onClick={onDeleteClick}
          aria-label={`Remove ${item.gearType} ${item.size ?? ''}`}
        >
          <Trash2 size={16} />
        </IconButton>
      </td>
    </tr>
  )
}

function AddItemDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: EquipmentInventoryTableProps['onAddItem']
}) {
  const tCommon = useTranslations('common')
  const tBooking = useTranslations('booking')
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
      setError(tCommon('fieldRequired', { field: 'Gear type' }))
      return
    }
    const units = parseInt(totalUnits, 10)
    if (isNaN(units) || units < 1) {
      setError(tCommon('fieldRequired', { field: 'Units' }))
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
    <Dialog open={open} onClose={handleClose} title={tBooking('addInventoryItem')} size="sm" melt={false}>
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
          <input /* design-ok: native checkbox */
            type="checkbox"
            id="add-prescription"
            checked={isPrescription}
            onChange={(e) => setIsPrescription(e.target.checked)}
            className="w-5 h-5 accent-[var(--color-primary)]"
          />
          <label /* design-ok: pairs with native checkbox above */ htmlFor="add-prescription" className="text-body text-primary">
            Prescription mask
          </label>
        </div>
        {isPrescription && (
          <NumberPicker
            label="Diopter"
            min={-6}
            max={3}
            step={0.5}
            decimals={1}
            value={diopter === '' ? undefined : Number(diopter)}
            onChange={(v) => setDiopter(v === undefined ? '' : String(v))}
          />
        )}
        <NumberPicker
          label="Total Units"
          min={1}
          max={500}
          value={totalUnits === '' ? undefined : Number(totalUnits)}
          onChange={(v) => setTotalUnits(v === undefined ? '' : String(v))}
          required
        />
        {error && <InlineError>{error}</InlineError>}
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
