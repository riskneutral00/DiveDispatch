'use client'

import { useMutation, useQuery } from 'convex/react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Package } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import {
  GEAR_TYPES,
  GEAR_TYPE_LABELS,
  MANUFACTURERS,
  ALL_GEAR_SIZING,
  isMatrixGearType,
  finSizesFor,
  type GearType,
  type MatrixGearType,
  type FinSizeSystem,
} from '@/lib/constants/gear-sizing'
import { GEAR_REQUIRED_FIELDS, isGearItemComplete } from '@/lib/constants/gear-required-fields'
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
import { ManufacturerMatrixSection, type InventoryCellRow } from '@/components/inventory/gear-matrix-section'
import { AddGearManufacturerDialog } from '@/components/inventory/add-gear-manufacturer-dialog'

interface InventoryRow {
  _id: string
  inventoryUnitId: string
  gearType: string
  manufacturer?: string
  size?: string
  sizeSystem?: FinSizeSystem
  diopter?: number
  isPrescription?: boolean
  totalUnits: number
}

interface DraftRow {
  localId: string
  gearType: GearType
}

interface PendingMatrix {
  key: string
  manufacturer: string
  sizeSystem?: FinSizeSystem
}

interface PendingRemoveGroup {
  manufacturer: string
  sizeSystem?: FinSizeSystem
  count: number
}

export function ConnectedEquipmentGear() {
  const tCommon = useTranslations('common')
  const tBooking = useTranslations('booking')

  const grouped = useQuery(api.equipmentInventory.listMyInventory)
  const addItemMutation = useMutation(api.equipmentInventory.addItem)
  const updateItemMutation = useMutation(api.equipmentInventory.updateItem)
  const removeItemMutation = useMutation(api.equipmentInventory.removeItem)
  const bulkSetMutation = useMutation(api.equipmentInventory.bulkSetByManufacturer)

  const [activeGearType, setActiveGearType] = useState<GearType>('wetsuit')
  const [pendingRemove, setPendingRemove] = useState<InventoryRow | null>(null)
  const [pendingRemoveGroup, setPendingRemoveGroup] = useState<PendingRemoveGroup | null>(null)
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [addManufacturerOpen, setAddManufacturerOpen] = useState(false)
  const [pendingMatrices, setPendingMatrices] = useState<PendingMatrix[]>([])

  const items = useMemo<InventoryRow[]>(() => {
    if (!grouped) return []
    return (grouped[activeGearType] ?? []).map((it) => ({ ...it }))
  }, [grouped, activeGearType])

  const allItems = useMemo<InventoryRow[]>(() => {
    if (!grouped) return []
    return Object.values(grouped).flat()
  }, [grouped])

  const activeDrafts = useMemo(
    () => drafts.filter((d) => d.gearType === activeGearType),
    [drafts, activeGearType],
  )

  const isMatrix = isMatrixGearType(activeGearType)

  const matrixGroups = useMemo(() => {
    if (!isMatrix) return []
    const byKey = new Map<string, { manufacturer: string; sizeSystem?: FinSizeSystem; rows: InventoryRow[] }>()
    for (const row of items) {
      const m = row.manufacturer
      if (!m) continue
      const key = activeGearType === 'fins' ? `${m}__${row.sizeSystem ?? ''}` : m
      const entry = byKey.get(key)
      if (entry) entry.rows.push(row)
      else byKey.set(key, { manufacturer: m, sizeSystem: row.sizeSystem, rows: [row] })
    }
    return Array.from(byKey.entries()).map(([key, v]) => ({ key, ...v }))
  }, [items, activeGearType, isMatrix])

  const matrixKeysInDb = useMemo(() => new Set(matrixGroups.map((g) => g.key)), [matrixGroups])

  const activePendingMatrices = useMemo(
    () =>
      pendingMatrices.filter((p) => {
        const key = p.key.startsWith(`${activeGearType}__`) ? p.key.slice(activeGearType.length + 2) : null
        return key !== null && !matrixKeysInDb.has(key)
      }),
    [pendingMatrices, activeGearType, matrixKeysInDb],
  )

  const handleAddDraft = useCallback(() => {
    setDrafts((prev) => [
      ...prev,
      { localId: generateLocalId(), gearType: activeGearType },
    ])
  }, [activeGearType])

  const handleDiscardDraft = useCallback((localId: string) => {
    setDrafts((prev) => prev.filter((d) => d.localId !== localId))
  }, [])

  const handleDraftSave = useCallback(
    async (localId: string, payload: {
      gearType: GearType
      manufacturer?: string
      size?: string
      diopter?: number
      isPrescription?: boolean
      totalUnits: number
    }) => {
      await addItemMutation(payload)
      setDrafts((prev) => prev.filter((d) => d.localId !== localId))
    },
    [addItemMutation],
  )

  const handleExistingSave = useCallback(
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

  const handleMatrixBulkSave = useCallback(
    async (manufacturer: string, sizeSystem: FinSizeSystem | undefined, cells: Record<string, number>) => {
      await bulkSetMutation({
        gearType: activeGearType,
        manufacturer,
        ...(sizeSystem !== undefined ? { sizeSystem } : {}),
        cells,
      })
      const localKey = sizeSystem ? `${manufacturer}__${sizeSystem}` : manufacturer
      setPendingMatrices((prev) =>
        prev.filter((p) => p.key !== `${activeGearType}__${localKey}`),
      )
    },
    [bulkSetMutation, activeGearType],
  )

  const handleConfirmGroupRemove = useCallback(async () => {
    if (!pendingRemoveGroup) return
    await bulkSetMutation({
      gearType: activeGearType,
      manufacturer: pendingRemoveGroup.manufacturer,
      ...(pendingRemoveGroup.sizeSystem !== undefined ? { sizeSystem: pendingRemoveGroup.sizeSystem } : {}),
      cells: {},
    })
    setPendingRemoveGroup(null)
  }, [bulkSetMutation, activeGearType, pendingRemoveGroup])

  const handleAddManufacturerConfirm = useCallback(
    (manufacturer: string, sizeSystem?: FinSizeSystem) => {
      const localKey = sizeSystem ? `${manufacturer}__${sizeSystem}` : manufacturer
      const fullKey = `${activeGearType}__${localKey}`
      setPendingMatrices((prev) => {
        if (prev.some((p) => p.key === fullKey)) return prev
        return [...prev, { key: fullKey, manufacturer, sizeSystem }]
      })
      setAddManufacturerOpen(false)
    },
    [activeGearType],
  )

  if (grouped === undefined) {
    return <LoadingCard variant="spinner" message={tCommon('loading')} />
  }

  const activeLabel = GEAR_TYPE_LABELS[activeGearType]
  const recentManufacturers = distinctManufacturers(allItems, activeGearType)

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

      {isMatrix ? (
        <MatrixView
          gearType={activeGearType as MatrixGearType}
          groups={matrixGroups}
          pendingMatrices={activePendingMatrices}
          onBulkSave={handleMatrixBulkSave}
          onRequestRemoveGroup={setPendingRemoveGroup}
          onAddManufacturer={() => setAddManufacturerOpen(true)}
          onDiscardPending={(key) =>
            setPendingMatrices((prev) => prev.filter((p) => p.key !== `${activeGearType}__${key}`))
          }
        />
      ) : (
        <div className="space-y-3">
          {items.length === 0 && activeDrafts.length === 0 ? (
            <Card>
              <EmptyState
                icon={Package}
                message={tBooking('noGearYet', { type: activeLabel.toLowerCase() })}
              />
            </Card>
          ) : (
            <>
              {items.map((item) => (
                <ExistingItemCard
                  key={item._id}
                  item={item}
                  gearType={activeGearType}
                  recentManufacturers={recentManufacturers}
                  onSave={(patch) => handleExistingSave(item._id, patch)}
                  onRemove={() => setPendingRemove(item)}
                />
              ))}
              {activeDrafts.map((draft) => (
                <DraftItemCard
                  key={draft.localId}
                  gearType={draft.gearType}
                  recentManufacturers={recentManufacturers}
                  onSave={(payload) => handleDraftSave(draft.localId, payload)}
                  onDiscard={() => handleDiscardDraft(draft.localId)}
                />
              ))}
            </>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddDraft}
            disabled={activeDrafts.length > 0}
          >
            <Plus size={14} />
            {tBooking('addGearType', { type: activeLabel })}
          </Button>
        </div>
      )}

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

      <ConfirmActionDialog
        open={!!pendingRemoveGroup}
        onClose={() => setPendingRemoveGroup(null)}
        onConfirm={handleConfirmGroupRemove}
        title={tBooking('removeManufacturer', { manufacturer: pendingRemoveGroup?.manufacturer ?? '' })}
        description={tBooking('removeManufacturerConfirm', {
          count: pendingRemoveGroup?.count ?? 0,
          manufacturer: pendingRemoveGroup?.manufacturer ?? '',
          gearType: activeLabel.toLowerCase(),
        })}
        confirmLabel={tCommon('remove')}
        variant="destructive"
      />

      {isMatrix && (
        <AddGearManufacturerDialog
          open={addManufacturerOpen}
          gearType={activeGearType as MatrixGearType}
          existingManufacturers={matrixGroups.map((g) => g.manufacturer)}
          existingFinSystems={
            activeGearType === 'fins'
              ? (matrixGroups
                  .filter((g) => g.sizeSystem !== undefined)
                  .map((g) => g.sizeSystem as FinSizeSystem))
              : []
          }
          onClose={() => setAddManufacturerOpen(false)}
          onConfirm={handleAddManufacturerConfirm}
        />
      )}
    </div>
  )
}

interface MatrixViewProps {
  gearType: MatrixGearType
  groups: Array<{ key: string; manufacturer: string; sizeSystem?: FinSizeSystem; rows: InventoryRow[] }>
  pendingMatrices: PendingMatrix[]
  onBulkSave: (manufacturer: string, sizeSystem: FinSizeSystem | undefined, cells: Record<string, number>) => Promise<void>
  onRequestRemoveGroup: (g: PendingRemoveGroup) => void
  onAddManufacturer: () => void
  onDiscardPending: (key: string) => void
}

function MatrixView({
  gearType,
  groups,
  pendingMatrices,
  onBulkSave,
  onRequestRemoveGroup,
  onAddManufacturer,
  onDiscardPending,
}: MatrixViewProps) {
  const tBooking = useTranslations('booking')

  const hasAny = groups.length > 0 || pendingMatrices.length > 0

  return (
    <div className="space-y-3">
      {!hasAny && (
        <Card>
          <EmptyState
            icon={Package}
            message={tBooking('noGearYet', { type: GEAR_TYPE_LABELS[gearType].toLowerCase() })}
          />
        </Card>
      )}
      {groups.map((group) => {
        const columns = columnsFor(gearType, group.manufacturer, group.sizeSystem)
        const rowsBySize = new Map<string, InventoryCellRow>()
        for (const r of group.rows) {
          if (r.size) rowsBySize.set(r.size, { _id: r._id, size: r.size, totalUnits: r.totalUnits })
        }
        return (
          <ManufacturerMatrixSection
            key={group.key}
            gearType={gearType}
            manufacturer={group.manufacturer}
            sizeSystem={group.sizeSystem}
            columns={columns}
            rowsBySize={rowsBySize}
            onBulkSave={(cells) => onBulkSave(group.manufacturer, group.sizeSystem, cells)}
            onRemoveAll={() =>
              onRequestRemoveGroup({
                manufacturer: group.manufacturer,
                sizeSystem: group.sizeSystem,
                count: group.rows.length,
              })
            }
          />
        )
      })}
      {pendingMatrices.map((pending) => {
        const localKey = pending.sizeSystem ? `${pending.manufacturer}__${pending.sizeSystem}` : pending.manufacturer
        const columns = columnsFor(gearType, pending.manufacturer, pending.sizeSystem)
        return (
          <ManufacturerMatrixSection
            key={pending.key}
            gearType={gearType}
            manufacturer={pending.manufacturer}
            sizeSystem={pending.sizeSystem}
            columns={columns}
            rowsBySize={new Map()}
            onBulkSave={(cells) => onBulkSave(pending.manufacturer, pending.sizeSystem, cells)}
            onRemoveAll={() => onDiscardPending(localKey)}
          />
        )
      })}
      <Button type="button" variant="secondary" size="sm" onClick={onAddManufacturer}>
        <Plus size={14} />
        {tBooking('addManufacturer')}
      </Button>
    </div>
  )
}

function columnsFor(gearType: MatrixGearType, manufacturer: string, sizeSystem?: FinSizeSystem): readonly string[] {
  if (gearType === 'fins') {
    return sizeSystem ? finSizesFor(sizeSystem) : []
  }
  const entries = ALL_GEAR_SIZING.filter(
    (e) => e.manufacturer === manufacturer && e.gearType === gearType,
  )
  return Array.from(new Set(entries.map((e) => e.size)))
}

function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

interface ExistingItemCardProps {
  item: InventoryRow
  gearType: GearType
  recentManufacturers: string[]
  onSave: (patch: Partial<InventoryRow>) => Promise<void>
  onRemove: () => void
}

function ExistingItemCard({ item, gearType, recentManufacturers, onSave, onRemove }: ExistingItemCardProps) {
  return (
    <GearItemCard
      kind="existing"
      gearType={gearType}
      recentManufacturers={recentManufacturers}
      initial={{
        manufacturer: item.manufacturer,
        size: item.size,
        totalUnits: item.totalUnits,
        isPrescription: item.isPrescription,
        diopter: item.diopter,
      }}
      onCommit={onSave}
      onRemove={onRemove}
    />
  )
}

interface DraftItemCardProps {
  gearType: GearType
  recentManufacturers: string[]
  onSave: (payload: {
    gearType: GearType
    manufacturer?: string
    size?: string
    diopter?: number
    isPrescription?: boolean
    totalUnits: number
  }) => Promise<void>
  onDiscard: () => void
}

function DraftItemCard({ gearType, recentManufacturers, onSave, onDiscard }: DraftItemCardProps) {
  return (
    <GearItemCard
      kind="draft"
      gearType={gearType}
      recentManufacturers={recentManufacturers}
      initial={{ totalUnits: 1 }}
      onCommit={async (patch) => {
        await onSave({
          gearType,
          manufacturer: patch.manufacturer,
          size: patch.size,
          diopter: patch.diopter,
          isPrescription: patch.isPrescription,
          totalUnits: patch.totalUnits ?? 1,
        })
      }}
      onRemove={onDiscard}
    />
  )
}

interface GearItemCardProps {
  kind: 'draft' | 'existing'
  gearType: GearType
  recentManufacturers: string[]
  initial: {
    manufacturer?: string
    size?: string
    totalUnits?: number
    isPrescription?: boolean
    diopter?: number
  }
  onCommit: (patch: Partial<InventoryRow>) => Promise<void>
  onRemove: () => void
}

function GearItemCard({ kind, gearType, recentManufacturers, initial, onCommit, onRemove }: GearItemCardProps) {
  const tCommon = useTranslations('common')
  const tBooking = useTranslations('booking')

  const [manufacturer, setManufacturer] = useState(initial.manufacturer ?? '')
  const [size, setSize] = useState(initial.size ?? '')
  const [totalUnits, setTotalUnits] = useState<number>(initial.totalUnits ?? 1)
  const [isPrescription, setIsPrescription] = useState(initial.isPrescription ?? false)
  const [diopter, setDiopter] = useState<number | undefined>(initial.diopter)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const canonicalManufacturers = useMemo<readonly string[]>(() => Array.from(MANUFACTURERS), [])

  const currentState = {
    manufacturer: manufacturer.trim() || undefined,
    size: size.trim() || undefined,
    totalUnits,
    isPrescription,
    diopter,
  }

  const isValid = isGearItemComplete(currentState, gearType)

  const isDirty =
    (initial.manufacturer ?? '') !== manufacturer ||
    (initial.size ?? '') !== size ||
    (initial.totalUnits ?? 1) !== totalUnits ||
    (initial.isPrescription ?? false) !== isPrescription ||
    (initial.diopter ?? undefined) !== diopter

  const requiredFields = GEAR_REQUIRED_FIELDS[gearType]
  const needsManufacturer = requiredFields.includes('manufacturer')
  const needsSize = requiredFields.includes('size')

  const canSave = kind === 'draft' ? isValid : isValid && isDirty

  const handleSave = useCallback(async () => {
    if (!canSave) return
    setSaveError('')
    setSaving(true)
    setSaved(false)
    try {
      const patch: Partial<InventoryRow> = {
        manufacturer: currentState.manufacturer,
        size: currentState.size,
        totalUnits,
        isPrescription,
      }
      if (gearType === 'mask' && isPrescription && typeof diopter === 'number') {
        patch.diopter = diopter
      }
      await onCommit(patch)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [canSave, currentState.manufacturer, currentState.size, totalUnits, isPrescription, diopter, gearType, onCommit])

  const isMask = gearType === 'mask'
  const sizeOptions = canonicalSizesFor(manufacturer, gearType)

  return (
    <ItemCard
      onRemove={onRemove}
      aria-label={tCommon('remove')}
      onSave={handleSave}
      canSave={canSave}
      saving={saving}
      saved={saved}
      save-aria-label={tCommon('save')}
    >
      <div className="flex flex-wrap gap-3">
        <SimpleSelect
          label={tBooking('manufacturer')}
          value={manufacturer}
          onChange={setManufacturer}
          options={[
            ...canonicalManufacturers,
            ...recentManufacturers.filter((m) => m && !canonicalManufacturers.includes(m)),
          ]}
          className="field-select-long"
          required={needsManufacturer}
        />
        {needsSize && (sizeOptions.length > 0 ? (
          <SimpleSelect
            label={tBooking('size')}
            value={size}
            onChange={setSize}
            options={sizeOptions}
            className="field-select-short"
            required
          />
        ) : (
          <Input
            label={tBooking('size')}
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="field-select-short"
            required
          />
        ))}
        <NumberPicker
          label={tBooking('units')}
          min={1}
          max={500}
          value={totalUnits}
          onChange={(v) => { if (v !== undefined) setTotalUnits(v) }}
          className="field-number"
          required
        />
        {isMask && (
          <div className="flex items-center">
            <Checkbox
              label={tBooking('prescription')}
              checked={isPrescription}
              onChange={setIsPrescription}
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
            onChange={setDiopter}
            className="field-number"
            required
          />
        )}
      </div>
      {saveError && <InlineError className="mt-2">{saveError}</InlineError>}
    </ItemCard>
  )
}
