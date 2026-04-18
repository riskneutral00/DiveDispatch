'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { NumberPicker } from '@/components/ui/number-picker'
import { ItemCard } from '@/components/ui/item-card'
import { SaveButton } from '@/components/ui/save-button'
import { InlineError } from '@/components/ui/inline-error'
import type { MatrixGearType, FinSizeSystem } from '@/lib/constants/gear-sizing'

export interface InventoryCellRow {
  _id: string
  size?: string
  totalUnits: number
}

interface Props {
  gearType: MatrixGearType
  manufacturer: string
  sizeSystem?: FinSizeSystem
  columns: readonly string[]
  rowsBySize: Map<string, InventoryCellRow>
  onBulkSave: (cells: Record<string, number>) => Promise<void>
  onRemoveAll: () => void
}

export function ManufacturerMatrixSection({
  gearType,
  manufacturer,
  sizeSystem,
  columns,
  rowsBySize,
  onBulkSave,
  onRemoveAll,
}: Props) {
  const tCommon = useTranslations('common')
  const tBooking = useTranslations('booking')

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

  const isDirty = useMemo(() => {
    for (const size of columns) {
      if ((cells[size] ?? 0) !== (initial[size] ?? 0)) return true
    }
    return false
  }, [cells, columns, initial])

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
      await onBulkSave(cells)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [cells, onBulkSave])

  const titleSuffix = gearType === 'fins' && sizeSystem
    ? ` · ${tBooking(`sizeSystem${sizeSystem.toUpperCase() as 'EU' | 'US' | 'CM' | 'LETTER'}`)}`
    : ''

  return (
    <ItemCard onRemove={onRemoveAll} aria-label={tBooking('removeManufacturer', { manufacturer })}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading text-primary text-base">
            {manufacturer}
            <span className="text-secondary text-body font-normal">{titleSuffix}</span>
          </h3>
        </div>

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

        <SaveButton
          saving={saving}
          saved={saved}
          isDirty={isDirty}
          isUpdate
          onClick={handleSave}
          label={tCommon('save')}
        />
        {saveError && <InlineError>{saveError}</InlineError>}
      </div>
    </ItemCard>
  )
}
