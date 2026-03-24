'use client'

import { useEffect, useState } from 'react'
import { GlassDialog } from '@/components/glass'
import { PROFILE_REGISTRY } from '@/lib/constants/profile-registry'
import type { RoleKey } from '@/lib/constants/roles'
import { DiveCenterProfileForm } from './dive-center-profile-form'
import { AgentProfileForm } from './agent-profile-form'
import { InstructorProfileForm } from './instructor-profile-form'
import { DiveMasterProfileForm } from './divemaster-profile-form'
import { BoatProfileForm } from './boat-profile-form'
import { CompressorProfileForm } from './compressor-profile-form'
import { EquipmentProfileForm } from './equipment-profile-form'
import { PoolProfileForm } from './pool-profile-form'
import { PreferencesEditor } from './preferences-editor'
import { AccountForm } from './account-form'

// ── Types ────────────────────────────────────────────────────────────────────

export type ProfileOverlayTab = 'profile' | 'preferences' | 'account'

interface ProfileOverlayProps {
  open: boolean
  onClose: () => void
  initialTab?: ProfileOverlayTab
  roleSlug: RoleKey
  slug: string
}

const TABS: { id: ProfileOverlayTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'account', label: 'Account' },
]

// ── Profile form by role (flat — no section filter) ──────────────────────────

function ProfileFormForRole({ roleSlug }: { roleSlug: RoleKey }) {
  switch (roleSlug) {
    case 'dive-center':
      return <DiveCenterProfileForm />
    case 'agent':
      return <AgentProfileForm />
    case 'instructor':
      return <InstructorProfileForm />
    case 'dive-master':
      return <DiveMasterProfileForm />
    case 'boat':
      return <BoatProfileForm />
    case 'compressor':
      return <CompressorProfileForm />
    case 'equipment':
      return <EquipmentProfileForm />
    case 'pool':
      return <PoolProfileForm />
    default:
      return null
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProfileOverlay({ open, onClose, initialTab = 'profile', roleSlug, slug }: ProfileOverlayProps) {
  const [activeTab, setActiveTab] = useState<ProfileOverlayTab>(initialTab)

  // Sync active tab when overlay opens with a specific tab
  useEffect(() => {
    if (open) setActiveTab(initialTab)
  }, [open, initialTab])

  const config = PROFILE_REGISTRY[roleSlug]

  return (
    <GlassDialog open={open} onClose={onClose} title={config?.label ?? 'Settings'} fullScreen>
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
          <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6">
            {activeTab === 'profile' && (
              <ProfileFormForRole roleSlug={roleSlug} />
            )}
            {activeTab === 'preferences' && (
              <PreferencesEditor />
            )}
            {activeTab === 'account' && (
              <AccountForm />
            )}
          </div>
        </div>
      </div>
    </GlassDialog>
  )
}
