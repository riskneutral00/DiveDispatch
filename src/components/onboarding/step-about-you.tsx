'use client'

import type { Language } from '@/lib/types/language'
import { LanguageField } from '@/components/profiles/language-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface AboutYouValues {
  operatingLanguage: Language | null
  firstName: string
  lastName: string
  nickname: string
  phone: string
}

interface StepAboutYouProps {
  values: AboutYouValues
  onChange: (values: AboutYouValues) => void
  onContinue: () => void
}

export function StepAboutYou({
  values,
  onChange,
  onContinue,
}: StepAboutYouProps) {
  function set<K extends keyof AboutYouValues>(field: K, value: AboutYouValues[K]) {
    onChange({ ...values, [field]: value })
  }

  const isComplete =
    values.operatingLanguage !== null &&
    values.firstName.trim().length > 0 &&
    values.lastName.trim().length > 0

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-6" data-testid="wizard-content">
      <div className="text-center">
        <h2
          className="text-xl font-semibold mb-1 text-primary"
        >
          About You
        </h2>
        <p className="text-sm text-secondary">
          Tell us a bit about yourself
        </p>
      </div>

      <div className="flex flex-wrap gap-4 w-full">
        <LanguageField
          variant="app"
          value={values.operatingLanguage ? [values.operatingLanguage] : []}
          onChange={(langs) => {
            if (langs[0]) set('operatingLanguage', langs[0])
          }}
        />
      </div>

      <div className="flex flex-wrap gap-4 w-full">
        <Input
          label="First name"
          value={values.firstName}
          onChange={(e) => set('firstName', e.target.value)}
          autoComplete="given-name"
          required
          className="field-name"
        />
        <Input
          label="Last name"
          value={values.lastName}
          onChange={(e) => set('lastName', e.target.value)}
          autoComplete="family-name"
          required
          className="field-name"
        />
        <Input
          label="Nickname / display name"
          value={values.nickname}
          onChange={(e) => set('nickname', e.target.value)}
          placeholder='e.g. "Captain Mike"'
          className="field-text-short"
        />
        <Input
          label="Phone"
          value={values.phone}
          onChange={(e) => set('phone', e.target.value)}
          autoComplete="tel"
          type="tel"
          className="field-phone"
        />
      </div>

      <Button
        variant="primary"
        fullWidth
        disabled={!isComplete}
        onClick={onContinue}
        className="mt-2"
      >
        Next
      </Button>
    </div>
  )
}
