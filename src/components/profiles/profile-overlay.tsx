'use client'

import { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import { GlassDialog } from '@/components/ui'
import { ROLE_BY_CLERK_ROLE, type ClerkRole, type RoleKey } from '@/lib/constants/roles'
import { api } from '../../../convex/_generated/api'
import { ProfileTab } from '@/components/settings/profile-tab'
import { PreferencesTab } from '@/components/settings/preferences-tab'
import { RoleDetailForm } from '@/components/settings/roles-tab'

// ── Types ────────────────────────────────────────────────────────────────────

export type ProfileOverlayTab = 'profile' | 'preferences'

interface ProfileOverlayProps {
  open: boolean
  onClose: () => void
  initialTab?: ProfileOverlayTab
  roleSlug: RoleKey
  slug: string
}

const STATIC_TABS: { id: string; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'preferences', label: 'Settings' },
]

// ── Component ────────────────────────────────────────────────────────────────

export function ProfileOverlay({ open, onClose, initialTab = 'profile', roleSlug, slug }: ProfileOverlayProps) {
  const [activeTab, setActiveTab] = useState<string>(initialTab)
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

  return (
    <GlassDialog open={open} onClose={onClose} title="Settings" fullScreen>
      <div className="flex flex-col h-full">
        {/* Tab bar */}
        <div
          className="flex gap-1 px-4 py-2 sm:px-6 flex-shrink-0 border-b overflow-x-auto"
          style={{ borderColor: 'var(--color-glass-border)', scrollbarWidth: 'none' }}
          role="tablist"
        >
          {STATIC_TABS.map((tab) => {
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
                {tab.label}
              </button>
            )
          })}

          {/* Role sub-tabs — appear inline after "Roles" */}
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
                    onClick={() => setActiveTab(`role:${role.key}`)}
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
          <div className="max-w-3xl mx-auto px-4 pt-4 pb-6 sm:px-6">
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'preferences' && <PreferencesTab />}
            {activeRoleKey && <RoleDetailForm roleKey={activeRoleKey} />}
          </div>
        </div>
      </div>
    </GlassDialog>
  )
}
