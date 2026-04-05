import { Input } from '@/components/ui/input'
import { LocationPicker, type LocationValue } from '@/components/profiles/location-picker-lazy'

interface ProfileBasicInfoProps {
  nameLabel?: string
  namePlaceholder?: string
  nameValue: string
  nameError?: string
  onNameChange: (value: string) => void

  locationValue: LocationValue | null
  locationError?: string
  onLocationChange: (value: LocationValue | null) => void

  phoneValue: string
  phoneError?: string
  onPhoneChange: (value: string) => void

  emailValue?: string
  emailError?: string
  onEmailChange?: (value: string) => void

  nameRequired?: boolean
  locationRequired?: boolean
  phoneRequired?: boolean
  emailRequired?: boolean

  children?: React.ReactNode
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
  phoneValue,
  phoneError,
  onPhoneChange,
  emailValue,
  emailError,
  onEmailChange,
  nameRequired,
  locationRequired,
  phoneRequired,
  emailRequired,
  children,
}: ProfileBasicInfoProps) {
  return (
    <div className="flex flex-wrap gap-4 w-full">
      <Input
        label={nameLabel}
        placeholder={namePlaceholder}
        value={nameValue}
        onChange={(e) => onNameChange(e.target.value)}
        error={nameError}
        autoComplete="organization"
        required={nameRequired}
        className="field-name"
      />
      <LocationPicker
        label="Location"
        value={locationValue}
        onChange={onLocationChange}
        error={locationError}
        required={locationRequired}
        className="field-location"
      />
      <Input
        label="Phone"
        type="text"
        inputMode="tel"
        placeholder="+66 81 234 5678"
        value={phoneValue}
        onChange={(e) => onPhoneChange(e.target.value)}
        error={phoneError}
        autoComplete="tel"
        required={phoneRequired}
        className="field-phone"
      />
      {onEmailChange !== undefined && (
        <Input
          label="Email"
          type="text"
          inputMode="email"
          placeholder="info@example.com"
          value={emailValue ?? ''}
          onChange={(e) => onEmailChange(e.target.value)}
          error={emailError}
          autoComplete="email"
          required={emailRequired}
          className="field-email"
        />
      )}
      {children}
    </div>
  )
}
