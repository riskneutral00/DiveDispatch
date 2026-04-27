'use client'

import { useTranslations } from 'next-intl'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckboxGroup } from '@/components/ui/checkbox-group'
import { NumberPicker } from '@/components/ui/number-picker'
import { FieldRow } from '@/components/ui/field-row'
import {
  GAS_MIX_OPTIONS,
  NITROX_MIN_PERCENT,
  NITROX_MAX_PERCENT,
  NITROX_DEFAULT_MIN,
  NITROX_DEFAULT_MAX,
  type GasMix,
} from '@/lib/constants/gas-mixes'

export interface GasMixFieldsValue {
  hasCompressor: boolean
  gasMixes: GasMix[]
  nitroxMin: number | undefined
  nitroxMax: number | undefined
}

export interface GasMixFieldsProps {
  checkboxLabel?: string
  groupLabel?: string
  alwaysOn?: boolean
  required?: boolean
  error?: string
  value: GasMixFieldsValue
  onChange: (next: GasMixFieldsValue) => void
}

export function GasMixFields({
  checkboxLabel,
  groupLabel,
  alwaysOn = false,
  required = false,
  error,
  value,
  onChange,
}: GasMixFieldsProps) {
  const t = useTranslations('common')
  const handleToggle = (checked: boolean) => {
    if (checked) {
      onChange({
        ...value,
        hasCompressor: true,
        gasMixes: value.gasMixes.length > 0 ? value.gasMixes : (['air'] as GasMix[]),
      })
    } else {
      onChange({ ...value, hasCompressor: false })
    }
  }

  const handleGasMixes = (values: string[]) => {
    const next = values as GasMix[]
    onChange({
      ...value,
      gasMixes: next,
      nitroxMin: next.includes('nitrox') && value.nitroxMin === undefined ? NITROX_DEFAULT_MIN : value.nitroxMin,
      nitroxMax: next.includes('nitrox') && value.nitroxMax === undefined ? NITROX_DEFAULT_MAX : value.nitroxMax,
    })
  }

  const showFields = alwaysOn || value.hasCompressor

  return (
    <div>
      {!alwaysOn && (
        <Checkbox label={checkboxLabel ?? ''} checked={value.hasCompressor} onChange={handleToggle} />
      )}
      {showFields && (
        <div className={alwaysOn ? 'space-y-3' : 'mt-3 space-y-3'}>
          <CheckboxGroup
            label={groupLabel ?? t('gasMixesAvailable')}
            items={GAS_MIX_OPTIONS.map(({ value: v, label }) => ({ value: v, label }))}
            selected={value.gasMixes}
            onChange={handleGasMixes}
            columns={2}
            required={required}
            error={error}
          />
          {value.gasMixes.includes('nitrox') && (
            <FieldRow density="compact">
              <NumberPicker
                className="field-sm"
                label={t('nitroxMinPercent')}
                value={value.nitroxMin}
                onChange={(v) => onChange({ ...value, nitroxMin: v })}
                min={NITROX_MIN_PERCENT}
                max={NITROX_MAX_PERCENT}
                suffix="%"
              />
              <NumberPicker
                className="field-sm"
                label={t('nitroxMaxPercent')}
                value={value.nitroxMax}
                onChange={(v) => onChange({ ...value, nitroxMax: v })}
                min={NITROX_MIN_PERCENT}
                max={NITROX_MAX_PERCENT}
                suffix="%"
              />
            </FieldRow>
          )}
        </div>
      )}
    </div>
  )
}
