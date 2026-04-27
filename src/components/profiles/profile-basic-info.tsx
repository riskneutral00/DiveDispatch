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
  onNameBlur?: () => void

  locationValue: LocationValue | null
  locationError?: string
  onLocationChange: (value: LocationValue | null) => void
  onLocationBlur?: () => void

  phoneValue: string
  phoneError?: string
  onPhoneChange: (value: string) => void
  onPhoneBlur?: () => void

  emailValue?: string
  emailError?: string
  onEmailChange?: (value: string) => void
  onEmailBlur?: () => void

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
  onNameBlur,
  locationValue,
  locationError,
  onLocationChange,
  onLocationBlur,
  phoneValue,
  phoneError,
  onPhoneChange,
  onPhoneBlur,
  emailValue,
  emailError,
  onEmailChange,
  onEmailBlur,
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
          onBlur={onNameBlur}
          error={nameError}
          required={nameRequired}
        />
      )}
      <LocationPicker
        label="Location"
        value={locationValue}
        onChange={onLocationChange}
        onBlur={onLocationBlur}
        error={locationError}
        required={locationRequired}
        className="field-md"
      />
      <PhoneField
        label="Phone"
        value={phoneValue}
        onChange={onPhoneChange}
        onBlur={onPhoneBlur}
        error={phoneError}
        required={phoneRequired}
      />
      {onEmailChange !== undefined && (
        <EmailField
          label="Email"
          value={emailValue ?? ''}
          onChange={onEmailChange}
          onBlur={onEmailBlur}
          error={emailError}
          required={emailRequired}
        />
      )}
      {children}
    </FieldRow>
  )
}
