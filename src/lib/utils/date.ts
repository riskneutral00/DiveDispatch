import { DAY_MS } from '@/lib/constants/time'

export { getDatesInRange, parseDateLocal } from '../../../convex/shared/dateRange'

export function diffDays(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00')
  const b = new Date(dateB + 'T00:00:00')
  return Math.round((a.getTime() - b.getTime()) / DAY_MS)
}

export function toISODateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00')
  date.setDate(date.getDate() + days)
  return toISODateString(date)
}

export function formatDateShort(dateStr: string, locale?: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateRange(start: string, end: string): string {
  if (!start && !end) return '\u2013'
  if (start === end || !end) return start
  return `${start} \u2013 ${end}`
}

export function formatDateRangeLocalized(start: Date, end: Date): string {
  const locale = typeof navigator !== 'undefined' ? navigator.language : undefined
  const sameYear = start.getFullYear() === end.getFullYear()

  const fmtOpts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }

  const startFmt = new Intl.DateTimeFormat(locale, fmtOpts).format(start)
  const endFmt = new Intl.DateTimeFormat(locale, fmtOpts).format(end)
  return `${startFmt} \u2013 ${endFmt}`
}

export function formatDateRangeCompact(startDate: string, endDate: string): string {
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (startDate === endDate) return startLabel
  if (start.getMonth() === end.getMonth() && sy === ey) {
    return `${startLabel}\u2013${ed}`
  }
  const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${startLabel}\u2013${endLabel}`
}
