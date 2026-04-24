'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { MENU_BUTTON_SIZE_MAP, type MenuButtonSize } from '@/lib/constants/button-sizes'

type MenuButtonVariant = 'pill' | 'flush'

interface MenuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  size?: MenuButtonSize
  variant?: MenuButtonVariant
  children: ReactNode
}

/* design-ok: flush variant intentionally has no radius — dropdown/context menu items sit inside a rounded container */
const VARIANT_MAP: Record<MenuButtonVariant, { base: string; active: string }> = {
  pill: {
    base: 'rounded-full',
    active: 'rounded-full',
  },
  flush: {
    base: 'rounded-none', /* design-ok */
    active: 'rounded-none', /* design-ok */
  },
}

export const MenuButton = forwardRef<HTMLButtonElement, MenuButtonProps>(function MenuButton(
  {
    active = false,
    size = 'md',
    variant = 'flush',
    children,
    className,
    type = 'button',
    ...rest
  },
  ref,
) {
  const shape = VARIANT_MAP[variant]

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center gap-2 font-medium cursor-pointer',
        'transition-all duration-theme',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-glow)]',
        MENU_BUTTON_SIZE_MAP[size],
        active ? shape.active : shape.base,
        active ? 'text-primary' : 'text-secondary',
        active && 'bg-glass-bg-elevated',
        !active && 'hover:opacity-70',
        'flex-shrink-0',
        className,
      )}
      style={active ? {
        border: '1px solid var(--color-primary)',
      } : {
        background: 'transparent',
        border: '1px solid transparent',
      }}
      aria-current={active ? 'page' : undefined}
      {...rest}
    >
      {children}
    </button>
  )
})
