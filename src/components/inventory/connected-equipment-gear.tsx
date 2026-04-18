'use client'

import { useMutation, useQuery } from 'convex/react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Package } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import { GEAR_TYPES, GEAR_TYPE_LABELS, MANUFACTURERS, ALL_GEAR_SIZING, type GearType } from '@/lib/constants/gear-sizing'
import { MenuButton } from '@/components/ui/menu-button'
import { Card } from '@/components/ui/card'
import { ItemCard } from '@/components/ui/item-card'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { NumberPicker } from '@/components/ui/number-picker'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingCard } from '@/components/ui/loading-card'
import { ConfirmActionDialog } from '@/components/ui/confirm-dialog'
import { InlineError } from '@/components/ui/inline-error'

interface InventoryRow {
  _id: string
  inventoryUnitId: string
  gearType: string
  manufacturer?: string
  size?: string
  diopter?: number
  isPrescription?: boolean
  totalUnits: number
}

export function ConnectedEquipmentGear() {
  const tCommon = useTranslations('common')
  const tBooking = useTranslations('booking')

  const grouped = useQuery(api.equipmentInventory.listMyInventory)
  const addItemMutation = useMutation(api.equipmentInventory.addItem)
  const updateItemMutation = useMutation(api.equipmentInventory.updateItem)
  const removeItemMutation = useMutation(api.equipmentInventory.removeItem)

  const [activeGearType, setActiveGearType] = useState<GearType>('wetsuit')
  const [pendingRemove, setPendingRemove] = useState<InventoryRow | null>(null)

  const items = useMemo<InventoryRow[]>(() => {
    if (!grouped) return []
    return (grouped[activeGearType] ?? []).map((it) => ({ ...it }))
  }, [grouped, activeGearType])

  const allItems = useMemo<InventoryRow[]>(() => {
    if (!grouped) return []
    return Object.values(grouped).flat()
  }, [grouped])

  const handleAdd = useCallback(async () => {
    await addItemMutation({
      gearType: activeGearType,
      totalUnits: 1,
    })
  }, [addItemMutation, activeGearType])

  const handleUpdate = useCallback(
    async (inventoryId: string, patch: Partial<InventoryRow>) => {
      const payload: {
        inventoryId: Id<'equipmentInventory'>
        manufacturer?: string
        size?: string
        diopter?: number
        isPrescription?: boolean
        totalUnits?: number
      } = { inventoryId: inventoryId as Id<'equipmentInventory'> }
      if (patch.manufacturer !== undefined) payload.manufacturer = patch.manufacturer
      if (patch.size !== undefined) payload.size = patch.size
      if (patch.diopter !== undefined) payload.diopter = patch.diopter
      if (patch.isPrescription !== undefined) payload.isPrescription = patch.isPrescription
      if (patch.totalUnits !== undefined) payload.totalUnits = patch.totalUnits
      await updateItemMutation(payload)
    },
    [updateItemMutation],
  )

  const handleRemoveConfirmed = useCallback(async () => {
    if (!pendingRemove) return
    await removeItemMutation({
      inventoryId: pendingRemove._id as Id<'equipmentInventory'>,
    })
    setPendingRemove(null)
  }, [pendingRemove, removeItemMutation])

  if (grouped === undefined) {
    return <LoadingCard variant="spinner" message={tCommon('loading')} />
  }

  const activeLabel = GEAR_TYPE_LABELS[activeGearType]

  return (
    <div className="space-y-4">
      <nav
        className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label={tBooking('gearTypes')}
      >
        {GEAR_TYPES.map((gt) => (
          <MenuButton
            key={gt}
            role="tab"
            aria-selected={activeGearType === gt}
            active={activeGearType === gt}
            variant="pill"
            size="sm"
            onClick={() => setActiveGearType(gt)}
          >
            {GEAR_TYPE_LABELS[gt]}
          </MenuButton>
        ))}
      </nav>

      <div className="space-y-3">
        {items.length === 0 ? (
          <Card>
            <EmptyState
              icon={Package}
              message={tBooking('noGearYet', { type: activeLabel.toLowerCase() })}
            />
          </Card>
        ) : (
          items.map((item) => (
            <InventoryItemCard
              key={item._id}
              item={item}
              gearType={activeGearType}
              recentManufacturers={distinctManufacturers(allItems, activeGearType)}
              onUpdate={(patch) => handleUpdate(item._id, patch)}
              onRemove={() => setPendingRemove(item)}
            />
          ))
        )}

        <Button type="button" variant="secondary" size="sm" onClick={handleAdd}>
          <Plus size={14} />
          {tBooking('addGearType', { type: activeLabel })}
        </Button>
      </div>

      <ConfirmActionDialog
        open={!!pendingRemove}
        onClose={() => setPendingRemove(null)}
        onConfirm={handleRemoveConfirmed}
        title={tBooking('removeItem')}
        description={tBooking('removeItemConfirm', {
          item: pendingRemove
            ? `${pendingRemove.manufacturer ? `${pendingRemove.manufacturer} ` : ''}${pendingRemove.gearType}${pendingRemove.size ? ` (${pendingRemove.size})` : ''}`
            : '',
        })}
        confirmLabel={tCommon('remove')}
        variant="destructive"
      />
    </div>
  )
}

function distinctManufacturers(items: InventoryRow[], gearType: GearType): string[] {
  const set = new Set<string>()
  for (const it of items) {
    if (it.gearType === gearType && it.manufacturer) set.add(it.manufacturer)
  }
  return Array.from(set).sort()
}

function canonicalSizesFor(manufacturer: string | undefined, gearType: GearType): string[] {
  if (!manufacturer) return []
  const entries = ALL_GEAR_SIZING.filter(
    (e) => e.manufacturer === manufacturer && e.gearType === gearType,
  )
  return Array.from(new Set(entries.map((e) => e.size)))
}

interface InventoryItemCardProps {
  item: InventoryRow
  gearType: GearType
  recentManufacturers: string[]
  onUpdate: (patch: Partial<InventoryRow>) => Promise<void>
  onRemove: () => void
}

function InventoryItemCard({ item, gearType, recentManufacturers, onUpdate, onRemove }: InventoryItemCardProps) {
  const tCommon = useTranslations('common')
  const tBooking = useTranslations('booking')
  const [manufacturer, setManufacturer] = useState(item.manufacturer ?? '')
  const [size, setSize] = useState(item.size ?? '')
  const [totalUnits, setTotalUnits] = useState(item.totalUnits)
  const [isPrescription, setIsPrescription] = useState(item.isPrescription ?? false)
  const [diopter, setDiopter] = useState<number | undefined>(item.diopter)
  const [saveError, setSaveError] = useState('')

  const canonicalManufacturers = useMemo<readonly string[]>(() => Array.from(MANUFACTURERS), [])

  const runUpdate = async (patch: Partial<InventoryRow>) => {
    setSaveError('')
    try {
      await onUpdate(patch)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleManufacturerChange = async (next: string) => {
    setManufacturer(next)
    if (next === (item.manufacturer ?? '')) return
    await runUpdate({ manufacturer: next })
  }

  const handleSizeChange = async (next: string) => {
    setSize(next)
    if (next === (item.size ?? '')) return
    await runUpdate({ size: next })
  }

  const handleUnitsChange = async (next: number | undefined) => {
    if (next === undefined) return
    setTotalUnits(next)
    if (next === item.totalUnits) return
    setSaveError('')
    try {
      await onUpdate({ totalUnits: next })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
      setTotalUnits(item.totalUnits)
    }
  }

  const handleRxChange = async (next: boolean) => {
    setIsPrescription(next)
    await runUpdate({ isPrescription: next })
  }

  const handleDiopterChange = async (next: number | undefined) => {
    setDiopter(next)
    if (next === undefined || next === item.diopter) return
    await runUpdate({ diopter: next })
  }

  const isMask = gearType === 'mask'
  const sizeOptions = canonicalSizesFor(manufacturer, gearType)

  return (
    <ItemCard onRemove={onRemove} aria-label={tCommon('remove')}>
      <div className="flex flex-wrap gap-3">
        <SimpleSelect
          label={tBooking('manufacturer')}
          value={manufacturer}
          onChange={handleManufacturerChange}
          options={[
            ...canonicalManufacturers,
            ...recentManufacturers.filter((m) => m && !canonicalManufacturers.includes(m)),
          ]}
          className="field-select-long"
        />
        {sizeOptions.length > 0 ? (
          <SimpleSelect
            label={tBooking('size')}
            value={size}
            onChange={handleSizeChange}
            options={sizeOptions}
            className="field-select-short"
          />
        ) : (
          <Input
            label={tBooking('size')}
            value={size}
            onChange={(e) => setSize(e.target.value)}
            onBlur={() => handleSizeChange(size)}
            className="w-16"
          />
        )}
        <NumberPicker
          label={tBooking('units')}
          min={1}
          max={500}
          value={totalUnits}
          onChange={handleUnitsChange}
          className="field-number"
        />
        {isMask && (
          <div className="flex items-center">
            <Checkbox
              label={tBooking('prescription')}
              checked={isPrescription}
              onChange={handleRxChange}
            />
          </div>
        )}
        {isMask && isPrescription && (
          <NumberPicker
            label={tBooking('diopter')}
            min={-6}
            max={3}
            step={0.5}
            decimals={1}
            value={diopter}
            onChange={handleDiopterChange}
            className="field-number"
          />
        )}
      </div>
      {saveError && <InlineError className="mt-2">{saveError}</InlineError>}
    </ItemCard>
  )
}
