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

export interface CompressorGasMixFieldsValue {
  hasCompressor: boolean
  gasMixes: GasMix[]
  nitroxMin: number | undefined
  nitroxMax: number | undefined
}

export interface CompressorGasMixFieldsProps {
  checkboxLabel: string
  value: CompressorGasMixFieldsValue
  onChange: (next: CompressorGasMixFieldsValue) => void
}

export function CompressorGasMixFields({
  checkboxLabel,
  value,
  onChange,
}: CompressorGasMixFieldsProps) {
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

  return (
    <div>
      <Checkbox label={checkboxLabel} checked={value.hasCompressor} onChange={handleToggle} />
      {value.hasCompressor && (
        <div className="mt-3 space-y-3">
          <CheckboxGroup
            label={t('gasMixesAvailable')}
            items={GAS_MIX_OPTIONS.map(({ value: v, label }) => ({ value: v, label }))}
            selected={value.gasMixes}
            onChange={handleGasMixes}
            columns={2}
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
