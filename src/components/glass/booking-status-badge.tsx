'use client'

import { STATUS_COLORS, type CalendarDisplayStatus } from '@/lib/constants/status-colors'

interface BookingStatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
  className?: string
}

export function BookingStatusBadge({ status, size = 'sm', className }: BookingStatusBadgeProps) {
  const key = status as CalendarDisplayStatus
  const colors = STATUS_COLORS[key]

  if (!colors) {
    return (
      <span
        className={`inline-flex items-center font-medium rounded-full ${
          size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
        }${className ? ` ${className}` : ''}`}
        style={{
          background: 'var(--color-glass-bg)',
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-glass-border)',
        }}
      >
        {status}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      }${className ? ` ${className}` : ''}`}
      style={{
        background: colors.bgVar,
        color: colors.textVar,
        border: `1px solid ${colors.borderVar}`,
      }}
    >
      {status}
    </span>
  )
}
