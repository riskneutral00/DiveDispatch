import { GlassInput } from '@/components/glass/glass-input'
import { LocationPicker, type LocationValue } from '@/components/common/location-picker'

interface ProfileBasicInfoProps {
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
}

export function ProfileBasicInfo({
  nameLabel = 'Name',
  namePlaceholder = 'Your name',
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
}: ProfileBasicInfoProps) {
  return (
    <>
      <div className="max-w-sm">
        <GlassInput
          label={nameLabel}
          placeholder={namePlaceholder}
          value={nameValue}
          onChange={(e) => onNameChange(e.target.value)}
          error={nameError}
          autoComplete="organization"
        />
      </div>
      <div className="max-w-md">
        <LocationPicker
          label="Location"
          value={locationValue}
          onChange={onLocationChange}
          error={locationError}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlassInput
          label="Contact Email"
          type="email"
          placeholder="you@example.com"
          value={emailValue}
          onChange={(e) => onEmailChange(e.target.value)}
          error={emailError}
          autoComplete="email"
        />
        <GlassInput
          label="Contact Phone"
          type="tel"
          placeholder="+66 81 234 5678"
          value={phoneValue}
          onChange={(e) => onPhoneChange(e.target.value)}
          error={phoneError}
          autoComplete="tel"
        />
      </div>
    </>
  )
}
