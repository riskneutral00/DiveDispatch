'use client'

import { useQuery, useMutation } from 'convex/react'
import { z } from 'zod'
import { isValidPhoneNumber } from 'libphonenumber-js'
import { api } from '@/lib/convex-generated'
import { Input } from '@/components/ui/input'
import { SimpleSelect } from '@/components/ui/simple-select'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import { ALL_LANGUAGES, languageToCode } from '@/lib/constants/dive-languages'
import { LanguageField } from '@/components/profiles/language-field'

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

const DAYS = Array.from({ length: 31 }, (_, i) => {
  const d = String(i + 1).padStart(2, '0')
  return { value: d, label: String(i + 1) }
})

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 83 }, (_, i) => {
  const y = String(currentYear - 18 - i)
  return { value: y, label: y }
})

export type ProfileValues = {
  firstName: string
  lastName: string
  nickname: string
  businessName: string
  email: string
  phone: string
  dobMonth: string
  dobDay: string
  dobYear: string
  appLanguage: string
}

export const profileTabSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  nickname: z.string(),
  businessName: z.string().min(1, 'Business name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().refine((v) => isValidPhoneNumber(v), { message: 'Invalid phone number' }),
  dobMonth: z.string(),
  dobDay: z.string(),
  dobYear: z.string(),
  appLanguage: z.string().min(1, 'App language is required'),
})

export const PROFILE_DEFAULTS: ProfileValues = {
  firstName: '',
  lastName: '',
  nickname: '',
  businessName: '',
  email: '',
  phone: '',
  dobMonth: '',
  dobDay: '',
  dobYear: '',
  appLanguage: 'en',
}

export function profileFromUser(p: Record<string, unknown>): ProfileValues {
  const dob = typeof p.dateOfBirth === 'string' ? p.dateOfBirth : null
  return {
    firstName: (typeof p.firstName === 'string' ? p.firstName : '') || '',
    lastName: (typeof p.lastName === 'string' ? p.lastName : '') || '',
    nickname: (typeof p.nickname === 'string' ? p.nickname : '') || '',
    businessName: (typeof p.businessName === 'string' ? p.businessName : '') || '',
    email: (typeof p.email === 'string' ? p.email : '') || '',
    phone: (typeof p.phone === 'string' ? p.phone : '') || '',
    dobMonth: dob?.split('-')[1] ?? '',
    dobDay: dob?.split('-')[2] ?? '',
    dobYear: dob?.split('-')[0] ?? '',
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
    dateOfBirth: form.dobYear && form.dobMonth && form.dobDay
      ? `${form.dobYear}-${form.dobMonth}-${form.dobDay}`
      : undefined,
  }
}

export function ProfileTab({ onClose }: { onClose?: () => void }) {
  const user = useQuery(api.users.me)
  const createUser = useMutation(api.users.createUser)
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
    create: (payload) => createUser({ ...payload, role: 'DiveCenter' }),
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
        <div className="grid grid-cols-6 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:gap-4"> {/* design-ok */}
          <Input
            label="First name"
            value={form.firstName}
            onChange={(e) => setField('firstName', e.target.value)}
            autoComplete="given-name"
            required
            className="field-name"
          />
          <Input
            label="Last name"
            value={form.lastName}
            onChange={(e) => setField('lastName', e.target.value)}
            autoComplete="family-name"
            required
            className="field-name"
          />
        </div>

        <hr className="border-glass-border opacity-70 my-1" />

        <div className="grid grid-cols-6 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:gap-4"> {/* design-ok */}
          <Input
            label="Nickname"
            value={form.nickname}
            onChange={(e) => setField('nickname', e.target.value)}
            autoComplete="nickname"
            className="field-text-short"
          />
          <Input
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(e) => {
              const filtered = e.target.value.replace(/[^+\d\s\-()]/g, '')
              setField('phone', filtered)
            }}
            autoComplete="tel"
            maxLength={16}
            required
            className="field-phone"
          />
        </div>

        <hr className="border-glass-border opacity-70 my-1" />

        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setField('email', e.target.value)}
          required
          className="w-full"
        />

        <hr className="border-glass-border opacity-70 my-1" />

        <div className="grid grid-cols-3 gap-3"> {/* design-ok */}
          <SimpleSelect
            label="Month"
            value={form.dobMonth}
            onChange={(v) => setField('dobMonth', v)}
            options={MONTHS}
          />
          <SimpleSelect
            label="Day"
            value={form.dobDay}
            onChange={(v) => setField('dobDay', v)}
            options={DAYS}
          />
          <SimpleSelect
            label="Year"
            value={form.dobYear}
            onChange={(v) => setField('dobYear', v)}
            options={YEARS}
          />
        </div>

        <hr className="border-glass-border opacity-70 my-1" />

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
