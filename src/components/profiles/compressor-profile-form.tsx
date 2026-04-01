'use client'

import { z } from 'zod'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormHeader } from '@/components/profiles/profile-form-header'
import { ProfileFormSectionDivider } from '@/components/profiles/profile-form-section-divider'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { GlassCard } from '@/components/ui/glass-card'
import { GlassCheckboxGroup } from '@/components/ui/glass-checkbox-group'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import {
  contactFieldsFromProfile,
  createOptimisticLocationOnChange,
  locationToPayload,
  nullableProfileLocation,
} from '@/lib/profile-form/location'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

// ── Constants ────────────────────────────────────────────────────────

const GAS_MIXES = [
  { value: 'air', label: 'Air' },
  { value: 'nitrox', label: 'Nitrox' },
  { value: 'trimix', label: 'Trimix' },
] as const

type GasMix = 'air' | 'nitrox' | 'trimix'

// ── Zod Schema ────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: nullableProfileLocation(),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  gasMixes: z.array(z.enum(['air', 'nitrox', 'trimix'])).min(1, 'Select at least one gas mix'),
})

type FormState = {
  name: string
  location: LocationValue | null
  email: string
  phone: string
  gasMixes: GasMix[]
}

const INITIAL_FORM: FormState = {
  name: '',
  location: null,
  email: '',
  phone: '',
  gasMixes: [],
}

// ── Sub-components ────────────────────────────────────────────────────


// ── Main Form ─────────────────────────────────────────────────────────

export type CompressorProfileFormProps = {
  profile: Record<string, unknown> | null | undefined
  me: Record<string, unknown> | null | undefined
  create: (payload: Record<string, unknown>) => Promise<unknown>
  update: (payload: Record<string, unknown>) => Promise<unknown>
}

export function CompressorProfileForm({ profile, me, create, update }: CompressorProfileFormProps) {

  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, loading, isUpdate, handleSubmit } = useProfileForm({
    profile,
    me: me ?? undefined,
    schema: profileSchema,
    defaults: INITIAL_FORM,
    fromProfile: (p) => {
      const c = contactFieldsFromProfile(p)
      return {
        ...c,
        location: c.location as LocationValue,
        gasMixes: (p.gasMixes ?? []) as GasMix[],
      }
    },
    fromMe: (u, initial) => ({
      ...initial,
      email: u.email ?? '',
      phone: u.phone ?? '',
    }),
    toPayload: (f) => ({
      name: f.name,
      ...locationToPayload(f.location!),
      email: f.email,
      phone: f.phone,
      gasMixes: f.gasMixes,
    }),
    create,
    update,
  })

  const onLocationChange = createOptimisticLocationOnChange({
    setField,
    update,
    isUpdate,
  })

  return (
    <ProfileFormShell
      loading={loading}
      onSubmit={handleSubmit}
      footerErrorMessage={footerErrorMessage}
      saving={saving}
      saved={saved}
      isDirty={isDirty}
      isUpdate={isUpdate}
      className="space-y-6"
    >
      <ProfileFormHeader isUpdate={isUpdate} roleName="compressor" />

      {/* Basic info */}
      <div className="space-y-4">
        <ProfileBasicInfo
          nameValue={form.name}
          onNameChange={(val) => setField('name', val)}
          nameError={errors.name}
          nameLabel="Business Name"
          namePlaceholder="e.g. Phuket Gas Services"
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

      {/* Gas mixes */}
      <GlassCard padding="md">
        <FormSectionHeader label="Gas Mixes Available" />
        <GlassCheckboxGroup
          label="Select the gas mixes you supply"
          items={GAS_MIXES.map(({ value, label }) => ({ value, label }))}
          selected={form.gasMixes}
          onChange={(values) => setField('gasMixes', values as GasMix[])}
          error={errors.gasMixes}
          columns={2}
        />
      </GlassCard>
    </ProfileFormShell>
  )
}
