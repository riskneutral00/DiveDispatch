'use client'

import { useMutation, useQuery } from 'convex/react'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/convex-generated'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { LoadingCard } from '@/components/ui/loading-card'
import { type LocationValue } from '@/components/profiles/location-picker'
import { contactSchema } from '@/lib/schemas/profile-shared'
import {
  INITIAL_CONTACT_FORM,
  contactFromProfile,
  type ContactFormState,
} from '@/lib/profile-form'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import { useSessionIdentity } from '@/lib/hooks/use-session-identity'
import type { BaseProfileSectionProps } from '@/lib/profile-form'

export function VenueContactSection({ onSaved, onClose }: BaseProfileSectionProps) {
  const t = useTranslations('common')
  const org = useQuery(api.organizations.mine)
  const { user: me } = useSessionIdentity()
  const inheritance = useQuery(api.users.inheritedContactDefaults, { excludeRole: 'Venue' })
  const updateMutation = useMutation(api.organizations.updateBusinessMetadata)

  const inheritedDefaults: ContactFormState = inheritance
    ? { ...INITIAL_CONTACT_FORM, ...contactFromProfile(inheritance as unknown as Record<string, unknown>) }
    : INITIAL_CONTACT_FORM

  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit, resetToBaseline, validateField } =
    useProfileForm({
      profile: inheritance === undefined ? undefined : org,
      me,
      schema: contactSchema,
      defaults: inheritedDefaults,
      fromProfile: (p): ContactFormState => ({
        name: (p.name as string) ?? '',
        location:
          p.address != null
            ? {
                address: p.address as LocationValue['address'],
                placeId: p.placeId as string | undefined,
                lat: (p.lat as number | undefined) ?? 0,
                lng: (p.lng as number | undefined) ?? 0,
              }
            : null,
        email: (p.email as string) ?? '',
        phone: (p.phone as string) ?? '',
      }),
      fromMe: (u, defaults) => ({
        ...defaults,
        email: defaults.email || (u.email as string) || '',
      }),
      toPayload: (f) => ({
        name: f.name,
        email: f.email,
        phone: f.phone,
        ...(f.location
          ? {
              address: f.location.address,
              placeId: f.location.placeId,
              lat: f.location.lat,
              lng: f.location.lng,
            }
          : {}),
      }),
      create: async (payload) => {
        await updateMutation(payload)
      },
      update: async (payload) => {
        await updateMutation(payload)
      },
      onSaved,
    })

  if (loading) return <LoadingCard />

  return (
    <ProfileFormShell
      loading={loading}
      onSubmit={handleSubmit}
      onCancel={() => { resetToBaseline(); onClose?.() }}
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
          onNameBlur={() => validateField('name')}
          nameError={errors.name}
          nameLabel={t('businessName')}
          nameRequired
          locationValue={form.location}
          onLocationChange={(loc) => setField('location', loc)}
          onLocationBlur={() => validateField('location')}
          locationError={errors.location}
          locationRequired
          emailValue={form.email}
          onEmailChange={(val) => setField('email', val)}
          onEmailBlur={() => validateField('email')}
          emailError={errors.email}
          emailRequired
          phoneValue={form.phone}
          onPhoneChange={(val) => setField('phone', val)}
          onPhoneBlur={() => validateField('phone')}
          phoneError={errors.phone}
          phoneRequired
        />
      </div>
    </ProfileFormShell>
  )
}
