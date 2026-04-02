'use client'

import { useMemo } from 'react'
import { z } from 'zod'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileAgencyInfo } from '@/components/profiles/profile-agency-info'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormHeader } from '@/components/profiles/profile-form-header'
import { ProfileFormSectionDivider } from '@/components/profiles/profile-form-section-divider'
import { ProfileLanguagesSection } from '@/components/profiles/profile-languages-section'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { ProfileTabSection } from '@/components/profiles/profile-tab-section'
import {
  languagesFromProfile,
  languagesToPayload,
  teachingLanguagesFieldSchema,
} from '@/lib/profile-form/languages'
import {
  contactFieldsFromProfile,
  createOptimisticLocationOnChange,
  locationToPayload,
  nullableProfileLocation,
} from '@/lib/profile-form/location'
import { credentialSchema, instructorCredentialSchema } from '@/lib/schemas/profile-shared'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import type { Language } from '@/lib/types/language'

const profileSchemaDive = z.object({
  name: z.string().min(1, 'Name is required'),
  location: nullableProfileLocation(),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  credential: z.array(credentialSchema).min(1, 'Add at least one credential'),
  teachingLanguages: teachingLanguagesFieldSchema,
})

const profileSchemaInstructor = z.object({
  name: z.string().min(1, 'Name is required'),
  location: nullableProfileLocation(),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  credential: z.array(instructorCredentialSchema).min(1, 'Add at least one credential'),
  teachingLanguages: teachingLanguagesFieldSchema,
})

type DiveCred = z.infer<typeof credentialSchema>
type InstCred = z.infer<typeof instructorCredentialSchema>

type PersonalSection = 'contact' | 'languages' | 'credentials'

type PersonalVariant = 'divemaster' | 'instructor'

export type PersonalProfileFormProps = {
  variant: PersonalVariant
  section?: PersonalSection
  profile: Record<string, unknown> | null | undefined
  me: Record<string, unknown> | null | undefined
  create: (payload: Record<string, unknown>) => Promise<unknown>
  update: (payload: Record<string, unknown>) => Promise<unknown>
}

function PersonalProfileBody({
  variant,
  section,
  profile,
  me,
  create,
  update,
}: PersonalProfileFormProps) {
  const isDm = variant === 'divemaster'

  const schema = isDm ? profileSchemaDive : profileSchemaInstructor

  const emptyCredential = (): DiveCred | InstCred =>
    isDm
      ? { agency: '', level: '', agencyID: '' }
      : { agency: '', level: '', agencyID: '', courses: [] }

  const defaults = useMemo(
    () => ({
      name: '',
      location: null as LocationValue | null,
      email: '',
      phone: '',
      credential: [emptyCredential()] as DiveCred[] | InstCred[],
      teachingLanguages: [] as Language[],
    }),
    [isDm],
  )

  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, loading, isUpdate, handleSubmit } =
    useProfileForm({
      profile,
      me: me ?? undefined,
      schema,
      defaults,
      fromProfile: (p) => {
        const cred = p.credential as DiveCred[] | InstCred[]
        const c = contactFieldsFromProfile(p)
        return {
          ...c,
          location: c.location as LocationValue,
          credential: cred.length > 0 ? cred : [emptyCredential()],
          teachingLanguages: languagesFromProfile(p.teachingLanguages as string[] | undefined),
        }
      },
      fromMe: (u, initial) => ({
        ...initial,
        email: u.email ?? '',
        phone: u.phone ?? '',
      }),
      toPayload: (f) => ({
        name: f.name,
        ...locationToPayload(f.location!),
        email: f.email,
        phone: f.phone,
        credential: f.credential,
        teachingLanguages: languagesToPayload(f.teachingLanguages),
      }),
      create,
      update,
    })

  const onLocationChange = createOptimisticLocationOnChange({
    setField,
    update,
    isUpdate,
  })

  const agencyVariant = isDm ? 'divemaster' : 'instructor'
  const namePlaceholder = isDm ? 'Your name' : 'Ariel Nemo'

  return (
    <ProfileFormShell
      loading={loading}
      onSubmit={handleSubmit}
      footerErrorMessage={footerErrorMessage}
      saving={saving}
      saved={saved}
      isDirty={isDirty}
      isUpdate={isUpdate}
      className="space-y-6"
    >
      {isDm && !section && (
        <ProfileFormHeader isUpdate={isUpdate} roleName="divemaster" />
      )}

      <ProfileTabSection id="contact" section={section}>
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
      </ProfileTabSection>

      <ProfileFormSectionDivider show={!section} />

      <ProfileLanguagesSection
        section={section}
        variant="teaching"
        value={form.teachingLanguages}
        onChange={(langs) => setField('teachingLanguages', langs)}
      />

      <ProfileFormSectionDivider show={!section} />

      <ProfileTabSection id="credentials" section={section}>
        <ProfileAgencyInfo
          variant={agencyVariant}
          items={form.credential}
          onChange={(items) => setField('credential', items)}
          errors={errors as Record<string, string>}
        />
      </ProfileTabSection>
    </ProfileFormShell>
  )
}

export type DiveMasterProfileSection = PersonalSection
export type InstructorProfileSection = PersonalSection

export type DiveMasterProfileFormProps = Omit<PersonalProfileFormProps, 'variant'> & { section?: DiveMasterProfileSection }

export function DiveMasterProfileForm({ section, profile, me, create, update }: DiveMasterProfileFormProps) {
  return <PersonalProfileBody variant="divemaster" section={section} profile={profile} me={me} create={create} update={update} />
}

export type InstructorProfileFormProps = Omit<PersonalProfileFormProps, 'variant'> & { section?: InstructorProfileSection }

export function InstructorProfileForm({ section, profile, me, create, update }: InstructorProfileFormProps) {
  return <PersonalProfileBody variant="instructor" section={section} profile={profile} me={me} create={create} update={update} />
}
