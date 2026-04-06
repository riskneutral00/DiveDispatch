import { AlertTriangle, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface ErrorAlertProps {
  children: ReactNode
  /** 'error' uses destructive color, 'warning' uses warning color. Default: 'error'. */
  variant?: 'error' | 'warning'
  /** 'sm' uses text-xs with tighter padding. Default: 'md'. */
  size?: 'sm' | 'md'
  /** Override the default AlertTriangle icon. */
  icon?: LucideIcon
  /** Icon size in pixels. Default: 15. */
  iconSize?: number
  className?: string
}

/**
 * Inline error/warning alert with AlertTriangle icon.
 * Consolidates the repeated pattern of AlertTriangle + styled div
 * found across booking, portal, and dialog components.
 */
const sizeMap = { sm: 'text-xs py-2', md: 'text-sm py-2.5' } as const

export function ErrorAlert({
  children,
  variant = 'error',
  size = 'md',
  icon: Icon = AlertTriangle,
  iconSize = 15,
  className,
}: ErrorAlertProps) {
  const color = variant === 'error' ? 'var(--color-destructive)' : 'var(--color-warning)'
  const borderMix = variant === 'error'
    ? 'color-mix(in srgb, var(--color-destructive) 30%, transparent)'
    : 'color-mix(in srgb, var(--color-warning) 40%, transparent)'

  return (
    <div
      className={cn('flex items-start gap-2 rounded-theme px-3', sizeMap[size], className)}
      style={{
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
        border: `1px solid ${borderMix}`,
        color,
      }}
      role="alert"
    >
      <Icon size={iconSize} className="flex-shrink-0 mt-0.5" aria-hidden />
      <span>{children}</span>
    </div>
  )
}
