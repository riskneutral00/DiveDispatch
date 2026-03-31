'use client'

import { useState } from 'react'
import type { Language } from '@/lib/types/language'
import type { RoleConfig } from '@/lib/constants/roles'
import { LanguageField } from '@/components/profiles/language-field'
import { GlassButton } from '@/components/ui/glass-button'
import { GlassInput } from '@/components/ui/glass-input'

export interface BusinessInfoValues {
  businessName: string
  customerLanguages: Language[]
}

interface StepBusinessInfoProps {
  selectedRoles: RoleConfig[]
  values: BusinessInfoValues
  onChange: (values: BusinessInfoValues) => void
  onBack: () => void
  onContinue: () => void
}

export function StepBusinessInfo({
  selectedRoles,
  values,
  onChange,
  onBack,
  onContinue,
}: StepBusinessInfoProps) {
  const isOperator = selectedRoles.some((r) => r.displayGroup === 'operator')

  if (!isOperator) {
    return (
      <div className="w-full max-w-md mx-auto flex flex-col gap-6" data-testid="wizard-content">
        <div className="text-center">
          <h2
            className="text-xl font-semibold mb-1 text-primary"
          >
            Business Info
          </h2>
          <p className="text-sm text-secondary">
            No business info needed — operators will find you by your profile.
          </p>
        </div>

        <div className="flex gap-3 mt-2" data-testid="wizard-nav">
          <GlassButton type="button" variant="secondary" fullWidth onClick={onBack}>
            Back
          </GlassButton>
          <GlassButton variant="primary" fullWidth onClick={onContinue}>
            Next
          </GlassButton>
        </div>
      </div>
    )
  }

  const isComplete = values.businessName.trim().length > 0

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-6" data-testid="wizard-content">
      <div className="text-center">
        <h2
          className="text-xl font-semibold mb-1 text-primary"
        >
          Business Info
        </h2>
        <p className="text-sm text-secondary">
          {selectedRoles.map((r) => r.label).join(' · ')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        <GlassInput
          label="Business name"
          value={values.businessName}
          onChange={(e) => onChange({ ...values, businessName: e.target.value })}
          autoComplete="organization"
          required
        />
        <LanguageField
          variant="customer"
          value={values.customerLanguages}
          onChange={(langs) => onChange({ ...values, customerLanguages: langs })}
        />
      </div>

      <div className="flex gap-3 mt-2" data-testid="wizard-nav">
        <GlassButton type="button" variant="secondary" fullWidth onClick={onBack}>
          Back
        </GlassButton>
        <GlassButton
          variant="primary"
          fullWidth
          disabled={!isComplete}
          onClick={onContinue}
        >
          Next
        </GlassButton>
      </div>
    </div>
  )
}
