'use client'

import { useMutation, useQuery } from 'convex/react'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { api } from '../../../convex/_generated/api'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassInput } from '@/components/glass/glass-input'
import { LANGUAGE_OPTIONS } from '@/lib/constants/languages'
import { Spinner } from '@/components/common/spinner'

const poolSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
  contactEmail: z.string().email('Invalid email'),
  contactPhone: z.string().min(1, 'Phone is required'),
  maxDepth: z.number().positive('Must be greater than 0'),
  maxCapacity: z.number().int('Must be a whole number').positive('Must be at least 1'),
  focusedLanguages: z.array(z.string()).refine((a) => a.length > 0, 'Select at least one language'),
})

type PoolFormData = z.infer<typeof poolSchema>
type FieldErrors = Partial<Record<keyof PoolFormData, string>>

const EMPTY_FORM: PoolFormData = {
  name: '',
  city: '',
  country: '',
  contactEmail: '',
  contactPhone: '',
  maxDepth: 0,
  maxCapacity: 0,
  focusedLanguages: [],
}

export function PoolProfileForm() {
  const profile = useQuery(api.pools.mine)
  const create = useMutation(api.pools.create)
  const update = useMutation(api.pools.update)

  const [form, setForm] = useState<PoolFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name,
        city: profile.city,
        country: profile.country,
        contactEmail: profile.contactEmail,
        contactPhone: profile.contactPhone,
        maxDepth: profile.maxDepth,
        maxCapacity: profile.maxCapacity,
        focusedLanguages: profile.focusedLanguages,
      })
    }
  }, [profile])

  function setField<K extends keyof PoolFormData>(key: K, value: PoolFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setSaved(false)
  }

  function toggleLanguage(lang: string) {
    setForm((prev) => {
      const next = prev.focusedLanguages.includes(lang)
        ? prev.focusedLanguages.filter((l) => l !== lang)
        : [...prev.focusedLanguages, lang]
      return { ...prev, focusedLanguages: next }
    })
    setErrors((prev) => ({ ...prev, focusedLanguages: undefined }))
    setSaved(false)
  }

  function parseNumber(raw: string, isInt: boolean): number {
    if (raw === '') return 0
    const parsed = isInt ? parseInt(raw, 10) : parseFloat(raw)
    return isNaN(parsed) ? 0 : parsed
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    setSaved(false)

    const result = poolSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof PoolFormData
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
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
      setServerError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  if (profile === undefined) {
    return (
      <div className="flex items-center justify-center py-12" style={{ color: 'var(--color-primary)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <GlassCard padding="lg">
        <h2
          className="text-lg font-semibold mb-6"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Pool Profile
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Pool Name */}
          <div className="sm:col-span-2">
            <GlassInput
              label="Pool Name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              error={errors.name}
              placeholder="Blue Lagoon Training Pool"
              autoComplete="organization"
            />
          </div>

          {/* City */}
          <GlassInput
            label="City"
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
            error={errors.city}
            placeholder="Phuket"
          />

          {/* Country */}
          <GlassInput
            label="Country"
            value={form.country}
            onChange={(e) => setField('country', e.target.value)}
            error={errors.country}
            placeholder="Thailand"
          />

          {/* Contact Email */}
          <GlassInput
            label="Contact Email"
            type="email"
            value={form.contactEmail}
            onChange={(e) => setField('contactEmail', e.target.value)}
            error={errors.contactEmail}
            placeholder="pool@example.com"
            autoComplete="email"
          />

          {/* Contact Phone */}
          <GlassInput
            label="Contact Phone"
            type="tel"
            value={form.contactPhone}
            onChange={(e) => setField('contactPhone', e.target.value)}
            error={errors.contactPhone}
            placeholder="+66 81 234 5678"
            autoComplete="tel"
          />

          {/* Max Depth */}
          <GlassInput
            label="Max Depth (m)"
            type="number"
            min="0.1"
            step="0.1"
            value={form.maxDepth || ''}
            onChange={(e) => setField('maxDepth', parseNumber(e.target.value, false))}
            error={errors.maxDepth}
            placeholder="5"
          />

          {/* Max Capacity */}
          <GlassInput
            label="Max Capacity (divers)"
            type="number"
            min="1"
            step="1"
            value={form.maxCapacity || ''}
            onChange={(e) => setField('maxCapacity', parseNumber(e.target.value, true))}
            error={errors.maxCapacity}
            placeholder="15"
          />
        </div>

        {/* Languages */}
        <div className="mt-5">
          <p
            className="text-sm font-medium mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Languages Spoken
          </p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map(({ label }) => {
              const selected = form.focusedLanguages.includes(label)
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleLanguage(label)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-[var(--border-radius)] border transition-all"
                  style={{
                    background: selected ? 'var(--color-primary)' : 'var(--color-glass-bg)',
                    borderColor: selected ? 'var(--color-primary)' : 'var(--color-glass-border)',
                    color: selected
                      ? 'var(--color-text-on-primary)'
                      : 'var(--color-text-secondary)',
                    backdropFilter: selected ? undefined : 'blur(var(--glass-blur))',
                    transitionDuration: 'var(--transition-speed)',
                  }}
                >
                  {selected && <Check size={12} />}
                  {label}
                </button>
              )
            })}
          </div>
          {errors.focusedLanguages && (
            <p className="text-sm mt-2" style={{ color: 'var(--color-destructive)' }}>
              {errors.focusedLanguages}
            </p>
          )}
        </div>

        {/* Server error */}
        {serverError && (
          <p className="mt-4 text-sm" style={{ color: 'var(--color-destructive)' }}>
            {serverError}
          </p>
        )}

        {/* Success */}
        {saved && !submitting && (
          <p className="mt-4 text-sm" style={{ color: 'var(--color-success)' }}>
            Profile saved successfully.
          </p>
        )}

        {/* Submit */}
        <div className="mt-6">
          <GlassButton type="submit" loading={submitting} disabled={submitting}>
            {profile ? 'Save Changes' : 'Create Profile'}
          </GlassButton>
        </div>
      </GlassCard>
    </form>
  )
}
