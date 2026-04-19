'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog } from '@/components/ui/dialog'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Button } from '@/components/ui/button'
import {
  MANUFACTURERS,
  FIN_SIZE_SYSTEMS,
  type MatrixGearType,
  type FinSizeSystem,
} from '@/lib/constants/gear-sizing'

interface ExistingGroup {
  manufacturer: string
  sizeSystem?: FinSizeSystem
}

interface Props {
  open: boolean
  gearType: MatrixGearType
  existingGroups: readonly ExistingGroup[]
  onClose: () => void
  onConfirm: (manufacturer: string, sizeSystem?: FinSizeSystem) => void
}

export function AddGearManufacturerDialog({
  open,
  gearType,
  existingGroups,
  onClose,
  onConfirm,
}: Props) {
  const tCommon = useTranslations('common')
  const tBooking = useTranslations('booking')

  const [manufacturer, setManufacturer] = useState('')
  const [sizeSystem, setSizeSystem] = useState<FinSizeSystem>('eu')

  useEffect(() => {
    if (!open) {
      setManufacturer('')
      setSizeSystem('eu')
    }
  }, [open])

  const isFins = gearType === 'fins'

  const existingManufacturerSet = new Set(existingGroups.map((g) => g.manufacturer))

  const manufacturerOptions = MANUFACTURERS.filter((m) =>
    isFins ? true : !existingManufacturerSet.has(m),
  )

  const pairExists = isFins
    ? existingGroups.some(
        (g) => g.manufacturer === manufacturer && g.sizeSystem === sizeSystem,
      )
    : existingManufacturerSet.has(manufacturer)

  const canConfirm = manufacturer.length > 0 && !pairExists

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm(manufacturer, isFins ? sizeSystem : undefined)
    setManufacturer('')
    setSizeSystem('eu')
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={tBooking('addManufacturer')}
      size="sm"
    >
      <div className="space-y-4">
        <SimpleSelect
          label={tBooking('manufacturer')}
          value={manufacturer}
          onChange={setManufacturer}
          options={manufacturerOptions}
          required
        />
        {isFins && (
          <SimpleSelect
            label={tBooking('sizeSystem')}
            value={sizeSystem}
            onChange={(v) => setSizeSystem(v as FinSizeSystem)}
            options={FIN_SIZE_SYSTEMS.map((s) => ({
              value: s,
              label: tBooking(`sizeSystem${s.toUpperCase() as 'EU' | 'US' | 'CM' | 'LETTER'}`),
            }))}
            required
          />
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {tCommon('add')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
