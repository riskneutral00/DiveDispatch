'use client'

import { useMutation, useQuery } from 'convex/react'
import { z } from 'zod'

import { api } from '../../../convex/_generated/api'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileAgencyInfo } from '@/components/profiles/profile-agency-info'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormLoading } from '@/components/profiles/profile-form-loading'
import { ProfileFormSectionDivider } from '@/components/profiles/profile-form-section-divider'
import { ProfileLanguagesSection } from '@/components/profiles/profile-languages-section'
import { SaveButton } from '@/components/ui/save-button'
import { AGENCIES } from '@/lib/constants/agencies'
import {
  customerLanguagesFieldSchema,
  languagesFromProfile,
  languagesToPayload,
} from '@/lib/profile-form/languages'
import {
  createOptimisticLocationOnChange,
  locationFromProfileDoc,
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

export function DiveCenterProfileForm({ onSaved, section }: { onSaved?: () => void; section?: DiveCenterProfileSection } = {}) {
  const existing = useQuery(api.diveCenters.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.diveCenters.create)
  const update = useMutation(api.diveCenters.update)

  const { form, setField, errors, serverError, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } = useProfileForm({
    profile: existing,
    me,
    schema: formSchema,
    defaults: INITIAL_FORM,
    fromProfile: (p) => {
      const assocs = (p.associations as Array<{
        agency: string; number: string
        owDays?: number; aowDays?: number; oaDays?: number
        selectedSpecialties?: string[]
      }>) ?? []
      return {
        name: p.name as string,
        location: locationFromProfileDoc({
          placeName: p.placeName as string,
          country: p.country as string,
          lat: p.lat as number,
          lng: p.lng as number,
          placeId: p.placeId as string | null | undefined,
        }) as LocationValue,
        email: p.email as string,
        phone: p.phone as string,
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
    toPayload: (f) => {
      const loc = f.location!
      return {
        name: f.name,
        placeName: loc.placeName,
        country: loc.country,
        lat: loc.lat,
        lng: loc.lng,
        placeId: loc.placeId,
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
      }
    },
    create,
    update,
    onSaved,
  })


  const onLocationChange = createOptimisticLocationOnChange({
    setField,
    update,
    isUpdate,
  })

  if (loading) {
    return <ProfileFormLoading variant="pulse-text" />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      
      {(!section || section === 'contact') && (
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
      )}

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
      {(!section || section === 'associations') && (
        <ProfileAgencyInfo
          variant="dive-center"
          items={form.associations}
          onChange={(items) => setField('associations', items)}
          errors={errors as Record<string, string>}
        />
      )}

      {serverError && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{serverError}</p>
      )}

      <SaveButton saving={saving} saved={saved} isDirty={isDirty} isUpdate={isUpdate} disabled={!isValid} />
    </form>
  )
}
