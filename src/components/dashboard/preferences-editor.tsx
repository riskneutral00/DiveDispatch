'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassInput } from '@/components/glass/glass-input'
import { GlassButton } from '@/components/glass/glass-button'
import { PreferredInstructorList } from '@/components/dashboard/preferred-instructor-list'
import { LANGUAGE_OPTIONS } from '@/lib/constants/languages'

// ── Constants ────────────────────────────────────────────────────────

const ACCEPTANCE_MODES = [
  {
    value: 'Auto',
    label: 'Auto-accept',
    description: 'Booking confirmed automatically when all slots are filled.',
  },
  {
    value: 'PrePayRequired',
    label: 'Pre-pay required',
    description: 'Customer must complete payment before confirmation.',
  },
  {
    value: 'PostPayAllowed',
    label: 'Post-pay allowed',
    description: 'Confirmation possible before payment is received.',
  },
] as const

type AcceptanceMode = 'Auto' | 'PrePayRequired' | 'PostPayAllowed'

const ORGANIZER_ROLES_WITH_INSTRUCTOR_PREFS = new Set([
  'DiveCenter', 'Agent', 'Liveaboard', 'DiveResort', 'DiveHostel', 'DiveSite',
])

// ── Validation ───────────────────────────────────────────────────────

const prefsSchema = z.object({
  acceptanceMode: z.enum(['Auto', 'PrePayRequired', 'PostPayAllowed']),
  maxHoursPerDay: z.number().int().min(1).max(16),
  postJobBlockDuration: z.number().int().min(0).max(480),
  commonLanguageCodes: z.array(z.string()).min(1, 'Select at least one language'),
  confirmOnAccept: z.boolean(),
  confirmOnDecline: z.boolean(),
  preferredInstructorSlugs: z.array(z.string()).optional(),
})

type PrefsFormData = z.infer<typeof prefsSchema>
type FormErrors = Partial<Record<keyof PrefsFormData, string>>

const defaultFormData = (): PrefsFormData => ({
  acceptanceMode: 'Auto',
  maxHoursPerDay: 8,
  postJobBlockDuration: 30,
  commonLanguageCodes: ['en'],
  confirmOnAccept: false,
  confirmOnDecline: false,
  preferredInstructorSlugs: [],
})

// ── Sub-components ────────────────────────────────────────────────────

interface CheckboxGroupProps {
  label: string
  items: { value: string; label: string }[]
  selected: string[]
  onChange: (values: string[]) => void
  error?: string
}

function CheckboxGroup({ label, items, selected, onChange, error }: CheckboxGroupProps) {
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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

// ── Main Component ────────────────────────────────────────────────────

export function PreferencesEditor() {
  const prefs = useQuery(api.stakeholderPreferences.mine)
  const me = useQuery(api.users.me)
  const upsert = useMutation(api.stakeholderPreferences.upsert)

  const [form, setForm] = useState<PrefsFormData>(defaultFormData())
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (prefs) {
      setForm({
        acceptanceMode: prefs.acceptanceMode as AcceptanceMode,
        maxHoursPerDay: prefs.maxHoursPerDay,
        postJobBlockDuration: prefs.postJobBlockDuration,
        commonLanguageCodes: prefs.commonLanguageCodes,
        confirmOnAccept: prefs.confirmOnAccept,
        confirmOnDecline: prefs.confirmOnDecline,
        preferredInstructorSlugs: prefs.preferredInstructorSlugs ?? [],
      })
    }
  }, [prefs])

  const setField = <K extends keyof PrefsFormData>(key: K, value: PrefsFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setSaved(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    setSaved(false)

    const result = prefsSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: FormErrors = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof PrefsFormData
        if (key && !fieldErrors[key]) {
          fieldErrors[key] = issue.message
        }
      }
      setErrors(fieldErrors)
      return
    }

    setSubmitting(true)
    try {
      await upsert(result.data)
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

  if (prefs === undefined || me === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"
          style={{ color: 'var(--color-primary)' }}
        />
      </div>
    )
  }

  const showInstructorPrefs = me?.role != null && ORGANIZER_ROLES_WITH_INSTRUCTOR_PREFS.has(me.role)
  const langItems = LANGUAGE_OPTIONS.map(({ code, label }) => ({ value: code, label }))

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Preferences
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Configure how you handle bookings and availability.
        </p>
      </div>

      {/* Acceptance Mode */}
      <GlassCard padding="md" elevated>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Acceptance Mode
        </h2>
        <div className="space-y-2">
          {ACCEPTANCE_MODES.map(({ value, label, description }) => {
            const checked = form.acceptanceMode === value
            return (
              <label
                key={value}
                className="flex items-start gap-3 cursor-pointer p-3 rounded-[var(--border-radius)] transition-colors"
                style={{
                  background: checked ? 'var(--color-glass-bg-elevated)' : 'transparent',
                  border: `1px solid ${checked ? 'var(--color-primary)' : 'transparent'}`,
                }}
              >
                <input
                  type="radio"
                  name="acceptanceMode"
                  value={value}
                  checked={checked}
                  onChange={() => setField('acceptanceMode', value)}
                  className="mt-0.5"
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    {description}
                  </p>
                </div>
              </label>
            )
          })}
        </div>
      </GlassCard>

      {/* Availability limits */}
      <GlassCard padding="md" elevated>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Availability Limits
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Max hours per day"
            type="number"
            min={1}
            max={16}
            value={form.maxHoursPerDay}
            onChange={(e) => setField('maxHoursPerDay', Number(e.target.value))}
            error={errors.maxHoursPerDay}
          />
          <GlassInput
            label="Post-job block (minutes)"
            type="number"
            min={0}
            max={480}
            value={form.postJobBlockDuration}
            onChange={(e) => setField('postJobBlockDuration', Number(e.target.value))}
            error={errors.postJobBlockDuration}
          />
        </div>
      </GlassCard>

      {/* Notifications */}
      <GlassCard padding="md" elevated>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Confirmation Alerts
        </h2>
        <div className="space-y-3">
          {(
            [
              { key: 'confirmOnAccept', label: 'Notify me when a booking is accepted' },
              { key: 'confirmOnDecline', label: 'Notify me when a booking is declined' },
            ] as const
          ).map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-3 cursor-pointer select-none text-sm"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => setField(key, e.target.checked)}
                className="rounded"
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </GlassCard>

      {/* Language preferences */}
      <GlassCard padding="md" elevated>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Language Preferences
        </h2>
        <CheckboxGroup
          label="Languages you work in"
          items={langItems}
          selected={form.commonLanguageCodes}
          onChange={(values) => setField('commonLanguageCodes', values)}
          error={errors.commonLanguageCodes}
        />
      </GlassCard>

      {/* Preferred instructors (DiveCenter / Agent only) */}
      {showInstructorPrefs && (
        <GlassCard padding="md" elevated>
          <h2
            className="text-sm font-semibold uppercase tracking-wider mb-4"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Preferred Instructors
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Rank instructors in order of booking priority. The wizard will suggest them first.
          </p>
          <PreferredInstructorList
            slugs={form.preferredInstructorSlugs ?? []}
            onChange={(slugs) => setField('preferredInstructorSlugs', slugs)}
          />
        </GlassCard>
      )}

      {/* Server error */}
      {serverError && (
        <p className="text-sm text-center" style={{ color: 'var(--color-destructive)' }}>
          {serverError}
        </p>
      )}

      {/* Success */}
      {saved && (
        <p className="text-sm text-center" style={{ color: 'var(--color-success)' }}>
          Preferences saved.
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
          Save Preferences
        </GlassButton>
      </div>
    </form>
  )
}
