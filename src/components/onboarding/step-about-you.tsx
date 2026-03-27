'use client'

import { useState } from 'react'
import type { Language } from '@/lib/types/language'
import { LanguageField } from '@/components/common/language-field'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassInput } from '@/components/glass/glass-input'
import {
  COMMUNICATION_CHANNELS,
  type ChannelKey,
} from '@/lib/constants/communication-channels'

export interface AboutYouValues {
  operatingLanguage: Language | null
  firstName: string
  lastName: string
  nickname: string
  phone: string
  preferredChannel: ChannelKey | null
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
          className="text-xl font-semibold mb-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          About You
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Tell us a bit about yourself
        </p>
      </div>

      <LanguageField
        label="App language"
        value={values.operatingLanguage ? [values.operatingLanguage] : []}
        onChange={(langs) => {
          if (langs[0]) set('operatingLanguage', langs[0])
        }}
        max={1}
      />

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

      <GlassInput
        label="Nickname / display name"
        value={values.nickname}
        onChange={(e) => set('nickname', e.target.value)}
        placeholder='e.g. "Captain Mike"'
      />

      <GlassInput
        label="Phone"
        value={values.phone}
        onChange={(e) => set('phone', e.target.value)}
        autoComplete="tel"
        type="tel"
      />

      <div>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          Preferred communication channel
        </p>
        <div className="flex flex-wrap gap-2">
          {COMMUNICATION_CHANNELS.map((ch) => (
            <button
              key={ch.key}
              type="button"
              onClick={() =>
                set('preferredChannel', values.preferredChannel === ch.key ? null : ch.key)
              }
              className="px-3 py-1.5 rounded-full text-sm transition-colors border"
              style={{
                background:
                  values.preferredChannel === ch.key
                    ? 'var(--color-primary-muted)'
                    : 'transparent',
                borderColor:
                  values.preferredChannel === ch.key
                    ? 'var(--color-primary-border)'
                    : 'var(--color-glass-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              {ch.label}
            </button>
          ))}
        </div>
      </div>

      <GlassButton
        variant="primary"
        fullWidth
        disabled={!isComplete}
        onClick={onContinue}
        className="mt-2"
      >
        Next
      </GlassButton>
    </div>
  )
}
