'use client'

export interface TabItem {
  id: string
  label: string
}

interface SettingsTabBarProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (tab: string) => void
}

export function SettingsTabBar({ tabs, activeTab, onChange }: SettingsTabBarProps) {
  return (
    <div
      role="tablist"
      className="flex overflow-x-auto mb-6"
      style={{
        borderBottom: '1px solid var(--color-glass-border)',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className="px-4 h-10 text-sm whitespace-nowrap flex-shrink-0 bg-transparent cursor-pointer outline-none"
            style={{
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontWeight: isActive ? 600 : 400,
              borderBottom: `2px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
              marginBottom: '-1px',
              transition: 'color 0.3s ease, border-color 0.3s ease',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
