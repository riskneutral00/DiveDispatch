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
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { SaveButton } from '@/components/ui/save-button'
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

// ── Zod Schemas ───────────────────────────────────────────────────────

const associationSchema = z.object({
  agency: z.string().min(1, 'Agency is required'),
  number: z.string().min(1, 'Number is required'),
})

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: nullableProfileLocation(),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  associations: z.array(associationSchema),
  defaultReferralMode: z.enum(['independent', 'referral']),
  customerLanguages: customerLanguagesFieldSchema,
})
type AssociationData = z.infer<typeof associationSchema>

type ProfileFormData = {
  name: string
  location: LocationValue | null
  email: string
  phone: string
  associations: AssociationData[]
  defaultReferralMode: 'independent' | 'referral'
  customerLanguages: Language[]
}



const INITIAL_FORM: ProfileFormData = {
  name: '',
  location: null,
  email: '',
  phone: '',
  associations: [],
  defaultReferralMode: 'independent',
  customerLanguages: [],
}


export type AgentProfileSection = 'contact' | 'languages' | 'associations'

export function AgentProfileForm({ section }: { section?: AgentProfileSection } = {}) {
  const profile = useQuery(api.agents.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.agents.create)
  const update = useMutation(api.agents.update)
  const updateProfile = useMutation(api.users.updateProfile)

  const { form, setField, errors, serverError, saving, saved, isDirty, loading, isUpdate, handleSubmit } = useProfileForm({
    profile,
    me: me ?? undefined,
    schema: profileSchema,
    defaults: INITIAL_FORM,
    waitForMeBeforeInit: true,
    fromProfile: (p, user) => ({
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
      associations: (p.associations as Record<string, unknown>[])?.map(a => ({ agency: String(a.agency || ''), number: String(a.number || '') })) ?? [],
      defaultReferralMode: p.defaultReferralMode as 'independent' | 'referral',
      customerLanguages: languagesFromProfile(
        (user as { customerLanguages?: string[] } | undefined)?.customerLanguages,
      ),
    }),
    fromMe: (u, initial) => ({
      ...initial,
      email: u.email ?? '',
      phone: u.phone ?? '',
      customerLanguages: languagesFromProfile(u.customerLanguages),
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
        associations: f.associations,
        defaultReferralMode: f.defaultReferralMode,
      }
    },
    afterSuccessfulSave: async (f) => {
      await updateProfile({ customerLanguages: languagesToPayload(f.customerLanguages) })
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
      {/* Contact info */}
      {(!section || section === 'contact') && (
        <>
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

          {/* Referral mode */}
          <div>
            <FormSectionHeader label="Default Booking Mode" />
            <div className="flex gap-3 mt-2">
              {(['independent', 'referral'] as const).map((mode) => {
                const active = form.defaultReferralMode === mode
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setField('defaultReferralMode', mode)}
                    className="flex-1 py-2.5 px-4 rounded-[var(--border-radius)] text-sm font-medium border transition-all"
                    style={{
                      background: active ? 'var(--color-primary)' : 'var(--color-glass-bg)',
                      borderColor: active ? 'var(--color-primary)' : 'var(--color-glass-border)',
                      color: active ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
                      backdropFilter: active ? undefined : 'blur(var(--glass-blur))',
                      transitionDuration: 'var(--transition-speed)',
                    }}
                  >
                    {mode === 'independent' ? 'Independent' : 'Referral Only'}
                  </button>
                )
              })}
            </div>
            <p className="text-xs mt-2 text-secondary">
              {form.defaultReferralMode === 'independent'
                ? 'You create and manage bookings directly.'
                : 'You refer customers to operators who manage the booking.'}
            </p>
            {errors.defaultReferralMode && <p className="text-sm mt-1" style={{ color: 'var(--color-destructive)' }}>{errors.defaultReferralMode}</p>}
          </div>
        </>
      )}

      <ProfileFormSectionDivider show={!section} />

      <ProfileLanguagesSection
        section={section}
        variant="customer"
        value={form.customerLanguages}
        onChange={(langs) => setField('customerLanguages', langs)}
      />

      <ProfileFormSectionDivider show={!section} />

      {/* Agency associations */}
      {(!section || section === 'associations') && (
        <ProfileAgencyInfo
          variant="agent"
          items={form.associations}
          onChange={(items) => setField('associations', items)}
          errors={errors as Record<string, string>}
        />
      )}

      {serverError && <p className="text-sm text-center" style={{ color: 'var(--color-destructive)' }}>{serverError}</p>}
      {saved && <p className="text-sm text-center" style={{ color: 'var(--color-success)' }}>Profile saved successfully.</p>}

      <SaveButton saving={saving} saved={saved} isDirty={isDirty} isUpdate={isUpdate} />
    </form>
  )
}
