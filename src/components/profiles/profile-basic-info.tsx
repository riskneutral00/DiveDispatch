import { NameField } from '@/components/ui/name-field'
import { EmailField } from '@/components/ui/email-field'
import { PhoneField } from '@/components/ui/phone-field'
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
    <div className="grid grid-cols-6 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:gap-4 w-full"> {/* design-ok */}
      <NameField
        scope="organization"
        label={nameLabel}
        placeholder={namePlaceholder}
        value={nameValue}
        onChange={onNameChange}
        error={nameError}
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
      <PhoneField
        label="Phone"
        value={phoneValue}
        onChange={onPhoneChange}
        error={phoneError}
        required={phoneRequired}
        className="field-phone"
      />
      {onEmailChange !== undefined && (
        <EmailField
          label="Email"
          placeholder="info@example.com"
          value={emailValue ?? ''}
          onChange={onEmailChange}
          error={emailError}
          required={emailRequired}
          className="field-email"
        />
      )}
      {children}
    </div>
  )
}
