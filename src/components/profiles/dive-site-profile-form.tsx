'use client'

import { z } from 'zod'

import { LocationPicker, type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileFormSectionDivider } from '@/components/profiles/profile-form-section-divider'
import { GlassCheckbox } from '@/components/ui/glass-checkbox'
import { GlassInput } from '@/components/ui/glass-input'
import { GlassSelect, type GlassSelectOption } from '@/components/ui/glass-select'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import {
  contactFieldsFromProfile,
  createOptimisticLocationOnChange,
  locationToPayload,
  nullableProfileLocation,
} from '@/lib/profile-form/location'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

const VENUE_TYPE_OPTIONS: GlassSelectOption[] = [
  { id: 'Shore', label: 'Shore' },
  { id: 'Reef', label: 'Reef' },
  { id: 'Lake', label: 'Lake' },
  { id: 'River', label: 'River' },
  { id: 'Quarry', label: 'Quarry' },
  { id: 'Other', label: 'Other' },
]

export const diveSiteSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: nullableProfileLocation(),
  venueType: z.enum(['Shore', 'Reef', 'Lake', 'River', 'Quarry', 'Other']),
  maxCapacity: z.number().int('Must be a whole number').positive('Must be at least 1'),
  maxDepth: z.number().min(0).optional(),
  confinedCapable: z.boolean(),
  isPublic: z.boolean(),
})

export type DiveSiteFormState = {
  name: string
  location: LocationValue | null
  venueType: 'Shore' | 'Reef' | 'Lake' | 'River' | 'Quarry' | 'Other'
  maxCapacity: number
  maxDepth: number
  confinedCapable: boolean
  isPublic: boolean
}

export const INITIAL_DIVE_SITE_FORM: DiveSiteFormState = {
  name: '',
  location: null,
  venueType: 'Shore',
  maxCapacity: 0,
  maxDepth: 0,
  confinedCapable: false,
  isPublic: false,
}

function parseNumber(raw: string, isInt: boolean): number {
  if (raw === '') return 0
  const parsed = isInt ? parseInt(raw, 10) : parseFloat(raw)
  return isNaN(parsed) ? 0 : parsed
}

export function diveSiteFromProfile(p: Record<string, unknown>): DiveSiteFormState {
  const { name, location } = contactFieldsFromProfile(p)
  return {
    name,
    location: location as LocationValue,
    venueType: (p.venueType as DiveSiteFormState['venueType']) ?? 'Shore',
    maxCapacity: (p.maxCapacity as number) ?? 0,
    maxDepth: (p.maxDepth as number) ?? 0,
    confinedCapable: (p.confinedCapable as boolean) ?? false,
    isPublic: (p.isPublic as boolean) ?? false,
  }
}

export function diveSiteToPayload(f: DiveSiteFormState): Record<string, unknown> {
  return {
    name: f.name,
    ...locationToPayload(f.location!),
    venueType: f.venueType,
    maxCapacity: f.maxCapacity,
    ...(f.maxDepth > 0 ? { maxDepth: f.maxDepth } : {}),
    confinedCapable: f.confinedCapable,
    isPublic: f.isPublic,
  }
}

export function buildDiveSiteCreatePayload<T extends Record<string, unknown>>(payload: T) {
  return {
    ...payload,
    hasCompressor: false,
  }
}

export type DiveSiteProfileFormProps = {
  profile: Record<string, unknown> | null | undefined
  me: Record<string, unknown> | null | undefined
  create: (payload: Record<string, unknown>) => Promise<unknown>
  update: (payload: Record<string, unknown>) => Promise<unknown>
}

export function DiveSiteProfileForm({ profile, me, create: createMutation, update }: DiveSiteProfileFormProps) {

  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, loading, isUpdate, handleSubmit } = useProfileForm({
    profile,
    me: me ?? undefined,
    schema: diveSiteSchema,
    defaults: INITIAL_DIVE_SITE_FORM,
    fromProfile: diveSiteFromProfile,
    fromMe: (_u, initial) => ({
      ...initial,
    }),
    toPayload: diveSiteToPayload,
    create: (payload) =>
      createMutation(buildDiveSiteCreatePayload(payload)),
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
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <GlassInput
            label="Site Name"
            placeholder="Shark Bay Reef"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            error={errors.name}
            required
          />
          <LocationPicker
            label="Location"
            value={form.location}
            onChange={onLocationChange}
            error={errors.location}
            required
          />
        </div>

        <ProfileFormSectionDivider show />

        <GlassSelect
          label="Site Type"
          value={form.venueType}
          onChange={(val) => setField('venueType', val as DiveSiteFormState['venueType'])}
          options={VENUE_TYPE_OPTIONS}
          error={errors.venueType}
          required
        />

        <ProfileFormSectionDivider show />

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-secondary">
            Site Capabilities
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GlassCheckbox
              label="Confined Water Capable"
              checked={form.confinedCapable}
              onChange={(v) => setField('confinedCapable', v)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <GlassInput
            label="Max Depth (m)"
            type="number"
            min="0.1"
            step="0.1"
            value={form.maxDepth || ''}
            onChange={(e) => setField('maxDepth', parseNumber(e.target.value, false))}
            error={errors.maxDepth}
            placeholder="18"
          />
          <GlassInput
            label="Max Capacity (divers)"
            type="number"
            min="1"
            step="1"
            value={form.maxCapacity || ''}
            onChange={(e) => setField('maxCapacity', parseNumber(e.target.value, true))}
            error={errors.maxCapacity}
            placeholder="20"
            required
          />
        </div>

        <ProfileFormSectionDivider show />

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-secondary">
            Visibility
          </span>
          <GlassCheckbox
            label="List this site publicly in the booking wizard"
            checked={form.isPublic}
            onChange={(v) => setField('isPublic', v)}
          />
        </div>
      </div>
    </ProfileFormShell>
  )
}
