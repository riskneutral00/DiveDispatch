import { AlertTriangle, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface ErrorAlertProps {
  children: ReactNode
  variant?: 'error' | 'warning'
  size?: 'sm' | 'md'
  icon?: LucideIcon
  iconSize?: number
  className?: string
}

const sizeMap = { sm: 'text-label py-2', md: 'text-body py-2.5' } as const

export function ErrorAlert({
  children,
  variant = 'error',
  size = 'md',
  icon: Icon = AlertTriangle,
  iconSize = 15,
  className,
}: ErrorAlertProps) {
  const isError = variant === 'error'
  const color = isError ? 'var(--color-destructive)' : 'var(--color-warning)'

  return (
    <div
      className={cn('flex items-start gap-2 rounded-theme px-3', sizeMap[size], className)}
      style={{
        background: isError ? 'var(--color-alert-error-bg)' : 'var(--color-alert-warning-bg)',
        border: `1px solid ${isError ? 'var(--color-alert-error-border)' : 'var(--color-alert-warning-border)'}`,
        color,
      }}
      role="alert"
    >
      <Icon size={iconSize} className="flex-shrink-0 mt-0.5" aria-hidden />
      <span>{children}</span>
    </div>
  )
}
