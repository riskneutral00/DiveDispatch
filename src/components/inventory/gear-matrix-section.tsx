'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { NumberPicker } from '@/components/ui/number-picker'
import { ItemCard } from '@/components/ui/item-card'
import { SaveButton } from '@/components/ui/save-button'
import { SimpleSelect } from '@/components/ui/simple-select'
import { InlineError } from '@/components/ui/inline-error'
import {
  ALL_GEAR_SIZING,
  FIN_SIZE_SYSTEMS,
  finSizesFor,
  type MatrixGearType,
  type FinSizeSystem,
} from '@/lib/constants/gear-sizing'

export interface InventoryCellRow {
  _id: string
  size?: string
  totalUnits: number
}

export interface BulkSaveArgs {
  previousManufacturer?: string
  previousSizeSystem?: FinSizeSystem
  manufacturer: string
  sizeSystem?: FinSizeSystem
  cells: Record<string, number>
}

interface Props {
  gearType: MatrixGearType
  initialManufacturer?: string
  initialSizeSystem?: FinSizeSystem
  availableManufacturers: readonly string[]
  rowsBySize: Map<string, InventoryCellRow>
  canRemove: boolean
  onBulkSave: (args: BulkSaveArgs) => Promise<void>
  onRemoveAll: () => void
}

export function ManufacturerMatrixSection({
  gearType,
  initialManufacturer,
  initialSizeSystem,
  availableManufacturers,
  rowsBySize,
  canRemove,
  onBulkSave,
  onRemoveAll,
}: Props) {
  const tCommon = useTranslations('common')
  const tBooking = useTranslations('booking')

  const [manufacturer, setManufacturer] = useState(initialManufacturer ?? '')
  const [sizeSystem, setSizeSystem] = useState<FinSizeSystem>(initialSizeSystem ?? 'eu')

  const columns = useMemo<readonly string[]>(() => {
    if (gearType === 'fins') {
      return manufacturer ? finSizesFor(sizeSystem) : []
    }
    if (!manufacturer) return []
    const entries = ALL_GEAR_SIZING.filter(
      (e) => e.manufacturer === manufacturer && e.gearType === gearType,
    )
    return Array.from(new Set(entries.map((e) => e.size)))
  }, [gearType, manufacturer, sizeSystem])

  const initial = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    for (const size of columns) {
      out[size] = rowsBySize.get(size)?.totalUnits ?? 0
    }
    return out
  }, [columns, rowsBySize])

  const [cells, setCells] = useState<Record<string, number>>(initial)
  const [fillValue, setFillValue] = useState<number>(4)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const manufacturerChanged = manufacturer !== (initialManufacturer ?? '')
  const sizeSystemChanged = gearType === 'fins' && sizeSystem !== (initialSizeSystem ?? 'eu') && !!initialSizeSystem

  const cellsChanged = useMemo(() => {
    for (const size of columns) {
      if ((cells[size] ?? 0) !== (initial[size] ?? 0)) return true
    }
    return false
  }, [cells, columns, initial])

  const isDirty = cellsChanged || manufacturerChanged || sizeSystemChanged

  const hasAnyNonZero = useMemo(() => Object.values(cells).some((v) => v > 0), [cells])
  const hasExistingRows = rowsBySize.size > 0
  const canSave = manufacturer.length > 0 && isDirty && (hasAnyNonZero || hasExistingRows)

  const handleCellChange = useCallback((size: string, v: number | undefined) => {
    setCells((prev) => ({ ...prev, [size]: v ?? 0 }))
  }, [])

  const handleFillAll = useCallback(() => {
    const next: Record<string, number> = {}
    for (const size of columns) next[size] = fillValue
    setCells(next)
  }, [columns, fillValue])

  const handleSave = useCallback(async () => {
    setSaveError('')
    setSaving(true)
    setSaved(false)
    try {
      await onBulkSave({
        previousManufacturer: initialManufacturer,
        previousSizeSystem: initialSizeSystem,
        manufacturer,
        ...(gearType === 'fins' ? { sizeSystem } : {}),
        cells,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [cells, manufacturer, sizeSystem, gearType, initialManufacturer, initialSizeSystem, onBulkSave])

  return (
    <ItemCard
      onRemove={canRemove ? onRemoveAll : undefined}
      aria-label={tBooking('removeManufacturer', { manufacturer: manufacturer || tBooking('manufacturer') })}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <SimpleSelect
            label={tBooking('manufacturer')}
            value={manufacturer}
            onChange={setManufacturer}
            options={availableManufacturers}
            className="field-select-long"
          />
          {gearType === 'fins' && (
            <SimpleSelect
              label={tBooking('sizeSystem')}
              value={sizeSystem}
              onChange={(v) => setSizeSystem(v as FinSizeSystem)}
              options={FIN_SIZE_SYSTEMS.map((s) => ({
                value: s,
                label: tBooking(`sizeSystem${s.toUpperCase() as 'EU' | 'US' | 'CM' | 'LETTER'}`),
              }))}
              className="field-select-short"
            />
          )}
        </div>

        {columns.length > 0 && (
          <>
            <div className="flex items-end gap-2">
              <NumberPicker
                label={tBooking('fillAllWith')}
                min={0}
                max={20}
                value={fillValue}
                onChange={(v) => { if (v !== undefined) setFillValue(v) }}
                className="field-number"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleFillAll}
              >
                {tBooking('apply')}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {columns.map((size) => (
                <NumberPicker
                  key={size}
                  label={size}
                  min={0}
                  max={500}
                  value={cells[size] ?? 0}
                  onChange={(v) => handleCellChange(size, v)}
                />
              ))}
            </div>
          </>
        )}

        <SaveButton
          saving={saving}
          saved={saved}
          isDirty={isDirty}
          isUpdate
          disabled={!canSave}
          onClick={handleSave}
          label={tCommon('save')}
        />
        {manufacturer.length > 0 && !hasAnyNonZero && !hasExistingRows && (
          <p className="text-body text-secondary text-right">{tBooking('addAtLeastOneSize')}</p>
        )}
        {saveError && <InlineError>{saveError}</InlineError>}
      </div>
    </ItemCard>
  )
}
