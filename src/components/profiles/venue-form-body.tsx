'use client'

import { useTranslations } from 'next-intl'
import { NumberPicker } from '@/components/ui/number-picker'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckboxGroup } from '@/components/ui/checkbox-group'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
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
import type { VenueFormValue } from '@/lib/schemas/profile-shared'

export type { VenueFormValue }

export function isVenueFormSubmittable(form: VenueFormValue, kind: VenueKind): boolean {
  const baseValid =
    form.name.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    form.location !== null &&
    form.maxDepth !== undefined && form.maxDepth > 0
  if (kind === 'pool') return baseValid && form.maxCapacity !== undefined && form.maxCapacity > 0
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
      <ProfileBasicInfo
        nameLabel={isPool ? t('poolName') : t('diveSiteName')}
        nameValue={value.name}
        onNameChange={(v) => onChange({ ...value, name: v })}
        nameRequired
        emailValue={value.email}
        onEmailChange={(v) => onChange({ ...value, email: v })}
        emailRequired
        phoneValue={value.phone}
        onPhoneChange={(v) => onChange({ ...value, phone: v })}
        phoneRequired
        locationValue={value.location}
        onLocationChange={(loc) => onChange({ ...value, location: loc })}
        locationRequired
      />
      <div className="flex flex-wrap gap-3">
        <NumberPicker
          label={t('maxDepthM')}
          value={value.maxDepth}
          onChange={(v) => onChange({ ...value, maxDepth: v })}
          min={1}
          max={range.maxDepth}
          step={0.5}
          decimals={1}
          required
        />
        {isPool && (
          <NumberPicker
            label={t('maxCapacity')}
            value={value.maxCapacity}
            onChange={(v) => onChange({ ...value, maxCapacity: v })}
            min={1}
            max={range.maxCapacity}
            required
          />
        )}
        {!isPool && (
          <Checkbox
            label={t('confinedCapable')}
            checked={value.confinedCapable ?? false}
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
