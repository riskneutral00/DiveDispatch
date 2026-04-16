'use client'

import { useMutation, useQuery } from 'convex/react'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/convex-generated'
import { LoadingCard } from '@/components/ui/loading-card'
import { LocationPicker, type LocationValue } from '@/components/profiles/location-picker-lazy'
import { Input } from '@/components/ui/input'
import { EmailField } from '@/components/ui/email-field'
import { PhoneField } from '@/components/ui/phone-field'
import type { ClerkRole } from '@/lib/constants/roles'
import { useOrganizerRoleApi } from '@/lib/hooks/use-organizer-role-api'
import { getOrganizerRoleFlags } from '@/lib/constants/organizer-wizard-config'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import {
  INITIAL_CONTACT_FORM,
  contactFromProfile,
  contactToPayload,
  type ContactFormState,
} from '@/lib/profile-form'
import { contactSchema } from '@/lib/schemas/profile-shared'
import { OrganizerStepCard } from './organizer-step-card'

interface OrganizerBasicStepProps {
  role: ClerkRole
  onSaved: () => void
  onBack?: () => void
}

export function OrganizerBasicStep({ role, onSaved, onBack }: OrganizerBasicStepProps) {
  const t = useTranslations('common')
  const mutations = useOrganizerRoleApi(role)

  if (!mutations) {
    return (
      <OrganizerStepCard
        title={t('basicInformation')}
        subtitle={t('comingSoonPeriod')}
        onBack={onBack}
        onNext={onSaved}
      >
        <div />
      </OrganizerStepCard>
    )
  }

  return <BasicStepInner role={role} mutations={mutations} onSaved={onSaved} onBack={onBack} />
}

interface BasicStepInnerProps {
  role: ClerkRole
  mutations: NonNullable<ReturnType<typeof useOrganizerRoleApi>>
  onSaved: () => void
  onBack?: () => void
}

function BasicStepInner({ role, mutations, onSaved, onBack }: BasicStepInnerProps) {
  const t = useTranslations('common')
  const existing = useQuery(mutations.mine)
  const me = useQuery(api.users.me)
  const createMutation = useMutation(mutations.create)
  const updateMutation = useMutation(mutations.update)

  const createWithRoleExtras = async (payload: Record<string, unknown>) => {
    const base = {
      name: payload.name as string,
      placeName: payload.placeName as string,
      country: payload.country as string,
      lat: payload.lat as number,
      lng: payload.lng as number,
      email: payload.email as string,
      phone: payload.phone as string,
    }
    if (role === 'DiveSite') {
      return createMutation({
        ...base,
        venueCategory: 'diveSite',
        diveSiteTypes: ['shore'],
        hasCompressor: false,
      })
    }
    return createMutation({ ...base, associations: [] })
  }

  const fromMe = (u: Record<string, unknown>, defaults: ContactFormState): ContactFormState => ({
    ...defaults,
    email: (u.email as string) ?? '',
  })

  const { form, setField, errors, saving, isValid, loading, handleSubmit } =
    useProfileForm({
      profile: existing,
      me,
      schema: contactSchema,
      defaults: INITIAL_CONTACT_FORM,
      fromProfile: contactFromProfile,
      fromMe,
      toPayload: contactToPayload,
      create: createWithRoleExtras,
      update: updateMutation,
      onSaved,
      waitForMeBeforeInit: true,
    })

  if (loading) {
    return <LoadingCard />
  }

  const { displayLabel: roleLabel } = getOrganizerRoleFlags(role)

  const handleNext = () => {
    handleSubmit({ preventDefault: () => {} } as React.FormEvent)
  }

  return (
    <OrganizerStepCard
      title={t('basicInformation')}
      subtitle={t('tellUsAbout', { role: roleLabel })}
      onBack={onBack}
      onNext={handleNext}
      loading={saving}
      disabled={!isValid}
    >
      <div className="space-y-4" data-testid="wizard-content">
        <Input
          label={t('businessName')}
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          required
          error={errors.name}
        />
        <LocationPicker
          label={t('location')}
          value={form.location as LocationValue | null}
          onChange={(loc) => setField('location', loc)}
          error={errors.location}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <EmailField
            label={t('contactEmail')}
            value={form.email}
            onChange={(v) => setField('email', v)}
            required
            error={errors.email}
          />
          <PhoneField
            label={t('contactPhone')}
            value={form.phone}
            onChange={(v) => setField('phone', v)}
            required
            error={errors.phone}
          />
        </div>
      </div>
    </OrganizerStepCard>
  )
}
