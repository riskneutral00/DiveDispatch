'use client'

import { useCallback, useRef, type KeyboardEvent } from 'react'

export interface TabItem {
  id: string
  label: string
}

interface ProfileSectionTabBarProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (tab: string) => void
}

/** ARIA tablist for role profile sections (Contact, Languages, …) or preferences sub-tabs. */
export function ProfileSectionTabBar({ tabs, activeTab, onChange }: ProfileSectionTabBarProps) {
  const tablistRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = tabs.findIndex((t) => t.id === activeTab)
      if (currentIndex === -1) return

      let nextIndex: number | null = null

      if (e.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % tabs.length
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
      }

      if (nextIndex !== null) {
        e.preventDefault()
        onChange(tabs[nextIndex].id)
        // Move focus to the newly activated tab
        const buttons = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
        buttons?.[nextIndex]?.focus()
      }
    },
    [tabs, activeTab, onChange],
  )

  return (
    <div
      ref={tablistRef}
      role="tablist"
      className="flex overflow-x-auto mb-4 justify-center"
      onKeyDown={handleKeyDown}
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
            tabIndex={isActive ? 0 : -1}
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
