'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ProfileSectionTabBar } from '@/components/account/profile-section-tab-bar'
import { prefsSchema, type PrefsFormData } from '@/lib/preferences/prefs-schema'
import { SAVE_FEEDBACK_MS } from '@/lib/constants/ui-timings'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { ROLE_BY_KEY, DISPLAY_OPERATOR_ROLES, type RoleKey } from '@/lib/constants/roles'
import { BottomActionBar } from '@/components/ui/bottom-action-bar'
import { SaveButton } from '@/components/ui/save-button'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { SectionDivider } from '@/components/ui/section-divider'
import {
  PreferredInstructorList,
  PreferredVenueList,
  PreferredBoatList,
  PreferredEquipmentList,
  PreferredCompressorList,
} from '@/components/profiles/preferred-list'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import { SimpleSelect } from '@/components/ui/simple-select'
import { PreferredOperatorPicker } from '@/components/account/preferred-operator-picker'
import {
  RESOURCE_TAB_REQUIRED,
  type ResourceSubTab as ResourceSubTabId,
} from '@/lib/preferences/resource-tab-requirement'

type PreferencesRecord = Record<string, unknown>

const DISPLAY_OPERATOR_ROLE_KEYS = new Set(DISPLAY_OPERATOR_ROLES.map((r) => r.clerkRole))

export type ResourceSubTab = ResourceSubTabId

const defaultFormData = (): PrefsFormData => ({
  autoAccept: true,
  commonLanguageCodes: ['en'],
  confirmOnAccept: true,
  confirmOnDecline: true,
  preferredInstructorSlugs: [],
  preferredVenueSlugs: [],
  preferredEquipmentSlugs: [],
  preferredBoatSlugs: [],
  preferredCompressorSlugs: [],
  preferredOperatorSlug: undefined,
  autoAssignPreferred: true,
})

export function buildResourceSubTabs(
  clerkRole: string | undefined,
  requirementByTab?: Record<ResourceSubTab, boolean>,
): { id: ResourceSubTab; label: string; required?: boolean }[] {
  const base: { id: ResourceSubTab; label: string; required?: boolean }[] = [
    { id: 'instructors', label: 'Instructors', required: requirementByTab?.instructors },
    { id: 'venues', label: 'Venues', required: requirementByTab?.venues },
    { id: 'boats', label: 'Boats', required: requirementByTab?.boats },
    { id: 'equipment', label: 'Equipment', required: requirementByTab?.equipment },
    { id: 'compressors', label: 'Compressors', required: requirementByTab?.compressors },
  ]
  if (clerkRole === 'Agent') {
    base.push({ id: 'operator', label: 'Operator' })
  }
  return base
}

const SECTION_FIELDS: Record<ResourceSubTab, keyof PrefsFormData> = {
  instructors: 'preferredInstructorSlugs',
  venues: 'preferredVenueSlugs',
  boats: 'preferredBoatSlugs',
  equipment: 'preferredEquipmentSlugs',
  compressors: 'preferredCompressorSlugs',
  operator: 'preferredOperatorSlug',
}

interface PreferencesEditorProps {
  section?: 'booking' | 'resources'
  roleSlug?: string
  onClose?: () => void
}

export function PreferencesEditor({ section = 'booking', roleSlug: roleSlugProp, onClose }: PreferencesEditorProps) {
  const tCommon = useTranslations('common')
  const tBooking = useTranslations('booking')
  const tErrors = useTranslations('errors')
  const params = useParams()
  const roleSlug = roleSlugProp ?? (params?.roleSlug as string | undefined)
  const activeRole = roleSlug ? ROLE_BY_KEY[roleSlug as RoleKey]?.clerkRole : undefined
  const prefs = useQuery(api.stakeholderPreferences.mine)
  const upsert = useMutation(api.stakeholderPreferences.upsert)

  const [resourceSubTab, setResourceSubTab] = useState<ResourceSubTab>('instructors')
  const [resourceSaving, setResourceSaving] = useState(false)
  const [savedSection, setSavedSection] = useState<ResourceSubTab | null>(null)
  const [resourceBaseline, setResourceBaseline] = useState<PrefsFormData | null>(null)
  const defaults = useMemo(() => defaultFormData(), [])
  const savePreferences = useCallback(
    async (payload: PrefsFormData) => {
      if (!activeRole) {
        throw new Error(tErrors('roleNotDetermined'))
      }
      await upsert({ ...payload, activeRole })
    },
    [activeRole, upsert, tErrors],
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
    resetToBaseline,
  } = useProfileForm<PrefsFormData, PrefsFormData>({
    profile: prefs === undefined ? undefined : (prefs as PreferencesRecord | null),
    schema: prefsSchema,
    defaults,
    fromProfile: (profile) => {
      const typed = profile as Partial<PrefsFormData>
      return {
        autoAccept: typed.autoAccept ?? true,
        commonLanguageCodes: typed.commonLanguageCodes ?? ['en'],
        confirmOnAccept: typed.confirmOnAccept ?? true,
        confirmOnDecline: typed.confirmOnDecline ?? true,
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

  const resourceSubTabs = useMemo(
    () => buildResourceSubTabs(activeRole, RESOURCE_TAB_REQUIRED),
    [activeRole],
  )

  const saveStakeholderPreferences = useCallback(async () => {
    if (!activeRole) {
      throw new Error(tErrors('roleNotDetermined'))
    }
    await upsert({
      activeRole,
      autoAccept: form.autoAccept,
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
  }, [activeRole, form, upsert, tErrors])

  const handleSaveResourceSection = useCallback(async (section: ResourceSubTab) => {
    setResourceSaving(true)
    try {
      await saveStakeholderPreferences()
      markBaselineCurrent()
      setResourceBaseline({ ...form })
      setSavedSection(section)
      toast.success(tBooking('preferencesSaved'))
    } catch {
      toast.error(tCommon('actionFailed', { action: tCommon('save') }))
    } finally {
      setResourceSaving(false)
    }
  }, [form, markBaselineCurrent, saveStakeholderPreferences, tBooking, tCommon])

  useEffect(() => {
    if (activeRole !== 'Agent' && resourceSubTab === 'operator') {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- comments-ok resets tab when role loses access; external-trigger sync */
      setResourceSubTab('instructors')
    }
  }, [activeRole, resourceSubTab])

  useEffect(() => {
    if (!loading && resourceBaseline === null) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- comments-ok one-shot baseline capture once async prefs finish loading */
      setResourceBaseline({ ...form })
    }
  }, [loading, form, resourceBaseline])

  useEffect(() => {
    if (savedSection) {
      const timer = setTimeout(() => setSavedSection(null), SAVE_FEEDBACK_MS)
      return () => clearTimeout(timer)
    }
  }, [savedSection])

  const isSectionDirty = useCallback((section: ResourceSubTab): boolean => {
    if (!resourceBaseline) return false
    const field = SECTION_FIELDS[section]
    return JSON.stringify(form[field]) !== JSON.stringify(resourceBaseline[field])
  }, [form, resourceBaseline])

  return (
    <ProfileFormShell
      loading={loading}
      onSubmit={handleSubmit}
      onCancel={() => { resetToBaseline(); onClose?.() }}
      footerErrorMessage={footerErrorMessage}
      saving={saving}
      saved={saved}
      isDirty={isDirty}
      isUpdate={isUpdate}
      disableSaveWhenInvalid
      isValid={isValid}
      hideFooter={section === 'resources'}
      className="w-full pb-28 md:pb-10"
    >
      <div id={`tabpanel-${section}`} role="tabpanel" aria-labelledby={`tab-${section}`} className="space-y-6">

        {section === 'booking' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card padding="sm" className="reading-plane">
              <Checkbox
                label={tBooking('autoAccept')}
                description={tBooking('autoAcceptDescription')}
                checked={form.autoAccept}
                onChange={(v) => setField('autoAccept', v)}
              />
            </Card>

            <SectionDivider show />

            {showResourcePrefs && (
              <>
                <SectionDivider show />
                <Card padding="sm" className="reading-plane">
                  <FormSectionHeader className="mb-4" label={tBooking('preferredResources')} />
                  <Checkbox
                    label={tBooking('autoAssignPreferred')}
                    checked={form.autoAssignPreferred}
                    onChange={(v) => setField('autoAssignPreferred', v)}
                  />
                </Card>
              </>
            )}

            <SectionDivider show />

            <Card padding="sm" className="reading-plane">
              <FormSectionHeader
                className="mb-4"
                label={tBooking('confirmationAlerts')}
                required
              />
              <div className="space-y-3">
                {(
                  [
                    { key: 'confirmOnAccept', label: tBooking('notifyOnAccept') },
                    { key: 'confirmOnDecline', label: tBooking('notifyOnDecline') },
                  ] as const
                ).map(({ key, label }) => (
                  <Checkbox
                    key={key}
                    label={label}
                    checked={form[key]}
                    onChange={(v) => setField(key, v)}
                  />
                ))}
              </div>
            </Card>
          </div>
        )}

        {section === 'resources' && showResourcePrefs && (
          <>
            <div>
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
              className="max-w-2xl mx-auto space-y-4"
            >
              {resourceSubTab === 'instructors' && (
                <Card padding="sm">
                  <PreferredInstructorList
                    slugs={form.preferredInstructorSlugs ?? []}
                    onChange={(slugs) => setField('preferredInstructorSlugs', slugs)}
                  />
                  <BottomActionBar className="pt-4">
                    <SaveButton
                      isDirty={isSectionDirty('instructors')}
                      saving={resourceSaving}
                      saved={savedSection === 'instructors'}
                      isUpdate
                      size="sm"
                      onClick={() => void handleSaveResourceSection('instructors')}
                    />
                  </BottomActionBar>
                </Card>
              )}

              {resourceSubTab === 'venues' && (
                <Card padding="sm">
                  <PreferredVenueList
                    slugs={form.preferredVenueSlugs ?? []}
                    onChange={(slugs) => setField('preferredVenueSlugs', slugs)}
                  />
                  <BottomActionBar className="pt-4">
                    <SaveButton
                      isDirty={isSectionDirty('venues')}
                      saving={resourceSaving}
                      saved={savedSection === 'venues'}
                      isUpdate
                      size="sm"
                      onClick={() => void handleSaveResourceSection('venues')}
                    />
                  </BottomActionBar>
                </Card>
              )}

              {resourceSubTab === 'boats' && (
                <Card padding="sm">
                  <PreferredBoatList
                    slugs={form.preferredBoatSlugs ?? []}
                    onChange={(slugs) => setField('preferredBoatSlugs', slugs)}
                  />
                  <BottomActionBar className="pt-4">
                    <SaveButton
                      isDirty={isSectionDirty('boats')}
                      saving={resourceSaving}
                      saved={savedSection === 'boats'}
                      isUpdate
                      size="sm"
                      onClick={() => void handleSaveResourceSection('boats')}
                    />
                  </BottomActionBar>
                </Card>
              )}

              {resourceSubTab === 'equipment' && (
                <Card padding="sm">
                  <PreferredEquipmentList
                    slugs={form.preferredEquipmentSlugs ?? []}
                    onChange={(slugs) => setField('preferredEquipmentSlugs', slugs)}
                  />
                  <BottomActionBar className="pt-4">
                    <SaveButton
                      isDirty={isSectionDirty('equipment')}
                      saving={resourceSaving}
                      saved={savedSection === 'equipment'}
                      isUpdate
                      size="sm"
                      onClick={() => void handleSaveResourceSection('equipment')}
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
                    <SaveButton
                      isDirty={isSectionDirty('compressors')}
                      saving={resourceSaving}
                      saved={savedSection === 'compressors'}
                      isUpdate
                      size="sm"
                      onClick={() => void handleSaveResourceSection('compressors')}
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
                    <SaveButton
                      isDirty={isSectionDirty('operator')}
                      saving={resourceSaving}
                      saved={savedSection === 'operator'}
                      isUpdate
                      size="sm"
                      onClick={() => void handleSaveResourceSection('operator')}
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
