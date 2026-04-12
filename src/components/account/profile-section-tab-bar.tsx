'use client'

import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react'
import { TOUCH_TARGET_CLASS } from '@/lib/constants/button-sizes'

export interface TabItem {
  id: string
  label: string
}

interface ProfileSectionTabBarProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (tab: string) => void
}

export function ProfileSectionTabBar({ tabs, activeTab, onChange }: ProfileSectionTabBarProps) {
  const tablistRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeTabRef.current?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [activeTab])

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
      className="flex overflow-x-auto mb-4 glass-divider"
      onKeyDown={handleKeyDown}
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button /* design-ok: underline tab indicator requires inline border-bottom — distinct from pill/flush MenuButton */
            key={tab.id}
            ref={isActive ? activeTabRef : undefined}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`px-4 ${TOUCH_TARGET_CLASS} text-body whitespace-nowrap flex-shrink-0 bg-transparent cursor-pointer outline-none transition-all duration-theme ${isActive ? 'text-primary font-semibold' : 'text-secondary font-normal'}`}
            style={{
              borderBottom: `2px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
