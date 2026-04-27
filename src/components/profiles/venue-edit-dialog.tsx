'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { NameField } from '@/components/ui/name-field'
import { NumberPicker } from '@/components/ui/number-picker'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckboxGroup } from '@/components/ui/checkbox-group'
import { LocationPicker, type LocationValue } from '@/components/profiles/location-picker'
import { GasMixFields } from '@/components/capabilities/gas-mix-fields'
import {
  AccessControlSection,
  type AccessControlState,
  deriveAccessMode,
} from '@/components/profiles/access-control-section'
import {
  VENUE_KINDS,
  VENUE_FEATURES,
  RANGE_BY_KIND,
  type VenueKind,
  type VenueFeature,
} from '@/lib/constants/venue-subtypes'
import type { GasMix } from '@/lib/constants/gas-mixes'

export interface VenueEditValue {
  name: string
  kind: VenueKind
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

export const EMPTY_VENUE_EDIT: VenueEditValue = {
  name: '',
  kind: 'pool',
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

interface VenueEditDialogProps {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  initialValue?: VenueEditValue
  onSubmit: (value: VenueEditValue) => Promise<void>
}

export function VenueEditDialog({ open, onClose, mode, initialValue, onSubmit }: VenueEditDialogProps) {
  const t = useTranslations('common')
  const [form, setForm] = useState<VenueEditValue>(initialValue ?? EMPTY_VENUE_EDIT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const kindOptions = useMemo(
    () => VENUE_KINDS.map((k) => ({ value: k, label: t(`venueKinds.${k}`) })),
    [t],
  )
  const featureItems = useMemo(
    () => VENUE_FEATURES.map((f) => ({ value: f, label: t(`venueFeatures.${f}`) })),
    [t],
  )

  useEffect(() => {
    if (open) {
      setForm(initialValue ?? EMPTY_VENUE_EDIT)
      setError(null)
    }
  }, [open, initialValue])

  const range = RANGE_BY_KIND[form.kind]
  const showConfinedToggle = form.kind === 'dive_site'
  const capabilitiesRequired = form.kind === 'pool'

  const canSubmit =
    form.name.trim().length > 0 &&
    form.location !== null &&
    (!capabilitiesRequired || (form.maxDepth > 0 && form.maxCapacity > 0))

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit(form)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('actionFailed', { action: t('save') }))
    } finally {
      setSaving(false)
    }
  }

  const accessValue: AccessControlState = {
    mode: deriveAccessMode({ isAllowed: form.isAllowed, notAllowed: form.notAllowed }),
    isAllowed: form.isAllowed,
    notAllowed: form.notAllowed,
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'create' ? t('addVenue') : t('editVenue')}
      size="lg"
    >
      <div className="space-y-4">
        <NameField
          scope="organization"
          label={t('venueName')}
          value={form.name}
          onChange={(v) => setForm((prev) => ({ ...prev, name: v }))}
          required
        />
        <SimpleSelect
          label={t('venueType')}
          value={form.kind}
          onChange={(v) => setForm((prev) => ({ ...prev, kind: v as VenueKind }))}
          options={kindOptions}
          required
        />
        <LocationPicker
          label={t('location')}
          value={form.location}
          onChange={(loc) => setForm((prev) => ({ ...prev, location: loc }))}
          required
        />
        <div className="flex flex-wrap gap-3">
          <NumberPicker
            label={t('maxDepthM')}
            value={form.maxDepth || undefined}
            onChange={(v) => setForm((prev) => ({ ...prev, maxDepth: v ?? 0 }))}
            min={1}
            max={range.maxDepth}
            step={0.5}
            decimals={1}
            required={capabilitiesRequired}
          />
          <NumberPicker
            label={t('maxCapacity')}
            value={form.maxCapacity || undefined}
            onChange={(v) => setForm((prev) => ({ ...prev, maxCapacity: v ?? 0 }))}
            min={1}
            max={range.maxCapacity}
            required={capabilitiesRequired}
          />
        </div>
        {showConfinedToggle && (
          <Checkbox
            label={t('confinedCapable')}
            checked={form.confinedCapable}
            onChange={(v) => setForm((prev) => ({ ...prev, confinedCapable: v }))}
          />
        )}
        <CheckboxGroup
          label={t('features')}
          items={featureItems}
          selected={form.features}
          onChange={(values) => setForm((prev) => ({ ...prev, features: values as VenueFeature[] }))}
          columns={3}
        />
        <GasMixFields
          checkboxLabel={t('hasCompressorOnSite')}
          value={{
            hasCompressor: form.hasCompressorOnSite,
            gasMixes: (form.compressorGasMixes ?? []) as GasMix[],
            nitroxMin: form.compressorNitroxMin,
            nitroxMax: form.compressorNitroxMax,
          }}
          onChange={(next) =>
            setForm((prev) => ({
              ...prev,
              hasCompressorOnSite: next.hasCompressor,
              compressorGasMixes: next.gasMixes,
              compressorNitroxMin: next.nitroxMin,
              compressorNitroxMax: next.nitroxMax,
            }))
          }
        />
        <AccessControlSection
          value={accessValue}
          onChange={(next) =>
            setForm((prev) => ({ ...prev, isAllowed: next.isAllowed, notAllowed: next.notAllowed }))
          }
        />

        {error && <div className="text-destructive text-body">{error}</div>}

        <DialogFooter
          className="pt-2"
          primaryLabel={mode === 'create' ? t('addVenue') : t('save')}
          onPrimary={handleSubmit}
          primaryDisabled={!canSubmit || saving}
          primaryLoading={saving}
          secondaryLabel={t('cancel')}
          onSecondary={onClose}
          secondaryDisabled={saving}
        />
      </div>
    </Dialog>
  )
}
