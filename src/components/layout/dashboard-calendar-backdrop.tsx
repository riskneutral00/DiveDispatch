'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/** Bleed outside the calendar box; widen wrapper or reduce inset to change scope later. */
const BLEED_INSET = '-inset-2'

/**
 * Dashboard-only elevation ring around the calendar (box-shadow). Full-page skin +
 * vignette paint on `.bg-base`. `globals-surfaces` sets `background-image: none` here;
 * when a skin uses `url(...)` for `--bg-image`, re-enable background on this layer if
 * you want a photo only behind the calendar.
 */
export function DashboardCalendarBackdrop({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'dashboard-calendar-backdrop pointer-events-none absolute z-0 rounded-xl',
          BLEED_INSET,
        )}
        aria-hidden
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
