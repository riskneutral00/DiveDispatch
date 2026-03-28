'use client'

import React from 'react'
import { GlassInput } from '@/components/glass/glass-input'
import { GlassButton } from '@/components/glass/glass-button'
import { LocationPicker, type LocationValue } from '@/components/common/location-picker-lazy'
import { Save } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProfileFormSharedValue {
  name: string
  location: LocationValue | null
  email: string
  phone: string
}

export interface ProfileFormErrors {
  name?: string
  location?: string
  email?: string
  phone?: string
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
  email: z.string().email('Valid email required'),
  phone: z.string().min(1, 'Phone is required'),
})

// ── Section header helper ─────────────────────────────────────────────────────

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xs font-semibold uppercase tracking-wider text-secondary"
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
  showLocation = true,
  children,
  serverError,
  savedMessage,
}: ProfileFormProps) {
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
            value={value.email}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="dive@example.com"
            error={errors.email}
          />
          <GlassInput
            label="Contact Phone"
            type="tel"
            value={value.phone}
            onChange={(e) => onChange('phone', e.target.value)}
            placeholder="+66 81 234 5678"
            error={errors.phone}
          />
        </div>
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
