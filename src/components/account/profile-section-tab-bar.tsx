'use client'

import { Tabs, type TabItem } from '@/components/ui/tabs'

export type { TabItem }

interface ProfileSectionTabBarProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (tab: string) => void
}

export function ProfileSectionTabBar({ tabs, activeTab, onChange }: ProfileSectionTabBarProps) {
  return <Tabs tabs={tabs} activeTab={activeTab} onChange={onChange} variant="underline" className="mb-4" />
}
