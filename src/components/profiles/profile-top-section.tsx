'use client'

import { GlassInput } from '@/components/ui/glass-input'
import { LocationPicker, type LocationValue } from '@/components/profiles/location-picker-lazy'

interface ProfileTopSectionProps {
  nameLabel?: string
  namePlaceholder?: string
  nameValue: string
  nameError?: string
  onNameChange: (value: string) => void

  locationValue: LocationValue | null
  locationError?: string
  onLocationChange: (value: LocationValue | null) => void

  emailValue: string
  emailError?: string
  onEmailChange: (value: string) => void

  phoneValue: string
  phoneError?: string
  onPhoneChange: (value: string) => void

  children?: React.ReactNode
}

/**
 * Shared top section for all 8 stakeholder profile forms.
 * Renders: name, location, email, phone in a 2-column grid.
 * All fields required by default (DiveCenter standard).
 */
export function ProfileTopSection({
  nameLabel = 'Business Name',
  namePlaceholder = 'e.g. Ocean Explorer Dive Center',
  nameValue,
  nameError,
  onNameChange,
  locationValue,
  locationError,
  onLocationChange,
  emailValue,
  emailError,
  onEmailChange,
  phoneValue,
  phoneError,
  onPhoneChange,
  children,
}: ProfileTopSectionProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
      <GlassInput
        label={nameLabel}
        placeholder={namePlaceholder}
        value={nameValue}
        onChange={(e) => onNameChange(e.target.value)}
        error={nameError}
        autoComplete="organization"
        required
      />
      <LocationPicker
        label="Location"
        value={locationValue}
        onChange={onLocationChange}
        error={locationError}
        required
      />
      <GlassInput
        label="Phone"
        type="tel"
        placeholder="+66 81 234 5678"
        value={phoneValue}
        onChange={(e) => onPhoneChange(e.target.value)}
        error={phoneError}
        autoComplete="tel"
        required
      />
      <GlassInput
        label="Email"
        type="email"
        placeholder="info@example.com"
        value={emailValue}
        onChange={(e) => onEmailChange(e.target.value)}
        error={emailError}
        autoComplete="email"
        required
      />
      {children}
    </div>
  )
}
