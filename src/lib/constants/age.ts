export const MIN_BIRTH_YEAR = 1900
export const MIN_AGE_YEARS = 13

export function maxBirthDate(now: Date = new Date()): string {
  const year = now.getUTCFullYear() - MIN_AGE_YEARS
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = String(now.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function minBirthDate(): string {
  return `${MIN_BIRTH_YEAR}-01-01`
}
