import { getDaysOfWeek } from '@/lib/utils/calendar-range'
import { Card } from '@/components/ui'

interface CalendarShellProps {
  header: React.ReactNode
  todayCol?: number
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function CalendarShell({
  header,
  todayCol,
  children,
  footer,
  className,
}: CalendarShellProps) {
  const dayHeaders = getDaysOfWeek()

  return (
    <Card className={className} hoverable>
      {header}

      <div className="overflow-x-auto">
        <div className="min-w-[320px] overflow-hidden">
          <div
            className="grid grid-cols-7 glass-divider" /* design-ok: calendar week layout, fixed 7-day grid */
          >
            {dayHeaders.map((day, i) => (
              <div
                key={day}
                className="py-1.5 text-center text-[10px] sm:text-label font-bold uppercase tracking-widest" /* design-ok: calendar day-of-week header chrome, intentionally below text-label on mobile */
                style={{
                  color:
                    i === todayCol
                      ? 'var(--color-text-primary)'
                      : 'var(--color-text-secondary)',
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {children}
        </div>
      </div>

      {footer && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-3 md:px-5 py-3 border-t border-glass-border"
        >
          {footer}
        </div>
      )}

    </Card>
  )
}
