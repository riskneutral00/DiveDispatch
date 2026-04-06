'use client'

import { Plus } from 'lucide-react'
import { BusinessContactSection } from '@/components/profiles/business-contact-section'
import { ProfileAgencyInfo } from '@/components/profiles/profile-agency-info'
import { Button } from '@/components/ui/button'
import { ProfileLanguagesSection } from '@/components/profiles/profile-languages-section'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import {
  diveCenterAffiliationsSchema,
  contactSchema,
  diveCenterLanguagesSchema,
} from '@/lib/schemas/profile-shared'
import {
  type ContactFormState as DiveCenterContactFormState,
  INITIAL_CONTACT_FORM,
  INITIAL_CUSTOMER_LANGUAGES,
  contactFromProfile,
  contactToPayload,
  languagesFromProfile,
  languagesToPayload,
  type BaseProfileSectionProps,
  type ContactFormState,
} from '@/lib/profile-form'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import type { Language } from '@/lib/types/language'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiveCenterProfileSection = 'contact' | 'languages' | 'associations'

type DiveCenterSectionProps = BaseProfileSectionProps

// ---------------------------------------------------------------------------
// Contact section
// ---------------------------------------------------------------------------

export type { DiveCenterContactFormState }
export { INITIAL_CONTACT_FORM, contactFromProfile, contactToPayload }

const diveCenterFromMe = (u: Record<string, unknown>, defaults: ContactFormState): ContactFormState => ({
  ...defaults,
  name: (u.businessName as string) ?? '',
  email: (u.email as string) ?? '',
  phone: (u.phone as string) ?? '',
})

export function DiveCenterContactSection(props: DiveCenterSectionProps) {
  return (
    <BusinessContactSection
      {...props}
      nameLabel="Business Name"
      namePlaceholder="Ms. Mermaids' DC"
      schema={contactSchema}
      fromMe={diveCenterFromMe}
    />
  )
}

// ---------------------------------------------------------------------------
// Languages section
// ---------------------------------------------------------------------------

export type DiveCenterLanguagesFormState = {
  customerLanguages: Language[]
}

export const INITIAL_LANGUAGES_FORM: DiveCenterLanguagesFormState = INITIAL_CUSTOMER_LANGUAGES

export function languagesFromProfileDC(p: Record<string, unknown>): DiveCenterLanguagesFormState {
  return {
    customerLanguages: languagesFromProfile(p.customerLanguages as string[] | undefined),
  }
}

export function languagesToPayloadDC(f: DiveCenterLanguagesFormState): Record<string, unknown> {
  return {
    customerLanguages: languagesToPayload(f.customerLanguages),
  }
}

export function DiveCenterLanguagesSection({ profile: existing, create, update }: DiveCenterSectionProps) {
  const { form, setField, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } =
    useProfileForm({
      profile: existing,
      schema: diveCenterLanguagesSchema,
      defaults: INITIAL_LANGUAGES_FORM,
      fromProfile: languagesFromProfileDC,
      toPayload: languagesToPayloadDC,
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
        variant="customer"
        value={form.customerLanguages}
        onChange={(langs) => setField('customerLanguages', langs)}
      />
    </ProfileFormShell>
  )
}

// ---------------------------------------------------------------------------
// Affiliations section
// ---------------------------------------------------------------------------

export type DiveCenterAssociationItem = {
  agency: string
  number: string
  owDays: number | undefined
  aowDays: number | undefined
  oaDays: number | undefined
  selectedSpecialties: string[]
}

export type DiveCenterAffiliationsFormState = {
  associations: DiveCenterAssociationItem[]
}

export function makeDefaultAssoc(): DiveCenterAssociationItem {
  return {
    agency: '',
    number: '',
    owDays: undefined,
    aowDays: undefined,
    oaDays: undefined,
    selectedSpecialties: [],
  }
}

export const INITIAL_AFFILIATIONS_FORM: DiveCenterAffiliationsFormState = {
  associations: [makeDefaultAssoc()],
}

export function affiliationsFromProfile(p: Record<string, unknown>): DiveCenterAffiliationsFormState {
  const assocs = (p.associations as Array<Record<string, unknown>>) ?? []
  return {
    associations:
      assocs.length > 0
        ? assocs.map((a) => ({
            agency: String(a.agency ?? ''),
            number: String(a.number ?? ''),
            owDays: typeof a.owDays === 'number' ? a.owDays : undefined,
            aowDays: typeof a.aowDays === 'number' ? a.aowDays : undefined,
            oaDays: typeof a.oaDays === 'number' ? a.oaDays : undefined,
            selectedSpecialties: Array.isArray(a.selectedSpecialties) ? a.selectedSpecialties : [],
          }))
        : [makeDefaultAssoc()],
  }
}

export function affiliationsToPayload(f: DiveCenterAffiliationsFormState): Record<string, unknown> {
  return {
    associations: f.associations.map((a) => ({
      agency: a.agency,
      number: a.number,
      owDays: a.owDays,
      aowDays: a.aowDays,
      oaDays: a.oaDays,
      selectedSpecialties: a.selectedSpecialties,
    })),
  }
}

export function DiveCenterAffiliationsSection({ profile: existing, create, update }: DiveCenterSectionProps) {
  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } =
    useProfileForm({
      profile: existing,
      schema: diveCenterAffiliationsSchema,
      defaults: INITIAL_AFFILIATIONS_FORM,
      fromProfile: affiliationsFromProfile,
      toPayload: affiliationsToPayload,
      create,
      update,
    })

  function handleAdd() {
    const first = form.associations[0]
    const newAssoc: DiveCenterAssociationItem = {
      ...makeDefaultAssoc(),
      owDays: first?.owDays,
      aowDays: first?.aowDays,
      oaDays: first?.oaDays,
      selectedSpecialties: first?.selectedSpecialties ? [...first.selectedSpecialties] : [],
    }
    setField('associations', [...form.associations, newAssoc])
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
      footerLeftAction={
        <Button type="button" variant="secondary" size="sm" onClick={handleAdd}>
          <Plus size={14} />
          Add
        </Button>
      }
    >
      <ProfileAgencyInfo
        variant="dive-center"
        items={form.associations}
        onChange={(items) => setField('associations', items)}
        errors={errors as Record<string, string>}
      />
    </ProfileFormShell>
  )
}

// ---------------------------------------------------------------------------
// Compat alias
// ---------------------------------------------------------------------------

/**
 * Dispatches to the appropriate section component based on the `section` prop.
 * The app-layer ConnectedDiveCenterForm short-circuits before this is reached
 * at runtime; this export exists so that the lib-layer registry in
 * connected-role-forms.tsx continues to type-check without modification.
 */
export function DiveCenterProfileForm({
  section,
  profile,
  me,
  create,
  update,
  onSaved,
}: DiveCenterSectionProps & { section?: DiveCenterProfileSection }) {
  if (section === 'languages')
    return <DiveCenterLanguagesSection profile={profile} create={create} update={update} />
  if (section === 'associations')
    return <DiveCenterAffiliationsSection profile={profile} create={create} update={update} />
  return <DiveCenterContactSection profile={profile} me={me} create={create} update={update} onSaved={onSaved} />
}
