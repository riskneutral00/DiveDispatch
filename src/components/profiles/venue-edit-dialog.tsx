'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { NameField } from '@/components/ui/name-field'
import { NumberPicker } from '@/components/ui/number-picker'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckboxGroup } from '@/components/ui/checkbox-group'
import { EmailField } from '@/components/ui/email-field'
import { PhoneField } from '@/components/ui/phone-field'
import { MenuButton } from '@/components/ui/menu-button'
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

export const EMPTY_VENUE_EDIT: VenueEditValue = {
  name: '',
  kind: 'pool',
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

interface VenueEditDialogProps {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  initialValue?: VenueEditValue
  lockedKind?: VenueKind
  onSubmit: (value: VenueEditValue) => Promise<void>
}

type DiveSiteSection = 'basic' | 'features' | 'compressor' | 'access'

export function VenueEditDialog({ open, onClose, mode, initialValue, lockedKind, onSubmit }: VenueEditDialogProps) {
  const t = useTranslations('common')
  const [form, setForm] = useState<VenueEditValue>(initialValue ?? EMPTY_VENUE_EDIT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [section, setSection] = useState<DiveSiteSection>('basic')

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
      const seed = initialValue ?? EMPTY_VENUE_EDIT
      setForm(lockedKind ? { ...seed, kind: lockedKind } : seed)
      setError(null)
      setSection('basic')
    }
  }, [open, initialValue, lockedKind])

  const effectiveKind: VenueKind = lockedKind ?? form.kind
  const range = RANGE_BY_KIND[effectiveKind]
  const isPool = effectiveKind === 'pool'
  const isDiveSite = effectiveKind === 'dive_site'

  const canSubmit =
    form.name.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    form.location !== null &&
    form.maxDepth > 0 &&
    (isPool ? form.maxCapacity > 0 : true)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ ...form, kind: effectiveKind })
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

  const titleKey = isPool
    ? mode === 'create' ? 'addPool' : 'editPool'
    : isDiveSite
    ? mode === 'create' ? 'addDiveSite' : 'editDiveSite'
    : mode === 'create' ? 'addVenue' : 'editVenue'

  const primaryLabelKey = mode === 'create'
    ? (isPool ? 'addPool' : isDiveSite ? 'addDiveSite' : 'addVenue')
    : 'save'

  const renderBasicFields = () => (
    <>
      <NameField
        scope="organization"
        label={isPool ? t('poolName') : isDiveSite ? t('diveSiteName') : t('venueName')}
        value={form.name}
        onChange={(v) => setForm((prev) => ({ ...prev, name: v }))}
        required
      />
      {!lockedKind && (
        <SimpleSelect
          label={t('venueType')}
          value={form.kind}
          onChange={(v) => setForm((prev) => ({ ...prev, kind: v as VenueKind }))}
          options={kindOptions}
          required
        />
      )}
      <EmailField
        label={t('email')}
        value={form.email}
        onChange={(v) => setForm((prev) => ({ ...prev, email: v }))}
        required
      />
      <PhoneField
        label={t('phone')}
        value={form.phone}
        onChange={(v) => setForm((prev) => ({ ...prev, phone: v }))}
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
          required
        />
        {isPool && (
          <NumberPicker
            label={t('maxCapacity')}
            value={form.maxCapacity || undefined}
            onChange={(v) => setForm((prev) => ({ ...prev, maxCapacity: v ?? 0 }))}
            min={1}
            max={range.maxCapacity}
            required
          />
        )}
      </div>
      {isDiveSite && (
        <Checkbox
          label={t('confinedCapable')}
          checked={form.confinedCapable}
          onChange={(v) => setForm((prev) => ({ ...prev, confinedCapable: v }))}
        />
      )}
    </>
  )

  const renderFeaturesPanel = () => (
    <CheckboxGroup
      label={t('features')}
      items={featureItems}
      selected={form.features}
      onChange={(values) => setForm((prev) => ({ ...prev, features: values as VenueFeature[] }))}
      columns={3}
    />
  )

  const renderCompressorPanel = () => (
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
  )

  const renderAccessPanel = () => (
    <AccessControlSection
      value={accessValue}
      onChange={(next) =>
        setForm((prev) => ({ ...prev, isAllowed: next.isAllowed, notAllowed: next.notAllowed }))
      }
    />
  )

  const renderPoolBody = () => (
    <div className="space-y-4">
      {renderBasicFields()}
      {renderCompressorPanel()}
    </div>
  )

  const renderDiveSiteBody = () => {
    const sections: Array<{ id: DiveSiteSection; label: string }> = [
      { id: 'basic', label: t('basicInfo') },
      { id: 'features', label: t('features') },
      { id: 'compressor', label: t('hasCompressorOnSite') },
      { id: 'access', label: t('access') },
    ]
    return (
      <div className="space-y-4">
        <nav className="flex gap-2 overflow-x-auto" role="tablist" aria-label={t('sections')}>
          {sections.map((s) => (
            <MenuButton
              key={s.id}
              variant="pill"
              size="sm"
              role="tab"
              aria-selected={section === s.id}
              active={section === s.id}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </MenuButton>
          ))}
        </nav>
        <div role="tabpanel">
          {section === 'basic' && renderBasicFields()}
          {section === 'features' && renderFeaturesPanel()}
          {section === 'compressor' && renderCompressorPanel()}
          {section === 'access' && renderAccessPanel()}
        </div>
      </div>
    )
  }

  const renderGenericBody = () => (
    <div className="space-y-4">
      {renderBasicFields()}
      {renderFeaturesPanel()}
      {renderCompressorPanel()}
      {renderAccessPanel()}
    </div>
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(titleKey)}
      size={isDiveSite ? 'xl' : 'lg'}
    >
      <div className="space-y-4">
        {isPool ? renderPoolBody() : isDiveSite ? renderDiveSiteBody() : renderGenericBody()}

        {error && <div className="text-destructive text-body">{error}</div>}

        <DialogFooter
          className="pt-2"
          primaryLabel={t(primaryLabelKey)}
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
