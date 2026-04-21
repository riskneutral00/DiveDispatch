'use client'

import { useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Check } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import {
  GEAR_TYPES,
  GEAR_TYPE_LABELS,
  MANUFACTURERS,
  ALL_GEAR_SIZING,
  isMatrixGearType,
  type GearType,
  type MatrixGearType,
  type FinSizeSystem,
} from '@/lib/constants/gear-sizing'
import { PLANO_KEY, diopterCellKey } from '@/lib/constants/diopters'
import { GEAR_REQUIRED_FIELDS, isGearItemComplete } from '@/lib/constants/gear-required-fields'
import { MenuButton } from '@/components/ui/menu-button'
import { ItemCard } from '@/components/ui/item-card'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Input } from '@/components/ui/input'
import { NumberPicker } from '@/components/ui/number-picker'
import { Button } from '@/components/ui/button'
import { LoadingCard } from '@/components/ui/loading-card'
import { ConfirmActionDialog } from '@/components/ui/confirm-dialog'
import { InlineError } from '@/components/ui/inline-error'
import { RequiredAsterisk } from '@/components/ui/required-asterisk'
import {
  ManufacturerMatrixSection,
  type InventoryCellRow,
  type BulkSaveArgs,
} from '@/components/inventory/gear-matrix-section'

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
  localId: string
  gearType: MatrixGearType
  optimisticManufacturer?: string
  optimisticSizeSystem?: FinSizeSystem
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
  const renameGroupMutation = useMutation(api.equipmentInventory.renameManufacturerGroup)
  const bulkSetMasksMutation = useMutation(api.equipmentInventory.bulkSetMasksByManufacturer)
  const renameMaskGroupMutation = useMutation(api.equipmentInventory.renameMaskManufacturerGroup)

  const [activeGearType, setActiveGearType] = useState<GearType>('wetsuit')
  const [pendingRemove, setPendingRemove] = useState<InventoryRow | null>(null)
  const [pendingRemoveGroup, setPendingRemoveGroup] = useState<PendingRemoveGroup | null>(null)
  const [drafts, setDrafts] = useState<DraftRow[]>([])
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

  const activePendingMatrices = useMemo(
    () => pendingMatrices.filter((p) => p.gearType === activeGearType),
    [pendingMatrices, activeGearType],
  )

  const tabStatus = useMemo<Record<GearType, 'complete' | 'incomplete'>>(() => {
    const out = {} as Record<GearType, 'complete' | 'incomplete'>
    for (const gt of GEAR_TYPES) {
      const gearItems = grouped?.[gt] ?? []
      out[gt] = gearItems.some((item) => isGearItemComplete(item, gt)) ? 'complete' : 'incomplete'
    }
    return out
  }, [grouped])

  const hasAutoSeededRef = useRef<Partial<Record<GearType, boolean>>>({})

  useEffect(() => {
    if (grouped === undefined) return
    if (hasAutoSeededRef.current[activeGearType]) return
    const tabItems = grouped[activeGearType] ?? []
    if (tabItems.length > 0) {
      hasAutoSeededRef.current[activeGearType] = true
      return
    }
    hasAutoSeededRef.current[activeGearType] = true
    if (isMatrixGearType(activeGearType)) {
      const gt = activeGearType
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- comments-ok one-shot auto-seed per gearType, ref-guarded against re-run */
      setPendingMatrices((prev) =>
        prev.some((p) => p.gearType === gt)
          ? prev
          : [...prev, { localId: generateLocalId(), gearType: gt }],
      )
    } else {
      setDrafts((prev) =>
        prev.some((d) => d.gearType === activeGearType)
          ? prev
          : [...prev, { localId: generateLocalId(), gearType: activeGearType }],
      )
    }
  }, [grouped, activeGearType])

  useEffect(() => {
    setPendingMatrices((prev) => {
      const stillPending = prev.filter((p) => {
        if (!p.optimisticManufacturer) return true
        const matched = matrixGroups.some((g) =>
          g.manufacturer === p.optimisticManufacturer &&
          (p.gearType !== 'fins' || g.sizeSystem === p.optimisticSizeSystem),
        )
        return !matched
      })
      return stillPending.length === prev.length ? prev : stillPending
    })
  }, [matrixGroups])

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
    async (pendingLocalId: string | undefined, args: BulkSaveArgs) => {
      const { previousManufacturer, previousSizeSystem, manufacturer, sizeSystem, cells } = args
      const gearType = activeGearType as MatrixGearType

      const manufacturerChanged = previousManufacturer !== undefined && previousManufacturer !== manufacturer
      const sizeSystemChanged = gearType === 'fins' && previousSizeSystem !== undefined && previousSizeSystem !== sizeSystem

      if (gearType === 'mask') {
        if (manufacturerChanged && previousManufacturer !== undefined) {
          await renameMaskGroupMutation({ previousManufacturer, manufacturer })
        }
        await bulkSetMasksMutation({ manufacturer, cells })
      } else {
        if ((manufacturerChanged || sizeSystemChanged) && previousManufacturer !== undefined) {
          await renameGroupMutation({
            gearType,
            previousManufacturer,
            ...(previousSizeSystem !== undefined ? { previousSizeSystem } : {}),
            manufacturer,
            ...(sizeSystem !== undefined ? { sizeSystem } : {}),
          })
        }

        await bulkSetMutation({
          gearType,
          manufacturer,
          ...(sizeSystem !== undefined ? { sizeSystem } : {}),
          cells,
        })
      }

      if (pendingLocalId) {
        setPendingMatrices((prev) =>
          prev.map((p) =>
            p.localId === pendingLocalId
              ? { ...p, optimisticManufacturer: manufacturer, optimisticSizeSystem: sizeSystem }
              : p,
          ),
        )
      }
    },
    [activeGearType, renameGroupMutation, bulkSetMutation, renameMaskGroupMutation, bulkSetMasksMutation],
  )

  const handleConfirmGroupRemove = useCallback(async () => {
    if (!pendingRemoveGroup) return
    if (activeGearType === 'mask') {
      await bulkSetMasksMutation({
        manufacturer: pendingRemoveGroup.manufacturer,
        cells: {},
      })
    } else {
      await bulkSetMutation({
        gearType: activeGearType,
        manufacturer: pendingRemoveGroup.manufacturer,
        ...(pendingRemoveGroup.sizeSystem !== undefined ? { sizeSystem: pendingRemoveGroup.sizeSystem } : {}),
        cells: {},
      })
    }
    setPendingRemoveGroup(null)
  }, [bulkSetMutation, bulkSetMasksMutation, activeGearType, pendingRemoveGroup])

  const handleAddAnotherMatrix = useCallback(() => {
    if (!isMatrixGearType(activeGearType)) return
    const gt = activeGearType
    setPendingMatrices((prev) => [...prev, { localId: generateLocalId(), gearType: gt }])
  }, [activeGearType])

  const handleDiscardPending = useCallback((localId: string) => {
    setPendingMatrices((prev) => prev.filter((p) => p.localId !== localId))
  }, [])

  if (grouped === undefined) {
    return <LoadingCard variant="spinner" message={tCommon('loading')} />
  }

  const activeLabel = GEAR_TYPE_LABELS[activeGearType]
  const recentManufacturers = distinctManufacturers(allItems, activeGearType)

  const itemCardCount = items.length + activeDrafts.length
  const canRemoveItemCard = itemCardCount > 1

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
            {tabStatus[gt] === 'complete' ? (
              <Check size={12} className="text-success" aria-hidden />
            ) : (
              <RequiredAsterisk />
            )}
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
          onAddAnother={handleAddAnotherMatrix}
          onDiscardPending={handleDiscardPending}
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ExistingItemCard
              key={item._id}
              item={item}
              gearType={activeGearType}
              recentManufacturers={recentManufacturers}
              onSave={(patch) => handleExistingSave(item._id, patch)}
              onRemove={canRemoveItemCard ? () => setPendingRemove(item) : undefined}
            />
          ))}
          {activeDrafts.map((draft) => (
            <DraftItemCard
              key={draft.localId}
              gearType={draft.gearType}
              recentManufacturers={recentManufacturers}
              onSave={(payload) => handleDraftSave(draft.localId, payload)}
              onDiscard={canRemoveItemCard ? () => handleDiscardDraft(draft.localId) : undefined}
            />
          ))}

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
    </div>
  )
}

interface MatrixViewProps {
  gearType: MatrixGearType
  groups: Array<{ key: string; manufacturer: string; sizeSystem?: FinSizeSystem; rows: InventoryRow[] }>
  pendingMatrices: PendingMatrix[]
  onBulkSave: (pendingLocalId: string | undefined, args: BulkSaveArgs) => Promise<void>
  onRequestRemoveGroup: (g: PendingRemoveGroup) => void
  onAddAnother: () => void
  onDiscardPending: (localId: string) => void
}

function MatrixView({
  gearType,
  groups,
  pendingMatrices,
  onBulkSave,
  onRequestRemoveGroup,
  onAddAnother,
  onDiscardPending,
}: MatrixViewProps) {
  const tBooking = useTranslations('booking')

  const canonicalManufacturers = useMemo<readonly string[]>(() => Array.from(MANUFACTURERS), [])

  const visiblePending = useMemo(
    () => pendingMatrices.filter((p) => {
      if (!p.optimisticManufacturer) return true
      return !groups.some((g) =>
        g.manufacturer === p.optimisticManufacturer &&
        (p.gearType !== 'fins' || g.sizeSystem === p.optimisticSizeSystem),
      )
    }),
    [pendingMatrices, groups],
  )

  const totalBlocks = groups.length + visiblePending.length
  const canRemove = totalBlocks > 1

  const availableFor = useCallback(
    (selfManufacturer?: string): readonly string[] => {
      if (gearType === 'fins') return canonicalManufacturers
      const usedByOthers = new Set(
        groups
          .filter((g) => g.manufacturer !== selfManufacturer)
          .map((g) => g.manufacturer),
      )
      return canonicalManufacturers.filter((m) => !usedByOthers.has(m))
    },
    [gearType, canonicalManufacturers, groups],
  )

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const rowsBySize = new Map<string, InventoryCellRow>()
        for (const r of group.rows) {
          if (gearType === 'mask') {
            const key = r.isPrescription && typeof r.diopter === 'number' ? diopterCellKey(r.diopter) : PLANO_KEY
            rowsBySize.set(key, { _id: r._id, totalUnits: r.totalUnits })
          } else if (r.size) {
            rowsBySize.set(r.size, { _id: r._id, size: r.size, totalUnits: r.totalUnits })
          }
        }
        return (
          <ManufacturerMatrixSection
            key={group.key}
            gearType={gearType}
            initialManufacturer={group.manufacturer}
            initialSizeSystem={group.sizeSystem}
            availableManufacturers={availableFor(group.manufacturer)}
            rowsBySize={rowsBySize}
            canRemove={canRemove}
            onBulkSave={(args) => onBulkSave(undefined, args)}
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
      {visiblePending.map((pending) => (
        <ManufacturerMatrixSection
          key={pending.localId}
          gearType={gearType}
          availableManufacturers={availableFor(undefined)}
          rowsBySize={new Map()}
          canRemove={canRemove}
          onBulkSave={(args) => onBulkSave(pending.localId, args)}
          onRemoveAll={() => onDiscardPending(pending.localId)}
        />
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={onAddAnother}>
        <Plus size={14} />
        {tBooking('addManufacturer')}
      </Button>
    </div>
  )
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
  onRemove?: () => void
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
  onDiscard?: () => void
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
  }
  onCommit: (patch: Partial<InventoryRow>) => Promise<void>
  onRemove?: () => void
}

function GearItemCard({ kind, gearType, recentManufacturers, initial, onCommit, onRemove }: GearItemCardProps) {
  const tCommon = useTranslations('common')
  const tBooking = useTranslations('booking')

  const [manufacturer, setManufacturer] = useState(initial.manufacturer ?? '')
  const [size, setSize] = useState(initial.size ?? '')
  const [totalUnits, setTotalUnits] = useState<number>(initial.totalUnits ?? 1)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const canonicalManufacturers = useMemo<readonly string[]>(() => Array.from(MANUFACTURERS), [])

  const currentState = {
    manufacturer: manufacturer.trim() || undefined,
    size: size.trim() || undefined,
    totalUnits,
  }

  const isValid = isGearItemComplete(currentState, gearType)

  const isDirty =
    (initial.manufacturer ?? '') !== manufacturer ||
    (initial.size ?? '') !== size ||
    (initial.totalUnits ?? 1) !== totalUnits

  const needsSize = GEAR_REQUIRED_FIELDS[gearType].includes('size')

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
      }
      await onCommit(patch)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [canSave, currentState.manufacturer, currentState.size, totalUnits, onCommit])

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
        />
        {needsSize && (sizeOptions.length > 0 ? (
          <SimpleSelect
            label={tBooking('size')}
            value={size}
            onChange={setSize}
            options={sizeOptions}
            className="field-select-short"
          />
        ) : (
          <Input
            label={tBooking('size')}
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="field-select-short"
          />
        ))}
        <NumberPicker
          label={tBooking('units')}
          min={1}
          max={500}
          value={totalUnits}
          onChange={(v) => { if (v !== undefined) setTotalUnits(v) }}
          className="field-number"
        />
      </div>
      {saveError && <InlineError className="mt-2">{saveError}</InlineError>}
    </ItemCard>
  )
}
