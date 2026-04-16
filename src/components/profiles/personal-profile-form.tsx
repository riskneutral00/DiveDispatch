'use client'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileAgencyInfo } from '@/components/profiles/profile-agency-info'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { LanguageField } from '@/components/ui/language-field'
import { ProfileFormHeader } from '@/components/profiles/profile-form-header'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { SectionDivider } from '@/components/ui/section-divider'
import {
  INITIAL_ACCESS_CONTROL,
  accessFromProfile,
  accessToPayload,
  type AccessControlState,
} from '@/components/profiles/access-control-section'
import {
  type ContactFormState as PersonalContactFormState,
  INITIAL_CONTACT_FORM,
  INITIAL_TEACHING_LANGUAGES,
  contactFromProfile,
  contactToPayload,
  defaultFromMe,
  languagesFromProfile,
  languagesToPayload,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import {
  personalContactMergedSchema,
  diveMasterCredentialsSchema,
  instructorCredentialsSchema,
  credentialSchema,
  instructorCredentialSchema,
} from '@/lib/schemas/profile-shared'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import type { Language } from '@/lib/types/language'
import { z } from 'zod'

export type PersonalSection = 'contact' | 'credentials'
export type PersonalVariant = 'divemaster' | 'instructor'

type DmCredential = z.infer<typeof credentialSchema>
type InstCredential = z.infer<typeof instructorCredentialSchema>

export type PersonalCredential = DmCredential | InstCredential

export type { PersonalContactFormState }
export { INITIAL_CONTACT_FORM, contactFromProfile, contactToPayload }

export type PersonalMergedContactFormState = PersonalContactFormState & { // dry-ok
  teachingLanguages: Language[]
  access: AccessControlState
}

export const INITIAL_PERSONAL_MERGED_CONTACT: PersonalMergedContactFormState = {
  ...INITIAL_CONTACT_FORM,
  ...INITIAL_TEACHING_LANGUAGES,
  access: INITIAL_ACCESS_CONTROL,
}

export type PersonalLanguagesFormState = { teachingLanguages: Language[] }

export const INITIAL_LANGUAGES_FORM = INITIAL_TEACHING_LANGUAGES

export function languagesFromProfilePersonal(p: Record<string, unknown>): { teachingLanguages: Language[] } {
  return {
    teachingLanguages: languagesFromProfile(p.teachingLanguages as string[] | undefined),
  }
}

export function languagesToPayloadPersonal(f: { teachingLanguages: Language[] }): Record<string, unknown> {
  return {
    teachingLanguages: languagesToPayload(f.teachingLanguages),
  }
}

function mergedPersonalFromProfile(p: Record<string, unknown>): PersonalMergedContactFormState {
  return {
    ...contactFromProfile(p),
    ...languagesFromProfilePersonal(p),
    access: accessFromProfile(p),
  }
}

function mergedPersonalToPayload(f: PersonalMergedContactFormState): Record<string, unknown> {
  return {
    ...contactToPayload(f),
    ...languagesToPayloadPersonal(f),
    ...accessToPayload(f.access),
  }
}

export type PersonalCredentialsFormState = {
  credential: PersonalCredential[]
}

export function makeEmptyCredential(variant: PersonalVariant): PersonalCredential {
  const base = { agency: '', level: '', agencyID: '' }
  return variant === 'instructor' ? { ...base, specialtyRatings: [] } : base
}

export function getInitialCredentialsForm(variant: PersonalVariant): PersonalCredentialsFormState {
  return { credential: [makeEmptyCredential(variant)] }
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
        : [makeEmptyCredential(variant)],
  }
}

export function credentialsToPayload(f: PersonalCredentialsFormState): Record<string, unknown> {
  return {
    credential: f.credential,
  }
}

export type PersonalContactSectionProps = BaseProfileSectionProps & {
  variant: PersonalVariant
}

export type PersonalCredentialsSectionProps = Pick<BaseProfileSectionProps, 'profile' | 'create' | 'update'> & {
  variant: PersonalVariant
  onClose?: () => void
}

export function PersonalContactSection({
  variant,
  profile,
  me,
  create,
  update,
  onClose,
}: PersonalContactSectionProps) {
  const isDm = variant === 'divemaster'

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
    resetToBaseline,
  } = useProfileForm({
    profile,
    me,
    schema: personalContactMergedSchema,
    defaults: INITIAL_PERSONAL_MERGED_CONTACT,
    fromProfile: mergedPersonalFromProfile,
    fromMe: defaultFromMe,
    toPayload: mergedPersonalToPayload,
    create,
    update,
  })

  const onLocationChange = (loc: LocationValue | null) => setField('location', loc)

  return (
    <ProfileFormShell
      loading={loading}
      onSubmit={handleSubmit}
      onCancel={() => {
        resetToBaseline()
        onClose?.()
      }}
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

        <SectionDivider variant="soft" />

        <LanguageField
          variant="teaching"
          value={form.teachingLanguages}
          onChange={(langs) => setField('teachingLanguages', langs)}
        />
      </div>
    </ProfileFormShell>
  )
}

export function PersonalCredentialsSection({
  variant,
  profile,
  create,
  update,
  onClose,
}: PersonalCredentialsSectionProps) {
  const schema = variant === 'divemaster' ? diveMasterCredentialsSchema : instructorCredentialsSchema
  const initialDefaults =
    getInitialCredentialsForm(variant)
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
    resetToBaseline,
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
      onCancel={() => {
        resetToBaseline()
        onClose?.()
      }}
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
        variant={variant}
        items={form.credential}
        onChange={(items) => setField('credential', items)}
        errors={errors as Record<string, string>}
      />
    </ProfileFormShell>
  )
}

export type DiveMasterProfileSection = PersonalSection
export type InstructorProfileSection = PersonalSection

export function PersonalProfileForm({
  variant,
  section,
  profile,
  me,
  create,
  update,
  onClose,
}: BaseProfileSectionProps & {
  variant: PersonalVariant
  section?: PersonalSection
}) {
  const wrappedCreate = (payload: Record<string, unknown>) =>
    create({ ...payload, role: variant === 'divemaster' ? 'DiveMaster' : 'Instructor' })

  if (section === 'credentials')
    return (
      <PersonalCredentialsSection
        variant={variant}
        profile={profile}
        create={wrappedCreate}
        update={update}
        onClose={onClose}
      />
    )
  return (
    <PersonalContactSection
      variant={variant}
      profile={profile}
      me={me}
      create={wrappedCreate}
      update={update}
      onClose={onClose}
    />
  )
}

export function DiveMasterProfileForm(
  props: BaseProfileSectionProps & { section?: DiveMasterProfileSection },
) {
  return <PersonalProfileForm variant="divemaster" {...props} />
}

export function InstructorProfileForm(
  props: BaseProfileSectionProps & { section?: InstructorProfileSection },
) {
  return <PersonalProfileForm variant="instructor" {...props} />
}
