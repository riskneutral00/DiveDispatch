'use client'

import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react'
import { TabButton } from '@/components/ui/tab-button'

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
          <TabButton
            key={tab.id}
            variant="underline"
            id={tab.id}
            label={tab.label}
            active={isActive}
            onSelect={onChange}
            controlsId={`tabpanel-${tab.id}`}
            tabRef={isActive ? activeTabRef : undefined}
            className="first:pl-0"
          />
        )
      })}
    </div>
  )
}
