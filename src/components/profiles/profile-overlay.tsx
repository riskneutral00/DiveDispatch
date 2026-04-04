'use client'

import { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import { useTranslations } from 'next-intl'
import { Dialog } from '@/components/ui'
import { ROLE_BY_CLERK_ROLE, type ClerkRole, type RoleKey } from '@/lib/constants/roles'
import { api } from '@/lib/convex-generated'
import { ProfileTab } from '@/components/account/profile-tab'
import { PreferencesTab } from '@/components/account/preferences-tab'
import { ProfileSectionTabBar } from '@/components/account/profile-section-tab-bar'
import { OVERLAY_ONLY_SECTIONS } from '@/lib/constants/profile-registry'
import { ROLE_BY_KEY } from '@/lib/constants/roles'
import { RoleProfileForm } from '@/components/profiles/connected-role-forms'
import { ManageRolesConnected } from '@/components/account/manage-roles-connected'
import { ConnectedEquipmentInventory } from '@/components/inventory/connected-equipment-inventory'
import { PreferencesEditor } from '@/components/account/preferences-editor'

// ── Types ────────────────────────────────────────────────────────────────────

export type ProfileOverlayTab = 'profile' | 'preferences' | 'roles' | `role:${RoleKey}`

interface ProfileOverlayProps {
  open: boolean
  onClose: () => void
  initialTab?: ProfileOverlayTab
  roleSlug: RoleKey
  slug: string
}

const STATIC_TAB_IDS: { id: ProfileOverlayTab; labelKey: 'profile' | 'preferences' | 'roles' }[] = [
  { id: 'profile', labelKey: 'profile' },
  { id: 'preferences', labelKey: 'preferences' },
  { id: 'roles', labelKey: 'roles' },
]

// ── Component ────────────────────────────────────────────────────────────────

export function ProfileOverlay({ open, onClose, initialTab = 'profile', roleSlug, slug }: ProfileOverlayProps) {
  const tNav = useTranslations('nav')
  const tAccountOverlay = useTranslations('accountOverlay')
  const [activeTab, setActiveTab] = useState<string>(initialTab)
  /** Section within a multi-tab role profile (Contact / Languages / …) — mirrors Profile page. */
  const [roleProfileSection, setRoleProfileSection] = useState<string>('')
  const userRoles = useQuery(api.userRoles.myRoles)

  const roleConfigs = (userRoles ?? [])
    .map((r) => ROLE_BY_CLERK_ROLE[r.role as ClerkRole])
    .filter(Boolean)

  // Sync active tab when overlay opens with a specific tab
  useEffect(() => {
    if (open) setActiveTab(initialTab)
  }, [open, initialTab])

  const isRoleTab = activeTab.startsWith('role:')
  const activeRoleKey = isRoleTab ? activeTab.slice(5) as RoleKey : null

  // When switching role sub-tab, reset section to first profile tab (matches Profile page)
  useEffect(() => {
    if (!activeRoleKey) return
    const role = ROLE_BY_KEY[activeRoleKey]
    const tabs = role?.profileTabs
    if (tabs?.length) {
      setRoleProfileSection((prev) => (prev && tabs.some((t) => t.id === prev) ? prev : tabs[0].id))
    } else {
      setRoleProfileSection('')
    }
  }, [activeRoleKey])
  const activeRoleConfig = activeRoleKey ? ROLE_BY_KEY[activeRoleKey] : undefined
  const roleSectionTabs = activeRoleConfig?.profileTabs ?? null

  // The currently active section for a role tab
  const activeSection = roleSectionTabs && roleSectionTabs.length > 0
    ? roleProfileSection || roleSectionTabs[0].id
    : undefined

  // Determine what to render in the role tab content area
  function renderRoleContent() {
    if (!activeRoleKey) return null

    if (activeSection && OVERLAY_ONLY_SECTIONS.has(activeSection)) {
      if (activeSection === 'inventory') {
        return <ConnectedEquipmentInventory />
      }
      if (activeSection === 'booking' || activeSection === 'resources') {
        return <PreferencesEditor section={activeSection} roleSlug={activeRoleKey} />
      }
    }

    return (
      <RoleProfileForm
        roleSlug={activeRoleKey}
        section={activeSection}
      />
    )
  }

  return (
    <Dialog open={open} onClose={onClose} title={tAccountOverlay('title')} fullScreen>
      <div className="flex flex-col h-full">
        {/* Tab bar */}
        <div
          className="flex gap-1 px-4 py-2 sm:px-6 flex-shrink-0 border-b overflow-x-auto justify-center"
          style={{ borderColor: 'var(--color-glass-border)', scrollbarWidth: 'none' }}
          role="tablist"
        >
          {STATIC_TAB_IDS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer flex-shrink-0"
                style={{
                  background: isActive ? 'var(--color-glass-bg-elevated, var(--color-primary-glow))' : 'transparent',
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  border: isActive ? '1px solid var(--color-primary)' : '1px solid transparent',
                }}
              >
                {tNav(tab.labelKey)}
              </button>
            )
          })}

          {/* Role sub-tabs — appear inline after static tabs */}
          {roleConfigs.length > 0 && (
            <>
              <div
                className="w-px mx-1 self-stretch flex-shrink-0"
                style={{ background: 'var(--color-glass-border)' }}
              />
              {roleConfigs.map((role) => {
                const isActive = activeTab === `role:${role.key}`
                return (
                  <button
                    key={role.key}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => {
                      setActiveTab(`role:${role.key}`)
                      const first = ROLE_BY_KEY[role.key]?.profileTabs?.[0]?.id ?? ''
                      setRoleProfileSection(first)
                    }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer flex-shrink-0"
                    style={{
                      background: isActive ? 'var(--color-glass-bg-elevated, var(--color-primary-glow))' : 'transparent',
                      color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      border: isActive ? '1px solid var(--color-primary)' : '1px solid transparent',
                    }}
                  >
                    {role.label}
                  </button>
                )
              })}
            </>
          )}
        </div>

        {/* Tab content — scrollable */}
        <div
          className="flex-1 overflow-y-auto"
          role="tabpanel"
        >
          <div className="max-w-3xl mx-auto px-4 pt-2 pb-6 sm:px-6">
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'preferences' && <PreferencesTab />}
            {activeTab === 'roles' && <ManageRolesConnected />}
            {activeRoleKey && roleSectionTabs && roleSectionTabs.length > 0 && (
              <div className="max-w-2xl mx-auto">
                <ProfileSectionTabBar
                  tabs={roleSectionTabs}
                  activeTab={activeSection ?? roleSectionTabs[0].id}
                  onChange={setRoleProfileSection}
                />
              </div>
            )}
            {activeRoleKey && renderRoleContent()}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
