'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { ProfileSectionTabBar } from '@/components/account/profile-section-tab-bar'
import { z } from 'zod'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { ROLE_BY_KEY, DISPLAY_OPERATOR_ROLES, type RoleKey } from '@/lib/constants/roles'
import { GlassButton } from '@/components/ui/glass-button'
import { GlassCard } from '@/components/ui/glass-card'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { ProfileFormSectionDivider } from '@/components/profiles/profile-form-section-divider'
import { parseConvexError } from '@/lib/utils/convex-error'
import {
  PreferredInstructorList,
  PreferredVenueList,
  PreferredEquipmentList,
  PreferredBoatList,
  PreferredCompressorList,
} from '@/components/profiles/preferred-list'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import { GlassSimpleSelect } from '@/components/ui/glass-simple-select'

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
type PreferencesRecord = Record<string, unknown>

const DISPLAY_OPERATOR_ROLE_KEYS = new Set(DISPLAY_OPERATOR_ROLES.map((r) => r.clerkRole))

// ── Validation ───────────────────────────────────────────────────────

const prefsSchema = z.object({
  acceptanceMode: z.enum(['Auto', 'PrePayRequired', 'PostPayAllowed']),
  commonLanguageCodes: z.array(z.string()).optional(),
  confirmOnAccept: z.boolean(),
  confirmOnDecline: z.boolean(),
  preferredInstructorSlugs: z.array(z.string()).optional(),
  preferredVenueSlugs: z.array(z.string()).optional(),
  preferredEquipmentSlugs: z.array(z.string()).optional(),
  preferredBoatSlugs: z.array(z.string()).optional(),
  preferredCompressorSlugs: z.array(z.string()).optional(),
  preferredOperatorSlug: z.string().optional(),
  autoAssignPreferred: z.boolean(),
})

type PrefsFormData = z.infer<typeof prefsSchema>

type ResourceSubTab =
  | 'readiness'
  | 'instructors'
  | 'venues'
  | 'equipment'
  | 'boats'
  | 'compressors'
  | 'operator'

const defaultFormData = (): PrefsFormData => ({
  acceptanceMode: 'Auto',
  commonLanguageCodes: ['en'],
  confirmOnAccept: false,
  confirmOnDecline: false,
  preferredInstructorSlugs: [],
  preferredVenueSlugs: [],
  preferredEquipmentSlugs: [],
  preferredBoatSlugs: [],
  preferredCompressorSlugs: [],
  preferredOperatorSlug: undefined,
  autoAssignPreferred: true,
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

function ResourceSectionTitle({
  children,
  required,
}: {
  children: ReactNode
  required?: boolean
}) {
  return (
    <h2
      className="text-sm font-semibold uppercase tracking-wider mb-4 text-secondary flex items-center gap-1"
    >
      {children}
      {required ? (
        <span style={{ color: 'var(--color-destructive)' }} aria-hidden>
          *
        </span>
      ) : null}
    </h2>
  )
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

// ── Agent: preferred target operator (DD-355) ───────────────────────────

function PreferredOperatorPicker({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (slug: string | undefined) => void
}) {
  const dc = useQuery(api.directory.listByRole, { role: 'DiveCenter' }) ?? []
  const lb = useQuery(api.directory.listByRole, { role: 'Liveaboard' }) ?? []
  const dr = useQuery(api.directory.listByRole, { role: 'DiveResort' }) ?? []
  const dh = useQuery(api.directory.listByRole, { role: 'DiveHostel' }) ?? []

  const options = useMemo(() => {
    const merged = [...dc, ...lb, ...dr, ...dh]
    return merged
      .map((e) => ({
        value: e.slug,
        label: `${e.name} (${e.role}) — ${e.placeName}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [dc, lb, dr, dh])

  return (
    <GlassCard padding="md">
      <h2
        className="text-sm font-semibold uppercase tracking-wider mb-4 text-secondary"
      >
        Preferred operator
      </h2>
      <p className="text-sm mb-4 text-secondary">
        When set, the booking wizard can pre-fill resources from this operator&apos;s preferences (referral-style cascade).
      </p>
      <GlassSimpleSelect
        label="Target operator"
        value={value ?? ''}
        onChange={(v) => onChange(v ? v : undefined)}
        options={[
          { value: '', label: 'None' },
          ...options,
        ]}
        placeholder="Select an operator…"
      />
    </GlassCard>
  )
}

// ── Main Component ────────────────────────────────────────────────────

export function PreferencesEditor() {
  const params = useParams()
  const roleSlug = params?.roleSlug as string | undefined
  const activeRole = roleSlug ? ROLE_BY_KEY[roleSlug as RoleKey]?.clerkRole : undefined
  const prefs = useQuery(api.stakeholderPreferences.mine)
  const upsert = useMutation(api.stakeholderPreferences.upsert)

  const [activeTab, setActiveTab] = useState('booking')
  const [resourceSubTab, setResourceSubTab] = useState<ResourceSubTab>('readiness')
  const [resourceSaving, setResourceSaving] = useState(false)
  const defaults = useMemo(() => defaultFormData(), [])
  const savePreferences = useCallback(
    async (payload: PrefsFormData) => {
      if (!activeRole) {
        throw new Error('Unable to determine active role for saving preferences.')
      }
      await upsert({ ...payload, activeRole })
    },
    [activeRole, upsert],
  )

  const {
    form,
    setField,
    errors,
    footerErrorMessage,
    saving,
    saved,
    isDirty,
    isValid,
    loading,
    isUpdate,
    handleSubmit,
    markBaselineCurrent,
  } = useProfileForm<PrefsFormData, PrefsFormData>({
    profile: prefs === undefined ? undefined : (prefs as PreferencesRecord | null),
    schema: prefsSchema,
    defaults,
    fromProfile: (profile) => {
      const typed = profile as Partial<PrefsFormData>
      return {
        acceptanceMode: (typed.acceptanceMode as AcceptanceMode) ?? 'Auto',
        commonLanguageCodes: typed.commonLanguageCodes ?? ['en'],
        confirmOnAccept: typed.confirmOnAccept ?? false,
        confirmOnDecline: typed.confirmOnDecline ?? false,
        preferredInstructorSlugs: typed.preferredInstructorSlugs ?? [],
        preferredVenueSlugs: typed.preferredVenueSlugs ?? [],
        preferredEquipmentSlugs: typed.preferredEquipmentSlugs ?? [],
        preferredBoatSlugs: typed.preferredBoatSlugs ?? [],
        preferredCompressorSlugs: typed.preferredCompressorSlugs ?? [],
        preferredOperatorSlug: typed.preferredOperatorSlug,
        autoAssignPreferred: typed.autoAssignPreferred ?? true,
      }
    },
    toPayload: (values) => values,
    create: savePreferences,
    update: savePreferences,
  })

  const showResourcePrefs = activeRole != null && DISPLAY_OPERATOR_ROLE_KEYS.has(activeRole)

  const resourceSubTabs = useMemo(() => {
    const base: { id: ResourceSubTab; label: string }[] = [
      { id: 'readiness', label: 'Readiness' },
      { id: 'instructors', label: 'Instructors' },
      { id: 'venues', label: 'Venues' },
      { id: 'equipment', label: 'Equipment' },
      { id: 'boats', label: 'Boats' },
      { id: 'compressors', label: 'Compressors' },
    ]
    if (activeRole === 'Agent') {
      base.push({ id: 'operator', label: 'Operator' })
    }
    return base
  }, [activeRole])

  const saveStakeholderPreferences = useCallback(async () => {
    if (!activeRole) {
      throw new Error('Unable to determine active role for saving preferences.')
    }
    await upsert({
      activeRole,
      acceptanceMode: form.acceptanceMode,
      commonLanguageCodes: form.commonLanguageCodes,
      confirmOnAccept: form.confirmOnAccept,
      confirmOnDecline: form.confirmOnDecline,
      preferredInstructorSlugs: form.preferredInstructorSlugs,
      preferredVenueSlugs: form.preferredVenueSlugs,
      preferredEquipmentSlugs: form.preferredEquipmentSlugs,
      preferredBoatSlugs: form.preferredBoatSlugs,
      preferredCompressorSlugs: form.preferredCompressorSlugs,
      preferredOperatorSlug: form.preferredOperatorSlug,
      autoAssignPreferred: form.autoAssignPreferred,
    })
  }, [activeRole, form, upsert])

  const handleSaveResourceSection = useCallback(async () => {
    setResourceSaving(true)
    try {
      await saveStakeholderPreferences()
      markBaselineCurrent()
      toast.success('Preferences saved')
    } catch (err: unknown) {
      toast.error(parseConvexError(err, 'Save failed'))
    } finally {
      setResourceSaving(false)
    }
  }, [markBaselineCurrent, saveStakeholderPreferences])

  useEffect(() => {
    if (activeRole !== 'Agent' && resourceSubTab === 'operator') {
      setResourceSubTab('readiness')
    }
  }, [activeRole, resourceSubTab])

  const tabs = useMemo(() => {
    const base = [
      { id: 'booking', label: 'Booking' },
    ]
    if (showResourcePrefs) base.push({ id: 'resources', label: 'Resources' })
    return base
  }, [showResourcePrefs])

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
      hideFooter={activeTab === 'resources'}
      className="max-w-2xl mx-auto w-full px-4 pt-4 pb-28 md:pb-10"
    >
      <ProfileSectionTabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

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

            <ProfileFormSectionDivider show />

            {showResourcePrefs && (
              <>
                <ProfileFormSectionDivider show />
                <GlassCard padding="md">
                  <h2
                    className="text-sm font-semibold uppercase tracking-wider mb-4 text-secondary"
                  >
                    Preferred resources
                  </h2>
                  <label className="flex items-center gap-3 cursor-pointer select-none text-sm text-primary">
                    <input
                      type="checkbox"
                      checked={form.autoAssignPreferred}
                      onChange={(e) => setField('autoAssignPreferred', e.target.checked)}
                      className="rounded"
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span>
                      Auto-assign preferred instructors, boats, and venues in new bookings when
                      available
                    </span>
                  </label>
                </GlassCard>
              </>
            )}

            <ProfileFormSectionDivider show />

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

        {/* ── Resources tab (organizer roles only) — horizontal sub-tabs, per-section save ── */}
        {activeTab === 'resources' && showResourcePrefs && (
          <>
            <ProfileSectionTabBar
              tabs={resourceSubTabs}
              activeTab={resourceSubTab}
              onChange={(id) => setResourceSubTab(id as ResourceSubTab)}
            />

            <div
              id={`tabpanel-${resourceSubTab}`}
              role="tabpanel"
              aria-labelledby={`tab-${resourceSubTab}`}
              className="space-y-4"
            >
              {resourceSubTab === 'readiness' && (
                <CoverageStatus
                  instructorSlugs={form.preferredInstructorSlugs ?? []}
                  venueSlugs={form.preferredVenueSlugs ?? []}
                  equipmentSlugs={form.preferredEquipmentSlugs ?? []}
                  boatSlugs={form.preferredBoatSlugs ?? []}
                  compressorSlugs={form.preferredCompressorSlugs ?? []}
                />
              )}

              {resourceSubTab === 'instructors' && (
                <GlassCard padding="md">
                  <ResourceSectionTitle required>Preferred Instructors</ResourceSectionTitle>
                  <p className="text-sm mb-4 text-secondary">
                    Rank instructors in order of booking priority. The wizard will suggest them first.
                  </p>
                  <PreferredInstructorList
                    slugs={form.preferredInstructorSlugs ?? []}
                    onChange={(slugs) => setField('preferredInstructorSlugs', slugs)}
                  />
                  <div className="flex justify-end pt-4">
                    <GlassButton
                      type="button"
                      variant="primary"
                      size="sm"
                      loading={resourceSaving}
                      onClick={() => void handleSaveResourceSection()}
                    >
                      Save this section
                    </GlassButton>
                  </div>
                </GlassCard>
              )}

              {resourceSubTab === 'venues' && (
                <GlassCard padding="md">
                  <ResourceSectionTitle required>Preferred Venues</ResourceSectionTitle>
                  <p className="text-sm mb-4 text-secondary">
                    Pools and dive sites, ranked by preference. At least one venue or boat is required.
                  </p>
                  <PreferredVenueList
                    slugs={form.preferredVenueSlugs ?? []}
                    onChange={(slugs) => setField('preferredVenueSlugs', slugs)}
                  />
                  <div className="flex justify-end pt-4">
                    <GlassButton
                      type="button"
                      variant="primary"
                      size="sm"
                      loading={resourceSaving}
                      onClick={() => void handleSaveResourceSection()}
                    >
                      Save this section
                    </GlassButton>
                  </div>
                </GlassCard>
              )}

              {resourceSubTab === 'equipment' && (
                <GlassCard padding="md">
                  <ResourceSectionTitle required>Preferred Equipment Providers</ResourceSectionTitle>
                  <p className="text-sm mb-4 text-secondary">
                    At least one equipment provider is required before creating bookings.
                  </p>
                  <PreferredEquipmentList
                    slugs={form.preferredEquipmentSlugs ?? []}
                    onChange={(slugs) => setField('preferredEquipmentSlugs', slugs)}
                  />
                  <div className="flex justify-end pt-4">
                    <GlassButton
                      type="button"
                      variant="primary"
                      size="sm"
                      loading={resourceSaving}
                      onClick={() => void handleSaveResourceSection()}
                    >
                      Save this section
                    </GlassButton>
                  </div>
                </GlassCard>
              )}

              {resourceSubTab === 'boats' && (
                <GlassCard padding="md">
                  <ResourceSectionTitle required>Preferred Boats</ResourceSectionTitle>
                  <p className="text-sm mb-4 text-secondary">
                    A boat satisfies the venue requirement. Captain picks the dive site.
                  </p>
                  <PreferredBoatList
                    slugs={form.preferredBoatSlugs ?? []}
                    onChange={(slugs) => setField('preferredBoatSlugs', slugs)}
                  />
                  <div className="flex justify-end pt-4">
                    <GlassButton
                      type="button"
                      variant="primary"
                      size="sm"
                      loading={resourceSaving}
                      onClick={() => void handleSaveResourceSection()}
                    >
                      Save this section
                    </GlassButton>
                  </div>
                </GlassCard>
              )}

              {resourceSubTab === 'compressors' && (
                <GlassCard padding="md">
                  <ResourceSectionTitle required>Preferred Compressors</ResourceSectionTitle>
                  <p className="text-sm mb-4 text-secondary">
                    Not required if a preferred boat or venue has a compressor.
                  </p>
                  <PreferredCompressorList
                    slugs={form.preferredCompressorSlugs ?? []}
                    onChange={(slugs) => setField('preferredCompressorSlugs', slugs)}
                  />
                  <div className="flex justify-end pt-4">
                    <GlassButton
                      type="button"
                      variant="primary"
                      size="sm"
                      loading={resourceSaving}
                      onClick={() => void handleSaveResourceSection()}
                    >
                      Save this section
                    </GlassButton>
                  </div>
                </GlassCard>
              )}

              {resourceSubTab === 'operator' && activeRole === 'Agent' && (
                <>
                  <PreferredOperatorPicker
                    value={form.preferredOperatorSlug}
                    onChange={(slug) => setField('preferredOperatorSlug', slug)}
                  />
                  <div className="flex justify-end">
                    <GlassButton
                      type="button"
                      variant="primary"
                      size="sm"
                      loading={resourceSaving}
                      onClick={() => void handleSaveResourceSection()}
                    >
                      Save this section
                    </GlassButton>
                  </div>
                </>
              )}
            </div>
          </>
        )}

      </div>
    </ProfileFormShell>
  )
}
