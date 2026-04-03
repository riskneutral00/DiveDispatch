'use client'

import { z } from 'zod'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { GlassCard } from '@/components/ui/glass-card'
import { GlassCheckbox } from '@/components/ui/glass-checkbox'
import { GlassInput } from '@/components/ui/glass-input'
import {
  poolContactSchema,
  poolCapabilitiesSchema,
} from '@/lib/schemas/profile-shared'
import {
  contactFieldsFromProfile,
  createOptimisticLocationOnChange,
  locationToPayload,
  nullableProfileLocation,
} from '@/lib/profile-form/location'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

// ── Types ────────────────────────────────────────────────────────────

export type PoolProfileSection = 'contact' | 'capabilities'

export type PoolSectionProps = {
  profile: Record<string, unknown> | null | undefined
  me?: Record<string, unknown> | null | undefined
  create: (payload: Record<string, unknown>) => Promise<unknown>
  update: (payload: Record<string, unknown>) => Promise<unknown>
  onSaved?: () => void
}

// ── Contact section ──────────────────────────────────────────────────

export type PoolContactFormState = {
  name: string
  location: LocationValue | null
  email: string
  phone: string
}

export const INITIAL_POOL_CONTACT_FORM: PoolContactFormState = {
  name: '',
  location: null,
  email: '',
  phone: '',
}

export function poolContactFromProfile(p: Record<string, unknown>): PoolContactFormState {
  const c = contactFieldsFromProfile(p)
  return {
    name: c.name,
    location: c.location as LocationValue,
    email: c.email,
    phone: c.phone,
  }
}

export function poolContactToPayload(f: PoolContactFormState): Record<string, unknown> {
  return {
    name: f.name,
    ...locationToPayload(f.location!),
    email: f.email,
    phone: f.phone,
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

export function PoolContactSection({ profile: existing, me, create, update, onSaved }: PoolSectionProps) {
  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } =
    useProfileForm({
      profile: existing,
      me,
      schema: poolContactSchema,
      defaults: INITIAL_POOL_CONTACT_FORM,
      fromProfile: poolContactFromProfile,
      fromMe: (u, defaults) => ({
        ...defaults,
        email: (u.email as string) ?? '',
        phone: (u.phone as string) ?? '',
      }),
      toPayload: poolContactToPayload,
      create: (payload) => create(buildPoolCreatePayload(payload)),
      update,
      onSaved,
    })

  const onLocationChange = createOptimisticLocationOnChange({ setField, update, isUpdate })

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

function parseNumber(raw: string, isInt: boolean): number {
  if (raw === '') return 0
  const parsed = isInt ? parseInt(raw, 10) : parseFloat(raw)
  return isNaN(parsed) ? 0 : parsed
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

  if (!existing) {
    return (
      <GlassCard padding="md">
        <p className="text-sm text-secondary">Complete contact info first</p>
      </GlassCard>
    )
  }

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

// ── Legacy monolithic exports (backward-compat for existing tests) ────

/** @deprecated Use poolContactSchema + poolCapabilitiesSchema instead. */
export const poolSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: nullableProfileLocation(),
  email: z.string().email('Invalid email'),
  phone: z.string().min(1, 'Phone is required'),
  maxDepth: z.number().positive('Must be greater than 0'),
  maxCapacity: z.number().int('Must be a whole number').positive('Must be at least 1'),
  confinedCapable: z.boolean(),
})

/** @deprecated Use PoolContactFormState + PoolCapabilitiesFormState instead. */
export type PoolFormState = {
  name: string
  location: LocationValue | null
  email: string
  phone: string
  maxDepth: number
  maxCapacity: number
  confinedCapable: boolean
}

/** @deprecated Use INITIAL_POOL_CONTACT_FORM + INITIAL_POOL_CAPABILITIES_FORM instead. */
export const INITIAL_POOL_FORM: PoolFormState = {
  name: '',
  location: null,
  email: '',
  phone: '',
  maxDepth: 0,
  maxCapacity: 0,
  confinedCapable: false,
}

/** @deprecated Use poolContactFromProfile + poolCapabilitiesFromProfile instead. */
export function poolFromProfile(p: Record<string, unknown>): PoolFormState {
  const c = contactFieldsFromProfile(p)
  return {
    name: c.name,
    location: c.location as LocationValue,
    email: (p.email as string) ?? '',
    phone: (p.phone as string) ?? '',
    maxDepth: (p.maxDepth as number) ?? 0,
    maxCapacity: (p.maxCapacity as number) ?? 0,
    confinedCapable: (p.confinedCapable as boolean) ?? false,
  }
}

/** @deprecated Use poolContactToPayload + poolCapabilitiesToPayload instead. */
export function poolToPayload(f: PoolFormState): Record<string, unknown> {
  return {
    name: f.name,
    ...locationToPayload(f.location!),
    email: f.email,
    phone: f.phone,
    maxDepth: f.maxDepth,
    maxCapacity: f.maxCapacity,
    confinedCapable: f.confinedCapable,
  }
}
