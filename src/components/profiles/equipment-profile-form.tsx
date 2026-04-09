'use client'

import { Plus, X } from 'lucide-react'
import { useState } from 'react'

import { BusinessContactSection } from '@/components/profiles/business-contact-section'
import { ProfileIncompleteGuard } from '@/components/profiles/profile-incomplete-guard'
import { Card } from '@/components/ui/card'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PillToggle } from '@/components/ui/pill-toggle'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import {
  contactSchema,
  equipmentGearCatalogSchema,
} from '@/lib/schemas/profile-shared'
import {
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import { GEAR_TYPES, GEAR_TYPE_LABELS, type GearType } from '@/lib/constants/gear-sizing'

export type EquipmentProfileSection = 'contact' | 'gear-catalog'

type EquipmentSectionProps = BaseProfileSectionProps

export function EquipmentContactSection(props: EquipmentSectionProps) {
  return (
    <BusinessContactSection
      {...props}
      nameLabel="Business Name"
      namePlaceholder="e.g. Phuket Gear Rental"
      schema={contactSchema}
    />
  )
}

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

export function EquipmentGearCatalogSection({ profile: existing, create, update, onClose }: EquipmentSectionProps) {
  const { form, setForm, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit, resetToBaseline } =
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
      onCancel={() => { resetToBaseline(); onClose?.() }}
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
        <p className="text-label mb-4 text-secondary">
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
              <div key={gt} className="p-3 rounded-theme content-island">
                <FormSectionHeader label={GEAR_TYPE_LABELS[gt]} className="mb-2" />
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
                      <Badge key={mfr} variant="default" size="sm">
                        {mfr}
                        {/* design-ok */}<button className="text-secondary" type="button" aria-label={`Remove ${mfr}`} onClick={() => removeManufacturer(gt, mfr)}>
                          <X size={10} />
                        </button>
                      </Badge>
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

export function EquipmentProfileForm({
  section,
  profile,
  me,
  create,
  update,
  onSaved,
  onClose,
}: EquipmentSectionProps & { section?: EquipmentProfileSection }) {
  if (section === 'gear-catalog')
    return <EquipmentGearCatalogSection profile={profile} create={create} update={update} onClose={onClose} />
  return <EquipmentContactSection profile={profile} me={me} create={create} update={update} onSaved={onSaved} onClose={onClose} />
}
