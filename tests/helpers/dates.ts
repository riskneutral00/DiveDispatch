// ── Test Date Helpers ─────────────────────────────────────────────────────────
// All test dates should be relative to "today" so tests never break due to
// calendar rollover. No hardcoded date strings in test files.

import { addDays, toISODateString } from '../../src/lib/utils/date'

/** Returns an ISO date string N days from today. Positive = future, negative = past. */
export function testDate(daysFromNow: number): string {
  return addDays(toISODateString(new Date()), daysFromNow)
}

/** Returns today's ISO date string. */
export function today(): string {
  return toISODateString(new Date())
}

/** Passport expiry N years in the future. Always valid. */
export function passportExpiry(yearsOut = 5): string {
  return testDate(yearsOut * 365)
}

/** Date of birth N years in the past. */
export function dob(yearsAgo = 25): string {
  return testDate(-yearsAgo * 365)
}

/**
 * Strip leading zero from month in an ISO date to produce a deliberately
 * malformed date string (e.g. "2026-4-15" instead of "2026-04-15").
 * Used to test format-mismatch error paths.
 */
export function malformedDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${y}-${parseInt(m, 10)}-${d}`
}

// ── Deterministic Token Helper ──────────────────────────────────────────────
// Replaces Math.random() in tests. Counter resets per test run — no collisions
// within a single vitest execution.

let _tokenCounter = 0

/** Returns a deterministic, unique token string for test fixtures. */
export function testToken(prefix = 'tok'): string {
  return `${prefix}-${++_tokenCounter}`
}
