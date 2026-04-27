'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, Tabs, type TabItem } from '@/components/ui'
import { ROLE_BY_CLERK_ROLE, type ClerkRole, type RoleKey } from '@/lib/constants/roles'
import type { ProfileOverlayTab } from '@/lib/utils/first-incomplete-tab'
import { useSessionIdentity } from '@/lib/hooks/use-session-identity'
import { ProfileTab } from '@/components/account/profile-tab'
import { ProfileSectionTabBar } from '@/components/account/profile-section-tab-bar'
import { OVERLAY_ONLY_SECTIONS } from '@/lib/constants/profile-registry'
import { ROLE_BY_KEY, type ProfileSectionId } from '@/lib/constants/roles'
import { RoleProfileForm } from '@/components/profiles/connected-role-forms'
import { ManageRolesConnected } from '@/components/account/manage-roles-connected'
import { DashboardPageFrame } from '@/components/layout/dashboard-page-frame'
import { ConnectedEquipmentGear } from '@/components/inventory/connected-equipment-gear'
import { PreferencesEditor } from '@/components/account/preferences-editor'

export type { ProfileOverlayTab }

const DIALOG_EDGE_PADDING = 'px-4 md:px-6'

interface ProfileOverlayProps {
  open: boolean
  onClose: () => void
  initialTab?: ProfileOverlayTab
  initialSection?: string
  roleSlug: RoleKey
  slug: string
}

const STATIC_TAB_IDS: { id: ProfileOverlayTab; labelKey: 'profile' | 'roles' }[] = [
  { id: 'profile', labelKey: 'profile' },
  { id: 'roles', labelKey: 'roles' },
]

export function ProfileOverlay({ open, onClose, initialTab = 'profile', initialSection, roleSlug, slug: _slug }: ProfileOverlayProps) {
  const tNav = useTranslations('nav')
  const [activeTab, setActiveTab] = useState<string>(initialTab)
  const [roleProfileSection, setRoleProfileSection] = useState<string>(initialSection ?? '')
  const { roles: userRoles } = useSessionIdentity()
  const activeClerkRole = ROLE_BY_KEY[roleSlug]?.clerkRole

  const roleConfigs = Array.from(
    new Map(
      (userRoles ?? [])
        .map((r) => ROLE_BY_CLERK_ROLE[r.role as ClerkRole])
        .filter(Boolean)
        .map((config) => [config.key, config]),
    ).values(),
  )

  const visibleStaticTabs = STATIC_TAB_IDS

  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setActiveTab(initialTab)
      setRoleProfileSection(initialSection ?? '')
    }
  }

  const isRoleTab = activeTab.startsWith('role:')
  const activeRoleKey = isRoleTab ? activeTab.slice(5) as RoleKey : null

  const [prevRoleKey, setPrevRoleKey] = useState(activeRoleKey)
  if (activeRoleKey !== prevRoleKey) {
    setPrevRoleKey(activeRoleKey)
    if (activeRoleKey) {
      const role = ROLE_BY_KEY[activeRoleKey]
      const tabs = role?.profileTabs
      if (tabs?.length) {
        const current = roleProfileSection
        if (!current || !tabs.some((t) => t.id === current)) {
          setRoleProfileSection(tabs[0].id)
        }
      } else {
        setRoleProfileSection('')
      }
    }
  }
  const activeRoleConfig = activeRoleKey ? ROLE_BY_KEY[activeRoleKey] : undefined
  const roleSectionTabs = activeRoleConfig?.profileTabs ?? null

  const activeSection = roleSectionTabs && roleSectionTabs.length > 0
    ? roleProfileSection || roleSectionTabs[0].id
    : undefined

  function renderRoleContent() {
    if (!activeRoleKey) return null

    if (activeSection && OVERLAY_ONLY_SECTIONS.has(activeSection as ProfileSectionId)) {
      if (activeSection === 'gear') {
        return <ConnectedEquipmentGear />
      }
      if (activeSection === 'booking' || activeSection === 'resources') {
        return <PreferencesEditor section={activeSection} roleSlug={activeRoleKey} onClose={onClose} />
      }
    }

    return (
      <RoleProfileForm
        roleSlug={activeRoleKey}
        section={activeSection}
        onClose={onClose}
      />
    )
  }

  return (
    <Dialog open={open} onClose={onClose} title={tNav('account')} fullScreen melt>
      <div className="flex flex-col h-full">

        <Tabs
          variant="pill"
          className={`${DIALOG_EDGE_PADDING} py-2 flex-shrink-0 border-b border-glass-border`}
          activeTab={activeTab}
          onChange={(id) => {
            setActiveTab(id)
            if (id.startsWith('role:')) {
              const key = id.slice(5) as RoleKey
              const first = ROLE_BY_KEY[key]?.profileTabs?.[0]?.id ?? ''
              setRoleProfileSection(first)
            }
          }}
          groups={[
            visibleStaticTabs.map<TabItem>((tab) => ({
              id: tab.id,
              label: tNav(tab.labelKey),
            })),
            roleConfigs.map<TabItem>((role) => ({
              id: `role:${role.key}`,
              label: role.label,
            })),
          ]}
        />

        <div
          className="flex-1 overflow-y-auto overflow-x-hidden"
          role="tabpanel"
        >
          {activeRoleKey && roleSectionTabs && roleSectionTabs.length > 0 && (
            <div className={`${DIALOG_EDGE_PADDING} pt-2`}>
              <ProfileSectionTabBar
                tabs={roleSectionTabs}
                activeTab={activeSection ?? roleSectionTabs[0].id}
                onChange={setRoleProfileSection}
              />
            </div>
          )}
          <DashboardPageFrame
            maxWidth="4xl"
            className="px-4 pt-2 pb-28 md:pb-6 md:px-6"
          >
            {activeTab === 'profile' && <ProfileTab onClose={onClose} />}
            {activeTab === 'roles' && (
              <ManageRolesConnected
                onNavigateToRole={(roleKey) => setActiveTab(`role:${roleKey}`)}
                activeClerkRole={activeClerkRole}
              />
            )}
            {activeRoleKey && renderRoleContent()}
          </DashboardPageFrame>
        </div>
      </div>
    </Dialog>
  )
}
