'use client'

import { useState } from 'react'
import { DiveCenterProfileForm } from '@/components/dashboard/dive-center-profile-form'
import { SettingsTabBar } from '@/components/common/settings-tab-bar'
import type { DiveCenterProfileSection } from '@/components/dashboard/dive-center-profile-form'

const TABS = [
  { id: 'contact', label: 'Contact' },
  { id: 'languages', label: 'Languages' },
  { id: 'associations', label: 'Affiliations' },
]

export default function DiveCenterProfilePage() {
  const [activeTab, setActiveTab] = useState<DiveCenterProfileSection>('contact')

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
          Dive Center
        </p>
      </div>

      <SettingsTabBar tabs={TABS} activeTab={activeTab} onChange={(t) => setActiveTab(t as DiveCenterProfileSection)} />

      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
      >
        <DiveCenterProfileForm section={activeTab} />
      </div>
    </div>
  )
}
