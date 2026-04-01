'use client'

import { z } from 'zod'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileAgencyInfo } from '@/components/profiles/profile-agency-info'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormSectionDivider } from '@/components/profiles/profile-form-section-divider'
import { ProfileLanguagesSection } from '@/components/profiles/profile-languages-section'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { ProfileTabSection } from '@/components/profiles/profile-tab-section'
import { AGENCIES } from '@/lib/constants/agencies'
import {
  customerLanguagesFieldSchema,
  languagesFromProfile,
  languagesToPayload,
} from '@/lib/profile-form/languages'
import {
  contactFieldsFromProfile,
  createOptimisticLocationOnChange,
  locationToPayload,
  nullableProfileLocation,
} from '@/lib/profile-form/location'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import type { Language } from '@/lib/types/language'

const formSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  location: nullableProfileLocation(),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Contact phone is required'),
  customerLanguages: customerLanguagesFieldSchema,
  associations: z.array(
    z.object({
      agency: z.string().min(1, 'Agency is required'),
      number: z.string().min(1, 'Member ID is required'),
      owDays: z.number().min(1),
      aowDays: z.number().min(1),
      oaDays: z.number().min(1),
      selectedSpecialties: z.array(z.string()),
    }),
  ).min(1, 'At least one agency association is required'),
}).refine((data) => {
  return data.associations.every((a) => {
    const required = AGENCIES[a.agency]?.specialtyCount ?? 5
    return a.selectedSpecialties.length >= required
  })
}, { message: 'Not enough specialties selected', path: ['associations'] })

type FormState = {
  name: string
  location: LocationValue | null
  email: string
  phone: string
  associations: Array<{ agency: string; number: string; owDays: number; aowDays: number; oaDays: number; selectedSpecialties: string[] }>
  customerLanguages: Language[]
}

const makeDefaultAssoc = () => ({
  agency: '',
  number: '',
  owDays: 3,
  aowDays: 2,
  oaDays: 4,
  selectedSpecialties: [],
})

const INITIAL_FORM: FormState = {
  name: '',
  location: null,
  email: '',
  phone: '',
  associations: [makeDefaultAssoc()],
  customerLanguages: [],
}

export type DiveCenterProfileSection = 'contact' | 'languages' | 'associations'

export type DiveCenterProfileFormProps = {
  onSaved?: () => void
  section?: DiveCenterProfileSection
  profile: Record<string, unknown> | null | undefined
  me: Record<string, unknown> | null | undefined
  create: (payload: Record<string, unknown>) => Promise<unknown>
  update: (payload: Record<string, unknown>) => Promise<unknown>
}

export function DiveCenterProfileForm({ onSaved, section, profile: existing, me, create, update }: DiveCenterProfileFormProps) {

  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } = useProfileForm({
    profile: existing,
    me,
    schema: formSchema,
    defaults: INITIAL_FORM,
    fromProfile: (p) => {
      const c = contactFieldsFromProfile(p)
      const assocs = (p.associations as Array<{
        agency: string; number: string
        owDays?: number; aowDays?: number; oaDays?: number
        selectedSpecialties?: string[]
      }>) ?? []
      return {
        ...c,
        location: c.location as LocationValue,
        associations: assocs.length > 0 ? assocs.map((a: Record<string, unknown>) => ({
          agency: String(a.agency || ''),
          number: String(a.number || ''),
          owDays: typeof a.owDays === 'number' ? a.owDays : 3,
          aowDays: typeof a.aowDays === 'number' ? a.aowDays : 2,
          oaDays: typeof a.oaDays === 'number' ? a.oaDays : 4,
          selectedSpecialties: Array.isArray(a.selectedSpecialties) ? a.selectedSpecialties : [],
        })) : [makeDefaultAssoc()],
        customerLanguages: languagesFromProfile(p.customerLanguages as string[] | undefined),
      }
    },
    fromMe: (u, defaults) => ({
      ...defaults,
      name: u.businessName ?? '',
      email: u.email ?? '',
      phone: u.phone ?? '',
    }),
    toPayload: (f) => ({
      name: f.name,
      ...locationToPayload(f.location!),
      email: f.email,
      phone: f.phone,
      associations: f.associations.map((a) => ({
          agency: a.agency,
          number: a.number,
          owDays: a.owDays,
          aowDays: a.aowDays,
          oaDays: a.oaDays,
          selectedSpecialties: a.selectedSpecialties,
        })),
      customerLanguages: languagesToPayload(f.customerLanguages),
    }),
    create,
    update,
    onSaved,
  })

  const onLocationChange = createOptimisticLocationOnChange({
    setField,
    update,
    isUpdate,
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
      {/* Basic Information */}
      <ProfileTabSection id="contact" section={section}>
      <div className="space-y-4">
        <ProfileBasicInfo
          nameValue={form.name}
          onNameChange={(val) => setField('name', val)}
          nameError={errors.name}
          nameLabel="Business Name"
          namePlaceholder="Ms. Mermaids' DC"
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

      {/* Languages */}
      <ProfileLanguagesSection
        section={section}
        variant="customer"
        value={form.customerLanguages}
        onChange={(langs) => setField('customerLanguages', langs)}
      />

      <ProfileFormSectionDivider show={!section} />

      {/* Affiliations */}
      <ProfileTabSection id="associations" section={section}>
        <ProfileAgencyInfo
          variant="dive-center"
          items={form.associations}
          onChange={(items) => setField('associations', items)}
          errors={errors as Record<string, string>}
        />
      </ProfileTabSection>
    </ProfileFormShell>
  )
}
