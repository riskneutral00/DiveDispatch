'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

const SIZE_CLASS = {
  md: 'w-11 h-11',
  sm: 'w-11 h-11', /* design-ok: 44px minimum touch target — no sub-44px sizes */
} as const

export type IconButtonSize = keyof typeof SIZE_CLASS
export type IconButtonVariant = 'glass' | 'ghost'

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Lucide icon or similar */
  children: ReactNode
  size?: IconButtonSize
  variant?: IconButtonVariant
}

/**
 * Tap-target button for icon-only actions. 44px minimum touch target enforced.
 * - glass (default): glass background + border, used in shell header
 * - ghost: transparent, no background/border, used inline in content
 */
export function IconButton({
  children,
  className = '',
  size = 'md',
  variant = 'glass',
  type = 'button',
  ...rest
}: IconButtonProps) {
  const isGlass = variant === 'glass'
  return (
    <button
      type={type}
      className={`flex items-center justify-center cursor-pointer ${SIZE_CLASS[size]} rounded-full transition-all text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-glow)] ${className}`.trim()}
      style={isGlass ? {
        background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
        transitionDuration: 'var(--transition-speed)',
      } : {
        transitionDuration: 'var(--transition-speed)',
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
