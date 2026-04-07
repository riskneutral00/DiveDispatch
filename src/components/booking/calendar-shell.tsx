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
            className="grid grid-cols-7" /* design-ok */
            style={{ borderBottom: '1px solid var(--color-glass-border)' }}
          >
            {dayHeaders.map((day, i) => (
              <div
                key={day}
                className="py-1.5 text-center text-[10px] sm:text-label font-bold uppercase tracking-widest" /* design-ok */
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
          className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-3"
          style={{ borderTop: '1px solid var(--color-glass-border)' }}
        >
          {footer}
        </div>
      )}

    </Card>
  )
}
