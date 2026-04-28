'use client'

import { CredentialFields } from '@/components/profiles/credential-fields'
import { InlineRowList } from '@/components/profiles/collection-editors'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { BusinessContactSection } from '@/components/profiles/business-contact-section'
import {
  type PersonalContactFormState,
  buildParentContactDefaults,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import {
  personalContactMergedSchema,
  instructorCredentialsSchema,
  instructorCredentialSchema,
} from '@/lib/schemas/profile-shared'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import { z } from 'zod'

export type PersonalSection = 'contact' | 'credentials'

export type PersonalCredential = z.infer<typeof instructorCredentialSchema>

export type { PersonalContactFormState }

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
  return (
    <BusinessContactSection
      {...props}
      schema={personalContactMergedSchema}
      languageKey="teachingLanguages"
      inheritFromOtherRoles="Instructor"
      createOverride={(payload) => props.create({ ...payload, credential: [] })}
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
      <InlineRowList<PersonalCredential>
        label="Dive Credentials"
        addLabel="Add Credential"
        items={form.credential}
        onChange={(items) => setField('credential', items)}
        emptyItem={makeEmptyCredential}
        renderRow={(cred, update, i) => (
          <CredentialFields
            value={cred}
            onChange={update}
            errors={{
              agency: (errors as Record<string, string>)[`credential.${i}.agency`],
              level: (errors as Record<string, string>)[`credential.${i}.level`],
              agencyID: (errors as Record<string, string>)[`credential.${i}.agencyID`],
              specialtyRatings: (errors as Record<string, string>)[`credential.${i}.specialtyRatings`],
            }}
          />
        )}
        minItems={1}
        removeAriaLabel={() => 'Remove credential'}
      />
    </ProfileFormShell>
  )
}

export type InstructorProfileSection = PersonalSection
