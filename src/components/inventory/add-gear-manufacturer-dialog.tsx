'use client'

import { useState } from 'react'
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

interface Props {
  open: boolean
  gearType: MatrixGearType
  existingManufacturers: readonly string[]
  existingFinSystems?: readonly FinSizeSystem[]
  onClose: () => void
  onConfirm: (manufacturer: string, sizeSystem?: FinSizeSystem) => void
}

export function AddGearManufacturerDialog({
  open,
  gearType,
  existingManufacturers,
  existingFinSystems = [],
  onClose,
  onConfirm,
}: Props) {
  const tCommon = useTranslations('common')
  const tBooking = useTranslations('booking')

  const [manufacturer, setManufacturer] = useState('')
  const [sizeSystem, setSizeSystem] = useState<FinSizeSystem>('eu')

  const manufacturerOptions = MANUFACTURERS.filter((m) =>
    gearType === 'fins'
      ? true
      : !existingManufacturers.includes(m),
  )

  const isFins = gearType === 'fins'

  const canConfirm = manufacturer.length > 0 && (
    !isFins ||
    !(existingManufacturers.includes(manufacturer) && existingFinSystems.includes(sizeSystem))
  )

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
