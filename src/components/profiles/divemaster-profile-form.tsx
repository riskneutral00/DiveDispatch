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
import {
  languagesFromProfile,
  languagesToPayload,
  teachingLanguagesFieldSchema,
} from '@/lib/profile-form/languages'
import {
  createOptimisticLocationOnChange,
  locationFromProfileDoc,
  nullableProfileLocation,
} from '@/lib/profile-form/location'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import type { Language } from '@/lib/types/language'

// ── Zod Schemas ───────────────────────────────────────────────────────

const credentialSchema = z.object({
  agency: z.string().min(1, 'Agency is required'),
  level: z.string().min(1, 'Level is required'),
  agencyID: z.string().min(1, 'Agency ID is required'),
})

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: nullableProfileLocation(),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  credential: z.array(credentialSchema).min(1, 'Add at least one credential'),
  teachingLanguages: teachingLanguagesFieldSchema,
})

type CredentialData = z.infer<typeof credentialSchema>

type ProfileFormData = {
  name: string
  location: LocationValue | null
  email: string
  phone: string
  credential: CredentialData[]
  teachingLanguages: Language[]
}


const emptyCredential = (): CredentialData => ({ agency: '', level: '', agencyID: '' })

const INITIAL_FORM: ProfileFormData = {
  name: '',
  location: null,
  email: '',
  phone: '',
  credential: [emptyCredential()],
  teachingLanguages: [],
}


export type DiveMasterProfileSection = 'contact' | 'languages' | 'credentials'

export function DiveMasterProfileForm({ section }: { section?: DiveMasterProfileSection } = {}) {
  const profile = useQuery(api.diveMasters.mine)
  const me = useQuery(api.users.getAccountDefaults)
  const create = useMutation(api.diveMasters.create)
  const update = useMutation(api.diveMasters.update)

  const { form, setField, errors, serverError, saving, saved, isDirty, loading, isUpdate, handleSubmit } = useProfileForm({
    profile,
    me: me ?? undefined,
    schema: profileSchema,
    defaults: INITIAL_FORM,
    fromProfile: (p) => {
      const cred = p.credential as { agency: string; level: string; agencyID: string }[]
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
        credential: cred.length > 0 ? cred : [emptyCredential()],
        teachingLanguages: languagesFromProfile(p.teachingLanguages as string[] | undefined),
      }
    },
    fromMe: (u, initial) => ({
      ...initial,
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
        credential: f.credential,
        teachingLanguages: languagesToPayload(f.teachingLanguages),
      }
    },
    create,
    update,
  })

  const onLocationChange = createOptimisticLocationOnChange({
    setField,
    update,
    isUpdate,
  })

  if (loading) {
    return <ProfileFormLoading />
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {!section && (
        <div>
          <h1 className="text-2xl font-bold mb-1 text-primary" style={{ fontFamily: 'var(--font-heading)' }}>
            {isUpdate ? 'Update Profile' : 'Complete Your Profile'}
          </h1>
          <p className="text-sm text-secondary">
            {isUpdate ? 'Keep your profile current so dive centers can find you.' : 'Set up your divemaster profile to start receiving booking requests.'}
          </p>
        </div>
      )}

      {(!section || section === 'contact') && (
      <div className="space-y-4">
        <ProfileBasicInfo
          nameValue={form.name}
          onNameChange={(val) => setField('name', val)}
          nameError={errors.name}
          nameLabel="Full Name"
          namePlaceholder="Your name"
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

      <ProfileLanguagesSection
        section={section}
        variant="teaching"
        value={form.teachingLanguages}
        onChange={(langs) => setField('teachingLanguages', langs)}
      />

      <ProfileFormSectionDivider show={!section} />

      {(!section || section === 'credentials') && (
        <ProfileAgencyInfo
          variant="divemaster"
          items={form.credential}
          onChange={(items) => setField('credential', items)}
          errors={errors as Record<string, string>}
        />
      )}

      {serverError && <p className="text-sm text-center" style={{ color: 'var(--color-destructive)' }}>{serverError}</p>}
      {saved && <p className="text-sm text-center" style={{ color: 'var(--color-success)' }}>Profile saved successfully.</p>}

      <SaveButton saving={saving} saved={saved} isDirty={isDirty} isUpdate={isUpdate} />
    </form>
  )
}
