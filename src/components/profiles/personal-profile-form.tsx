'use client'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileAgencyInfo } from '@/components/profiles/profile-agency-info'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormHeader } from '@/components/profiles/profile-form-header'
import { ProfileLanguagesSection } from '@/components/profiles/profile-languages-section'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import {
  languagesFromProfile,
  languagesToPayload,
} from '@/lib/profile-form/languages'
import {
  contactFieldsFromProfile,
  createOptimisticLocationOnChange,
  locationToPayload,
} from '@/lib/profile-form/location'
import {
  personalContactSchema,
  personalLanguagesSchema,
  diveMasterCredentialsSchema,
  instructorCredentialsSchema,
  credentialSchema,
  instructorCredentialSchema,
} from '@/lib/schemas/profile-shared'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import type { Language } from '@/lib/types/language'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PersonalSection = 'contact' | 'languages' | 'credentials'
export type PersonalVariant = 'divemaster' | 'instructor'

type DmCredential = z.infer<typeof credentialSchema>
type InstCredential = z.infer<typeof instructorCredentialSchema>

export type PersonalCredential = DmCredential | InstCredential

// ── Contact ──────────────────────────────────────────────────────────────────

export type PersonalContactFormState = {
  name: string
  location: LocationValue | null
  email: string
  phone: string
}

export const INITIAL_CONTACT_FORM: PersonalContactFormState = {
  name: '',
  location: null,
  email: '',
  phone: '',
}

export function contactFromProfile(p: Record<string, unknown>): PersonalContactFormState {
  const c = contactFieldsFromProfile(p)
  return {
    name: c.name,
    location: c.location as LocationValue,
    email: c.email,
    phone: c.phone,
  }
}

export function contactToPayload(f: PersonalContactFormState): Record<string, unknown> {
  return {
    name: f.name,
    ...locationToPayload(f.location!),
    email: f.email,
    phone: f.phone,
  }
}

// ── Languages ─────────────────────────────────────────────────────────────────

export type PersonalLanguagesFormState = {
  teachingLanguages: Language[]
}

export const INITIAL_LANGUAGES_FORM: PersonalLanguagesFormState = {
  teachingLanguages: [],
}

export function languagesFromProfilePersonal(p: Record<string, unknown>): PersonalLanguagesFormState {
  return {
    teachingLanguages: languagesFromProfile(p.teachingLanguages as string[] | undefined),
  }
}

export function languagesToPayloadPersonal(f: PersonalLanguagesFormState): Record<string, unknown> {
  return {
    teachingLanguages: languagesToPayload(f.teachingLanguages),
  }
}

// ── Credentials ───────────────────────────────────────────────────────────────

export type PersonalCredentialsFormState = {
  credential: PersonalCredential[]
}

export function makeEmptyDmCredential(): DmCredential {
  return { agency: '', level: '', agencyID: '' }
}

export function makeEmptyInstCredential(): InstCredential {
  return { agency: '', level: '', agencyID: '', courses: [] }
}

export const INITIAL_DM_CREDENTIALS_FORM: PersonalCredentialsFormState = {
  credential: [makeEmptyDmCredential()],
}

export const INITIAL_INST_CREDENTIALS_FORM: PersonalCredentialsFormState = {
  credential: [makeEmptyInstCredential()],
}

export function credentialsFromProfile(
  p: Record<string, unknown>,
  variant: PersonalVariant,
): PersonalCredentialsFormState {
  const creds = (p.credential as PersonalCredential[] | undefined) ?? []
  return {
    credential:
      creds.length > 0
        ? creds
        : [variant === 'divemaster' ? makeEmptyDmCredential() : makeEmptyInstCredential()],
  }
}

export function credentialsToPayload(f: PersonalCredentialsFormState): Record<string, unknown> {
  return {
    credential: f.credential,
  }
}

// ---------------------------------------------------------------------------
// Section prop types
// ---------------------------------------------------------------------------

export type PersonalContactSectionProps = {
  variant: PersonalVariant
  profile: Record<string, unknown> | null | undefined
  me?: Record<string, unknown> | null | undefined
  create: (payload: Record<string, unknown>) => Promise<unknown>
  update: (payload: Record<string, unknown>) => Promise<unknown>
}

export type PersonalLanguagesSectionProps = {
  profile: Record<string, unknown> | null | undefined
  create: (payload: Record<string, unknown>) => Promise<unknown>
  update: (payload: Record<string, unknown>) => Promise<unknown>
}

export type PersonalCredentialsSectionProps = {
  variant: PersonalVariant
  profile: Record<string, unknown> | null | undefined
  create: (payload: Record<string, unknown>) => Promise<unknown>
  update: (payload: Record<string, unknown>) => Promise<unknown>
}

// ---------------------------------------------------------------------------
// PersonalContactSection
// ---------------------------------------------------------------------------

export function PersonalContactSection({
  variant,
  profile,
  me,
  create,
  update,
}: PersonalContactSectionProps) {
  const isDm = variant === 'divemaster'
  const namePlaceholder = isDm ? 'Your name' : 'Ariel Nemo'

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
    schema: personalContactSchema,
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
      {isDm && <ProfileFormHeader isUpdate={isUpdate} roleName="divemaster" />}

      <div className="space-y-4">
        <ProfileBasicInfo
          nameValue={form.name}
          onNameChange={(val) => setField('name', val)}
          nameError={errors.name}
          nameLabel="Full Name"
          namePlaceholder={namePlaceholder}
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

// ---------------------------------------------------------------------------
// PersonalLanguagesSection
// ---------------------------------------------------------------------------

export function PersonalLanguagesSection({ profile, create, update }: PersonalLanguagesSectionProps) {
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
    schema: personalLanguagesSchema,
    defaults: INITIAL_LANGUAGES_FORM,
    fromProfile: languagesFromProfilePersonal,
    toPayload: languagesToPayloadPersonal,
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
      <ProfileLanguagesSection
        variant="teaching"
        value={form.teachingLanguages}
        onChange={(langs) => setField('teachingLanguages', langs)}
      />
    </ProfileFormShell>
  )
}

// ---------------------------------------------------------------------------
// PersonalCredentialsSection
// ---------------------------------------------------------------------------

export function PersonalCredentialsSection({
  variant,
  profile,
  create,
  update,
}: PersonalCredentialsSectionProps) {
  const schema = variant === 'divemaster' ? diveMasterCredentialsSchema : instructorCredentialsSchema
  const initialDefaults =
    variant === 'divemaster' ? INITIAL_DM_CREDENTIALS_FORM : INITIAL_INST_CREDENTIALS_FORM
  const agencyVariant = variant === 'divemaster' ? 'divemaster' : 'instructor'

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
    schema,
    defaults: initialDefaults,
    fromProfile: (p) => credentialsFromProfile(p, variant),
    toPayload: credentialsToPayload,
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
        variant={agencyVariant}
        items={form.credential}
        onChange={(items) => setField('credential', items)}
        errors={errors as Record<string, string>}
      />
    </ProfileFormShell>
  )
}

// ---------------------------------------------------------------------------
// Re-exported types for barrel files
// ---------------------------------------------------------------------------

export type DiveMasterProfileSection = PersonalSection
export type InstructorProfileSection = PersonalSection

export type DiveMasterProfileFormProps = {
  section?: DiveMasterProfileSection
  profile: Record<string, unknown> | null | undefined
  me: Record<string, unknown> | null | undefined
  create: (payload: Record<string, unknown>) => Promise<unknown>
  update: (payload: Record<string, unknown>) => Promise<unknown>
}

export type InstructorProfileFormProps = {
  section?: InstructorProfileSection
  profile: Record<string, unknown> | null | undefined
  me: Record<string, unknown> | null | undefined
  create: (payload: Record<string, unknown>) => Promise<unknown>
  update: (payload: Record<string, unknown>) => Promise<unknown>
}

// ---------------------------------------------------------------------------
// DiveMasterProfileForm — dispatches to the correct section component
// ---------------------------------------------------------------------------

export function DiveMasterProfileForm({
  section,
  profile,
  me,
  create,
  update,
}: DiveMasterProfileFormProps) {
  if (section === 'languages')
    return <PersonalLanguagesSection profile={profile} create={create} update={update} />
  if (section === 'credentials')
    return (
      <PersonalCredentialsSection
        variant="divemaster"
        profile={profile}
        create={create}
        update={update}
      />
    )
  return (
    <PersonalContactSection
      variant="divemaster"
      profile={profile}
      me={me}
      create={create}
      update={update}
    />
  )
}

// ---------------------------------------------------------------------------
// InstructorProfileForm — dispatches to the correct section component
// ---------------------------------------------------------------------------

export function InstructorProfileForm({
  section,
  profile,
  me,
  create,
  update,
}: InstructorProfileFormProps) {
  if (section === 'languages')
    return <PersonalLanguagesSection profile={profile} create={create} update={update} />
  if (section === 'credentials')
    return (
      <PersonalCredentialsSection
        variant="instructor"
        profile={profile}
        create={create}
        update={update}
      />
    )
  return (
    <PersonalContactSection
      variant="instructor"
      profile={profile}
      me={me}
      create={create}
      update={update}
    />
  )
}
