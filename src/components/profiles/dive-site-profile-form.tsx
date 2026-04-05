'use client'

import { z } from 'zod'

import { LocationPicker, type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileFormSectionDivider } from '@/components/profiles/profile-form-section-divider'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { ProfileIncompleteGuard } from '@/components/profiles/profile-incomplete-guard'
import {
  diveSiteDetailsSchema,
  diveSiteCapabilitiesSchema,
} from '@/lib/schemas/profile-shared'
import {
  contactFieldsFromProfile,
  locationToPayload,
  nullableProfileLocation,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { parseNumber } from '@/lib/utils/numbers'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

// ── Constants ─────────────────────────────────────────────────────────

const VENUE_TYPE_OPTIONS: SelectOption[] = [
  { id: 'Shore', label: 'Shore' },
  { id: 'Reef', label: 'Reef' },
  { id: 'Lake', label: 'Lake' },
  { id: 'River', label: 'River' },
  { id: 'Quarry', label: 'Quarry' },
  { id: 'Other', label: 'Other' },
]

// ── Types ─────────────────────────────────────────────────────────────

export type DiveSiteProfileSection = 'details' | 'capabilities'

type DiveSiteSectionProps = BaseProfileSectionProps

// ── Details section ───────────────────────────────────────────────────

export type DiveSiteDetailsFormState = {
  name: string
  location: LocationValue | null
  venueType: 'Shore' | 'Reef' | 'Lake' | 'River' | 'Quarry' | 'Other'
}

export const INITIAL_DIVE_SITE_DETAILS_FORM: DiveSiteDetailsFormState = {
  name: '',
  location: null,
  venueType: 'Shore',
}

export function diveSiteDetailsFromProfile(p: Record<string, unknown>): DiveSiteDetailsFormState {
  const { name, location } = contactFieldsFromProfile(p)
  return {
    name,
    location: location as LocationValue,
    venueType: (p.venueType as DiveSiteDetailsFormState['venueType']) ?? 'Shore',
  }
}

export function diveSiteDetailsToPayload(f: DiveSiteDetailsFormState): Record<string, unknown> {
  return {
    name: f.name,
    ...locationToPayload(f.location!),
    venueType: f.venueType,
  }
}

export function buildDiveSiteCreatePayload<T extends Record<string, unknown>>(payload: T) {
  return {
    ...payload,
    hasCompressor: false,
  }
}

export function DiveSiteDetailsSection({ profile: existing, me, create, update, onSaved }: DiveSiteSectionProps) {
  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } =
    useProfileForm({
      profile: existing,
      me,
      schema: diveSiteDetailsSchema,
      defaults: INITIAL_DIVE_SITE_DETAILS_FORM,
      fromProfile: diveSiteDetailsFromProfile,
      fromMe: (_u, defaults) => ({ ...defaults }),
      toPayload: diveSiteDetailsToPayload,
      create: (payload) => create(buildDiveSiteCreatePayload(payload)),
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
      className="space-y-6"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <Input
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

        <Select
          label="Site Type"
          value={form.venueType}
          onChange={(val) => setField('venueType', val as DiveSiteDetailsFormState['venueType'])}
          options={VENUE_TYPE_OPTIONS}
          error={errors.venueType}
          required
        />
      </div>
    </ProfileFormShell>
  )
}

// ── Capabilities section ──────────────────────────────────────────────

export type DiveSiteCapabilitiesFormState = {
  confinedCapable: boolean
  maxDepth: number
  maxCapacity: number
  isPublic: boolean
}

export const INITIAL_DIVE_SITE_CAPABILITIES_FORM: DiveSiteCapabilitiesFormState = {
  confinedCapable: false,
  maxDepth: 0,
  maxCapacity: 0,
  isPublic: false,
}

export function diveSiteCapabilitiesFromProfile(p: Record<string, unknown>): DiveSiteCapabilitiesFormState {
  return {
    confinedCapable: (p.confinedCapable as boolean) ?? false,
    maxDepth: (p.maxDepth as number) ?? 0,
    maxCapacity: (p.maxCapacity as number) ?? 0,
    isPublic: (p.isPublic as boolean) ?? false,
  }
}

export function diveSiteCapabilitiesToPayload(f: DiveSiteCapabilitiesFormState): Record<string, unknown> {
  return {
    confinedCapable: f.confinedCapable,
    ...(f.maxDepth > 0 ? { maxDepth: f.maxDepth } : {}),
    maxCapacity: f.maxCapacity,
    isPublic: f.isPublic,
  }
}

export function DiveSiteCapabilitiesSection({ profile: existing, create, update }: DiveSiteSectionProps) {
  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } =
    useProfileForm({
      profile: existing,
      schema: diveSiteCapabilitiesSchema,
      defaults: INITIAL_DIVE_SITE_CAPABILITIES_FORM,
      fromProfile: diveSiteCapabilitiesFromProfile,
      toPayload: diveSiteCapabilitiesToPayload,
      create,
      update,
    })

  if (!existing) return <ProfileIncompleteGuard message="Complete details first" />

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
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-secondary">
            Site Capabilities
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Checkbox
              label="Confined Water Capable"
              checked={form.confinedCapable}
              onChange={(v) => setField('confinedCapable', v)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Max Depth (m)"
            type="number"
            min="0.1"
            step="0.1"
            value={form.maxDepth || ''}
            onChange={(e) => setField('maxDepth', parseNumber(e.target.value, false))}
            error={errors.maxDepth}
            placeholder="18"
          />
          <Input
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
          <Checkbox
            label="List this site publicly in the booking wizard"
            checked={form.isPublic}
            onChange={(v) => setField('isPublic', v)}
          />
        </div>
      </div>
    </ProfileFormShell>
  )
}

// ── Compat alias ──────────────────────────────────────────────────────

/**
 * Dispatches to the appropriate section component based on the `section` prop.
 * The app-layer ConnectedDiveSiteForm short-circuits before this is reached
 * at runtime; this export exists so that the lib-layer registry continues to
 * type-check without modification.
 */
export function DiveSiteProfileForm({
  section,
  profile,
  me,
  create,
  update,
  onSaved,
}: DiveSiteSectionProps & { section?: DiveSiteProfileSection }) {
  if (section === 'capabilities')
    return <DiveSiteCapabilitiesSection profile={profile} create={create} update={update} />
  return <DiveSiteDetailsSection profile={profile} me={me} create={create} update={update} onSaved={onSaved} />
}

