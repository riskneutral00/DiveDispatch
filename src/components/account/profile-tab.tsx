'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation } from 'convex/react'
import { z } from 'zod'
import { phoneSchema } from '@/lib/schemas/i18n'
import { api } from '@/lib/convex-generated'
import { useDashboardSession } from '@/lib/hooks/use-dashboard-session'
import { isValidISODate } from '@/lib/utils/date'
import { NameField } from '@/components/ui/name-field'
import { EmailField } from '@/components/ui/email-field'
import { PhoneField } from '@/components/ui/phone-field'
import { BirthdayField } from '@/components/ui/birthday-field'
import { FieldRow } from '@/components/ui/field-row'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import { findLanguageByCode, languageToCode } from '@/lib/constants/dive-languages'
import { LanguageField } from '@/components/ui/language-field'
import { EmailChangeSheet } from '@/components/account/email-change-sheet'

export type ProfileValues = {
  firstName: string
  lastName: string
  nickname: string
  phone: string
  dateOfBirth: string
  appLanguage: string
}

export const profileTabSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  nickname: z.string(),
  phone: phoneSchema({ requiredMessage: 'Phone is required', invalidMessage: 'Invalid phone number' }),
  dateOfBirth: z
    .string()
    .refine((v) => v === '' || isValidISODate(v), {
      message: 'Invalid date',
    }),
  appLanguage: z.string().min(1, 'App language is required'),
})

export const PROFILE_DEFAULTS: ProfileValues = {
  firstName: '',
  lastName: '',
  nickname: '',
  phone: '',
  dateOfBirth: '',
  appLanguage: 'en',
}

export function profileFromUser(p: Record<string, unknown>): ProfileValues {
  const dob = typeof p.dateOfBirth === 'string' ? p.dateOfBirth : ''
  return {
    firstName: (typeof p.firstName === 'string' ? p.firstName : '') || '',
    lastName: (typeof p.lastName === 'string' ? p.lastName : '') || '',
    nickname: (typeof p.nickname === 'string' ? p.nickname : '') || '',
    phone: (typeof p.phone === 'string' ? p.phone : '') || '',
    dateOfBirth: isValidISODate(dob) ? dob : '',
    appLanguage: (typeof p.appLanguage === 'string' ? p.appLanguage : '') || 'en',
  }
}

export function profileToPayload(form: ProfileValues) {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    nickname: form.nickname.trim() || undefined,
    phone: form.phone.trim() || undefined,
    appLanguage: form.appLanguage,
    dateOfBirth: form.dateOfBirth || undefined,
  }
}

export function ProfileTab({ onClose }: { onClose?: () => void }) {
  const t = useTranslations('common')
  const { user } = useDashboardSession()
  const updateProfile = useMutation(api.users.updateProfile)
  const accountEmail = typeof user?.email === 'string' ? user.email : ''
  const [emailChangeOpen, setEmailChangeOpen] = useState(false)

  const {
    form,
    setField,
    errors,
    footerErrorMessage,
    saving,
    saved,
    isDirty,
    isValid,
    isUpdate,
    handleSubmit,
    loading,
    resetToBaseline,
    validateField,
  } = useProfileForm<ProfileValues, ReturnType<typeof profileToPayload>>({
    profile: user as Record<string, unknown> | null | undefined,
    schema: profileTabSchema,
    defaults: PROFILE_DEFAULTS,
    fromProfile: profileFromUser,
    toPayload: profileToPayload,
    update: (payload) => updateProfile(payload),
  })

  const selectedLocaleObj = findLanguageByCode(languageToCode(form.appLanguage))
  const selectedLocale = selectedLocaleObj
    ? [{ code: selectedLocaleObj.code, label: selectedLocaleObj.label }]
    : []

  return (
    <ProfileFormShell
      loading={loading}
      onSubmit={handleSubmit}
      footerErrorMessage={footerErrorMessage}
      saving={saving}
      saved={saved}
      isDirty={isDirty}
      isUpdate={isUpdate}
      disableSaveWhenInvalid
      isValid={isValid}
      onCancel={() => { resetToBaseline(); onClose?.() }}
      loadingVariant="pulse-text"
      className="space-y-6"
    >
      <div className="space-y-4">
        <FieldRow>
          <NameField
            scope="given"
            label={t('firstName')}
            value={form.firstName}
            onChange={(v) => setField('firstName', v)}
            onBlur={() => validateField('firstName')}
            error={errors.firstName}
            required
          />
          <NameField
            scope="family"
            label={t('lastName')}
            value={form.lastName}
            onChange={(v) => setField('lastName', v)}
            onBlur={() => validateField('lastName')}
            error={errors.lastName}
            required
          />
          <NameField
            scope="nickname"
            label={t('nickname')}
            value={form.nickname}
            onChange={(v) => setField('nickname', v)}
            onBlur={() => validateField('nickname')}
            error={errors.nickname}
          />
          <PhoneField
            label={t('phone')}
            value={form.phone}
            onChange={(v) => setField('phone', v)}
            onBlur={() => validateField('phone')}
            error={errors.phone}
            required
          />
          <EmailField
            label={t('email')}
            value={accountEmail}
            onChange={() => {}}
            readOnly
            onClick={() => setEmailChangeOpen(true)}
            className="cursor-pointer"
          />
          <BirthdayField
            label={t('dateOfBirth')}
            value={form.dateOfBirth || null}
            onChange={(v) => setField('dateOfBirth', v ?? '')}
            onBlur={() => validateField('dateOfBirth')}
            error={errors.dateOfBirth}
            required
          />
        </FieldRow>

        <LanguageField
          label={t('appLanguage')}
          multiple={false}
          required
          value={selectedLocale}
          onChange={(langs) => {
            setField('appLanguage', langs[0]?.code ?? '')
          }}
        />
      </div>
      <EmailChangeSheet open={emailChangeOpen} onClose={() => setEmailChangeOpen(false)} />
    </ProfileFormShell>
  )
}
