/**
 * Seed data constants for E2E tests.
 * All email addresses follow the pattern: {slug}+clerk_test@divedispatch.dev
 * All seed user passwords: REDACTED
 *
 * Slugs come from convex/seedData.ts — must stay in sync.
 * Multi-role operators use their primary role slug for dashboard paths.
 */

// ── Operator: DiveCenter ───────────────────────────────────────────────────────

/** Hug Ocean — multi-role: DC + Boat + Pool + Equipment (slug: n7rq5j) */
export const HUG_OCEAN = {
  email: 'hug-ocean+clerk_test@divedispatch.dev',
  slug: 'n7rq5j',
  roleKey: 'dive-center',
  dashboardPath: '/dive-center/n7rq5j/dashboard',
} as const

/** Nicole Dive Center — multi-role: DC + Equipment (slug: q9bz7r) */
export const NICOLE = {
  email: 'nicole-dive-center+clerk_test@divedispatch.dev',
  slug: 'q9bz7r',
  roleKey: 'dive-center',
  dashboardPath: '/dive-center/q9bz7r/dashboard',
} as const

/** Sirolo — multi-role: DC + Boat + Equipment (slug: sirolo) */
export const SIROLO = {
  email: 'sirolo+clerk_test@divedispatch.dev',
  slug: 'sirolo',
  roleKey: 'dive-center',
  dashboardPath: '/dive-center/sirolo/dashboard',
} as const

// ── Instructors ───────────────────────────────────────────────────────────────

export const RYAN_CLARKE = {
  email: 'ryan-clarke+clerk_test@divedispatch.dev',
  slug: 'ryan-clarke',
  roleKey: 'instructor',
  dashboardPath: '/instructor/ryan-clarke/dashboard',
} as const

// ── DiveMasters ──────────────────────────────────────────────────────────────

export const ARISA = {
  email: 'arisa-kanchanaburi+clerk_test@divedispatch.dev',
  slug: 'arisa-kanchanaburi',
  roleKey: 'dive-master',
  dashboardPath: '/dive-master/arisa-kanchanaburi/dashboard',
} as const

// ── Agent ─────────────────────────────────────────────────────────────────────

/** Amanda — primary Agent role seed user (slug: r5yz4q) */
export const AMANDA = {
  email: 'amanda+clerk_test@divedispatch.dev',
  slug: 'r5yz4q',
  roleKey: 'agent',
  dashboardPath: '/agent/r5yz4q/dashboard',
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
