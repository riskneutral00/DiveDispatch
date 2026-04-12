'use client'

import type { Ref } from 'react'
import { TOUCH_TARGET_CLASS } from '@/lib/constants/button-sizes'
import { cn } from '@/lib/utils/cn'

export type TabButtonVariant = 'underline' | 'pill'

interface TabButtonProps {
  id: string
  label: string
  active: boolean
  onSelect: (id: string) => void
  controlsId: string
  variant?: TabButtonVariant
  tabRef?: Ref<HTMLButtonElement>
  className?: string
}

export function TabButton({
  id,
  label,
  active,
  onSelect,
  controlsId,
  variant = 'underline',
  tabRef,
  className,
}: TabButtonProps) {
  const isUnderline = variant === 'underline'

  return (
    <button /* design-ok: tab indicator requires conditional inline border-bottom per MASTER.md */
      ref={tabRef}
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={active}
      aria-controls={controlsId}
      tabIndex={active ? 0 : -1}
      onClick={() => onSelect(id)}
      className={cn(
        'px-4 text-body whitespace-nowrap flex-shrink-0 bg-transparent cursor-pointer outline-none transition-all duration-theme',
        TOUCH_TARGET_CLASS,
        isUnderline ? '-mb-px' : 'rounded-full',
        active ? 'text-primary font-semibold' : 'text-secondary font-normal',
        className,
      )}
      style={
        isUnderline
          ? {
              borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`,
            }
          : undefined
      }
    >
      {label}
    </button>
  )
}
