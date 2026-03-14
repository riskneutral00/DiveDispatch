/**
 * Seed data constants for E2E tests.
 * All email addresses follow the pattern: {slug}+clerk_test@divedispatch.dev
 * All seed user passwords: REDACTED
 */

// ── Operator ─────────────────────────────────────────────────────────────────

export const NICOLE = {
  email: 'nicole-dive-center+clerk_test@divedispatch.dev',
  slug: 'nicole-dive-center',
  roleKey: 'dive-center',
  /** Absolute URL path to Nicole's dashboard */
  dashboardPath: '/dive-center/nicole-dive-center/dashboard',
} as const

// ── Instructors ───────────────────────────────────────────────────────────────

export const JAMES = {
  email: 'james-cooper+clerk_test@divedispatch.dev',
  slug: 'james-cooper',
  roleKey: 'instructor',
  dashboardPath: '/instructor/james-cooper/dashboard',
} as const

export const SARAH = {
  email: 'sarah-mitchell+clerk_test@divedispatch.dev',
  slug: 'sarah-mitchell',
  roleKey: 'instructor',
  dashboardPath: '/instructor/sarah-mitchell/dashboard',
} as const

// ── Booking defaults ──────────────────────────────────────────────────────────

/**
 * A future date far enough out to avoid availability collisions during a test run.
 * Format: YYYY-MM-DD
 */
export function futureDateString(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

export const SEED_PASSWORD = 'REDACTED'
