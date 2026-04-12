import React from 'react'
import { cn } from '@/lib/utils/cn'
import { INTERACTION_DEFAULTS, type BadgeHoverEffect } from '@/lib/constants/interaction-config'
import type { StatusColorSet } from '@/lib/constants/vessel-colors'

interface ColorBadgeProps {
  color: Pick<StatusColorSet, 'textVar' | 'bgVar' | 'borderVar'>
  children: React.ReactNode
  onClick?: () => void
  hoverEffect?: BadgeHoverEffect
  dimmed?: boolean
  className?: string
  style?: React.CSSProperties
  title?: string
}

export const ColorBadge = React.memo(function ColorBadge({
  color,
  children,
  onClick,
  hoverEffect = INTERACTION_DEFAULTS.badgeHover,
  dimmed,
  className,
  style,
  title,
}: ColorBadgeProps) {
  const Tag = onClick ? 'button' : 'span'

  const HOVER_CLASS: Record<BadgeHoverEffect, string> = {
    /* Shadow stack matches .glass-surface:hover; keeps status fill via inline style */
    'glass-glow': 'dashboard-hover-glow',
    opacity: 'transition-opacity duration-theme hover:opacity-70',
    none: '',
  }

  const colorStyle: React.CSSProperties = dimmed
    ? {
        color: color.textVar,
        border: `1px solid ${color.borderVar}`,
        background: 'transparent',
        opacity: 0.55,
      }
    : {
        color: color.textVar,
        background: color.bgVar,
        border: `1px solid ${color.borderVar}`,
      }

  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      title={title}
      className={cn(
        'rounded-full px-2 py-0.5 font-medium select-none',
        onClick && `cursor-pointer ${HOVER_CLASS[hoverEffect]}`,
        className,
      )}
      style={{ ...colorStyle, ...style }}
    >
      {children}
    </Tag>
  )
})
