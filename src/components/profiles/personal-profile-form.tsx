'use client'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileAgencyInfo } from '@/components/profiles/profile-agency-info'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormHeader } from '@/components/profiles/profile-form-header'
import { ProfileLanguagesSection } from '@/components/profiles/profile-languages-section'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import {
  type ContactFormState as PersonalContactFormState,
  INITIAL_CONTACT_FORM,
  contactFromProfile,
  contactToPayload,
  defaultFromMe,
  languagesFromProfile,
  languagesToPayload,
  INITIAL_TEACHING_LANGUAGES,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
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

export type PersonalSection = 'contact' | 'languages' | 'credentials'
export type PersonalVariant = 'divemaster' | 'instructor'

type DmCredential = z.infer<typeof credentialSchema>
type InstCredential = z.infer<typeof instructorCredentialSchema>

export type PersonalCredential = DmCredential | InstCredential

export type { PersonalContactFormState }
export { INITIAL_CONTACT_FORM, contactFromProfile, contactToPayload }

export type PersonalLanguagesFormState = {
  teachingLanguages: Language[]
}

export const INITIAL_LANGUAGES_FORM: PersonalLanguagesFormState = INITIAL_TEACHING_LANGUAGES

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

export type PersonalCredentialsFormState = {
  credential: PersonalCredential[]
}

export function makeEmptyDmCredential(): DmCredential {
  return { agency: '', level: '', agencyID: '' }
}

export function makeEmptyInstCredential(): InstCredential {
  return { agency: '', level: '', agencyID: '', specialtyRatings: [] }
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

export type PersonalContactSectionProps = BaseProfileSectionProps & {
  variant: PersonalVariant
}

export type PersonalLanguagesSectionProps = Pick<BaseProfileSectionProps, 'profile' | 'create' | 'update'> & { onClose?: () => void }

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
    resetToBaseline,
  } = useProfileForm({
    profile,
    me,
    schema: personalContactSchema,
    defaults: INITIAL_CONTACT_FORM,
    fromProfile: contactFromProfile,
    fromMe: defaultFromMe,
    toPayload: contactToPayload,
    create,
    update,
  })

  const onLocationChange = (loc: LocationValue | null) => setField('location', loc)

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

export function PersonalLanguagesSection({ profile, create, update, onClose }: PersonalLanguagesSectionProps) {
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
    resetToBaseline,
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
      <ProfileLanguagesSection
        variant="teaching"
        value={form.teachingLanguages}
        onChange={(langs) => setField('teachingLanguages', langs)}
      />
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
    variant === 'divemaster' ? INITIAL_DM_CREDENTIALS_FORM : INITIAL_INST_CREDENTIALS_FORM
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
  if (section === 'languages')
    return <PersonalLanguagesSection profile={profile} create={create} update={update} onClose={onClose} />
  if (section === 'credentials')
    return (
      <PersonalCredentialsSection
        variant={variant}
        profile={profile}
        create={create}
        update={update}
        onClose={onClose}
      />
    )
  return (
    <PersonalContactSection
      variant={variant}
      profile={profile}
      me={me}
      create={create}
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
