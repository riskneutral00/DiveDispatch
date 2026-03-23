'use client'

import { useState } from 'react'
import { DiveMasterProfileForm } from '@/components/dashboard/divemaster-profile-form'
import { SettingsTabBar } from '@/components/common/settings-tab-bar'
import type { DiveMasterProfileSection } from '@/components/dashboard/divemaster-profile-form'

const TABS = [
  { id: 'contact', label: 'Contact' },
  { id: 'languages', label: 'Languages' },
  { id: 'credentials', label: 'Credentials' },
]

export default function DiveMasterProfilePage() {
  const [activeTab, setActiveTab] = useState<DiveMasterProfileSection>('contact')

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-10">
      <div className="mb-6">
        <h1
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Profile
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Divemaster
        </p>
      </div>

      <SettingsTabBar tabs={TABS} activeTab={activeTab} onChange={(t) => setActiveTab(t as DiveMasterProfileSection)} />

      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
      >
        <DiveMasterProfileForm section={activeTab} />
      </div>
    </div>
  )
}
