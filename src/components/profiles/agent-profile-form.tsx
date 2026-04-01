'use client'

import { z } from 'zod'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileAgencyInfo } from '@/components/profiles/profile-agency-info'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormSectionDivider } from '@/components/profiles/profile-form-section-divider'
import { ProfileLanguagesSection } from '@/components/profiles/profile-languages-section'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { ProfileTabSection } from '@/components/profiles/profile-tab-section'
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
import { associationSchema } from '@/lib/schemas/profile-shared'
import type { Language } from '@/lib/types/language'

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

export type AgentProfileFormProps = {
  section?: AgentProfileSection
  profile: Record<string, unknown> | null | undefined
  me: Record<string, unknown> | null | undefined
  create: (payload: Record<string, unknown>) => Promise<unknown>
  update: (payload: Record<string, unknown>) => Promise<unknown>
  updateProfile: (payload: Record<string, unknown>) => Promise<unknown>
}

export function AgentProfileForm({ section, profile, me, create, update, updateProfile }: AgentProfileFormProps) {

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
    profile: profile as Record<string, unknown> | null | undefined,
    me: (me ?? undefined) as { businessName?: string; email?: string; phone?: string; customerLanguages?: string[] } | undefined,
    schema: profileSchema,
    defaults: INITIAL_FORM,
    waitForMeBeforeInit: true,
    fromProfile: (p, user) => {
      const c = contactFieldsFromProfile(p)
      return {
        ...c,
        location: c.location as LocationValue,
        associations: (p.associations as Record<string, unknown>[])?.map(a => ({ agency: String(a.agency || ''), number: String(a.number || '') })) ?? [],
        defaultReferralMode: p.defaultReferralMode as 'independent' | 'referral',
        customerLanguages: languagesFromProfile(
          (user as { customerLanguages?: string[] } | undefined)?.customerLanguages,
        ),
      }
    },
    fromMe: (u, initial) => ({
      ...initial,
      email: u.email ?? '',
      phone: u.phone ?? '',
      customerLanguages: languagesFromProfile(u.customerLanguages),
    }),
    toPayload: (f) => ({
      name: f.name,
      ...locationToPayload(f.location!),
      email: f.email,
      phone: f.phone,
      associations: f.associations,
      defaultReferralMode: f.defaultReferralMode,
    }),
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
      {/* Contact info */}
      <ProfileTabSection id="contact" section={section}>
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
      </ProfileTabSection>

      <ProfileFormSectionDivider show={!section} />

      <ProfileLanguagesSection
        section={section}
        variant="customer"
        value={form.customerLanguages}
        onChange={(langs) => setField('customerLanguages', langs)}
      />

      <ProfileFormSectionDivider show={!section} />

      {/* Agency associations */}
      <ProfileTabSection id="associations" section={section}>
        <ProfileAgencyInfo
          variant="agent"
          items={form.associations}
          onChange={(items) => setField('associations', items)}
          errors={errors as Record<string, string>}
        />
      </ProfileTabSection>
    </ProfileFormShell>
  )
}
