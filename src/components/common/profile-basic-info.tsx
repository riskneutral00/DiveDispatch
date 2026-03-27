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

  phoneValue: string
  phoneError?: string
  onPhoneChange: (value: string) => void

  nameRequired?: boolean
  locationRequired?: boolean
  phoneRequired?: boolean

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
  nameRequired,
  locationRequired,
  phoneRequired,
  children,
}: ProfileBasicInfoProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
      <GlassInput
        label={nameLabel}
        placeholder={namePlaceholder}
        value={nameValue}
        onChange={(e) => onNameChange(e.target.value)}
        error={nameError}
        autoComplete="organization"
        required={nameRequired}
      />
      <LocationPicker
        label="Location"
        value={locationValue}
        onChange={onLocationChange}
        error={locationError}
        required={locationRequired}
      />
      <GlassInput
        label="Phone"
        type="tel"
        placeholder="+66 81 234 5678"
        value={phoneValue}
        onChange={(e) => onPhoneChange(e.target.value)}
        error={phoneError}
        autoComplete="tel"
        required={phoneRequired}
      />
      {children}
    </div>
  )
}
