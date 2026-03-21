'use client'

import { useState } from 'react'
import type { RoleConfig } from '@/lib/constants/roles'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassInput } from '@/components/glass/glass-input'

// Roles where a personal name is used instead of a business name
const PERSONAL_ROLE_KEYS = new Set(['instructor', 'dive-master'])

export interface ProfileFormValues {
  firstName: string
  lastName: string
  businessName: string
  city: string
  country: string
  contactEmail: string
  contactPhone: string
}

interface StepProfileSetupProps {
  selectedRoles: RoleConfig[]
  initialValues: ProfileFormValues
  onBack: () => void
  onSubmit: (values: ProfileFormValues) => void
  submitting: boolean
  error: string
}

export function StepProfileSetup({
  selectedRoles,
  initialValues,
  onBack,
  onSubmit,
  submitting,
  error,
}: StepProfileSetupProps) {
  const [values, setValues] = useState<ProfileFormValues>(initialValues)

  const hasOrganizerRole = selectedRoles.some((r) => r.isOrganizer)
  const hasPersonalOnlyRoles =
    !hasOrganizerRole && selectedRoles.every((r) => PERSONAL_ROLE_KEYS.has(r.key))
  const showBusinessName = !hasPersonalOnlyRoles

  function set(field: keyof ProfileFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
  }

  const isComplete =
    values.firstName.trim() &&
    values.lastName.trim() &&
    values.city.trim() &&
    values.country.trim() &&
    values.contactEmail.trim() &&
    values.contactPhone.trim() &&
    (!showBusinessName || values.businessName.trim())

  return (
    <>
      <div className="mb-6 text-center">
        <h2
          className="text-xl font-semibold mb-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Set up your profile
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {selectedRoles.map((r) => r.label).join(' · ')}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (isComplete) onSubmit(values)
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="First name"
            value={values.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            autoComplete="given-name"
            required
          />
          <GlassInput
            label="Last name"
            value={values.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            autoComplete="family-name"
            required
          />
        </div>

        {showBusinessName && (
          <GlassInput
            label="Business name"
            value={values.businessName}
            onChange={(e) => set('businessName', e.target.value)}
            autoComplete="organization"
            required
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="City"
            value={values.city}
            onChange={(e) => set('city', e.target.value)}
            autoComplete="address-level2"
            required
          />
          <GlassInput
            label="Country"
            value={values.country}
            onChange={(e) => set('country', e.target.value)}
            autoComplete="country-name"
            required
          />
        </div>

        <GlassInput
          label="Contact email"
          type="email"
          value={values.contactEmail}
          onChange={(e) => set('contactEmail', e.target.value)}
          autoComplete="email"
          required
        />

        <GlassInput
          label="Contact phone"
          type="tel"
          value={values.contactPhone}
          onChange={(e) => set('contactPhone', e.target.value)}
          autoComplete="tel"
          required
        />

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
            {error}
          </p>
        )}

        <div className="flex gap-3 mt-2">
          <GlassButton
            type="button"
            variant="secondary"
            onClick={onBack}
            disabled={submitting}
          >
            Back
          </GlassButton>
          <GlassButton
            type="submit"
            variant="primary"
            fullWidth
            disabled={!isComplete || submitting}
            loading={submitting}
          >
            Complete Setup
          </GlassButton>
        </div>
      </form>
    </>
  )
}
