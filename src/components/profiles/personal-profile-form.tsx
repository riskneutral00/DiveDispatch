'use client'

import { useTranslations } from 'next-intl'
import { ProfileAgencyInfo } from '@/components/profiles/profile-agency-info'
import { LanguageField } from '@/components/ui/language-field'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { BusinessContactSection } from '@/components/profiles/business-contact-section'
import {
  type PersonalContactFormState,
  INITIAL_TEACHING_LANGUAGES,
  buildParentContactDefaults,
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

export function PersonalContactSection(props: BaseProfileSectionProps) {
  const tCommon = useTranslations('common')
  return (
    <BusinessContactSection
      {...props}
      schema={personalContactMergedSchema}
      languageKey="teachingLanguages"
      inheritFromOtherRoles="Instructor"
      createOverride={(payload) => props.create({ ...payload, credential: [] })}
      extras={{
        defaults: { teachingLanguages: [] },
        fromProfile: (p) => languagesFromProfilePersonal(p) as Record<string, unknown>,
        toPayload: (f) => languagesToPayloadPersonal({ teachingLanguages: (f.teachingLanguages as Language[]) ?? [] }),
        render: ({ form, setField }) => (
          <LanguageField
            label={tCommon('teachingLanguages')}
            value={(form.teachingLanguages as Language[]) ?? []}
            onChange={(langs) => setField('teachingLanguages', langs)}
          />
        ),
      }}
    />
  )
}

export function PersonalCredentialsSection({
  profile,
  me,
  create,
  update,
  onClose,
}: BaseProfileSectionProps) {
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
