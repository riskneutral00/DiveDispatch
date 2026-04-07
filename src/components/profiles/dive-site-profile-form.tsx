'use client'

import { LocationPicker, type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileFormSectionDivider } from '@/components/profiles/profile-form-section-divider'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { VenueCapabilitiesSection } from '@/components/profiles/venue-capabilities-section'
import {
  diveSiteDetailsSchema,
  diveSiteCapabilitiesSchema,
} from '@/lib/schemas/profile-shared'
import {
  contactFieldsFromProfile,
  locationToPayload,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

const VENUE_TYPE_OPTIONS: SelectOption[] = [
  { id: 'Shore', label: 'Shore' },
  { id: 'Reef', label: 'Reef' },
  { id: 'Lake', label: 'Lake' },
  { id: 'River', label: 'River' },
  { id: 'Quarry', label: 'Quarry' },
  { id: 'Other', label: 'Other' },
]

export type DiveSiteProfileSection = 'details' | 'capabilities'

type DiveSiteSectionProps = BaseProfileSectionProps

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
        <div className="grid grid-cols-6 gap-4 w-full"> {/* design-ok */}
          <Input
            label="Site Name"
            placeholder="Shark Bay Reef"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            error={errors.name}
            required
            className="field-name"
          />
          <LocationPicker
            label="Location"
            value={form.location}
            onChange={onLocationChange}
            error={errors.location}
            required
            className="field-location"
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

export type DiveSiteCapabilitiesFormState = {
  confinedCapable: boolean
  maxDepth: number
  maxCapacity: number
}

export const INITIAL_DIVE_SITE_CAPABILITIES_FORM: DiveSiteCapabilitiesFormState = {
  confinedCapable: false,
  maxDepth: 0,
  maxCapacity: 0,
}

export function diveSiteCapabilitiesFromProfile(p: Record<string, unknown>): DiveSiteCapabilitiesFormState {
  return {
    confinedCapable: (p.confinedCapable as boolean) ?? false,
    maxDepth: (p.maxDepth as number) ?? 0,
    maxCapacity: (p.maxCapacity as number) ?? 0,
  }
}

export function diveSiteCapabilitiesToPayload(f: DiveSiteCapabilitiesFormState): Record<string, unknown> {
  return {
    confinedCapable: f.confinedCapable,
    ...(f.maxDepth > 0 ? { maxDepth: f.maxDepth } : {}),
    maxCapacity: f.maxCapacity,
  }
}

export function DiveSiteCapabilitiesSection(props: DiveSiteSectionProps) {
  return (
    <VenueCapabilitiesSection
      {...props}
      schema={diveSiteCapabilitiesSchema}
      defaults={INITIAL_DIVE_SITE_CAPABILITIES_FORM}
      fromProfile={diveSiteCapabilitiesFromProfile}
      toPayload={diveSiteCapabilitiesToPayload}
      venueType="diveSite"
      incompleteMessage="Complete details first"
      capabilitiesLabel="Site Capabilities"
      depthPlaceholder="18"
      capacityPlaceholder="20"
    />
  )
}

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
