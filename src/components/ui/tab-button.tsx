'use client'

import type { ReactNode, Ref } from 'react'
import { TOUCH_TARGET_CLASS } from '@/lib/constants/button-sizes'
import type { Requirable } from '@/lib/types/requirable'
import { cn } from '@/lib/utils/cn'

export type TabButtonVariant = 'underline' | 'pill'

interface TabButtonProps extends Requirable {
  id: string
  label: ReactNode
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
  required,
  ariaRequired,
  className,
}: TabButtonProps) {
  const isUnderline = variant === 'underline'
  const announceRequired = ariaRequired ?? required

  return (
    <button /* design-ok: tab indicator requires conditional inline border-bottom per MASTER.md */
      ref={tabRef}
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={active}
      aria-controls={controlsId}
      aria-required={announceRequired ? true : undefined}
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
