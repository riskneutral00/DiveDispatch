'use client'

import { z } from 'zod'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/glass/glass-card'
import { Spinner } from '@/components/common/spinner'
import { FormSectionHeader } from '@/components/common/form-section-header'
import { SaveButton } from '@/components/common/save-button'
import { type LocationValue } from '@/components/common/location-picker'
import { ProfileBasicInfo } from '@/components/common/profile-basic-info'
import { GlassInput } from '@/components/glass/glass-input'
import { GlassCheckboxGroup } from '@/components/glass/glass-checkbox-group'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

// ── Constants ────────────────────────────────────────────────────────

const GAS_MIXES = [
  { value: 'air', label: 'Air' },
  { value: 'nitrox', label: 'Nitrox' },
  { value: 'trimix', label: 'Trimix' },
] as const

type GasMix = 'air' | 'nitrox' | 'trimix'

// ── Zod Schema ────────────────────────────────────────────────────────

const locationSchema = z.object({
  placeName: z.string().min(1),
  country: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().optional(),
})

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  contactPhone: z.string().min(1, 'Phone number is required'),
  gasMixes: z.array(z.enum(['air', 'nitrox', 'trimix'])).min(1, 'Select at least one gas mix'),
})

type FormState = {
  name: string
  location: LocationValue | null
  contactEmail: string
  contactPhone: string
  gasMixes: GasMix[]
}

const INITIAL_FORM: FormState = {
  name: '',
  location: null,
  contactEmail: '',
  contactPhone: '',
  gasMixes: [],
}

// ── Sub-components ────────────────────────────────────────────────────


// ── Main Form ─────────────────────────────────────────────────────────

export function CompressorProfileForm() {
  const profile = useQuery(api.compressors.mine)
  const me = useQuery(api.users.getAccountDefaults)
  const create = useMutation(api.compressors.create)
  const update = useMutation(api.compressors.update)

  const { form, setField, errors, serverError, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } = useProfileForm({
    profile,
    me: me ?? undefined,
    schema: profileSchema,
    defaults: INITIAL_FORM,
    fromProfile: (p) => ({
      name: p.name as string,
      location: {
        placeName: p.placeName,
        country: p.country,
        lat: p.lat,
        lng: p.lng,
        placeId: (p.placeId ?? undefined) as string | undefined,
      } as LocationValue,
      contactEmail: p.contactEmail as string,
      contactPhone: p.contactPhone as string,
      gasMixes: (p.gasMixes ?? []) as GasMix[],
    }),
    fromMe: (defaults, initial) => ({
      ...initial,
      contactEmail: defaults.defaultContactEmail ?? '',
      contactPhone: defaults.defaultContactPhone ?? '',
    }),
    toPayload: (f) => {
      const loc = f.location!
      return {
        name: f.name,
        placeName: loc.placeName,
        country: loc.country,
        lat: loc.lat,
        lng: loc.lng,
        placeId: loc.placeId,
        contactEmail: f.contactEmail,
        contactPhone: f.contactPhone,
        gasMixes: f.gasMixes,
      }
    },
    create,
    update,
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" style={{ color: 'var(--color-primary)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-3xl mx-auto space-y-6">
      {/* Basic info */}
      <GlassCard padding="md">
        <div className="space-y-4">
          <ProfileBasicInfo
            nameLabel="Business Name"
            namePlaceholder="e.g. Phuket Gas Services"
            nameValue={form.name}
            onNameChange={(val) => setField('name', val)}
            nameError={errors.name}
            locationValue={form.location}
            onLocationChange={(loc) => setField('location', loc)}
            locationError={errors.location}
            phoneValue={form.contactPhone}
            onPhoneChange={(val) => setField('contactPhone', val)}
            phoneError={errors.contactPhone}
          />
        </div>
      </GlassCard>

      <hr className="form-divider" />

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

      {serverError && (
        <p className="text-sm text-center" style={{ color: 'var(--color-destructive)' }}>
          {serverError}
        </p>
      )}
      {saved && (
        <p className="text-sm text-center" style={{ color: 'var(--color-success)' }}>
          Profile saved successfully.
        </p>
      )}

      <SaveButton saving={saving} saved={saved} isDirty={isDirty} isUpdate={isUpdate} disabled={!isValid} />
    </form>
  )
}
