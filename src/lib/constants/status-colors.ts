export type BookingStatus = 'Draft' | 'Upcoming' | 'Completed' | 'Cancelled'

export type CalendarDisplayStatus = BookingStatus | 'Active' | 'Urgent' | 'MultiDay'

export const LOCKING_STATUSES: ReadonlySet<CalendarDisplayStatus> = new Set([
  'Active',
  'Upcoming',
  'Completed',
])

export const ACTIVE_STATUSES: ReadonlySet<CalendarDisplayStatus> = new Set(['Draft', 'Upcoming'])

export const TERMINAL_STATUSES: ReadonlySet<CalendarDisplayStatus> = new Set([
  'Cancelled',
  'Completed',
])

// Opacity for booking bars — Draft faded, Completed muted, others full
export const STATUS_OPACITY: Record<CalendarDisplayStatus, number> = {
  Active: 1.0,
  Draft: 1.0,
  Upcoming: 1.0,
  Completed: 0.6,
  Cancelled: 0,
  Urgent: 1.0,
  MultiDay: 1.0,
}

// Border style — Draft uses dashed to signal incomplete state
export const STATUS_BORDER_STYLE: Record<CalendarDisplayStatus, 'dashed' | 'solid'> = {
  Active: 'solid',
  Draft: 'solid',
  Upcoming: 'solid',
  Completed: 'solid',
  Cancelled: 'solid',
  Urgent: 'solid',
  MultiDay: 'solid',
}

// CSS custom property keys — defined in globals.css
export const STATUS_COLORS: Record<
  CalendarDisplayStatus,
  {
    textVar: string
    bgVar: string
    borderVar: string
    dotVar: string
  }
> = {
  Active: {
    textVar: 'var(--color-status-active)',
    bgVar: 'var(--color-status-active-bg)',
    borderVar: 'var(--color-status-active-border)',
    dotVar: 'var(--color-status-active)',
  },
  Draft: {
    textVar: 'var(--color-status-draft)',
    bgVar: 'var(--color-status-draft-bg)',
    borderVar: 'var(--color-status-draft-border)',
    dotVar: 'var(--color-status-draft)',
  },
  Upcoming: {
    textVar: 'var(--color-status-upcoming)',
    bgVar: 'var(--color-status-upcoming-bg)',
    borderVar: 'var(--color-status-upcoming-border)',
    dotVar: 'var(--color-status-upcoming)',
  },
  Completed: {
    textVar: 'var(--color-status-completed)',
    bgVar: 'var(--color-status-completed-bg)',
    borderVar: 'var(--color-status-completed-border)',
    dotVar: 'var(--color-status-completed)',
  },
  Cancelled: {
    textVar: 'var(--color-status-cancelled)',
    bgVar: 'var(--color-status-cancelled-bg)',
    borderVar: 'var(--color-status-cancelled-border)',
    dotVar: 'var(--color-status-cancelled)',
  },
  Urgent: {
    textVar: 'var(--color-status-urgent)',
    bgVar: 'var(--color-status-urgent-bg)',
    borderVar: 'var(--color-status-urgent-border)',
    dotVar: 'var(--color-status-urgent)',
  },
  MultiDay: {
    textVar: 'var(--color-status-multiday)',
    bgVar: 'var(--color-status-multiday-bg)',
    borderVar: 'var(--color-status-multiday-border)',
    dotVar: 'var(--color-status-multiday)',
  },
}
