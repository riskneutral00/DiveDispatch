'use client'

import { useTranslations } from 'next-intl'
import { useQuery, useMutation } from 'convex/react'
import { z } from 'zod'
import { isValidPhoneNumber } from 'libphonenumber-js'
import { api } from '@/lib/convex-generated'
import { NameField } from '@/components/ui/name-field'
import { EmailField } from '@/components/ui/email-field'
import { PhoneField } from '@/components/ui/phone-field'
import { BirthdayField } from '@/components/ui/birthday-field'
import { SectionDivider } from '@/components/ui/section-divider'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import { ALL_LANGUAGES, languageToCode } from '@/lib/constants/dive-languages'
import { LanguageField } from '@/components/ui/language-field'

export type ProfileValues = {
  firstName: string
  lastName: string
  nickname: string
  businessName: string
  email: string
  phone: string
  dateOfBirth: string
  appLanguage: string
}

export const profileTabSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  nickname: z.string(),
  businessName: z.string().min(1, 'Business name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().refine((v) => isValidPhoneNumber(v), { message: 'Invalid phone number' }),
  dateOfBirth: z
    .string()
    .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: 'Invalid date',
    }),
  appLanguage: z.string().min(1, 'App language is required'),
})

export const PROFILE_DEFAULTS: ProfileValues = {
  firstName: '',
  lastName: '',
  nickname: '',
  businessName: '',
  email: '',
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
    businessName: (typeof p.businessName === 'string' ? p.businessName : '') || '',
    email: (typeof p.email === 'string' ? p.email : '') || '',
    phone: (typeof p.phone === 'string' ? p.phone : '') || '',
    dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : '',
    appLanguage: (typeof p.appLanguage === 'string' ? p.appLanguage : '') || 'en',
  }
}

export function profileToPayload(form: ProfileValues) {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    nickname: form.nickname.trim() || undefined,
    businessName: form.businessName.trim(),
    phone: form.phone.trim() || undefined,
    email: form.email.trim(),
    appLanguage: form.appLanguage,
    dateOfBirth: form.dateOfBirth || undefined,
  }
}

export function ProfileTab({ onClose }: { onClose?: () => void }) {
  const t = useTranslations('common')
  const user = useQuery(api.users.me)
  const updateProfile = useMutation(api.users.updateProfile)

  const {
    form,
    setField,
    footerErrorMessage,
    saving,
    saved,
    isDirty,
    isValid,
    isUpdate,
    handleSubmit,
    loading,
    resetToBaseline,
  } = useProfileForm<ProfileValues, ReturnType<typeof profileToPayload>>({
    profile: user as Record<string, unknown> | null | undefined,
    schema: profileTabSchema,
    defaults: PROFILE_DEFAULTS,
    fromProfile: profileFromUser,
    toPayload: profileToPayload,
    update: (payload) => updateProfile(payload),
  })

  const selectedLocaleObj = ALL_LANGUAGES.find((l) => l.code === languageToCode(form.appLanguage))
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NameField
            scope="given"
            label={t('firstName')}
            value={form.firstName}
            onChange={(v) => setField('firstName', v)}
            required
          />
          <NameField
            scope="family"
            label={t('lastName')}
            value={form.lastName}
            onChange={(v) => setField('lastName', v)}
            required
          />
        </div>

        <SectionDivider variant="soft" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NameField
            scope="nickname"
            label={t('nickname')}
            value={form.nickname}
            onChange={(v) => setField('nickname', v)}
          />
          <PhoneField
            label={t('phone')}
            value={form.phone}
            onChange={(v) => setField('phone', v)}
            required
          />
        </div>

        <SectionDivider variant="soft" />

        <NameField
          scope="organization"
          label={t('businessName')}
          value={form.businessName}
          onChange={(v) => setField('businessName', v)}
          required
        />

        <SectionDivider variant="soft" />

        <EmailField
          label={t('email')}
          value={form.email}
          onChange={(v) => setField('email', v)}
          required
        />

        <SectionDivider variant="soft" />

        <BirthdayField
          label={t('dateOfBirth')}
          value={form.dateOfBirth || null}
          onChange={(v) => setField('dateOfBirth', v ?? '')}
        />

        <SectionDivider variant="soft" />

        <LanguageField
          variant="app"
          value={selectedLocale}
          onChange={(langs) => {
            if (langs[0]) setField('appLanguage', langs[0].code)
          }}
        />
      </div>
    </ProfileFormShell>
  )
}
