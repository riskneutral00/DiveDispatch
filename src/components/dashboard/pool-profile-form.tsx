'use client'

import { useMutation, useQuery } from 'convex/react'
import { Check } from 'lucide-react'
import { z } from 'zod'
import { api } from '../../../convex/_generated/api'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassInput } from '@/components/glass/glass-input'
import { PROFILE_LANGUAGE_OPTIONS as LANGUAGE_OPTIONS } from '@/lib/constants/dive-languages'
import { Spinner } from '@/components/common/spinner'
import { LocationPicker, type LocationValue } from '@/components/common/location-picker'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

const locationSchema = z.object({
  placeName: z.string().min(1),
  country: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().optional(),
})

const poolSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  contactEmail: z.string().email('Invalid email'),
  contactPhone: z.string().min(1, 'Phone is required'),
  maxDepth: z.number().positive('Must be greater than 0'),
  maxCapacity: z.number().int('Must be a whole number').positive('Must be at least 1'),
  focusedLanguages: z.array(z.string()).refine((a) => a.length > 0, 'Select at least one language'),
})

type FormState = {
  name: string
  location: LocationValue | null
  contactEmail: string
  contactPhone: string
  maxDepth: number
  maxCapacity: number
  focusedLanguages: string[]
}

const INITIAL_FORM: FormState = {
  name: '',
  location: null,
  contactEmail: '',
  contactPhone: '',
  maxDepth: 0,
  maxCapacity: 0,
  focusedLanguages: [],
}

function parseNumber(raw: string, isInt: boolean): number {
  if (raw === '') return 0
  const parsed = isInt ? parseInt(raw, 10) : parseFloat(raw)
  return isNaN(parsed) ? 0 : parsed
}

export function PoolProfileForm() {
  const profile = useQuery(api.venues.mine)
  const createMutation = useMutation(api.venues.create)
  const update = useMutation(api.venues.update)

  const { form, setField, errors, serverError, saving, saved, loading, isUpdate, handleSubmit } = useProfileForm<FormState>({
    profile,
    schema: poolSchema,
    defaults: INITIAL_FORM,
    fromProfile: (p) => ({
      name: p.name,
      location: {
        placeName: p.placeName,
        country: p.country,
        lat: p.lat,
        lng: p.lng,
        placeId: p.placeId ?? undefined,
      } as LocationValue,
      contactEmail: p.contactEmail ?? '',
      contactPhone: p.contactPhone ?? '',
      maxDepth: p.maxDepth ?? 0,
      maxCapacity: p.maxCapacity ?? 0,
      focusedLanguages: p.focusedLanguages,
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
        maxDepth: f.maxDepth,
        maxCapacity: f.maxCapacity,
        focusedLanguages: f.focusedLanguages,
      }
    },
    create: (payload) =>
      createMutation({
        ...payload,
        venueType: 'Pool',
        isPublic: false,
        confinedCapable: true,
        openWaterCapable: false,
        hasCompressor: false,
      } as Parameters<typeof createMutation>[0]),
    update,
  })

  function toggleLanguage(lang: string) {
    setField(
      'focusedLanguages',
      form.focusedLanguages.includes(lang)
        ? form.focusedLanguages.filter((l) => l !== lang)
        : [...form.focusedLanguages, lang],
    )
  }

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
        <h2
          className="text-lg font-semibold mb-6"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Pool Profile
        </h2>

        <div className="space-y-4">
          <GlassInput
            label="Pool Name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            error={errors.name}
            placeholder="Blue Lagoon Training Pool"
            autoComplete="organization"
          />

          <LocationPicker
            label="Location"
            value={form.location}
            onChange={(loc) => setField('location', loc)}
            error={errors.location}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput
              label="Contact Email"
              type="email"
              value={form.contactEmail}
              onChange={(e) => setField('contactEmail', e.target.value)}
              error={errors.contactEmail}
              placeholder="pool@example.com"
              autoComplete="email"
            />
            <GlassInput
              label="Contact Phone"
              type="tel"
              value={form.contactPhone}
              onChange={(e) => setField('contactPhone', e.target.value)}
              error={errors.contactPhone}
              placeholder="+66 81 234 5678"
              autoComplete="tel"
            />
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

        {/* Languages */}
        <div className="mt-5">
          <p
            className="text-sm font-medium mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Languages Spoken
          </p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map(({ code, label }) => {
              const selected = form.focusedLanguages.includes(code)
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleLanguage(code)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-[var(--border-radius)] border transition-all"
                  style={{
                    background: selected ? 'var(--color-primary)' : 'var(--color-glass-bg)',
                    borderColor: selected ? 'var(--color-primary)' : 'var(--color-glass-border)',
                    color: selected
                      ? 'var(--color-text-on-primary)'
                      : 'var(--color-text-secondary)',
                    backdropFilter: selected ? undefined : 'blur(var(--glass-blur))',
                    transitionDuration: 'var(--transition-speed)',
                  }}
                >
                  {selected && <Check size={12} />}
                  {label}
                </button>
              )
            })}
          </div>
          {errors.focusedLanguages && (
            <p className="text-sm mt-2" style={{ color: 'var(--color-destructive)' }}>
              {errors.focusedLanguages}
            </p>
          )}
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
          <GlassButton type="submit" loading={saving} disabled={saving}>
            {isUpdate ? 'Save Changes' : 'Create Profile'}
          </GlassButton>
        </div>
      </GlassCard>
    </form>
  )
}
