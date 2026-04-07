'use client'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileAgencyInfo } from '@/components/profiles/profile-agency-info'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileLanguagesSection } from '@/components/profiles/profile-languages-section'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import {
  type ContactFormState,
  INITIAL_CONTACT_FORM as BASE_INITIAL_CONTACT,
  INITIAL_CUSTOMER_LANGUAGES,
  contactFromProfile as baseContactFromProfile,
  contactToPayload as baseContactToPayload,
  defaultFromMe,
  languagesFromProfile,
  languagesToPayload,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import {
  agentContactSchema,
  agentLanguagesSchema,
  agentAssociationsSchema,
  associationSchema,
} from '@/lib/schemas/profile-shared'
import type { Language } from '@/lib/types/language'
import { z } from 'zod'

export type AgentProfileSection = 'contact' | 'languages' | 'associations'

type AssociationData = z.infer<typeof associationSchema>

export type AgentContactFormState = ContactFormState & {
  defaultReferral: string | null
}

export type AgentLanguagesFormState = {
  customerLanguages: Language[]
}

export type AgentAssociationsFormState = {
  associations: AssociationData[]
}

export const INITIAL_CONTACT_FORM: AgentContactFormState = {
  ...BASE_INITIAL_CONTACT,
  defaultReferral: null,
}

export const INITIAL_LANGUAGES_FORM: AgentLanguagesFormState = INITIAL_CUSTOMER_LANGUAGES

export const INITIAL_ASSOCIATIONS_FORM: AgentAssociationsFormState = {
  associations: [],
}

export function contactFromProfile(p: Record<string, unknown>): AgentContactFormState {
  return {
    ...baseContactFromProfile(p),
    defaultReferral: (p.defaultReferral as string) ?? null,
  }
}

export function contactToPayload(f: AgentContactFormState): Record<string, unknown> {
  return {
    ...baseContactToPayload(f),
    ...(f.defaultReferral ? { defaultReferral: f.defaultReferral } : {}),
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

type AgentContactSectionProps = BaseProfileSectionProps

export type AgentLanguagesSectionProps = Pick<BaseProfileSectionProps, 'profile' | 'me' | 'update'> & {
  updateProfile: (payload: Record<string, unknown>) => Promise<unknown>
}

export type AgentAssociationsSectionProps = Pick<BaseProfileSectionProps, 'profile' | 'create' | 'update'>

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

      <div>
        <FormSectionHeader label="Default Referral" />
        <p className="text-label mt-2 text-secondary">
          {form.defaultReferral
            ? 'Bookings cascade from your preferred operator. Change in Preferences → Resources → Operator.'
            : 'You create and manage bookings independently.'}
        </p>
      </div>
    </ProfileFormShell>
  )
}

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

type AgentProfileFormProps = {
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
