'use client'

import { STATUS_COLORS, type CalendarDisplayStatus } from '@/lib/constants/status-colors'

interface CalendarLegendProps {
  statuses?: CalendarDisplayStatus[]
  hiddenStatuses?: Set<CalendarDisplayStatus>
  onToggle?: (status: CalendarDisplayStatus) => void
  showBlocked?: boolean
  blockedHidden?: boolean
  onToggleBlocked?: () => void
  className?: string
}

const DEFAULT_STATUSES: CalendarDisplayStatus[] = ['Active', 'Draft', 'Upcoming', 'Completed']

export function CalendarLegend({
  statuses = DEFAULT_STATUSES,
  hiddenStatuses,
  onToggle,
  showBlocked,
  blockedHidden,
  onToggleBlocked,
  className,
}: CalendarLegendProps) {
  return (
    <div
      className={`flex flex-wrap gap-1.5${className ? ` ${className}` : ''}`}
    >
      {statuses.map((status) => {
        const isHidden = hiddenStatuses?.has(status) ?? false
        const colors = STATUS_COLORS[status]

        const pillStyle: React.CSSProperties = isHidden
          ? {
              color: colors.textVar,
              border: `1px solid ${colors.borderVar}`,
              background: 'transparent',
              opacity: 0.55,
            }
          : {
              color: colors.textVar,
              background: colors.bgVar,
              border: `1px solid ${colors.borderVar}`,
            }

        if (onToggle) {
          return (
            <button
              key={status}
              type="button"
              onClick={() => onToggle(status)}
              title={isHidden ? `Show ${status}` : `Hide ${status}`}
              className="rounded-full px-2 py-0.5 font-medium select-none transition-all cursor-pointer"
              style={{ ...pillStyle, fontSize: 'clamp(9px, 1.8vw, 12px)' }}
            >
              {status}
            </button>
          )
        }

        return (
          <div
            key={status}
            className="rounded-full px-2 py-0.5 font-medium select-none"
            style={{ ...pillStyle, fontSize: 'clamp(9px, 1.8vw, 12px)' }}
          >
            {status}
          </div>
        )
      })}

      {showBlocked &&
        (onToggleBlocked ? (
          <button
            type="button"
            onClick={onToggleBlocked}
            title={blockedHidden ? 'Show Blocked' : 'Hide Blocked'}
            className="rounded-full px-2 py-0.5 font-medium select-none transition-all cursor-pointer"
            style={{
              fontSize: 'clamp(9px, 1.8vw, 12px)',
              color: 'var(--color-text-secondary)',
              background: blockedHidden
                ? 'transparent'
                : 'color-mix(in srgb, var(--color-text-secondary) 10%, transparent)',
              border: '1px solid var(--color-glass-border)',
              opacity: blockedHidden ? 0.55 : 1,
            }}
          >
            Blocked
          </button>
        ) : (
          <div
            className="rounded-full px-2 py-0.5 font-medium select-none"
            style={{
              fontSize: 'clamp(9px, 1.8vw, 12px)',
              color: 'var(--color-text-secondary)',
              background: 'color-mix(in srgb, var(--color-text-secondary) 10%, transparent)',
              border: '1px solid var(--color-glass-border)',
            }}
          >
            Blocked
          </div>
        ))}
    </div>
  )
}
