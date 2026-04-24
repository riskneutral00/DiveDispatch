'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { FieldRow } from '@/components/ui/field-row'
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
import { DIOPTER_VALUES, PLANO_KEY, diopterCellKey } from '@/lib/constants/diopters'

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

  const isMask = gearType === 'mask'

  const columns = useMemo<readonly string[]>(() => {
    if (isMask) {
      return manufacturer ? DIOPTER_VALUES.map(diopterCellKey) : []
    }
    if (gearType === 'fins') {
      return manufacturer ? finSizesFor(sizeSystem) : []
    }
    if (!manufacturer) return []
    const entries = ALL_GEAR_SIZING.filter(
      (e) => e.manufacturer === manufacturer && e.gearType === gearType,
    )
    return Array.from(new Set(entries.map((e) => e.size)))
  }, [gearType, isMask, manufacturer, sizeSystem])

  const initial = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    for (const col of columns) {
      out[col] = rowsBySize.get(col)?.totalUnits ?? 0
    }
    if (isMask) {
      out[PLANO_KEY] = rowsBySize.get(PLANO_KEY)?.totalUnits ?? 0
    }
    return out
  }, [columns, rowsBySize, isMask])

  const [cells, setCells] = useState<Record<string, number>>(initial)
  const [fillValue, setFillValue] = useState<number>(4)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const manufacturerChanged = manufacturer !== (initialManufacturer ?? '')
  const sizeSystemChanged = gearType === 'fins' && sizeSystem !== (initialSizeSystem ?? 'eu') && !!initialSizeSystem

  const cellsChanged = useMemo(() => {
    for (const col of columns) {
      if ((cells[col] ?? 0) !== (initial[col] ?? 0)) return true
    }
    if (isMask && (cells[PLANO_KEY] ?? 0) !== (initial[PLANO_KEY] ?? 0)) return true
    return false
  }, [cells, columns, initial, isMask])

  const isDirty = cellsChanged || manufacturerChanged || sizeSystemChanged

  const hasAnyNonZero = useMemo(() => {
    for (const col of columns) {
      if ((cells[col] ?? 0) > 0) return true
    }
    if (isMask && (cells[PLANO_KEY] ?? 0) > 0) return true
    return false
  }, [cells, columns, isMask])
  const hasExistingRows = rowsBySize.size > 0
  const canSave = manufacturer.length > 0 && isDirty && (hasAnyNonZero || hasExistingRows)

  const handleCellChange = useCallback((col: string, v: number | undefined) => {
    setCells((prev) => ({ ...prev, [col]: v ?? 0 }))
  }, [])

  const handleFillAll = useCallback(() => {
    setCells((prev) => {
      const next: Record<string, number> = { ...prev }
      for (const col of columns) next[col] = fillValue
      return next
    })
  }, [columns, fillValue])

  const handleSave = useCallback(async () => {
    setSaveError('')
    setSaving(true)
    setSaved(false)
    try {
      const payloadCells: Record<string, number> = {}
      for (const col of columns) payloadCells[col] = cells[col] ?? 0
      if (isMask) payloadCells[PLANO_KEY] = cells[PLANO_KEY] ?? 0
      await onBulkSave({
        previousManufacturer: initialManufacturer,
        previousSizeSystem: initialSizeSystem,
        manufacturer,
        ...(gearType === 'fins' ? { sizeSystem } : {}),
        cells: payloadCells,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [cells, columns, manufacturer, sizeSystem, gearType, isMask, initialManufacturer, initialSizeSystem, onBulkSave])

  const emptyHintKey = isMask ? 'addAtLeastOneQty' : 'addAtLeastOneSize'

  return (
    <ItemCard
      onRemove={canRemove ? onRemoveAll : undefined}
      aria-label={tBooking('removeManufacturer', { manufacturer: manufacturer || tBooking('manufacturer') })}
    >
      <div className="space-y-3">
        <FieldRow density="compact">
          <SimpleSelect
            label={tBooking('manufacturer')}
            value={manufacturer}
            onChange={setManufacturer}
            options={availableManufacturers}
            className="field-lg"
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
              className="field-sm"
            />
          )}
        </FieldRow>

        {columns.length > 0 && (
          <>
            <div className="flex items-end gap-2">
              <NumberPicker
                label={tBooking('fillAllWith')}
                min={0}
                max={20}
                value={fillValue}
                onChange={(v) => { if (v !== undefined) setFillValue(v) }}
                className="field-xs"
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

            {isMask && (
              <div className="flex flex-col gap-1">
                <NumberPicker
                  label={tBooking('noPrescription')}
                  min={0}
                  max={500}
                  value={cells[PLANO_KEY] ?? 0}
                  onChange={(v) => handleCellChange(PLANO_KEY, v)}
                  className="field-xs"
                />
                <p className="text-body text-secondary">{tBooking('prescriptionStrength')}</p>
              </div>
            )}

            <div className={isMask ? 'grid grid-cols-1 sm:grid-cols-4 md:grid-cols-6 gap-3' : 'grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3'}>
              {columns.map((col) => (
                <NumberPicker
                  key={col}
                  label={col}
                  min={0}
                  max={500}
                  value={cells[col] ?? 0}
                  onChange={(v) => handleCellChange(col, v)}
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
          <p className="text-body text-secondary text-right">{tBooking(emptyHintKey)}</p>
        )}
        {saveError && <InlineError>{saveError}</InlineError>}
      </div>
    </ItemCard>
  )
}
