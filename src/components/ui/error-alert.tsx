import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface ErrorAlertProps {
  children: ReactNode
  /** 'error' uses destructive color, 'warning' uses warning color. Default: 'error'. */
  variant?: 'error' | 'warning'
  /** Icon size in pixels. Default: 15. */
  iconSize?: number
  className?: string
}

/**
 * Inline error/warning alert with AlertTriangle icon.
 * Consolidates the repeated pattern of AlertTriangle + styled div
 * found across booking, portal, and dialog components.
 */
export function ErrorAlert({
  children,
  variant = 'error',
  iconSize = 15,
  className,
}: ErrorAlertProps) {
  const color = variant === 'error' ? 'var(--color-destructive)' : 'var(--color-warning, #fbbf24)'
  const borderMix = variant === 'error'
    ? 'color-mix(in srgb, var(--color-destructive) 30%, transparent)'
    : 'color-mix(in srgb, var(--color-warning) 40%, transparent)'

  return (
    <div
      className={cn('flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm', className)}
      style={{
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
        border: `1px solid ${borderMix}`,
        color,
      }}
      role="alert"
    >
      <AlertTriangle size={iconSize} className="flex-shrink-0 mt-0.5" aria-hidden />
      <span>{children}</span>
    </div>
  )
}
