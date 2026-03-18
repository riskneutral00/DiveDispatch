'use client'

import { STATUS_COLORS, type CalendarDisplayStatus } from '@/lib/constants/status-colors'

interface BookingBarProps {
  id: string
  label: string
  subLabel?: string
  status: CalendarDisplayStatus
  startCol: number
  endCol: number
  row: number
  top?: number
  onClick?: (id: string) => void
  className?: string
}

export const BAR_ROW_HEIGHT = 28

export function BookingBar({
  id,
  label,
  subLabel,
  status,
  startCol,
  endCol,
  row,
  top,
  onClick,
  className,
}: BookingBarProps) {
  const colors = STATUS_COLORS[status]
  const span = endCol - startCol + 1
  const topVal = top !== undefined ? top : row * BAR_ROW_HEIGHT

  return (
    <button
      type="button"
      onClick={onClick ? () => onClick(id) : undefined}
      className={`absolute rounded-r-[6px] px-1.5 text-left transition-[transform,filter] duration-150 ease-out hover:scale-[1.01] hover:brightness-95${status === 'Urgent' ? ' urgent-pulse' : ''}${className ? ` ${className}` : ''}`}
      style={{
        left: `calc(${(startCol / 7) * 100}% + 2px)`,
        width: `calc(${(span / 7) * 100}% - 4px)`,
        top: `${topVal}px`,
        height: `${BAR_ROW_HEIGHT - 2}px`,
        background: status === 'Urgent' ? 'var(--color-status-urgent)' : colors.bgVar,
        color: status === 'Urgent' ? '#ffffff' : colors.textVar,
        borderLeft: `3px solid ${colors.borderVar}`,
        borderTop: `1px solid ${colors.borderVar}`,
        borderRight: `1px solid ${colors.borderVar}`,
        borderBottom: `1px solid ${colors.borderVar}`,
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          fontSize: '10px',
          fontWeight: 600,
          lineHeight: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}{subLabel ? ` · ${subLabel}` : ''}
      </span>
    </button>
  )
}
