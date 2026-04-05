'use client'

import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileIncompleteGuard } from '@/components/profiles/profile-incomplete-guard'
import { Card } from '@/components/ui/card'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PillToggle } from '@/components/ui/pill-toggle'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import {
  equipmentContactSchema,
  equipmentGearCatalogSchema,
} from '@/lib/schemas/profile-shared'
import {
  INITIAL_CONTACT_FORM,
  contactFromProfile,
  contactToPayload,
  defaultFromMe,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import { GEAR_TYPES, GEAR_TYPE_LABELS, type GearType } from '@/lib/constants/gear-sizing'

// ── Types ────────────────────────────────────────────────────────────

export type EquipmentProfileSection = 'contact' | 'gear-catalog'

type EquipmentSectionProps = BaseProfileSectionProps

// ── Contact section ──────────────────────────────────────────────────


export function EquipmentContactSection({ profile: existing, me, create, update, onSaved }: EquipmentSectionProps) {
  const t = useTranslations('common')

  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } =
    useProfileForm({
      profile: existing,
      me,
      schema: equipmentContactSchema,
      defaults: INITIAL_CONTACT_FORM,
      fromProfile: contactFromProfile,
      fromMe: defaultFromMe,
      toPayload: contactToPayload,
      create,
      update,
      onSaved,
    })

  const onLocationChange = (loc: LocationValue | null) => setField('location', loc)

  return (
    <ProfileFormShell
      loading={loading}
      onSubmit={handleSubmit}
      footerErrorMessage={footerErrorMessage}
      saving={saving}
      saved={saved}
      isDirty={isDirty}
      isUpdate={isUpdate}
      disableSaveWhenInvalid
      isValid={isValid}
      loadingVariant="plain"
      loadingMessage={t('loading')}
      className="space-y-6"
    >
      <div className="space-y-4">
        <ProfileBasicInfo
          nameValue={form.name}
          onNameChange={(val) => setField('name', val)}
          nameError={errors.name}
          nameLabel="Business Name"
          namePlaceholder="e.g. Phuket Gear Rental"
          nameRequired
          locationValue={form.location}
          onLocationChange={onLocationChange}
          locationError={errors.location}
          locationRequired
          emailValue={form.email}
          onEmailChange={(val) => setField('email', val)}
          emailError={errors.email}
          emailRequired
          phoneValue={form.phone}
          onPhoneChange={(val) => setField('phone', val)}
          phoneError={errors.phone}
          phoneRequired
        />
      </div>
    </ProfileFormShell>
  )
}

// ── Gear Catalog section ─────────────────────────────────────────────

export type EquipmentGearCatalogFormState = {
  manufacturersByGearType: Partial<Record<GearType, string[]>>
}

export const INITIAL_EQUIPMENT_GEAR_CATALOG_FORM: EquipmentGearCatalogFormState = {
  manufacturersByGearType: {},
}

export function equipmentGearCatalogFromProfile(p: Record<string, unknown>): EquipmentGearCatalogFormState {
  const parsed: Partial<Record<GearType, string[]>> = {}
  const mbt = p.manufacturersByGearType as Record<string, string[]> | undefined
  if (mbt) {
    for (const gt of GEAR_TYPES) {
      const mfrs = mbt[gt]
      if (mfrs && mfrs.length > 0) parsed[gt] = mfrs
    }
  }
  return { manufacturersByGearType: parsed }
}

export function equipmentGearCatalogToPayload(f: EquipmentGearCatalogFormState): Record<string, unknown> {
  const mbt: Record<string, string[]> = {}
  for (const gt of GEAR_TYPES) {
    const mfrs = f.manufacturersByGearType[gt]
    if (mfrs && mfrs.length > 0) mbt[gt] = mfrs
  }
  return {
    manufacturersByGearType: Object.keys(mbt).length > 0 ? mbt : undefined,
  }
}

export function EquipmentGearCatalogSection({ profile: existing, create, update }: EquipmentSectionProps) {
  const { form, setForm, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } =
    useProfileForm({
      profile: existing,
      schema: equipmentGearCatalogSchema,
      defaults: INITIAL_EQUIPMENT_GEAR_CATALOG_FORM,
      fromProfile: equipmentGearCatalogFromProfile,
      toPayload: equipmentGearCatalogToPayload,
      create,
      update,
    })

  const [mfrInputs, setMfrInputs] = useState<Partial<Record<GearType, string>>>({})

  if (!existing) return <ProfileIncompleteGuard />

  function toggleGearType(gt: GearType) {
    setForm((prev) => {
      const next = { ...prev.manufacturersByGearType }
      if (gt in next) {
        delete next[gt]
      } else {
        next[gt] = []
      }
      return { ...prev, manufacturersByGearType: next }
    })
  }

  function addManufacturer(gt: GearType) {
    const mfr = (mfrInputs[gt] ?? '').trim()
    if (!mfr) return
    const existing = form.manufacturersByGearType[gt] ?? []
    if (existing.includes(mfr)) return
    setForm((prev) => ({
      ...prev,
      manufacturersByGearType: {
        ...prev.manufacturersByGearType,
        [gt]: [...(prev.manufacturersByGearType[gt] ?? []), mfr],
      },
    }))
    setMfrInputs((prev) => ({ ...prev, [gt]: '' }))
  }

  function removeManufacturer(gt: GearType, mfr: string) {
    setForm((prev) => ({
      ...prev,
      manufacturersByGearType: {
        ...prev.manufacturersByGearType,
        [gt]: (prev.manufacturersByGearType[gt] ?? []).filter((m) => m !== mfr),
      },
    }))
  }

  const activeGearTypes = GEAR_TYPES.filter((gt) => gt in form.manufacturersByGearType)

  return (
    <ProfileFormShell
      loading={loading}
      onSubmit={handleSubmit}
      footerErrorMessage={footerErrorMessage}
      saving={saving}
      saved={saved}
      isDirty={isDirty}
      isUpdate={isUpdate}
      disableSaveWhenInvalid
      isValid={isValid}
      className="space-y-6"
    >
      <Card padding="lg">
        <FormSectionHeader label="Gear Catalog" />
        <p className="text-xs mb-4 text-secondary">
          Select the gear types you stock and add manufacturer brands per type.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {GEAR_TYPES.map((gt) => (
            <PillToggle
              key={gt}
              label={GEAR_TYPE_LABELS[gt]}
              checked={gt in form.manufacturersByGearType}
              onChange={() => toggleGearType(gt)}
            />
          ))}
        </div>
        {activeGearTypes.length > 0 && (
          <div className="space-y-3">
            {activeGearTypes.map((gt) => (
              <div key={gt} className="p-3 rounded-[var(--border-radius)]" style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-glass-border)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-secondary">
                  {GEAR_TYPE_LABELS[gt]}
                </p>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={mfrInputs[gt] ?? ''}
                    onChange={(e) => setMfrInputs((prev) => ({ ...prev, [gt]: e.target.value }))}
                    placeholder="e.g. ScubaPro, Mares, Aqualung"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManufacturer(gt) } }}
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={() => addManufacturer(gt)}>
                    <Plus size={14} />
                  </Button>
                </div>
                {(form.manufacturersByGearType[gt] ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(form.manufacturersByGearType[gt] ?? []).map((mfr) => (
                      <span key={mfr} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border text-primary" style={{ background: 'var(--color-glass-bg)', borderColor: 'var(--color-glass-border)' }}>
                        {mfr}
                        <button className="text-secondary" type="button" aria-label={`Remove ${mfr}`} onClick={() => removeManufacturer(gt, mfr)}>
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </ProfileFormShell>
  )
}

// ── Compat alias ─────────────────────────────────────────────────────

/**
 * Dispatches to the appropriate section component based on the `section` prop.
 * The app-layer ConnectedEquipmentForm short-circuits before this is reached
 * at runtime; this export exists so that the lib-layer registry in
 * connected-role-forms.tsx continues to type-check without modification.
 */
export function EquipmentProfileForm({
  section,
  profile,
  me,
  create,
  update,
  onSaved,
}: EquipmentSectionProps & { section?: EquipmentProfileSection }) {
  if (section === 'gear-catalog')
    return <EquipmentGearCatalogSection profile={profile} create={create} update={update} />
  return <EquipmentContactSection profile={profile} me={me} create={create} update={update} onSaved={onSaved} />
}
