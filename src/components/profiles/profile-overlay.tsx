'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { useTranslations } from 'next-intl'
import { Dialog, MenuButton } from '@/components/ui'
import { ROLE_BY_CLERK_ROLE, type ClerkRole, type RoleKey } from '@/lib/constants/roles'
import { api } from '@/lib/convex-generated'
import { ProfileTab } from '@/components/account/profile-tab'
import { ProfileSectionTabBar } from '@/components/account/profile-section-tab-bar'
import { OVERLAY_ONLY_SECTIONS } from '@/lib/constants/profile-registry'
import { ROLE_BY_KEY } from '@/lib/constants/roles'
import { RoleProfileForm } from '@/components/profiles/connected-role-forms'
import { ManageRolesConnected } from '@/components/account/manage-roles-connected'
import { DashboardPageFrame } from '@/components/layout/dashboard-page-frame'
import { ConnectedEquipmentInventory } from '@/components/inventory/connected-equipment-inventory'
import { PreferencesEditor } from '@/components/account/preferences-editor'

export type ProfileOverlayTab = 'profile' | 'roles' | `role:${RoleKey}`

interface ProfileOverlayProps {
  open: boolean
  onClose: () => void
  initialTab?: ProfileOverlayTab
  roleSlug: RoleKey
  slug: string
}

const STATIC_TAB_IDS: { id: ProfileOverlayTab; labelKey: 'profile' | 'roles' }[] = [
  { id: 'profile', labelKey: 'profile' },
  { id: 'roles', labelKey: 'roles' },
]

export function ProfileOverlay({ open, onClose, initialTab = 'profile', roleSlug: _roleSlug, slug: _slug }: ProfileOverlayProps) {
  const tNav = useTranslations('nav')
  const [activeTab, setActiveTab] = useState<string>(initialTab)
  const [roleProfileSection, setRoleProfileSection] = useState<string>('')
  const userRoles = useQuery(api.userRoles.myRoles)

  const roleConfigs = (userRoles ?? [])
    .map((r) => ROLE_BY_CLERK_ROLE[r.role as ClerkRole])
    .filter(Boolean)

  const hasOperatorRole = roleConfigs.some((r) => r.displayGroup === 'operator')
  const visibleStaticTabs = STATIC_TAB_IDS.filter(
    (tab) => tab.id !== 'roles' || hasOperatorRole,
  )

  if (activeTab === 'roles' && !hasOperatorRole) {
    setActiveTab('profile')
  }

  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setActiveTab(initialTab)
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

    if (activeSection && OVERLAY_ONLY_SECTIONS.has(activeSection)) {
      if (activeSection === 'inventory') {
        return <ConnectedEquipmentInventory />
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
    <Dialog open={open} onClose={onClose} title="Account" fullScreen scrim>
      <div className="flex flex-col h-full">

        <div
          className="flex gap-1 px-4 py-2 sm:px-6 flex-shrink-0 border-b border-glass-border overflow-x-auto sm:justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
        >
          {visibleStaticTabs.map((tab) => (
              <MenuButton
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                active={activeTab === tab.id}
                variant="pill"
                onClick={() => setActiveTab(tab.id)}
              >
                {tNav(tab.labelKey)}
              </MenuButton>
          ))}

          {roleConfigs.length > 0 && (
            <>
              <div
                className="w-px mx-1 self-stretch flex-shrink-0 bg-glass-border"
              />
              {roleConfigs.map((role) => (
                  <MenuButton
                    key={role.key}
                    role="tab"
                    aria-selected={activeTab === `role:${role.key}`}
                    active={activeTab === `role:${role.key}`}
                    variant="pill"
                    size="sm"
                    onClick={() => {
                      setActiveTab(`role:${role.key}`)
                      const first = ROLE_BY_KEY[role.key]?.profileTabs?.[0]?.id ?? ''
                      setRoleProfileSection(first)
                    }}
                  >
                    {role.label}
                  </MenuButton>
              ))}
            </>
          )}
        </div>

        <div
          className="flex-1 overflow-y-auto overflow-x-hidden"
          role="tabpanel"
        >
          <DashboardPageFrame className="px-4 pt-2 pb-28 md:pb-6 sm:px-6">
            {activeTab === 'profile' && <ProfileTab onClose={onClose} />}
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
          </DashboardPageFrame>
        </div>
      </div>
    </Dialog>
  )
}
