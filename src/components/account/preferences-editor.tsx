'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ProfileSectionTabBar } from '@/components/account/profile-section-tab-bar'
import { z } from 'zod'
import { SAVE_FEEDBACK_MS } from '@/lib/constants/ui-timings'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { ROLE_BY_KEY, DISPLAY_OPERATOR_ROLES, type RoleKey } from '@/lib/constants/roles'
import { Button } from '@/components/ui/button'
import { BottomActionBar } from '@/components/ui/bottom-action-bar'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { Card } from '@/components/ui/card'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { ProfileFormSectionDivider } from '@/components/profiles/profile-form-section-divider'
import {
  PreferredInstructorList,
  PreferredVenueBoatList,
  PreferredEquipmentList,
  PreferredCompressorList,
} from '@/components/profiles/preferred-list'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Check, Save } from 'lucide-react'

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

export type ResourceSubTab =
  | 'instructors'
  | 'venues-boats'
  | 'equipment'
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

export function buildResourceSubTabs(clerkRole: string | undefined): { id: ResourceSubTab; label: string }[] {
  const base: { id: ResourceSubTab; label: string }[] = [
    { id: 'instructors', label: 'Instructors' },
    { id: 'venues-boats', label: 'Venues & Boats' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'compressors', label: 'Compressors' },
  ]
  if (clerkRole === 'Agent') {
    base.push({ id: 'operator', label: 'Operator' })
  }
  return base
}

const SECTION_FIELDS: Record<ResourceSubTab, keyof PrefsFormData | (keyof PrefsFormData)[]> = {
  instructors: 'preferredInstructorSlugs',
  'venues-boats': ['preferredVenueSlugs', 'preferredBoatSlugs'],
  equipment: 'preferredEquipmentSlugs',
  compressors: 'preferredCompressorSlugs',
  operator: 'preferredOperatorSlug',
}

function ResourceSaveButton({
  isDirty,
  saving,
  saved,
  onSave,
}: {
  isDirty: boolean
  saving: boolean
  saved: boolean
  onSave: () => void
}) {
  const t = useTranslations('common')
  return (
    <Button
      type="button"
      variant="primary"
      size="sm"
      loading={saving}
      disabled={!isDirty || saving}
      onClick={onSave}
      style={saved ? { background: 'var(--color-active-fg)', borderColor: 'var(--color-active-fg)' } : undefined}
    >
      {saved ? (
        <>
          <Check size={16} />
          {t('saved')}
        </>
      ) : (
        <>
          <Save size={16} />
          {t('save')}
        </>
      )}
    </Button>
  )
}

function PreferredOperatorPicker({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (slug: string | undefined) => void
}) {
  const t = useTranslations('booking')
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
    <Card padding="sm">
      <FormSectionHeader className="mb-4" label={t('preferredOperator')} />
      <p className="text-body mb-4 text-secondary">
        {t('preferredOperatorDesc')}
      </p>
      <SimpleSelect
        label={t('targetOperator')}
        value={value ?? ''}
        onChange={(v) => onChange(v ? v : undefined)}
        options={[
          { value: '', label: 'None' },
          ...options,
        ]}
        placeholder="Select an operator…"
      />
    </Card>
  )
}

interface PreferencesEditorProps {
  section?: 'booking' | 'resources'
  roleSlug?: string
}

export function PreferencesEditor({ section = 'booking', roleSlug: roleSlugProp }: PreferencesEditorProps) {
  const tCommon = useTranslations('common')
  const tBooking = useTranslations('booking')
  const params = useParams()
  const roleSlug = roleSlugProp ?? (params?.roleSlug as string | undefined)
  const activeRole = roleSlug ? ROLE_BY_KEY[roleSlug as RoleKey]?.clerkRole : undefined
  const prefs = useQuery(api.stakeholderPreferences.mine)
  const upsert = useMutation(api.stakeholderPreferences.upsert)

  const [resourceSubTab, setResourceSubTab] = useState<ResourceSubTab>('instructors')
  const [resourceSaving, setResourceSaving] = useState(false)
  const [savedSection, setSavedSection] = useState<ResourceSubTab | null>(null)
  const resourceBaselineRef = useRef<PrefsFormData | null>(null)
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

  const resourceSubTabs = useMemo(() => buildResourceSubTabs(activeRole), [activeRole])

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

  const handleSaveResourceSection = useCallback(async (section: ResourceSubTab) => {
    setResourceSaving(true)
    try {
      await saveStakeholderPreferences()
      markBaselineCurrent()
      resourceBaselineRef.current = { ...form }
      setSavedSection(section)
      toast.success(tBooking('preferencesSaved'))
    } catch {
      toast.error(tCommon('actionFailed', { action: tCommon('save') }))
    } finally {
      setResourceSaving(false)
    }
  }, [form, markBaselineCurrent, saveStakeholderPreferences])

  useEffect(() => {
    if (activeRole !== 'Agent' && resourceSubTab === 'operator') {
      setResourceSubTab('instructors')
    }
  }, [activeRole, resourceSubTab])

  useEffect(() => {
    if (!loading && resourceBaselineRef.current === null) {
      resourceBaselineRef.current = { ...form }
    }
  }, [loading, form])

  useEffect(() => {
    if (savedSection) {
      const timer = setTimeout(() => setSavedSection(null), SAVE_FEEDBACK_MS)
      return () => clearTimeout(timer)
    }
  }, [savedSection])

  const isSectionDirty = useCallback((section: ResourceSubTab): boolean => {
    if (!resourceBaselineRef.current) return false
    const field = SECTION_FIELDS[section]
    if (Array.isArray(field)) {
      return field.some((f) => JSON.stringify(form[f]) !== JSON.stringify(resourceBaselineRef.current![f]))
    }
    return JSON.stringify(form[field]) !== JSON.stringify(resourceBaselineRef.current[field])
  }, [form])

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
      hideFooter={section === 'resources'}
      className="max-w-2xl mx-auto w-full px-4 pb-28 md:pb-10"
    >
      <div id={`tabpanel-${section}`} role="tabpanel" aria-labelledby={`tab-${section}`} className="space-y-6">

        {section === 'booking' && (
          <>
            <Card padding="sm">
              <FormSectionHeader className="mb-4" label={tBooking('acceptanceMode')} />
              <div className="space-y-2">
                {ACCEPTANCE_MODES.map(({ value, label, description }) => {
                  const checked = form.acceptanceMode === value
                  return (
                    <label
                      key={value}
                      className="flex items-start gap-3 cursor-pointer p-3 rounded-theme transition-colors duration-theme"
                      style={{
                        background: checked ? 'var(--color-glass-bg-elevated)' : 'transparent',
                        border: `1px solid ${checked ? 'var(--color-primary)' : 'transparent'}`,
                      }}
                    >
                      {/* design-ok */}<input
                        type="radio"
                        name="acceptanceMode"
                        value={value}
                        checked={checked}
                        onChange={() => setField('acceptanceMode', value)}
                        className="mt-0.5"
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      <div>
                        <p className="text-body font-medium text-primary">
                          {label}
                        </p>
                        <p className="text-label mt-0.5 text-secondary">
                          {description}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </Card>

            <ProfileFormSectionDivider show />

            {showResourcePrefs && (
              <>
                <ProfileFormSectionDivider show />
                <Card padding="sm">
                  <FormSectionHeader className="mb-4" label={tBooking('preferredResources')} />
                  <label className="flex items-center gap-3 cursor-pointer select-none text-body text-primary">
                    {/* design-ok */}<input
                      type="checkbox"
                      checked={form.autoAssignPreferred}
                      onChange={(e) => setField('autoAssignPreferred', e.target.checked)}
                      className="rounded-[var(--border-radius-button)]"
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span>
                      {tBooking('autoAssignPreferred')}
                    </span>
                  </label>
                </Card>
              </>
            )}

            <ProfileFormSectionDivider show />

            <Card padding="sm">
              <FormSectionHeader className="mb-4" label={tBooking('confirmationAlerts')} />
              <div className="space-y-3">
                {(
                  [
                    { key: 'confirmOnAccept', label: tBooking('notifyOnAccept') },
                    { key: 'confirmOnDecline', label: tBooking('notifyOnDecline') },
                  ] as const
                ).map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 cursor-pointer select-none text-body text-primary"
                  >
                    {/* design-ok */}<input
                      type="checkbox"
                      checked={form[key]}
                      onChange={(e) => setField(key, e.target.checked)}
                      className="rounded-[var(--border-radius-button)]"
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </Card>
          </>
        )}

        {section === 'resources' && showResourcePrefs && (
          <>
            <div className="max-w-xl mx-auto">
              <div className="flex sm:hidden mb-4">
                <SimpleSelect
                  aria-label="Resource section"
                  value={resourceSubTab}
                  onChange={(v) => setResourceSubTab(v as ResourceSubTab)}
                  options={resourceSubTabs.map((tab) => ({ value: tab.id, label: tab.label }))}
                  className="w-full"
                />
              </div>
              <div className="hidden sm:block">
                <ProfileSectionTabBar
                  tabs={resourceSubTabs}
                  activeTab={resourceSubTab}
                  onChange={(id) => setResourceSubTab(id as ResourceSubTab)}
                />
              </div>
            </div>

            <div
              id={`tabpanel-${resourceSubTab}`}
              role="tabpanel"
              aria-labelledby={`tab-${resourceSubTab}`}
              className="space-y-4"
            >
              {resourceSubTab === 'instructors' && (
                <Card padding="sm">
                  <PreferredInstructorList
                    slugs={form.preferredInstructorSlugs ?? []}
                    onChange={(slugs) => setField('preferredInstructorSlugs', slugs)}
                    required
                  />
                  <BottomActionBar className="pt-4">
                    <ResourceSaveButton
                      isDirty={isSectionDirty('instructors')}
                      saving={resourceSaving}
                      saved={savedSection === 'instructors'}
                      onSave={() => void handleSaveResourceSection('instructors')}

                    />
                  </BottomActionBar>
                </Card>
              )}

              {resourceSubTab === 'venues-boats' && (
                <Card padding="sm">
                  <PreferredVenueBoatList
                    venueSlugs={form.preferredVenueSlugs ?? []}
                    boatSlugs={form.preferredBoatSlugs ?? []}
                    onVenueChange={(slugs) => setField('preferredVenueSlugs', slugs)}
                    onBoatChange={(slugs) => setField('preferredBoatSlugs', slugs)}
                    required={(form.preferredVenueSlugs ?? []).length + (form.preferredBoatSlugs ?? []).length === 0}
                  />
                  <BottomActionBar className="pt-4">
                    <ResourceSaveButton
                      isDirty={isSectionDirty('venues-boats')}
                      saving={resourceSaving}
                      saved={savedSection === 'venues-boats'}
                      onSave={() => void handleSaveResourceSection('venues-boats')}

                    />
                  </BottomActionBar>
                </Card>
              )}

              {resourceSubTab === 'equipment' && (
                <Card padding="sm">
                  <PreferredEquipmentList
                    slugs={form.preferredEquipmentSlugs ?? []}
                    onChange={(slugs) => setField('preferredEquipmentSlugs', slugs)}
                    required
                  />
                  <BottomActionBar className="pt-4">
                    <ResourceSaveButton
                      isDirty={isSectionDirty('equipment')}
                      saving={resourceSaving}
                      saved={savedSection === 'equipment'}
                      onSave={() => void handleSaveResourceSection('equipment')}

                    />
                  </BottomActionBar>
                </Card>
              )}

              {resourceSubTab === 'compressors' && (
                <Card padding="sm">
                  <PreferredCompressorList
                    slugs={form.preferredCompressorSlugs ?? []}
                    onChange={(slugs) => setField('preferredCompressorSlugs', slugs)}
                  />
                  <BottomActionBar className="pt-4">
                    <ResourceSaveButton
                      isDirty={isSectionDirty('compressors')}
                      saving={resourceSaving}
                      saved={savedSection === 'compressors'}
                      onSave={() => void handleSaveResourceSection('compressors')}

                    />
                  </BottomActionBar>
                </Card>
              )}

              {resourceSubTab === 'operator' && activeRole === 'Agent' && (
                <>
                  <PreferredOperatorPicker
                    value={form.preferredOperatorSlug}
                    onChange={(slug) => setField('preferredOperatorSlug', slug)}
                  />
                  <BottomActionBar>
                    <ResourceSaveButton
                      isDirty={isSectionDirty('operator')}
                      saving={resourceSaving}
                      saved={savedSection === 'operator'}
                      onSave={() => void handleSaveResourceSection('operator')}

                    />
                  </BottomActionBar>
                </>
              )}
            </div>
          </>
        )}

      </div>
    </ProfileFormShell>
  )
}
