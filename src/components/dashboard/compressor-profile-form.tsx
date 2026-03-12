'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassInput } from '@/components/glass/glass-input'
import { GlassButton } from '@/components/glass/glass-button'

// ── Constants ────────────────────────────────────────────────────────

const GAS_MIXES = [
  { value: 'air', label: 'Air' },
  { value: 'nitrox', label: 'Nitrox' },
  { value: 'trimix', label: 'Trimix' },
] as const

type GasMix = 'air' | 'nitrox' | 'trimix'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'th', label: 'Thai' },
  { code: 'zh', label: 'Chinese (Mandarin)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ru', label: 'Russian' },
  { code: 'it', label: 'Italian' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'ar', label: 'Arabic' },
  { code: 'he', label: 'Hebrew' },
  { code: 'sv', label: 'Swedish' },
]

// ── Zod Schema ────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
  contactEmail: z.string().email('Invalid email address'),
  contactPhone: z.string().min(1, 'Phone number is required'),
  gasMixes: z.array(z.enum(['air', 'nitrox', 'trimix'])).min(1, 'Select at least one gas mix'),
  focusedLanguages: z.array(z.string()).min(1, 'Select at least one language'),
})

type ProfileFormData = z.infer<typeof profileSchema>
type FormErrors = Partial<Record<keyof ProfileFormData, string>>

const defaultFormData = (): ProfileFormData => ({
  name: '',
  city: '',
  country: '',
  contactEmail: '',
  contactPhone: '',
  gasMixes: [],
  focusedLanguages: [],
})

// ── Sub-components ────────────────────────────────────────────────────

interface CheckboxGroupProps {
  label: string
  items: { value: string; label: string }[]
  selected: string[]
  onChange: (values: string[]) => void
  error?: string
  columns?: 2 | 3
}

function CheckboxGroup({ label, items, selected, onChange, error, columns = 2 }: CheckboxGroupProps) {
  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    )
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <div className={`grid gap-2 ${columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
        {items.map(({ value, label: itemLabel }) => {
          const checked = selected.includes(value)
          return (
            <label
              key={value}
              className="flex items-center gap-2 cursor-pointer select-none text-sm"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(value)}
                className="rounded"
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <span>{itemLabel}</span>
            </label>
          )
        })}
      </div>
      {error && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

// ── Main Form ─────────────────────────────────────────────────────────

export function CompressorProfileForm() {
  const profile = useQuery(api.compressors.mine)
  const create = useMutation(api.compressors.create)
  const update = useMutation(api.compressors.update)

  const [form, setForm] = useState<ProfileFormData>(defaultFormData())
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)

  // Populate form once profile loads
  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name,
        city: profile.city,
        country: profile.country,
        contactEmail: profile.contactEmail,
        contactPhone: profile.contactPhone,
        gasMixes: (profile.gasMixes ?? []) as GasMix[],
        focusedLanguages: profile.focusedLanguages,
      })
    }
  }, [profile])

  // ── Field helpers ──────────────────────────────────────────────────

  const setField = <K extends keyof ProfileFormData>(key: K, value: ProfileFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setSaved(false)
  }

  // ── Submit ─────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    setSaved(false)

    const result = profileSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: FormErrors = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof ProfileFormData
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setSubmitting(true)
    try {
      if (profile) {
        await update(result.data)
      } else {
        await create(result.data)
      }
      setSaved(true)
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { code?: string; reason?: string }
        setServerError(data.reason ?? data.code ?? 'An error occurred')
      } else {
        setServerError('An unexpected error occurred')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading state ──────────────────────────────────────────────────

  if (profile === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"
          style={{ color: 'var(--color-primary)' }}
        />
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────

  const langItems = LANGUAGES.map(({ code, label }) => ({ value: code, label }))

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          {profile ? 'Update Profile' : 'Complete Your Profile'}
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {profile
            ? 'Keep your profile current so dive centers can find you.'
            : 'Set up your compressor profile to start receiving booking requests.'}
        </p>
      </div>

      {/* Basic info */}
      <GlassCard padding="md" elevated>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Contact Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Business Name"
            placeholder="e.g. Phuket Gas Services"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            error={errors.name}
            className="sm:col-span-2"
          />
          <GlassInput
            label="City"
            placeholder="e.g. Phuket"
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
            error={errors.city}
          />
          <GlassInput
            label="Country"
            placeholder="e.g. Thailand"
            value={form.country}
            onChange={(e) => setField('country', e.target.value)}
            error={errors.country}
          />
          <GlassInput
            label="Contact Email"
            type="email"
            placeholder="you@example.com"
            value={form.contactEmail}
            onChange={(e) => setField('contactEmail', e.target.value)}
            error={errors.contactEmail}
          />
          <GlassInput
            label="Contact Phone"
            type="tel"
            placeholder="+66 81 234 5678"
            value={form.contactPhone}
            onChange={(e) => setField('contactPhone', e.target.value)}
            error={errors.contactPhone}
          />
        </div>
      </GlassCard>

      {/* Gas mixes */}
      <GlassCard padding="md" elevated>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Gas Mixes Available
        </h2>
        <CheckboxGroup
          label="Select the gas mixes you supply"
          items={GAS_MIXES.map(({ value, label }) => ({ value, label }))}
          selected={form.gasMixes}
          onChange={(values) => setField('gasMixes', values as GasMix[])}
          error={errors.gasMixes}
          columns={2}
        />
      </GlassCard>

      {/* Languages */}
      <GlassCard padding="md" elevated>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Languages
        </h2>
        <CheckboxGroup
          label="Languages you operate in"
          items={langItems}
          selected={form.focusedLanguages}
          onChange={(values) => setField('focusedLanguages', values)}
          error={errors.focusedLanguages}
          columns={3}
        />
      </GlassCard>

      {/* Server error */}
      {serverError && (
        <p className="text-sm text-center" style={{ color: 'var(--color-destructive)' }}>
          {serverError}
        </p>
      )}

      {/* Success */}
      {saved && (
        <p className="text-sm text-center" style={{ color: 'var(--color-success)' }}>
          Profile saved successfully.
        </p>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <GlassButton
          type="submit"
          variant="primary"
          size="md"
          loading={submitting}
          disabled={submitting}
        >
          {profile ? 'Save Changes' : 'Create Profile'}
        </GlassButton>
      </div>
    </form>
  )
}
