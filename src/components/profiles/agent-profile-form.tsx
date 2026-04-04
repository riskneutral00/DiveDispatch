'use client'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileAgencyInfo } from '@/components/profiles/profile-agency-info'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileLanguagesSection } from '@/components/profiles/profile-languages-section'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import {
  languagesFromProfile,
  languagesToPayload,
} from '@/lib/profile-form/languages'
import {
  contactFieldsFromProfile,
  locationToPayload,
} from '@/lib/profile-form/location'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import {
  agentContactSchema,
  agentLanguagesSchema,
  agentAssociationsSchema,
  associationSchema,
} from '@/lib/schemas/profile-shared'
import type { Language } from '@/lib/types/language'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentProfileSection = 'contact' | 'languages' | 'associations'

type AssociationData = z.infer<typeof associationSchema>

export type AgentContactFormState = {
  name: string
  location: LocationValue | null
  email: string
  phone: string
  defaultReferralMode: 'independent' | 'referral'
}

export type AgentLanguagesFormState = {
  customerLanguages: Language[]
}

export type AgentAssociationsFormState = {
  associations: AssociationData[]
}

// ---------------------------------------------------------------------------
// Initial defaults
// ---------------------------------------------------------------------------

export const INITIAL_CONTACT_FORM: AgentContactFormState = {
  name: '',
  location: null,
  email: '',
  phone: '',
  defaultReferralMode: 'independent',
}

export const INITIAL_LANGUAGES_FORM: AgentLanguagesFormState = {
  customerLanguages: [],
}

export const INITIAL_ASSOCIATIONS_FORM: AgentAssociationsFormState = {
  associations: [],
}

// ---------------------------------------------------------------------------
// fromProfile / toPayload helpers
// ---------------------------------------------------------------------------

export function contactFromProfile(p: Record<string, unknown>): AgentContactFormState {
  const c = contactFieldsFromProfile(p)
  return {
    name: c.name,
    location: c.location as LocationValue,
    email: c.email,
    phone: c.phone,
    defaultReferralMode: (p.defaultReferralMode as 'independent' | 'referral') ?? 'independent',
  }
}

export function contactToPayload(f: AgentContactFormState): Record<string, unknown> {
  return {
    name: f.name,
    ...locationToPayload(f.location!),
    email: f.email,
    phone: f.phone,
    defaultReferralMode: f.defaultReferralMode,
  }
}

export function languagesFromProfileAgent(
  _p: Record<string, unknown>,
  me: { customerLanguages?: string[] } | undefined,
): AgentLanguagesFormState {
  return {
    customerLanguages: languagesFromProfile(me?.customerLanguages),
  }
}

export function languagesToPayloadAgent(_f: AgentLanguagesFormState): Record<string, unknown> {
  return {}
}

export function associationsFromProfile(p: Record<string, unknown>): AgentAssociationsFormState {
  return {
    associations:
      ((p.associations as Array<Record<string, unknown>>) ?? []).map((a) => ({
        agency: String(a.agency ?? ''),
        number: String(a.number ?? ''),
      })),
  }
}

export function associationsToPayload(f: AgentAssociationsFormState): Record<string, unknown> {
  return {
    associations: f.associations,
  }
}

// ---------------------------------------------------------------------------
// Section prop types
// ---------------------------------------------------------------------------

type BaseProps = {
  profile: Record<string, unknown> | null | undefined
  me?: Record<string, unknown> | null | undefined
  create: (payload: Record<string, unknown>) => Promise<unknown>
  update: (payload: Record<string, unknown>) => Promise<unknown>
}

export type AgentContactSectionProps = BaseProps

export type AgentLanguagesSectionProps = {
  profile: Record<string, unknown> | null | undefined
  me: Record<string, unknown> | null | undefined
  update: (payload: Record<string, unknown>) => Promise<unknown>
  updateProfile: (payload: Record<string, unknown>) => Promise<unknown>
}

export type AgentAssociationsSectionProps = {
  profile: Record<string, unknown> | null | undefined
  create: (payload: Record<string, unknown>) => Promise<unknown>
  update: (payload: Record<string, unknown>) => Promise<unknown>
}

// ---------------------------------------------------------------------------
// AgentContactSection
// ---------------------------------------------------------------------------

export function AgentContactSection({ profile, me, create, update }: AgentContactSectionProps) {
  const {
    form,
    setField,
    errors,
    footerErrorMessage,
    saving,
    saved,
    isDirty,
    isValid,
    loading,
    isUpdate,
    handleSubmit,
  } = useProfileForm({
    profile,
    me,
    schema: agentContactSchema,
    defaults: INITIAL_CONTACT_FORM,
    fromProfile: contactFromProfile,
    fromMe: (u, defaults) => ({
      ...defaults,
      email: (u.email as string) ?? '',
      phone: (u.phone as string) ?? '',
    }),
    toPayload: contactToPayload,
    create,
    update,
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
          nameLabel="Agent / Business Name"
          namePlaceholder="Your name or agency"
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

      {/* Referral mode */}
      <div>
        <FormSectionHeader label="Default Booking Mode" />
        <div className="flex gap-3 mt-2">
          {(['independent', 'referral'] as const).map((mode) => {
            const active = form.defaultReferralMode === mode
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setField('defaultReferralMode', mode)}
                className="flex-1 py-2.5 px-4 rounded-[var(--border-radius)] text-sm font-medium border transition-all"
                style={{
                  background: active ? 'var(--color-primary)' : 'var(--color-glass-bg)',
                  borderColor: active ? 'var(--color-primary)' : 'var(--color-glass-border)',
                  color: active ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
                  backdropFilter: active ? undefined : 'blur(var(--glass-blur))',
                  transitionDuration: 'var(--transition-speed)',
                }}
              >
                {mode === 'independent' ? 'Independent' : 'Referral Only'}
              </button>
            )
          })}
        </div>
        <p className="text-xs mt-2 text-secondary">
          {form.defaultReferralMode === 'independent'
            ? 'You create and manage bookings directly.'
            : 'You refer customers to operators who manage the booking.'}
        </p>
        {errors.defaultReferralMode && (
          <p className="text-sm mt-1" style={{ color: 'var(--color-destructive)' }}>
            {errors.defaultReferralMode}
          </p>
        )}
      </div>
    </ProfileFormShell>
  )
}

// ---------------------------------------------------------------------------
// AgentLanguagesSection
// ---------------------------------------------------------------------------

export function AgentLanguagesSection({ profile, me, update, updateProfile }: AgentLanguagesSectionProps) {
  const meTyped = (me ?? undefined) as { customerLanguages?: string[] } | undefined

  const {
    form,
    setField,
    footerErrorMessage,
    saving,
    saved,
    isDirty,
    isValid,
    loading,
    isUpdate,
    handleSubmit,
  } = useProfileForm({
    profile,
    me,
    schema: agentLanguagesSchema,
    defaults: INITIAL_LANGUAGES_FORM,
    waitForMeBeforeInit: true,
    fromProfile: (_p) => languagesFromProfileAgent(_p, meTyped),
    fromMe: (u, defaults) => ({
      ...defaults,
      customerLanguages: languagesFromProfile((u as { customerLanguages?: string[] }).customerLanguages),
    }),
    toPayload: languagesToPayloadAgent,
    afterSuccessfulSave: async (f) => {
      await updateProfile({ customerLanguages: languagesToPayload(f.customerLanguages) })
    },
    create: update,
    update,
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
      disableSaveWhenInvalid
      isValid={isValid}
      className="space-y-6"
    >
      <ProfileLanguagesSection
        variant="customer"
        value={form.customerLanguages}
        onChange={(langs) => setField('customerLanguages', langs)}
      />
    </ProfileFormShell>
  )
}

// ---------------------------------------------------------------------------
// AgentAssociationsSection
// ---------------------------------------------------------------------------

export function AgentAssociationsSection({ profile, create, update }: AgentAssociationsSectionProps) {
  const {
    form,
    setField,
    errors,
    footerErrorMessage,
    saving,
    saved,
    isDirty,
    isValid,
    loading,
    isUpdate,
    handleSubmit,
  } = useProfileForm({
    profile,
    schema: agentAssociationsSchema,
    defaults: INITIAL_ASSOCIATIONS_FORM,
    fromProfile: associationsFromProfile,
    toPayload: associationsToPayload,
    create,
    update,
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
      disableSaveWhenInvalid
      isValid={isValid}
      className="space-y-6"
    >
      <ProfileAgencyInfo
        variant="agent"
        items={form.associations}
        onChange={(items) => setField('associations', items)}
        errors={errors as Record<string, string>}
      />
    </ProfileFormShell>
  )
}

// ---------------------------------------------------------------------------
// Compat alias — dispatches to the correct section component.
// The app-layer ConnectedAgentForm short-circuits before this is reached
// at runtime; this export exists so that the lib-layer registry in
// connected-role-forms.tsx continues to type-check without modification.
// ---------------------------------------------------------------------------

export type AgentProfileFormProps = {
  section?: AgentProfileSection
  profile: Record<string, unknown> | null | undefined
  me: Record<string, unknown> | null | undefined
  create: (payload: Record<string, unknown>) => Promise<unknown>
  update: (payload: Record<string, unknown>) => Promise<unknown>
  updateProfile: (payload: Record<string, unknown>) => Promise<unknown>
}

export function AgentProfileForm({ section, profile, me, create, update, updateProfile }: AgentProfileFormProps) {
  if (section === 'languages')
    return <AgentLanguagesSection profile={profile} me={me} update={update} updateProfile={updateProfile} />
  if (section === 'associations')
    return <AgentAssociationsSection profile={profile} create={create} update={update} />
  return <AgentContactSection profile={profile} me={me} create={create} update={update} />
}
