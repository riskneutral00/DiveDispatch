'use client'

import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileAgencyInfo } from '@/components/profiles/profile-agency-info'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { LanguageField } from '@/components/ui/language-field'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { SectionDivider } from '@/components/ui/section-divider'
import {
  INITIAL_ACCESS_CONTROL,
  accessFromProfile,
  accessToPayload,
  type AccessControlState,
} from '@/components/profiles/access-control-section'
import {
  type PersonalContactFormState,
  INITIAL_PERSONAL_CONTACT_FORM,
  INITIAL_TEACHING_LANGUAGES,
  buildParentContactDefaults,
  personalContactFromProfile,
  personalContactToPayload,
  defaultFromMe,
  languagesFromProfile,
  languagesToPayload,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import {
  personalContactMergedSchema,
  instructorCredentialsSchema,
  instructorCredentialSchema,
} from '@/lib/schemas/profile-shared'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import type { Language } from '@/lib/types/language'
import { z } from 'zod'

export type PersonalSection = 'contact' | 'credentials'

export type PersonalCredential = z.infer<typeof instructorCredentialSchema>

export type { PersonalContactFormState }

export type PersonalMergedContactFormState = PersonalContactFormState & { // dry-ok
  teachingLanguages: Language[]
  access: AccessControlState
}

export const INITIAL_PERSONAL_MERGED_CONTACT: PersonalMergedContactFormState = {
  ...INITIAL_PERSONAL_CONTACT_FORM,
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
    ...personalContactFromProfile(p),
    ...languagesFromProfilePersonal(p),
    access: accessFromProfile(p),
  }
}

function mergedPersonalToPayload(f: PersonalMergedContactFormState): Record<string, unknown> {
  return {
    ...personalContactToPayload(f),
    ...languagesToPayloadPersonal(f),
    ...accessToPayload(f.access),
  }
}

export type PersonalCredentialsFormState = {
  credential: PersonalCredential[]
}

export function makeEmptyCredential(): PersonalCredential {
  return { agency: '', level: '', agencyID: '', specialtyRatings: [] }
}

export function getInitialCredentialsForm(): PersonalCredentialsFormState {
  return { credential: [makeEmptyCredential()] }
}

export function credentialsFromProfile(p: Record<string, unknown>): PersonalCredentialsFormState {
  const creds = (p.credential as PersonalCredential[] | undefined) ?? []
  return {
    credential:
      creds.length > 0
        ? creds
        : [makeEmptyCredential()],
  }
}

export function credentialsToPayload(f: PersonalCredentialsFormState): Record<string, unknown> {
  return {
    credential: f.credential.map((c) => ({
      agency: c.agency,
      level: c.level,
      agencyID: c.agencyID,
      specialtyRatings: c.specialtyRatings ?? [],
    })),
  }
}

export type PersonalContactSectionProps = BaseProfileSectionProps

export type PersonalCredentialsSectionProps = Pick<BaseProfileSectionProps, 'profile' | 'me' | 'create' | 'update'> & {
  onClose?: () => void
}

export function PersonalContactSection({
  profile,
  me,
  create,
  update,
  onClose,
}: PersonalContactSectionProps) {
  const inheritance = useQuery(api.users.inheritedContactDefaults, { excludeRole: 'Instructor' })

  const inheritedDefaults: PersonalMergedContactFormState = inheritance
    ? {
        ...INITIAL_PERSONAL_MERGED_CONTACT,
        ...personalContactFromProfile(inheritance as unknown as Record<string, unknown>),
      }
    : INITIAL_PERSONAL_MERGED_CONTACT

  const createOverride = (payload: Record<string, unknown>) =>
    create({ ...payload, credential: [] })

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
    profile: inheritance === undefined ? undefined : profile,
    me,
    schema: personalContactMergedSchema,
    defaults: inheritedDefaults,
    fromProfile: mergedPersonalFromProfile,
    fromMe: (u, defaults) => ({
      ...defaultFromMe(u, defaults),
      email: defaults.email || ((u.email as string) ?? ''),
      location: defaults.location ?? null,
    }),
    toPayload: mergedPersonalToPayload,
    create: createOverride,
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
      <div className="space-y-4">
        <ProfileBasicInfo
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
  profile,
  me,
  create,
  update,
  onClose,
}: PersonalCredentialsSectionProps) {
  const initialDefaults = getInitialCredentialsForm()

  const createOverride = (payload: Record<string, unknown>) => {
    const { name: _omitName, ...parentDefaults } = buildParentContactDefaults(me)
    return create({
      ...parentDefaults,
      teachingLanguages: [],
      ...payload,
    })
  }

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
    schema: instructorCredentialsSchema,
    defaults: initialDefaults,
    fromProfile: (p) => credentialsFromProfile(p),
    toPayload: credentialsToPayload,
    create: createOverride,
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
        variant="instructor"
        items={form.credential}
        onChange={(items) => setField('credential', items)}
        errors={errors as Record<string, string>}
      />
    </ProfileFormShell>
  )
}

export type InstructorProfileSection = PersonalSection

export function PersonalProfileForm({
  section,
  profile,
  me,
  create,
  update,
  onClose,
}: BaseProfileSectionProps & {
  section?: PersonalSection
}) {
  if (section === 'credentials')
    return (
      <PersonalCredentialsSection
        profile={profile}
        me={me}
        create={create}
        update={update}
        onClose={onClose}
      />
    )
  return (
    <PersonalContactSection
      profile={profile}
      me={me}
      create={create}
      update={update}
      onClose={onClose}
    />
  )
}

export function InstructorProfileForm(
  props: BaseProfileSectionProps & { section?: InstructorProfileSection },
) {
  return <PersonalProfileForm {...props} />
}
