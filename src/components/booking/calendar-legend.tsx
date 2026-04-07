'use client'

import { STATUS_COLORS, type CalendarDisplayStatus } from '@/lib/constants/status-colors'
import type { StatusColorSet } from '@/lib/constants/vessel-colors'
import { ColorBadge } from '@/components/ui/color-badge'

export type CustomLegendItem = {
  key: string
  label: string
  color: StatusColorSet
}

interface CalendarLegendProps {
  statuses?: CalendarDisplayStatus[]
  hiddenStatuses?: Set<CalendarDisplayStatus>
  onToggle?: (status: CalendarDisplayStatus) => void
  customItems?: CustomLegendItem[]
  hiddenKeys?: Set<string>
  onToggleKey?: (key: string) => void
  showBlocked?: boolean
  blockedHidden?: boolean
  onToggleBlocked?: () => void
  className?: string
}

const DEFAULT_STATUSES: CalendarDisplayStatus[] = ['Active', 'Draft', 'Upcoming', 'Completed']

const BLOCKED_COLOR = {
  textVar: 'var(--color-blocked)',
  bgVar: 'var(--color-blocked-bg)',
  borderVar: 'var(--color-blocked-border)',
}

const PILL_FONT: React.CSSProperties = { fontSize: 'clamp(9px, 1.8vw, 12px)' } /* design-ok: responsive legend pill */

export function CalendarLegend({
  statuses = DEFAULT_STATUSES,
  hiddenStatuses,
  onToggle,
  customItems,
  hiddenKeys,
  onToggleKey,
  showBlocked,
  blockedHidden,
  onToggleBlocked,
  className,
}: CalendarLegendProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-1.5${className ? ` ${className}` : ''}`}
    >
      {customItems ? customItems.map((item) => {
        const isHidden = hiddenKeys?.has(item.key) ?? false
        return (
          <ColorBadge
            key={item.key}
            color={item.color}
            dimmed={isHidden}
            onClick={onToggleKey ? () => onToggleKey(item.key) : undefined}
            title={onToggleKey ? (isHidden ? `Show ${item.label}` : `Hide ${item.label}`) : undefined}
            style={PILL_FONT}
          >
            {item.label}
          </ColorBadge>
        )
      }) :

      statuses.map((status) => {
        const isHidden = hiddenStatuses?.has(status) ?? false
        return (
          <ColorBadge
            key={status}
            color={STATUS_COLORS[status]}
            dimmed={isHidden}
            onClick={onToggle ? () => onToggle(status) : undefined}
            title={onToggle ? (isHidden ? `Show ${status}` : `Hide ${status}`) : undefined}
            style={PILL_FONT}
          >
            {status}
          </ColorBadge>
        )
      })}

      {showBlocked && (
        <ColorBadge
          color={BLOCKED_COLOR}
          dimmed={blockedHidden}
          onClick={onToggleBlocked}
          title={onToggleBlocked ? (blockedHidden ? 'Show Blocked' : 'Hide Blocked') : undefined}
          style={PILL_FONT}
        >
          Blocked
        </ColorBadge>
      )}
    </div>
  )
}
