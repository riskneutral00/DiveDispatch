'use client'

import { useTranslations } from 'next-intl'
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

  locationLabel?: string
  locationValue: LocationValue | null
  locationError?: string
  onLocationChange: (value: LocationValue | null) => void
  onLocationBlur?: () => void

  phoneLabel?: string
  phoneValue: string
  phoneError?: string
  onPhoneChange: (value: string) => void
  onPhoneBlur?: () => void

  emailLabel?: string
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
  nameLabel,
  nameValue,
  nameError,
  onNameChange,
  onNameBlur,
  locationLabel,
  locationValue,
  locationError,
  onLocationChange,
  onLocationBlur,
  phoneLabel,
  phoneValue,
  phoneError,
  onPhoneChange,
  onPhoneBlur,
  emailLabel,
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
  const t = useTranslations('common')
  return (
    <FieldRow className="w-full">
      {onNameChange !== undefined && (
        <NameField
          scope="organization"
          label={nameLabel ?? t('name')}
          value={nameValue ?? ''}
          onChange={onNameChange}
          onBlur={onNameBlur}
          error={nameError}
          required={nameRequired}
        />
      )}
      <LocationPicker
        label={locationLabel ?? t('location')}
        value={locationValue}
        onChange={onLocationChange}
        onBlur={onLocationBlur}
        error={locationError}
        required={locationRequired}
        className="field-md"
      />
      <PhoneField
        label={phoneLabel ?? t('phone')}
        value={phoneValue}
        onChange={onPhoneChange}
        onBlur={onPhoneBlur}
        error={phoneError}
        required={phoneRequired}
      />
      {onEmailChange !== undefined && (
        <EmailField
          label={emailLabel ?? t('email')}
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
