'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { isValidPhoneNumber } from 'libphonenumber-js'
import { WizardStepShell } from '@/components/ui/wizard-step-shell'
import { PhoneField } from '@/components/ui/phone-field'
import { NameField } from '@/components/ui/name-field'
import { BirthdayField } from '@/components/ui/birthday-field'
import { FieldRow } from '@/components/ui/field-row'
import { Checkbox } from '@/components/ui/checkbox'
import { isAdult, MIN_SIGNUP_AGE_YEARS } from '@/lib/constants/age'

interface StepProfileCompletionProps {
  firstName: string
  lastName: string
  dateOfBirth: string
  phone: string
  nickname: string
  tcAccepted: boolean
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onDateOfBirthChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onNicknameChange: (value: string) => void
  onTcAcceptedChange: (value: boolean) => void
  onBack: () => void
  onContinue: () => void
  submitting?: boolean
  error?: string | null
}

export function StepProfileCompletion({
  firstName,
  lastName,
  dateOfBirth,
  phone,
  nickname,
  tcAccepted,
  onFirstNameChange,
  onLastNameChange,
  onDateOfBirthChange,
  onPhoneChange,
  onNicknameChange,
  onTcAcceptedChange,
  onBack,
  onContinue,
  submitting,
  error,
}: StepProfileCompletionProps) {
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')

  const canContinue = useMemo(
    () =>
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      phone.trim().length > 0 &&
      isValidPhoneNumber(phone) &&
      dateOfBirth.length > 0 &&
      isAdult(dateOfBirth) &&
      tcAccepted,
    [firstName, lastName, phone, dateOfBirth, tcAccepted],
  )

  return (
    <WizardStepShell
      card={false}
      title={t('profileStepTitle')}
      onBack={onBack}
      primary={{
        label: tCommon('continue'),
        onClick: onContinue,
        disabled: !canContinue,
        loading: submitting,
      }}
      error={error ?? null}
    >
      <div className="w-full mb-4 space-y-4" data-testid="wizard-content">
        <FieldRow>
          <NameField
            scope="given"
            label={tCommon('firstName')}
            value={firstName}
            onChange={onFirstNameChange}
            required
          />
          <NameField
            scope="family"
            label={tCommon('lastName')}
            value={lastName}
            onChange={onLastNameChange}
            required
          />
          <NameField
            scope="nickname"
            label={tCommon('nickname')}
            value={nickname}
            onChange={onNicknameChange}
          />
          <PhoneField
            label={tCommon('phone')}
            value={phone}
            onChange={onPhoneChange}
            required
          />
          <BirthdayField
            label={tCommon('dateOfBirth')}
            value={dateOfBirth || null}
            onChange={(v) => onDateOfBirthChange(v ?? '')}
            required
            minAge={MIN_SIGNUP_AGE_YEARS}
          />
        </FieldRow>
        <Checkbox
          checked={tcAccepted}
          onChange={onTcAcceptedChange}
          required
          label={t.rich('iAgreeToTerms', {
            link: (chunks) => (
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-2 hover:opacity-70 transition-opacity duration-theme"
              >
                {chunks}
              </Link>
            ),
          })}
        />
      </div>
    </WizardStepShell>
  )
}
