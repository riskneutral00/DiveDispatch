'use client'

import { STATUS_COLORS, STATUS_OPACITY, STATUS_BORDER_STYLE, type CalendarDisplayStatus } from '@/lib/constants/status-colors'

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
  const statusColors = STATUS_COLORS[status]
  const opacity = STATUS_OPACITY[status]
  const borderStyle = STATUS_BORDER_STYLE[status]
  const span = endCol - startCol + 1
  const topVal = top !== undefined ? top : row * BAR_ROW_HEIGHT

  return (
    <button
      type="button"
      role="button"
      tabIndex={0}
      onClick={onClick ? () => onClick(id) : undefined}
      className={`glass-surface absolute rounded-r-[6px] px-1.5 text-left transition-[transform,filter,border-color,box-shadow] duration-150 ease-out hover:scale-[1.01] hover:brightness-95${status === 'Urgent' ? ' urgent-pulse' : ''}${className ? ` ${className}` : ''}`}
      style={{
        left: `calc(${(startCol / 7) * 100}% + 2px)`,
        width: `calc(${(span / 7) * 100}% - 4px)`,
        top: `${topVal}px`,
        height: `${BAR_ROW_HEIGHT - 2}px`,
        opacity,
        background: status === 'Urgent'
          ? 'var(--color-status-urgent)'
          : statusColors.bgVar,
        color: status === 'Urgent'
          ? '#ffffff'
          : statusColors.textVar,
        borderLeft: `3px ${borderStyle} ${statusColors.borderVar}`,
        borderTop: `1px ${borderStyle} ${statusColors.borderVar}`,
        borderRight: `1px ${borderStyle} ${statusColors.borderVar}`,
        borderBottom: `1px ${borderStyle} ${statusColors.borderVar}`,
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
