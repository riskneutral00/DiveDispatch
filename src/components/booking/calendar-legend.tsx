'use client'

import type { ReactNode } from 'react'
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

/** Outer glass frame (Option A). Elevated interaction on the ring; inner ColorBadge keeps shadow-only hover so status fills stay intact. */
const LEGEND_GLASS_FRAME =
  'inline-flex items-center justify-center rounded-full border border-[var(--color-glass-container-border)] p-0.5 glass-surface glass-surface-elevated transition-all duration-theme'

function LegendFrame({ children }: { children: ReactNode }) {
  return <span className={LEGEND_GLASS_FRAME}>{children}</span>
}

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
          <LegendFrame key={item.key}>
            <ColorBadge
              color={item.color}
              dimmed={isHidden}
              hoverEffect="none"
              className="glass-surface"
              onClick={onToggleKey ? () => onToggleKey(item.key) : undefined}
              title={onToggleKey ? (isHidden ? `Show ${item.label}` : `Hide ${item.label}`) : undefined}
              style={PILL_FONT}
            >
              {item.label}
            </ColorBadge>
          </LegendFrame>
        )
      }) :

      statuses.map((status) => {
        const isHidden = hiddenStatuses?.has(status) ?? false
        return (
          <LegendFrame key={status}>
            <ColorBadge
              color={STATUS_COLORS[status]}
              dimmed={isHidden}
              hoverEffect="none"
              className="glass-surface"
              onClick={onToggle ? () => onToggle(status) : undefined}
              title={onToggle ? (isHidden ? `Show ${status}` : `Hide ${status}`) : undefined}
              style={PILL_FONT}
            >
              {status}
            </ColorBadge>
          </LegendFrame>
        )
      })}

      {showBlocked && (
        <LegendFrame key="legend-blocked">
          <ColorBadge
            color={BLOCKED_COLOR}
            dimmed={blockedHidden}
            hoverEffect="none"
            className="glass-surface"
            onClick={onToggleBlocked}
            title={onToggleBlocked ? (blockedHidden ? 'Show Blocked' : 'Hide Blocked') : undefined}
            style={PILL_FONT}
          >
            Blocked
          </ColorBadge>
        </LegendFrame>
      )}
    </div>
  )
}
