'use client'

import { Fragment, useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { TabButton } from '@/components/ui/tab-button'
import { MenuButton } from '@/components/ui/menu-button'
import { RequiredAsterisk } from '@/components/ui/required-asterisk'
import type { Requirable } from '@/lib/types/requirable'
import { cn } from '@/lib/utils/cn'

export interface TabItem extends Requirable {
  id: string
  label: ReactNode
  ariaLabel?: string
}

type TabsVariant = 'underline' | 'pill'

interface TabsBaseProps {
  activeTab: string
  onChange: (id: string) => void
  variant?: TabsVariant
  ariaLabel?: string
  className?: string
}

interface TabsFlatProps extends TabsBaseProps {
  tabs: TabItem[]
  groups?: never
}

interface TabsGroupedProps extends TabsBaseProps {
  groups: TabItem[][]
  tabs?: never
}

export type TabsProps = TabsFlatProps | TabsGroupedProps

const CONTAINER_BY_VARIANT: Record<TabsVariant, string> = {
  underline: 'flex overflow-x-auto glass-divider [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
  pill: 'flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
}

export function Tabs(props: TabsProps) {
  const { activeTab, onChange, variant = 'underline', ariaLabel, className } = props
  const rawGroups: TabItem[][] = 'groups' in props && props.groups !== undefined
    ? props.groups
    : [props.tabs ?? []]
  const groups = rawGroups.filter((g) => g.length > 0)
  const flatTabs = groups.flat()

  const tablistRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeTabRef.current?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [activeTab])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = flatTabs.findIndex((t) => t.id === activeTab)
      if (currentIndex === -1) return

      let nextIndex: number | null = null
      if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % flatTabs.length
      else if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + flatTabs.length) % flatTabs.length

      if (nextIndex !== null) {
        e.preventDefault()
        onChange(flatTabs[nextIndex].id)
        const buttons = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
        buttons?.[nextIndex]?.focus()
      }
    },
    [flatTabs, activeTab, onChange],
  )

  const renderTab = (tab: TabItem) => {
    const isActive = tab.id === activeTab
    const composedLabel = (
      <>
        {tab.label}
        {tab.required && <RequiredAsterisk />}
      </>
    )
    const announceRequired = tab.ariaRequired ?? tab.required
    if (variant === 'underline') {
      return (
        <TabButton
          key={tab.id}
          variant="underline"
          id={tab.id}
          label={composedLabel}
          active={isActive}
          required={tab.required}
          ariaRequired={tab.ariaRequired}
          onSelect={onChange}
          controlsId={`tabpanel-${tab.id}`}
          tabRef={isActive ? activeTabRef : undefined}
          className="first:pl-0"
        />
      )
    }
    return (
      <MenuButton
        key={tab.id}
        role="tab"
        aria-selected={isActive}
        aria-controls={`tabpanel-${tab.id}`}
        aria-label={tab.ariaLabel}
        aria-required={announceRequired ? true : undefined}
        active={isActive}
        variant="pill"
        size="sm"
        onClick={() => onChange(tab.id)}
        ref={isActive ? activeTabRef : undefined}
      >
        {composedLabel}
      </MenuButton>
    )
  }

  return (
    <div
      ref={tablistRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(CONTAINER_BY_VARIANT[variant], className)}
      onKeyDown={handleKeyDown}
    >
      {groups.map((group, groupIndex) => (
        <Fragment key={groupIndex}>
          {groupIndex > 0 && (
            <div
              className="w-px mx-1 self-stretch flex-shrink-0 bg-glass-border"
              aria-hidden
            />
          )}
          {group.map(renderTab)}
        </Fragment>
      ))}
    </div>
  )
}
