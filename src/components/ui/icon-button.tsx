'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { INTERACTION_DEFAULTS, type IconButtonHoverEffect } from '@/lib/constants/interaction-config'
import { ICON_BUTTON_SIZE } from '@/lib/constants/button-sizes'

export type IconButtonSize = 'sm' | 'md'
export type IconButtonVariant = 'glass' | 'ghost'

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode
  size?: IconButtonSize
  variant?: IconButtonVariant
  hoverEffect?: IconButtonHoverEffect
}

const HOVER_CLASS: Record<IconButtonHoverEffect, string> = {
  glow: 'glass-btn glass-btn-ghost',
  opacity: 'transition-opacity hover:opacity-70',
  none: '',
}

export function IconButton({
  children,
  className = '',
  size: _size = 'md',
  variant = 'glass',
  hoverEffect = INTERACTION_DEFAULTS.iconButtonHover,
  type = 'button',
  ...rest
}: IconButtonProps) {
  void _size
  const isGlass = variant === 'glass'
  return (
    <button
      type={type}
      className={cn(
        'flex items-center justify-center cursor-pointer',
        ICON_BUTTON_SIZE,
        'rounded-full transition-all duration-theme text-secondary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-glow)]',
        HOVER_CLASS[hoverEffect],
        className,
      )}
      style={isGlass ? {
        background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
      } : undefined}
      {...rest}
    >
      {children}
    </button>
  )
}
