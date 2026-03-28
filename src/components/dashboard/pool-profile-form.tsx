'use client'

import { useMutation, useQuery } from 'convex/react'
import { z } from 'zod'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassInput } from '@/components/glass/glass-input'
import { Spinner } from '@/components/common/spinner'
import { LocationPicker, type LocationValue } from '@/components/common/location-picker-lazy'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import { FormSectionHeader } from '@/components/common/form-section-header'
import { SaveButton } from '@/components/common/save-button'
import { ProfileBasicInfo } from '@/components/common/profile-basic-info'

const locationSchema = z.object({
  placeName: z.string().min(1),
  country: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().optional(),
})

export const poolSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  email: z.string().email('Invalid email'),
  phone: z.string().min(1, 'Phone is required'),
  maxDepth: z.number().positive('Must be greater than 0'),
  maxCapacity: z.number().int('Must be a whole number').positive('Must be at least 1'),
  confinedCapable: z.boolean(),
})

export type PoolFormState = {
  name: string
  location: LocationValue | null
  email: string
  phone: string
  maxDepth: number
  maxCapacity: number
  confinedCapable: boolean
}

export const INITIAL_POOL_FORM: PoolFormState = {
  name: '',
  location: null,
  email: '',
  phone: '',
  maxDepth: 0,
  maxCapacity: 0,
  confinedCapable: false,
}

function parseNumber(raw: string, isInt: boolean): number {
  if (raw === '') return 0
  const parsed = isInt ? parseInt(raw, 10) : parseFloat(raw)
  return isNaN(parsed) ? 0 : parsed
}

export function poolFromProfile(p: Record<string, unknown>): PoolFormState {
  return {
    name: p.name as string,
    location: {
      placeName: p.placeName,
      country: p.country,
      lat: p.lat,
      lng: p.lng,
      placeId: (p.placeId ?? undefined) as string | undefined,
    } as LocationValue,
    email: (p.email as string) ?? '',
    phone: (p.phone as string) ?? '',
    maxDepth: (p.maxDepth as number) ?? 0,
    maxCapacity: (p.maxCapacity as number) ?? 0,
    confinedCapable: (p.confinedCapable as boolean) ?? false,
  }
}

export function poolToPayload(f: PoolFormState): Record<string, unknown> {
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
    maxDepth: f.maxDepth,
    maxCapacity: f.maxCapacity,
    confinedCapable: f.confinedCapable,
  }
}

export function buildPoolCreatePayload<T extends Record<string, unknown>>(payload: T) {
  return {
    ...payload,
    venueType: 'Pool' as const,
    isPublic: false,
    hasCompressor: false,
  }
}

export function PoolProfileForm() {
  const profile = useQuery(api.venues.mine)
  const me = useQuery(api.users.getAccountDefaults)
  const createMutation = useMutation(api.venues.create)
  const update = useMutation(api.venues.update)

  const { form, setField, errors, serverError, saving, saved, isDirty, loading, isUpdate, handleSubmit } = useProfileForm({
    profile,
    me: me ?? undefined,
    schema: poolSchema,
    defaults: INITIAL_POOL_FORM,
    fromProfile: poolFromProfile,
    fromMe: (defaults, initial) => ({
      ...initial,
      email: defaults.email ?? '',
      phone: defaults.phone ?? '',
    }),
    toPayload: poolToPayload,
    create: (payload) =>
      createMutation(
        buildPoolCreatePayload(payload) as Parameters<typeof createMutation>[0],
      ),
    update,
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" style={{ color: 'var(--color-primary)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <GlassCard padding="lg">
        <FormSectionHeader label="Pool Profile" />

        <div className="space-y-4">
          <ProfileBasicInfo
            nameValue={form.name}
            onNameChange={(val) => setField('name', val)}
            nameError={errors.name}
            nameLabel="Pool Name"
            namePlaceholder="Blue Lagoon Training Pool"
            locationValue={form.location}
            onLocationChange={(loc) => setField('location', loc)}
            locationError={errors.location}
            emailValue={form.email}
            onEmailChange={(val) => setField('email', val)}
            emailError={errors.email}
            phoneValue={form.phone}
            onPhoneChange={(val) => setField('phone', val)}
            phoneError={errors.phone}
          />

          <hr className="form-divider" />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-secondary">
              Venue Capabilities
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className="flex items-center gap-2 cursor-pointer select-none text-sm text-primary"
              >
                <input
                  type="checkbox"
                  checked={form.confinedCapable}
                  onChange={(e) => setField('confinedCapable', e.target.checked)}
                  className="rounded"
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                <span>Confined Water Capable</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput
              label="Max Depth (m)"
              type="number"
              min="0.1"
              step="0.1"
              value={form.maxDepth || ''}
              onChange={(e) => setField('maxDepth', parseNumber(e.target.value, false))}
              error={errors.maxDepth}
              placeholder="5"
            />
            <GlassInput
              label="Max Capacity (divers)"
              type="number"
              min="1"
              step="1"
              value={form.maxCapacity || ''}
              onChange={(e) => setField('maxCapacity', parseNumber(e.target.value, true))}
              error={errors.maxCapacity}
              placeholder="15"
            />
          </div>
        </div>

        {serverError && (
          <p className="mt-4 text-sm" style={{ color: 'var(--color-destructive)' }}>
            {serverError}
          </p>
        )}
        {saved && !saving && (
          <p className="mt-4 text-sm" style={{ color: 'var(--color-success)' }}>
            Profile saved successfully.
          </p>
        )}

        <div className="mt-6">
          <SaveButton saving={saving} saved={saved} isDirty={isDirty} isUpdate={isUpdate} />
        </div>
      </GlassCard>
    </form>
  )
}
