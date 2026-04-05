'use client'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { ProfileIncompleteGuard } from '@/components/profiles/profile-incomplete-guard'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  poolContactSchema,
  poolCapabilitiesSchema,
} from '@/lib/schemas/profile-shared'
import {
  INITIAL_CONTACT_FORM,
  contactFromProfile,
  contactToPayload,
  defaultFromMe,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { parseNumber } from '@/lib/utils/numbers'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

// ── Types ────────────────────────────────────────────────────────────

export type PoolProfileSection = 'contact' | 'capabilities'

type PoolSectionProps = BaseProfileSectionProps

// ── Contact section ──────────────────────────────────────────────────


export function buildPoolCreatePayload<T extends Record<string, unknown>>(payload: T) {
  return {
    ...payload,
    venueType: 'Pool' as const,
    isPublic: false,
    hasCompressor: false,
  }
}

export function PoolContactSection({ profile: existing, me, create, update, onSaved }: PoolSectionProps) {
  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } =
    useProfileForm({
      profile: existing,
      me,
      schema: poolContactSchema,
      defaults: INITIAL_CONTACT_FORM,
      fromProfile: contactFromProfile,
      fromMe: defaultFromMe,
      toPayload: contactToPayload,
      create: (payload) => create(buildPoolCreatePayload(payload)),
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
        <ProfileBasicInfo
          nameValue={form.name}
          onNameChange={(val) => setField('name', val)}
          nameError={errors.name}
          nameLabel="Business Name"
          namePlaceholder="Blue Lagoon Training Pool"
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
    </ProfileFormShell>
  )
}

// ── Capabilities section ─────────────────────────────────────────────

export type PoolCapabilitiesFormState = {
  confinedCapable: boolean
  maxDepth: number
  maxCapacity: number
}

export const INITIAL_POOL_CAPABILITIES_FORM: PoolCapabilitiesFormState = {
  confinedCapable: false,
  maxDepth: 0,
  maxCapacity: 0,
}

export function poolCapabilitiesFromProfile(p: Record<string, unknown>): PoolCapabilitiesFormState {
  return {
    confinedCapable: (p.confinedCapable as boolean) ?? false,
    maxDepth: (p.maxDepth as number) ?? 0,
    maxCapacity: (p.maxCapacity as number) ?? 0,
  }
}

export function poolCapabilitiesToPayload(f: PoolCapabilitiesFormState): Record<string, unknown> {
  return {
    confinedCapable: f.confinedCapable,
    maxDepth: f.maxDepth,
    maxCapacity: f.maxCapacity,
  }
}

export function PoolCapabilitiesSection({ profile: existing, create, update }: PoolSectionProps) {
  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } =
    useProfileForm({
      profile: existing,
      schema: poolCapabilitiesSchema,
      defaults: INITIAL_POOL_CAPABILITIES_FORM,
      fromProfile: poolCapabilitiesFromProfile,
      toPayload: poolCapabilitiesToPayload,
      create,
      update,
    })

  if (!existing) return <ProfileIncompleteGuard />

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
            Venue Capabilities
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
            placeholder="5"
          />
          <Input
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
    </ProfileFormShell>
  )
}

// ── Compat alias ─────────────────────────────────────────────────────

/**
 * Dispatches to the appropriate section component based on the `section` prop.
 * The app-layer ConnectedPoolForm short-circuits before this is reached
 * at runtime; this export exists so that the lib-layer registry in
 * connected-role-forms.tsx continues to type-check without modification.
 */
export function PoolProfileForm({
  section,
  profile,
  me,
  create,
  update,
  onSaved,
}: PoolSectionProps & { section?: PoolProfileSection }) {
  if (section === 'capabilities')
    return <PoolCapabilitiesSection profile={profile} create={create} update={update} />
  return <PoolContactSection profile={profile} me={me} create={create} update={update} onSaved={onSaved} />
}

