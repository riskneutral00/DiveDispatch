'use client'

import { LocationPicker, type LocationValue } from '@/components/profiles/location-picker-lazy'
import { SectionDivider } from '@/components/ui/section-divider'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { VenueCapabilitiesSection } from '@/components/profiles/venue-capabilities-section'
import {
  INITIAL_ACCESS_CONTROL,
  accessFromProfile,
  accessToPayload,
  type AccessControlState,
} from '@/components/profiles/access-control-section'
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
import { DIVE_SITE_TYPES, type DiveSiteType } from '../../../convex/shared/venueTypes'

const DIVE_SITE_TYPE_LABELS: Record<DiveSiteType, string> = {
  shore: 'Shore',
  reef: 'Reef',
  lake: 'Lake',
  river: 'River',
  quarry: 'Quarry',
  other: 'Other',
}

export type DiveSiteProfileSection = 'details' | 'capabilities'

type DiveSiteSectionProps = BaseProfileSectionProps

export type DiveSiteDetailsFormState = {
  name: string
  location: LocationValue | null
  diveSiteTypes: DiveSiteType[]
  access: AccessControlState
}

export const INITIAL_DIVE_SITE_DETAILS_FORM: DiveSiteDetailsFormState = {
  name: '',
  location: null,
  diveSiteTypes: [],
  access: INITIAL_ACCESS_CONTROL,
}

export function diveSiteDetailsFromProfile(p: Record<string, unknown>): DiveSiteDetailsFormState {
  const { name, location } = contactFieldsFromProfile(p)
  return {
    name,
    location: location as LocationValue,
    diveSiteTypes: (p.diveSiteTypes as DiveSiteType[] | undefined) ?? [],
    access: accessFromProfile(p),
  }
}

export function diveSiteDetailsToPayload(f: DiveSiteDetailsFormState): Record<string, unknown> {
  return {
    name: f.name,
    ...locationToPayload(f.location!),
    diveSiteTypes: f.diveSiteTypes,
    ...accessToPayload(f.access),
  }
}

export function buildDiveSiteCreatePayload<T extends Record<string, unknown>>(payload: T) {
  return {
    ...payload,
    venueCategory: 'diveSite' as const,
    hasCompressor: false,
  }
}

export function DiveSiteDetailsSection({ profile: existing, me, create, update, onSaved, onClose }: DiveSiteSectionProps) {
  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit, resetToBaseline } =
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
  const toggleSubtype = (subtype: DiveSiteType, checked: boolean) => {
    const current = form.diveSiteTypes
    const next = checked
      ? Array.from(new Set([...current, subtype]))
      : current.filter((s) => s !== subtype)
    setField('diveSiteTypes', next)
  }

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
      <div className="space-y-4">
        <div className="grid grid-cols-6 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:gap-4 w-full"> {/* design-ok */}
          <Input
            label="Site Name"
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

        <SectionDivider show />

        <div className="flex flex-col gap-2">
          <FormSectionHeader label="Site Types" required />
          <div className="flex flex-wrap gap-3">
            {DIVE_SITE_TYPES.map((subtype) => (
              <Checkbox
                key={subtype}
                label={DIVE_SITE_TYPE_LABELS[subtype]}
                checked={form.diveSiteTypes.includes(subtype)}
                onChange={(v) => toggleSubtype(subtype, v)}
              />
            ))}
          </div>
          {errors.diveSiteTypes && (
            <span className="text-label text-destructive">{errors.diveSiteTypes}</span>
          )}
        </div>
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
    ...(f.maxCapacity > 0 ? { maxCapacity: f.maxCapacity } : {}),
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
      wrapCreatePayload={buildDiveSiteCreatePayload}
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
  onClose,
}: DiveSiteSectionProps & { section?: DiveSiteProfileSection }) {
  if (section === 'capabilities')
    return <DiveSiteCapabilitiesSection profile={profile} me={me} create={create} update={update} onClose={onClose} />
  return <DiveSiteDetailsSection profile={profile} me={me} create={create} update={update} onSaved={onSaved} onClose={onClose} />
}
