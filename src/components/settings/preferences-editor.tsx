'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { SettingsTabBar } from '@/components/settings/settings-tab-bar'
import { z } from 'zod'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { parseConvexError } from '@/lib/utils/convex-error'
import { UNEXPECTED_ERROR_MESSAGE } from '@/lib/constants/error-messages'
import { api } from '../../../convex/_generated/api'
import { ROLE_BY_KEY, DISPLAY_OPERATOR_ROLES, type RoleKey } from '@/lib/constants/roles'
import { MAX_SESSION_MINUTES } from '@/lib/constants/form-config'
import { GlassCard } from '@/components/ui/glass-card'
import { GlassInput } from '@/components/ui/glass-input'
import { GlassButton } from '@/components/ui/glass-button'
import { GlassCheckboxGroup } from '@/components/ui/glass-checkbox-group'
import {
  PreferredInstructorList,
  PreferredVenueList,
  PreferredEquipmentList,
  PreferredBoatList,
  PreferredCompressorList,
} from '@/components/profiles/preferred-list'
import { PROFILE_LANGUAGE_OPTIONS as LANGUAGE_OPTIONS } from '@/lib/constants/dive-languages'
import { Spinner } from '@/components/ui/spinner'

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

const DISPLAY_OPERATOR_ROLE_KEYS = new Set(DISPLAY_OPERATOR_ROLES.map((r) => r.clerkRole))

// ── Validation ───────────────────────────────────────────────────────

const prefsSchema = z.object({
  acceptanceMode: z.enum(['Auto', 'PrePayRequired', 'PostPayAllowed']),
  maxHoursPerDay: z.number().int().min(1).max(16),
  postJobBlockDuration: z.number().int().min(0).max(480),
  commonLanguageCodes: z.array(z.string()).optional(),
  confirmOnAccept: z.boolean(),
  confirmOnDecline: z.boolean(),
  preferredInstructorSlugs: z.array(z.string()).optional(),
  preferredVenueSlugs: z.array(z.string()).optional(),
  preferredEquipmentSlugs: z.array(z.string()).optional(),
  preferredBoatSlugs: z.array(z.string()).optional(),
  preferredCompressorSlugs: z.array(z.string()).optional(),
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
  preferredVenueSlugs: [],
  preferredEquipmentSlugs: [],
  preferredBoatSlugs: [],
  preferredCompressorSlugs: [],
})

// ── Sub-components ────────────────────────────────────────────────────


// ── Coverage Status ──────────────────────────────────────────────────

interface CoverageStatusProps {
  instructorSlugs: string[]
  venueSlugs: string[]
  equipmentSlugs: string[]
  boatSlugs: string[]
  compressorSlugs: string[]
}

function CoverageStatus({
  instructorSlugs,
  venueSlugs,
  equipmentSlugs,
  boatSlugs,
  compressorSlugs,
}: CoverageStatusProps) {
  // Simplified client-side check: "has at least one" for each resource type.
  // The detailed capability check (confinedCapable, venueType, hasCompressor)
  // happens server-side at booking time via createDraftShell.
  // A boat satisfies venue needs; a boat or venue with compressor satisfies compressor needs.
  const hasBoat = boatSlugs.length > 0
  const checks = [
    { label: 'Instructor', met: instructorSlugs.length > 0 },
    { label: 'Equipment Provider', met: equipmentSlugs.length > 0 },
    { label: 'Venue or Boat', met: venueSlugs.length > 0 || hasBoat },
    { label: 'Compressor', met: compressorSlugs.length > 0 || hasBoat },
  ]
  const allMet = checks.every((c) => c.met)

  return (
    <GlassCard padding="md">
      <h2
        className="text-sm font-semibold uppercase tracking-wider mb-4 text-secondary"
      >
        Booking Readiness
      </h2>
      <p className="text-sm mb-4 text-secondary">
        These resources must be configured before you can create bookings.
        Detailed capability checks happen when you submit a booking.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {checks.map(({ label, met }) => (
          <div
            key={label}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-[var(--border-radius)]"
            style={{ background: 'var(--color-glass-bg-elevated)' }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: met ? 'var(--color-success)' : 'var(--color-destructive)' }}
            />
            <span style={{ color: met ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>
      {allMet && (
        <p className="text-sm mt-3 font-medium" style={{ color: 'var(--color-success)' }}>
          All coverage requirements met. You can create bookings.
        </p>
      )}
    </GlassCard>
  )
}

// ── Main Component ────────────────────────────────────────────────────

export function PreferencesEditor() {
  const params = useParams()
  const roleSlug = params?.roleSlug as string | undefined
  const activeRole = roleSlug ? ROLE_BY_KEY[roleSlug as RoleKey]?.clerkRole : undefined
  const prefs = useQuery(api.stakeholderPreferences.mine)
  const me = useQuery(api.users.me)
  const upsert = useMutation(api.stakeholderPreferences.upsert)

  const [form, setForm] = useState<PrefsFormData>(defaultFormData())
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState('booking')
  const baselineRef = useRef<PrefsFormData | null>(null)

  useEffect(() => {
    if (prefs) {
      const loaded: PrefsFormData = {
        acceptanceMode: prefs.acceptanceMode as AcceptanceMode,
        maxHoursPerDay: prefs.maxHoursPerDay,
        postJobBlockDuration: prefs.postJobBlockDuration,
        commonLanguageCodes: prefs.commonLanguageCodes,
        confirmOnAccept: prefs.confirmOnAccept,
        confirmOnDecline: prefs.confirmOnDecline,
        preferredInstructorSlugs: prefs.preferredInstructorSlugs ?? [],
        preferredVenueSlugs: prefs.preferredVenueSlugs ?? [],
        preferredEquipmentSlugs: prefs.preferredEquipmentSlugs ?? [],
        preferredBoatSlugs: prefs.preferredBoatSlugs ?? [],
        preferredCompressorSlugs: prefs.preferredCompressorSlugs ?? [],
      }
      setForm(loaded)
      baselineRef.current = loaded
    }
  }, [prefs])

  const isDirty = baselineRef.current !== null && JSON.stringify(form) !== JSON.stringify(baselineRef.current)

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
      await upsert({ ...result.data, activeRole: activeRole! })
      baselineRef.current = { ...form }
      setSaved(true)
      toast.success('Preferences saved', { duration: 3000 })
    } catch (err) {
      const message = parseConvexError(err, UNEXPECTED_ERROR_MESSAGE)
      setServerError(message)
      toast.error('Save failed', { description: message, duration: 5000 })
    } finally {
      setSubmitting(false)
    }
  }

  if (prefs === undefined || me === undefined) {
    return (
      <div className="flex items-center justify-center py-16" style={{ color: 'var(--color-primary)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  const showResourcePrefs = activeRole != null && DISPLAY_OPERATOR_ROLE_KEYS.has(activeRole)
  const langItems = LANGUAGE_OPTIONS.map(({ code, label }) => ({ value: code, label }))

  const tabs = useMemo(() => {
    const base = [
      { id: 'booking', label: 'Booking' },
      { id: 'availability', label: 'Availability' },
    ]
    if (showResourcePrefs) base.push({ id: 'resources', label: 'Resources' })
    return base
  }, [showResourcePrefs])

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-10">
      <div className="mb-6">
        <h1
          className="text-2xl font-bold mb-1 text-primary"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Settings
        </h1>
        <p className="text-sm text-secondary">
          Booking behaviour and availability preferences
        </p>
      </div>

      <SettingsTabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div id={`tabpanel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} className="space-y-6">

        {/* ── Booking tab ─────────────────────────────────────────── */}
        {activeTab === 'booking' && (
          <>
            <GlassCard padding="md">
              <h2
                className="text-sm font-semibold uppercase tracking-wider mb-4 text-secondary"
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
                        <p className="text-sm font-medium text-primary">
                          {label}
                        </p>
                        <p className="text-xs mt-0.5 text-secondary">
                          {description}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </GlassCard>

            <hr className="form-divider" />

            <GlassCard padding="md">
              <h2
                className="text-sm font-semibold uppercase tracking-wider mb-4 text-secondary"
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
                    className="flex items-center gap-3 cursor-pointer select-none text-sm text-primary"
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
          </>
        )}

        {/* ── Availability tab ─────────────────────────────────────── */}
        {activeTab === 'availability' && (
          <>
            <GlassCard padding="md">
              <h2
                className="text-sm font-semibold uppercase tracking-wider mb-4 text-secondary"
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
                  max={MAX_SESSION_MINUTES}
                  value={form.postJobBlockDuration}
                  onChange={(e) => setField('postJobBlockDuration', Number(e.target.value))}
                  error={errors.postJobBlockDuration}
                />
              </div>
            </GlassCard>

            <hr className="form-divider" />

          </>
        )}

        {/* ── Resources tab (organizer roles only) ─────────────────── */}
        {activeTab === 'resources' && showResourcePrefs && (
          <>
            <CoverageStatus
              instructorSlugs={form.preferredInstructorSlugs ?? []}
              venueSlugs={form.preferredVenueSlugs ?? []}
              equipmentSlugs={form.preferredEquipmentSlugs ?? []}
              boatSlugs={form.preferredBoatSlugs ?? []}
              compressorSlugs={form.preferredCompressorSlugs ?? []}
            />

            <hr className="form-divider" />

            <GlassCard padding="md">
              <h2
                className="text-sm font-semibold uppercase tracking-wider mb-4 text-secondary"
              >
                Preferred Instructors
              </h2>
              <p className="text-sm mb-4 text-secondary">
                Rank instructors in order of booking priority. The wizard will suggest them first.
              </p>
              <PreferredInstructorList
                slugs={form.preferredInstructorSlugs ?? []}
                onChange={(slugs) => setField('preferredInstructorSlugs', slugs)}
              />
            </GlassCard>

            <hr className="form-divider" />

            <GlassCard padding="md">
              <h2
                className="text-sm font-semibold uppercase tracking-wider mb-4 text-secondary"
              >
                Preferred Venues
              </h2>
              <p className="text-sm mb-4 text-secondary">
                Pools and dive sites, ranked by preference. Need at least one confined water and one open water venue (or a boat).
              </p>
              <PreferredVenueList
                slugs={form.preferredVenueSlugs ?? []}
                onChange={(slugs) => setField('preferredVenueSlugs', slugs)}
              />
            </GlassCard>

            <hr className="form-divider" />

            <GlassCard padding="md">
              <h2
                className="text-sm font-semibold uppercase tracking-wider mb-4 text-secondary"
              >
                Preferred Equipment Providers
              </h2>
              <p className="text-sm mb-4 text-secondary">
                At least one equipment provider is required before creating bookings.
              </p>
              <PreferredEquipmentList
                slugs={form.preferredEquipmentSlugs ?? []}
                onChange={(slugs) => setField('preferredEquipmentSlugs', slugs)}
              />
            </GlassCard>

            <hr className="form-divider" />

            <GlassCard padding="md">
              <h2
                className="text-sm font-semibold uppercase tracking-wider mb-4 text-secondary"
              >
                Preferred Boats
              </h2>
              <p className="text-sm mb-4 text-secondary">
                A boat satisfies both confined and open water venue requirements.
              </p>
              <PreferredBoatList
                slugs={form.preferredBoatSlugs ?? []}
                onChange={(slugs) => setField('preferredBoatSlugs', slugs)}
              />
            </GlassCard>

            <hr className="form-divider" />

            <GlassCard padding="md">
              <h2
                className="text-sm font-semibold uppercase tracking-wider mb-4 text-secondary"
              >
                Preferred Compressors
              </h2>
              <p className="text-sm mb-4 text-secondary">
                Not required if a preferred boat or venue has a compressor.
              </p>
              <PreferredCompressorList
                slugs={form.preferredCompressorSlugs ?? []}
                onChange={(slugs) => setField('preferredCompressorSlugs', slugs)}
              />
            </GlassCard>
          </>
        )}

      </div>

      {serverError && (
        <p className="text-sm text-center mt-4" style={{ color: 'var(--color-destructive)' }}>
          {serverError}
        </p>
      )}
      {saved && (
        <p className="text-sm text-center mt-4" style={{ color: 'var(--color-success)' }}>
          Preferences saved.
        </p>
      )}

      <div className="flex justify-end mt-6">
        <GlassButton
          type="submit"
          variant="primary"
          size="md"
          loading={submitting}
          disabled={!isDirty || submitting}
        >
          Save
        </GlassButton>
      </div>
    </form>
  )
}
