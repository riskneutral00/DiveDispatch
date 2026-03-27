'use client'

import { useEffect, useState } from 'react'
import { GlassDialog } from '@/components/glass'
import type { RoleKey } from '@/lib/constants/roles'
import { ProfileTab } from '@/components/settings/profile-tab'
import { AccountForm } from '@/components/dashboard/account-form'
import { PreferencesTab } from '@/components/settings/preferences-tab'
import { RolesTab } from '@/components/settings/roles-tab'

// ── Types ────────────────────────────────────────────────────────────────────

export type ProfileOverlayTab = 'profile' | 'roles' | 'preferences' | 'account'

interface ProfileOverlayProps {
  open: boolean
  onClose: () => void
  initialTab?: ProfileOverlayTab
  roleSlug: RoleKey
  slug: string
}

const TABS: { id: ProfileOverlayTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'roles', label: 'Roles' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'account', label: 'Account' },
]

// ── Component ────────────────────────────────────────────────────────────────

export function ProfileOverlay({ open, onClose, initialTab = 'profile', roleSlug, slug }: ProfileOverlayProps) {
  const [activeTab, setActiveTab] = useState<ProfileOverlayTab>(initialTab)

  // Sync active tab when overlay opens with a specific tab
  useEffect(() => {
    if (open) setActiveTab(initialTab)
  }, [open, initialTab])

  return (
    <GlassDialog open={open} onClose={onClose} title="Settings" fullScreen>
      <div className="flex flex-col h-full">
        {/* Tab bar */}
        <div
          className="flex gap-1 px-4 py-2 sm:px-6 flex-shrink-0 border-b"
          style={{ borderColor: 'var(--color-glass-border)' }}
          role="tablist"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                id={`overlay-tab-${tab.id}`}
                aria-controls={`overlay-panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer"
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
        </div>

        {/* Tab content — scrollable */}
        <div
          className="flex-1 overflow-y-auto"
          role="tabpanel"
          id={`overlay-panel-${activeTab}`}
          aria-labelledby={`overlay-tab-${activeTab}`}
        >
          <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6">
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'roles' && <RolesTab />}
            {activeTab === 'preferences' && <PreferencesTab />}
            {activeTab === 'account' && <AccountForm showAppPreferences={false} />}
          </div>
        </div>
      </div>
    </GlassDialog>
  )
}
