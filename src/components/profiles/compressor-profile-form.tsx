'use client'

import { useMutation, useQuery } from 'convex/react'
import { z } from 'zod'

import { api } from '../../../convex/_generated/api'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormLoading } from '@/components/profiles/profile-form-loading'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { GlassCard } from '@/components/ui/glass-card'
import { GlassCheckboxGroup } from '@/components/ui/glass-checkbox-group'
import { SaveButton } from '@/components/ui/save-button'
import {
  createOptimisticLocationOnChange,
  locationFromProfileDoc,
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

export function CompressorProfileForm() {
  const profile = useQuery(api.compressors.mine)
  const me = useQuery(api.users.getAccountDefaults)
  const create = useMutation(api.compressors.create)
  const update = useMutation(api.compressors.update)

  const { form, setField, errors, serverError, saving, saved, isDirty, loading, isUpdate, handleSubmit } = useProfileForm({
    profile,
    me: me ?? undefined,
    schema: profileSchema,
    defaults: INITIAL_FORM,
    fromProfile: (p) => ({
      name: p.name as string,
      location: locationFromProfileDoc({
        placeName: p.placeName as string,
        country: p.country as string,
        lat: p.lat as number,
        lng: p.lng as number,
        placeId: p.placeId as string | null | undefined,
      }) as LocationValue,
      email: p.email as string,
      phone: p.phone as string,
      gasMixes: (p.gasMixes ?? []) as GasMix[],
    }),
    fromMe: (u, initial) => ({
      ...initial,
      email: u.email ?? '',
      phone: u.phone ?? '',
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
        email: f.email,
        phone: f.phone,
        gasMixes: f.gasMixes,
      }
    },
    create,
    update,
  })

  const onLocationChange = createOptimisticLocationOnChange({
    setField,
    update,
    isUpdate,
  })

  if (loading) {
    return <ProfileFormLoading />
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1
          className="text-2xl font-bold mb-1 text-primary"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {isUpdate ? 'Update Profile' : 'Complete Your Profile'}
        </h1>
        <p className="text-sm text-secondary">
          {isUpdate
            ? 'Keep your profile current so dive centers can find you.'
            : 'Set up your compressor profile to start receiving booking requests.'}
        </p>
      </div>

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

      <SaveButton saving={saving} saved={saved} isDirty={isDirty} isUpdate={isUpdate} />
    </form>
  )
}
