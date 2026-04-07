export function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return dateStr(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

export const COURSE_DURATIONS: Record<string, number> = {
  DSD: 1,
  TRY_DIVE: 1,
  OW: 3,
  AOW: 2,
  FD: 1,
  RESCUE: 3,
  DM: 5,
  REFRESH: 1,
  SPECIALTY: 2,
}
