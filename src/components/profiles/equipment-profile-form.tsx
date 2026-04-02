'use client'

import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { z } from 'zod'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormSectionDivider } from '@/components/profiles/profile-form-section-divider'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { GlassButton } from '@/components/ui/glass-button'
import { GlassCard } from '@/components/ui/glass-card'
import { GlassInput } from '@/components/ui/glass-input'
import { PillToggle } from '@/components/ui/pill-toggle'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import {
  contactFieldsFromProfile,
  createOptimisticLocationOnChange,
  locationToPayload,
  nullableProfileLocation,
} from '@/lib/profile-form/location'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

const GEAR_TYPES = ['bcd', 'wetsuit', 'fins', 'regulator', 'mask'] as const
type GearType = (typeof GEAR_TYPES)[number]

const GEAR_TYPE_LABELS: Record<GearType, string> = {
  bcd: 'BCD',
  wetsuit: 'Wetsuit',
  fins: 'Fins',
  regulator: 'Regulator',
  mask: 'Mask',
}

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  location: nullableProfileLocation(),
  email: z.string().email('Valid email required'),
  phone: z.string().min(1, 'Phone is required').max(30),
})

type FormState = {
  name: string
  location: LocationValue | null
  email: string
  phone: string
  manufacturersByGearType: Partial<Record<GearType, string[]>>
}

const INITIAL_FORM: FormState = {
  name: '',
  location: null,
  email: '',
  phone: '',
  manufacturersByGearType: {},
}

export type EquipmentProfileFormProps = {
  profile: Record<string, unknown> | null | undefined
  me: Record<string, unknown> | null | undefined
  create: (payload: Record<string, unknown>) => Promise<unknown>
  update: (payload: Record<string, unknown>) => Promise<unknown>
}

export function EquipmentProfileForm({ profile, me, create, update }: EquipmentProfileFormProps) {
  const t = useTranslations('common')

  const { form, setForm, setField, errors, footerErrorMessage, saving, saved, isDirty, loading, isUpdate, handleSubmit } = useProfileForm({
    profile,
    me: me ?? undefined,
    schema: profileSchema,
    defaults: INITIAL_FORM,
    fromProfile: (p) => {
      const parsed: Partial<Record<GearType, string[]>> = {}
      const mbt = p.manufacturersByGearType as Record<string, string[]> | undefined
      if (mbt) {
        for (const gt of GEAR_TYPES) {
          const mfrs = mbt[gt]
          if (mfrs && mfrs.length > 0) parsed[gt] = mfrs
        }
      }
      const c = contactFieldsFromProfile(p)
      return {
        ...c,
        location: c.location as LocationValue,
        manufacturersByGearType: parsed,
      }
    },
    fromMe: (u, initial) => ({
      ...initial,
      email: u.email ?? '',
      phone: u.phone ?? '',
    }),
    toPayload: (f) => {
      const mbt: Record<string, string[]> = {}
      for (const gt of GEAR_TYPES) {
        const mfrs = f.manufacturersByGearType[gt]
        if (mfrs && mfrs.length > 0) mbt[gt] = mfrs
      }
      return {
        name: f.name,
        ...locationToPayload(f.location!),
        email: f.email,
        phone: f.phone,
        manufacturersByGearType: Object.keys(mbt).length > 0 ? mbt : undefined,
      }
    },
    create,
    update,
  })

  // Local UI state for tag inputs (not part of form/schema)
  const [mfrInputs, setMfrInputs] = useState<Partial<Record<GearType, string>>>({})

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
      manufacturersByGearType: { ...prev.manufacturersByGearType, [gt]: [...(prev.manufacturersByGearType[gt] ?? []), mfr] },
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

  const onLocationChange = createOptimisticLocationOnChange({
    setField,
    update,
    isUpdate,
  })

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
      loadingVariant="plain"
      loadingMessage={t('loading')}
      className="space-y-6"
    >
      {/* Business Details */}
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

      <ProfileFormSectionDivider show />

      {/* Gear Catalog */}
      <GlassCard padding="lg">
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
                  <GlassInput
                    value={mfrInputs[gt] ?? ''}
                    onChange={(e) => setMfrInputs((prev) => ({ ...prev, [gt]: e.target.value }))}
                    placeholder="e.g. ScubaPro, Mares, Aqualung"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManufacturer(gt) } }}
                  />
                  <GlassButton type="button" variant="secondary" size="sm" onClick={() => addManufacturer(gt)}>
                    <Plus size={14} />
                  </GlassButton>
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
      </GlassCard>
    </ProfileFormShell>
  )
}
