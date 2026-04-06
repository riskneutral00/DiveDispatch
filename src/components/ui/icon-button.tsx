'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

const SIZE_CLASS = {
  md: 'w-11 h-11',
  sm: 'w-11 h-11', /* design-ok: 44px minimum touch target — no sub-44px sizes */
} as const

export type IconButtonSize = keyof typeof SIZE_CLASS

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Lucide icon or similar */
  children: ReactNode
  size?: IconButtonSize
}

/**
 * Circular glass control used for theme, background, and compact toggles in the shell header.
 */
export function IconButton({
  children,
  className = '',
  size = 'md',
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={`flex items-center justify-center cursor-pointer ${SIZE_CLASS[size]} rounded-full transition-all text-secondary ${className}`.trim()}
      style={{
        background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
        transitionDuration: 'var(--transition-speed)',
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
