'use client'

import React from 'react'
import { GlassInput } from '@/components/glass/glass-input'
import { GlassButton } from '@/components/glass/glass-button'
import { LanguagePicker } from '@/components/common/language-picker'
import { LocationPicker, type LocationValue } from '@/components/common/location-picker'
import { ALL_LANGUAGES } from '@/lib/constants/dive-languages'
import type { Language } from '@/lib/types/language'
import { Save } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProfileFormSharedValue {
  name: string
  location: LocationValue | null
  contactEmail: string
  contactPhone: string
  focusedLanguages: string[]
}

export interface ProfileFormErrors {
  name?: string
  location?: string
  contactEmail?: string
  contactPhone?: string
  focusedLanguages?: string
}

interface ProfileFormProps {
  value: ProfileFormSharedValue
  onChange: <K extends keyof ProfileFormSharedValue>(
    field: K,
    newValue: ProfileFormSharedValue[K],
  ) => void
  onSubmit: (e: React.FormEvent) => void
  errors?: ProfileFormErrors
  isLoading?: boolean
  submitLabel?: string
  /** Defaults to "Operating Languages" */
  languageLabel?: string
  /** Pass false to hide the LocationPicker (e.g. for agents with multiple locations) */
  showLocation?: boolean
  /** Stakeholder-specific sections rendered after the shared fields */
  children?: React.ReactNode
  /** Optional server error message */
  serverError?: string | null
  /** Optional success message */
  savedMessage?: string | null
}

// ── Zod schema (exported for reuse in parent forms) ───────────────────────────

export { z } from 'zod'
import { z } from 'zod'

export const locationSchema = z.object({
  placeName: z.string().min(1),
  country: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().optional(),
})

export const sharedProfileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  contactEmail: z.string().email('Valid email required'),
  contactPhone: z.string().min(1, 'Phone is required'),
  focusedLanguages: z.array(z.string()),
})

// ── Section header helper ─────────────────────────────────────────────────────

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xs font-semibold uppercase tracking-wider"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      {children}
    </h2>
  )
}

// ── ProfileForm ───────────────────────────────────────────────────────────────

export function ProfileForm({
  value,
  onChange,
  onSubmit,
  errors = {},
  isLoading = false,
  submitLabel,
  languageLabel = 'Operating Languages',
  showLocation = true,
  children,
  serverError,
  savedMessage,
}: ProfileFormProps) {
  const selectedLanguages: Language[] = value.focusedLanguages
    .map((code) => ALL_LANGUAGES.find((l) => l.code === code))
    .filter((l): l is NonNullable<typeof l> => l !== undefined)
    .map((l) => ({ code: l.code, label: l.label }))

  return (
    <form onSubmit={onSubmit} className="max-w-2xl mx-auto space-y-8">
      {/* Basic Information */}
      <div className="space-y-4">
        <SectionHeader>Basic Information</SectionHeader>

        <GlassInput
          label="Business Name"
          value={value.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="e.g. Ocean Explorer Dive Center"
          error={errors.name}
        />

        {showLocation && (
          <LocationPicker
            label="Location"
            value={value.location}
            onChange={(loc) => onChange('location', loc)}
            error={errors.location}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Contact Email"
            type="email"
            value={value.contactEmail}
            onChange={(e) => onChange('contactEmail', e.target.value)}
            placeholder="dive@example.com"
            error={errors.contactEmail}
          />
          <GlassInput
            label="Contact Phone"
            type="tel"
            value={value.contactPhone}
            onChange={(e) => onChange('contactPhone', e.target.value)}
            placeholder="+66 81 234 5678"
            error={errors.contactPhone}
          />
        </div>
      </div>

      {/* Languages */}
      <div className="space-y-4">
        <SectionHeader>{languageLabel}</SectionHeader>
        <LanguagePicker
          value={selectedLanguages}
          onChange={(langs) => onChange('focusedLanguages', langs.map((l) => l.code))}
        />
        {errors.focusedLanguages && (
          <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
            {errors.focusedLanguages}
          </p>
        )}
      </div>

      {/* Stakeholder-specific sections */}
      {children}

      {serverError && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{serverError}</p>
      )}
      {savedMessage && (
        <p className="text-sm" style={{ color: 'var(--color-success)' }}>{savedMessage}</p>
      )}

      <div className="flex justify-end">
        <GlassButton type="submit" loading={isLoading}>
          <Save size={16} />
          {submitLabel ?? 'Save Changes'}
        </GlassButton>
      </div>
    </form>
  )
}
