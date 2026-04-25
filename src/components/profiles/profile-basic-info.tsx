import { NameField } from '@/components/ui/name-field'
import { EmailField } from '@/components/ui/email-field'
import { PhoneField } from '@/components/ui/phone-field'
import { LocationPicker, type LocationValue } from '@/components/profiles/location-picker'
import { FieldRow } from '@/components/ui/field-row'

interface ProfileBasicInfoProps {
  nameLabel?: string
  nameValue?: string
  nameError?: string
  onNameChange?: (value: string) => void

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
    <FieldRow className="w-full">
      {onNameChange !== undefined && (
        <NameField
          scope="organization"
          label={nameLabel}
          value={nameValue ?? ''}
          onChange={onNameChange}
          error={nameError}
          required={nameRequired}
        />
      )}
      <LocationPicker
        label="Location"
        value={locationValue}
        onChange={onLocationChange}
        error={locationError}
        required={locationRequired}
        className="field-md"
      />
      <PhoneField
        label="Phone"
        value={phoneValue}
        onChange={onPhoneChange}
        error={phoneError}
        required={phoneRequired}
      />
      {onEmailChange !== undefined && (
        <EmailField
          label="Email"
          value={emailValue ?? ''}
          onChange={onEmailChange}
          error={emailError}
          required={emailRequired}
        />
      )}
      {children}
    </FieldRow>
  )
}
