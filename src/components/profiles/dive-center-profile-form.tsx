'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ProfileAgencyInfo } from '@/components/profiles/profile-agency-info'
import { LanguageField } from '@/components/ui/language-field'
import { Button } from '@/components/ui/button'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { BusinessContactSection } from '@/components/profiles/business-contact-section'
import { diveCenterAffiliationsSchema, diveCenterContactMergedSchema } from '@/lib/schemas/profile-shared'
import {
  type ContactFormState as DiveCenterContactFormState,
  INITIAL_CONTACT_FORM,
  INITIAL_CUSTOMER_LANGUAGES,
  buildParentContactDefaults,
  contactFromProfile,
  contactToPayload,
  customerLanguagesBlock,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import type { Language } from '@/lib/types/language'

export type DiveCenterProfileSection = 'contact' | 'associations'

type DiveCenterSectionProps = BaseProfileSectionProps

export type { DiveCenterContactFormState }
export { INITIAL_CONTACT_FORM, contactFromProfile, contactToPayload }

export type DiveCenterLanguagesFormState = {
  customerLanguages: Language[]
}

export const INITIAL_LANGUAGES_FORM: DiveCenterLanguagesFormState = INITIAL_CUSTOMER_LANGUAGES

export function languagesFromProfileDC(p: Record<string, unknown>): DiveCenterLanguagesFormState {
  return customerLanguagesBlock.fromProfile(p) as DiveCenterLanguagesFormState
}

export function languagesToPayloadDC(f: DiveCenterLanguagesFormState): Record<string, unknown> {
  return customerLanguagesBlock.toPayload(f)
}

export function DiveCenterContactSection(props: DiveCenterSectionProps) {
  const tCommon = useTranslations('common')
  return (
    <BusinessContactSection
      {...props}
      nameLabel="Business Name"
      schema={diveCenterContactMergedSchema}
      createOverride={(payload) => props.create({ ...payload, associations: [] })}
      extras={{
        defaults: { customerLanguages: [] },
        fromProfile: (p) => languagesFromProfileDC(p) as Record<string, unknown>,
        toPayload: (f) => languagesToPayloadDC({ customerLanguages: (f.customerLanguages as Language[]) ?? [] }),
        render: ({ form, setField }) => (
          <LanguageField
            label={tCommon('customerLanguages')}
            value={(form.customerLanguages as Language[]) ?? []}
            onChange={(langs) => setField('customerLanguages', langs)}
          />
        ),
      }}
    />
  )
}

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

export function DiveCenterAffiliationsSection({ profile: existing, me, create, update, onClose }: DiveCenterSectionProps) {
  const createOverride = (payload: Record<string, unknown>) =>
    create({ ...buildParentContactDefaults(me), ...payload })

  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit, resetToBaseline } =
    useProfileForm({
      profile: existing,
      schema: diveCenterAffiliationsSchema,
      defaults: INITIAL_AFFILIATIONS_FORM,
      fromProfile: affiliationsFromProfile,
      toPayload: affiliationsToPayload,
      create: createOverride,
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

