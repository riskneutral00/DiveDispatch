import React from 'react'
import { cn } from '@/lib/utils/cn'
import type { StatusColorSet } from '@/lib/constants/vessel-colors'

interface ColorBadgeProps {
  /** Dynamic runtime colors — accepts StatusColorSet or any { textVar, bgVar, borderVar } shape */
  color: Pick<StatusColorSet, 'textVar' | 'bgVar' | 'borderVar'>
  children: React.ReactNode
  /** When provided, renders as interactive <button> with hover effects */
  onClick?: () => void
  /** Visual dim for hidden/toggled-off state */
  dimmed?: boolean
  className?: string
  style?: React.CSSProperties
  title?: string
}

export const ColorBadge = React.memo(function ColorBadge({
  color,
  children,
  onClick,
  dimmed,
  className,
  style,
  title,
}: ColorBadgeProps) {
  const Tag = onClick ? 'button' : 'span'

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
        onClick && 'transition-all duration-theme cursor-pointer hover:brightness-125 hover:scale-105',
        className,
      )}
      style={{ ...colorStyle, ...style }}
    >
      {children}
    </Tag>
  )
})
