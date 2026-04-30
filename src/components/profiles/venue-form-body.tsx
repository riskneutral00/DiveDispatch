'use client'

import { useTranslations } from 'next-intl'
import { NameField } from '@/components/ui/name-field'
import { NumberPicker } from '@/components/ui/number-picker'
import { EmailField } from '@/components/ui/email-field'
import { PhoneField } from '@/components/ui/phone-field'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckboxGroup } from '@/components/ui/checkbox-group'
import { LocationPicker, type LocationValue } from '@/components/profiles/location-picker'
import { GasMixFields } from '@/components/capabilities/gas-mix-fields'
import {
  AccessControlSection,
  type AccessControlState,
} from '@/components/profiles/access-control-section'
import {
  RANGE_BY_KIND,
  VENUE_FEATURES,
  type VenueFeature,
  type VenueKind,
} from '@/lib/constants/venue-subtypes'
import type { GasMix } from '@/lib/constants/gas-mixes'

export interface VenueFormValue {
  name: string
  email: string
  phone: string
  location: LocationValue | null
  maxDepth: number
  maxCapacity: number
  confinedCapable: boolean
  features: VenueFeature[]
  isAllowed: string[]
  notAllowed: string[]
  hasCompressorOnSite: boolean
  compressorGasMixes?: GasMix[]
  compressorNitroxMin?: number
  compressorNitroxMax?: number
}

export const EMPTY_VENUE_FORM: VenueFormValue = {
  name: '',
  email: '',
  phone: '',
  location: null,
  maxDepth: 0,
  maxCapacity: 0,
  confinedCapable: false,
  features: [],
  isAllowed: [],
  notAllowed: [],
  hasCompressorOnSite: false,
  compressorGasMixes: [],
  compressorNitroxMin: undefined,
  compressorNitroxMax: undefined,
}

export function isVenueFormSubmittable(form: VenueFormValue, kind: VenueKind): boolean {
  const baseValid =
    form.name.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    form.location !== null &&
    form.maxDepth > 0
  if (kind === 'pool') return baseValid && form.maxCapacity > 0
  return baseValid
}

interface VenueFormBodyProps {
  kind: VenueKind
  value: VenueFormValue
  onChange: (next: VenueFormValue) => void
}

export function VenueFormBody({ kind, value, onChange }: VenueFormBodyProps) {
  const t = useTranslations('common')
  const range = RANGE_BY_KIND[kind]
  const isPool = kind === 'pool'

  const accessValue: AccessControlState = {
    mode:
      value.isAllowed.length > 0
        ? 'allowlist'
        : value.notAllowed.length > 0
          ? 'blocklist'
          : 'open',
    isAllowed: value.isAllowed,
    notAllowed: value.notAllowed,
  }

  return (
    <div className="space-y-4">
      <NameField
        scope="organization"
        label={isPool ? t('poolName') : t('diveSiteName')}
        value={value.name}
        onChange={(v) => onChange({ ...value, name: v })}
        required
      />
      <EmailField
        label={t('email')}
        value={value.email}
        onChange={(v) => onChange({ ...value, email: v })}
        required
      />
      <PhoneField
        label={t('phone')}
        value={value.phone}
        onChange={(v) => onChange({ ...value, phone: v })}
        required
      />
      <LocationPicker
        label={t('location')}
        value={value.location}
        onChange={(loc) => onChange({ ...value, location: loc })}
        required
      />
      <div className="flex flex-wrap gap-3">
        <NumberPicker
          label={t('maxDepthM')}
          value={value.maxDepth || undefined}
          onChange={(v) => onChange({ ...value, maxDepth: v ?? 0 })}
          min={1}
          max={range.maxDepth}
          step={0.5}
          decimals={1}
          required
        />
        {isPool && (
          <NumberPicker
            label={t('maxCapacity')}
            value={value.maxCapacity || undefined}
            onChange={(v) => onChange({ ...value, maxCapacity: v ?? 0 })}
            min={1}
            max={range.maxCapacity}
            required
          />
        )}
        {!isPool && (
          <Checkbox
            label={t('confinedCapable')}
            checked={value.confinedCapable}
            onChange={(checked) => onChange({ ...value, confinedCapable: checked })}
          />
        )}
      </div>
      {!isPool && (
        <CheckboxGroup
          label={t('features')}
          items={VENUE_FEATURES.map((f) => ({ value: f, label: t(`venueFeatures.${f}`) }))}
          selected={value.features}
          onChange={(next) => onChange({ ...value, features: next as VenueFeature[] })}
        />
      )}
      {!isPool && (
        <AccessControlSection
          value={accessValue}
          onChange={(next) =>
            onChange({ ...value, isAllowed: next.isAllowed, notAllowed: next.notAllowed })
          }
        />
      )}
      <GasMixFields
        checkboxLabel={t('hasCompressorOnSite')}
        value={{
          hasCompressor: value.hasCompressorOnSite,
          gasMixes: (value.compressorGasMixes ?? []) as GasMix[],
          nitroxMin: value.compressorNitroxMin,
          nitroxMax: value.compressorNitroxMax,
        }}
        onChange={(next) =>
          onChange({
            ...value,
            hasCompressorOnSite: next.hasCompressor,
            compressorGasMixes: next.gasMixes,
            compressorNitroxMin: next.nitroxMin,
            compressorNitroxMax: next.nitroxMax,
          })
        }
      />
    </div>
  )
}
