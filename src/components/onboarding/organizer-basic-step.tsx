'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/convex-generated'
import { LoadingCard } from '@/components/ui/loading-card'
import { LocationPicker, type LocationValue } from '@/components/profiles/location-picker'
import { Input } from '@/components/ui/input'
import { EmailField } from '@/components/ui/email-field'
import { PhoneField } from '@/components/ui/phone-field'
import { FieldRow } from '@/components/ui/field-row'
import type { ClerkRole } from '@/lib/constants/roles'
import {
  getVenueKindTile,
  type VenueSignupIntent,
} from '@/lib/constants/signup-role-tiles'
import { VENUE_KINDS, type VenueKind } from '../../../convex/shared/venueTypes'
import { useOrganizerRoleApi } from '@/lib/hooks/use-organizer-role-api'
import { useDashboardSession } from '@/lib/hooks/use-dashboard-session'
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
import { RoleTile } from '@/components/ui/role-tile'

// query-budget-ok: 4 subscriptions; planned migration to organizer.basicStepContext (Phase 2D of zesty-creek perf plan)

function mergeInheritedDefaults(
  inheritance: Record<string, unknown> | null,
): ContactFormState {
  if (!inheritance) return INITIAL_CONTACT_FORM
  return {
    ...INITIAL_CONTACT_FORM,
    ...contactFromProfile(inheritance),
  }
}

interface OrganizerContactFieldsProps {
  form: ContactFormState
  setField: <K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) => void
  errors: Partial<Record<keyof ContactFormState, string>>
  validateField: (field: string) => void
}

function OrganizerContactFields({ form, setField, errors, validateField }: OrganizerContactFieldsProps) {
  const t = useTranslations('common')
  return (
    <div className="space-y-4" data-testid="wizard-content">
      <Input
        label={t('businessName')}
        value={form.name}
        onChange={(e) => setField('name', e.target.value)}
        onBlur={() => validateField('name')}
        required
        error={errors.name}
      />
      <LocationPicker
        label={t('location')}
        value={form.location as LocationValue | null}
        onChange={(loc) => setField('location', loc)}
        onBlur={() => validateField('location')}
        error={errors.location}
      />
      <FieldRow>
        <EmailField
          label={t('contactEmail')}
          value={form.email}
          onChange={(v) => setField('email', v)}
          onBlur={() => validateField('email')}
          required
          error={errors.email}
        />
        <PhoneField
          label={t('contactPhone')}
          value={form.phone}
          onChange={(v) => setField('phone', v)}
          onBlur={() => validateField('phone')}
          required
          error={errors.phone}
        />
      </FieldRow>
    </div>
  )
}

interface VenueKindPickerProps {
  value: VenueKind | null
  onChange: (kind: VenueKind) => void
}

function VenueKindPicker({ value, onChange }: VenueKindPickerProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
      {VENUE_KINDS.map((kind) => {
        const tile = getVenueKindTile(kind)
        return (
          <RoleTile
            key={kind}
            role={tile}
            selected={value === kind}
            onClick={() => onChange(kind)}
          />
        )
      })}
    </div>
  )
}

interface OrganizerBasicStepProps {
  role: ClerkRole
  onSaved: () => void
  onBack?: () => void
  venueSignupIntent?: VenueSignupIntent | null
}

export function OrganizerBasicStep({ role, onSaved, onBack, venueSignupIntent }: OrganizerBasicStepProps) {
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

  return (
    <BasicStepInner
      role={role}
      mutations={mutations}
      onSaved={onSaved}
      onBack={onBack}
      venueSignupIntent={venueSignupIntent ?? null}
    />
  )
}

interface BasicStepInnerProps {
  role: ClerkRole
  mutations: NonNullable<ReturnType<typeof useOrganizerRoleApi>>
  onSaved: () => void
  onBack?: () => void
  venueSignupIntent: VenueSignupIntent | null
}

function BasicStepInner({ role, mutations, onSaved, onBack, venueSignupIntent }: BasicStepInnerProps) {
  const t = useTranslations('common')
  const existing = useQuery(mutations.mine)
  const { user: me } = useDashboardSession()
  const inheritance = useQuery(api.users.inheritedContactDefaults, { excludeRole: role })
  const createMutation = useMutation(mutations.create)
  const updateMutation = useMutation(mutations.update)

  const seedKind: VenueKind | null =
    role === 'Venue' && (venueSignupIntent === 'pool' || venueSignupIntent === 'dive_site')
      ? venueSignupIntent
      : null
  const [pickedKind, setPickedKind] = useState<VenueKind | null>(seedKind)

  const createWithRoleExtras = async (payload: Record<string, unknown>) => {
    const base = {
      name: payload.name as string,
      address: payload.address as { street?: string; city: string; state?: string; country: string; postalCode?: string },
      placeId: payload.placeId as string | undefined,
      lat: payload.lat as number,
      lng: payload.lng as number,
      email: payload.email as string,
      phone: payload.phone as string,
    }
    if (role === 'Venue') {
      if (!pickedKind) {
        throw new Error('VENUE_KIND_REQUIRED') // error-ok: developer contract — UI gate prevents reaching this
      }
      const venueCreate = createMutation as unknown as (args: Record<string, unknown>) => Promise<unknown>
      return venueCreate({
        ...base,
        kind: pickedKind,
        features: [],
      })
    }
    return createMutation({ ...base, associations: [] })
  }

  const fromMe = (u: Record<string, unknown>, defaults: ContactFormState): ContactFormState => ({
    ...defaults,
    email: defaults.email || (u.email as string) || '',
  })

  const inheritedDefaults = mergeInheritedDefaults(
    inheritance && inheritance !== undefined
      ? (inheritance as unknown as Record<string, unknown>)
      : null,
  )

  const existingProfile = Array.isArray(existing) ? existing[0] ?? null : existing

  const updateForRole = async (payload: Record<string, unknown>) => {
    if (role === 'DiveCenter') {
      const dcId = (existingProfile as { _id?: string } | null)?._id
      if (!dcId) return undefined
      return (updateMutation as unknown as (args: Record<string, unknown>) => Promise<unknown>)({
        ...payload,
        entityId: dcId,
      })
    }
    if (role === 'Venue') {
      const venueId = (existingProfile as { _id?: string } | null)?._id
      if (!venueId) return undefined
      return (updateMutation as unknown as (args: Record<string, unknown>) => Promise<unknown>)({
        ...payload,
        venueId,
      })
    }
    return (updateMutation as unknown as (args: Record<string, unknown>) => Promise<unknown>)(payload)
  }

  const { form, setField, errors, saving, isValid, loading, handleSubmit, validateField } =
    useProfileForm({
      profile: inheritance === undefined ? undefined : existingProfile,
      me,
      schema: contactSchema,
      defaults: inheritedDefaults,
      fromProfile: contactFromProfile,
      fromMe,
      toPayload: contactToPayload,
      create: createWithRoleExtras,
      update: updateForRole,
      onSaved,
      waitForMeBeforeInit: true,
    })

  if (loading) {
    return <LoadingCard />
  }

  const { displayLabel: roleLabel } = getOrganizerRoleFlags(role)

  const venueRequiresPicker = role === 'Venue' && existingProfile == null
  const venueGate = venueRequiresPicker && pickedKind == null

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
      disabled={!isValid || venueGate}
    >
      {venueRequiresPicker && (
        <VenueKindPicker value={pickedKind} onChange={setPickedKind} />
      )}
      <OrganizerContactFields form={form} setField={setField} errors={errors} validateField={validateField} />
    </OrganizerStepCard>
  )
}
