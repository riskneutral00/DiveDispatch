'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { z } from 'zod'
import { isValidPhoneNumber } from 'libphonenumber-js'
import { api } from '../../../convex/_generated/api'
import { toast } from 'sonner'
import { parseConvexError } from '@/lib/utils/convex-error'
import { GlassInput } from '@/components/glass/glass-input'
import { GlassSimpleSelect } from '@/components/glass/glass-simple-select'
import { SaveButton } from '@/components/common/save-button'
import { SAVE_FEEDBACK_MS } from '@/lib/constants/ui-timings'

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

interface ProfileValues {
  firstName: string
  lastName: string
  nickname: string
  businessName: string
  email: string
  phone: string
  dobMonth: string
  dobDay: string
  dobYear: string
}

export function ProfileTab() {
  const user = useQuery(api.users.me)
  const createUser = useMutation(api.users.createUser)

  const [values, setValues] = useState<ProfileValues>({
    firstName: '',
    lastName: '',
    nickname: '',
    businessName: '',
    email: '',
    phone: '',
    dobMonth: '',
    dobDay: '',
    dobYear: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const baselineRef = useRef<ProfileValues | null>(null)

  useEffect(() => {
    if (user) {
      const loaded: ProfileValues = {
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        nickname: user.nickname ?? '',
        businessName: user.businessName ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
        dobMonth: user.dateOfBirth?.split('-')[1] ?? '',
        dobDay: user.dateOfBirth?.split('-')[2] ?? '',
        dobYear: user.dateOfBirth?.split('-')[0] ?? '',
      }
      setValues(loaded)
      baselineRef.current = loaded
    }
  }, [user])

  const isDirty = baselineRef.current !== null && JSON.stringify(values) !== JSON.stringify(baselineRef.current)

  const isValidEmail = z.string().email().safeParse(values.email).success
  const isValidPhone = isValidPhoneNumber(values.phone)
  const isValid = values.firstName.trim() !== '' && values.lastName.trim() !== '' && values.businessName.trim() !== '' && isValidEmail && isValidPhone

  function set<K extends keyof ProfileValues>(field: K, value: ProfileValues[K]) {
    setValues((v) => ({ ...v, [field]: value }))
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.businessName.trim() || !values.email.trim() || !values.phone.trim()) return
    setError('')
    setSaved(false)
    setSaving(true)
    try {
      await createUser({
        role: 'DiveCenter',
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        nickname: values.nickname.trim() || undefined,
        businessName: values.businessName.trim(),
        phone: values.phone.trim() || undefined,
        email: values.email.trim(),
        appLanguage: user?.appLanguage ?? 'en',
        dateOfBirth: values.dobYear && values.dobMonth && values.dobDay
          ? `${values.dobYear}-${values.dobMonth}-${values.dobDay}`
          : undefined,
      })
      baselineRef.current = { ...values }
      setSaved(true)
      setTimeout(() => setSaved(false), SAVE_FEEDBACK_MS)
      toast.success('Profile saved', { duration: 3000 })
    } catch (err) {
      const message = parseConvexError(err, 'Something went wrong.')
      setError(message)
      toast.error('Save failed', { description: message, duration: 5000 })
    } finally {
      setSaving(false)
    }
  }

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm animate-pulse" style={{ color: 'var(--color-text-secondary)' }}>
          Loading…
        </span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GlassInput
            label="First name"
            value={values.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            autoComplete="given-name"
            required
          />
          <GlassInput
            label="Last name"
            value={values.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            autoComplete="family-name"
            required
          />
          <GlassInput
            label="Nickname"
            value={values.nickname}
            onChange={(e) => set('nickname', e.target.value)}
            autoComplete="nickname"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Phone"
            type="tel"
            value={values.phone}
            onChange={(e) => {
              const filtered = e.target.value.replace(/[^+\d\s\-()]/g, '')
              set('phone', filtered)
            }}
            autoComplete="tel"
            maxLength={16}
            required
          />
          <GlassInput
            label="Email"
            type="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            required
          />
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Date of birth</p>
        <div className="grid grid-cols-3 gap-4">
          <GlassSimpleSelect
            label="Month"
            value={values.dobMonth}
            onChange={(v) => set('dobMonth', v)}
            options={MONTHS}
            placeholder="Month"
          />
          <GlassSimpleSelect
            label="Day"
            value={values.dobDay}
            onChange={(v) => set('dobDay', v)}
            options={DAYS}
            placeholder="Day"
          />
          <GlassSimpleSelect
            label="Year"
            value={values.dobYear}
            onChange={(v) => set('dobYear', v)}
            options={YEARS}
            placeholder="Year"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{error}</p>
      )}

      <SaveButton saving={saving} saved={saved} isDirty={isDirty} isUpdate={true} disabled={!isValid} label="Save" />
    </form>
  )
}
