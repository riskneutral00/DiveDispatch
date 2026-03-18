/**
 * Seed data constants for E2E tests.
 * All email addresses follow the pattern: {slug}+clerk_test@divedispatch.dev
 * All seed user passwords: REDACTED
 *
 * Slugs come from convex/seedData.ts — must stay in sync.
 */

// ── Operator: DiveCenter ───────────────────────────────────────────────────────

/** Nicole Dive Center — primary test DiveCenter user (slug: q9bz7r) */
export const NICOLE = {
  email: 'nicole-dive-center+clerk_test@divedispatch.dev',
  slug: 'q9bz7r',
  roleKey: 'dive-center',
  dashboardPath: '/dive-center/q9bz7r/dashboard',
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

// ── Pool ──────────────────────────────────────────────────────────────────────

/** Water Pro pool — primary Pool role seed user (slug: b3wt9f) */
export const WATER_PRO = {
  email: 'water-pro+clerk_test@divedispatch.dev',
  slug: 'b3wt9f',
  roleKey: 'pool',
  dashboardPath: '/pool/b3wt9f/dashboard',
} as const

// ── Compressor ────────────────────────────────────────────────────────────────

/** Compressor Chalong — primary Compressor role seed user (slug: x4kp2m) */
export const COMPRESSOR_CHALONG = {
  email: 'compressor-chalong+clerk_test@divedispatch.dev',
  slug: 'x4kp2m',
  roleKey: 'compressor',
  dashboardPath: '/compressor/x4kp2m/dashboard',
} as const

// ── Agent ─────────────────────────────────────────────────────────────────────

/** Amanda — primary Agent role seed user (slug: r5yz4q) */
export const AMANDA = {
  email: 'amanda+clerk_test@divedispatch.dev',
  slug: 'r5yz4q',
  roleKey: 'agent',
  dashboardPath: '/agent/r5yz4q/dashboard',
} as const

// ── Roles without standalone seed users ───────────────────────────────────────
// Boat, Equipment, DiveMaster have no seed users with those as primary roles.
// They appear only as additionalRoles on DiveCenter users.
// TODO: add seed users for these roles to enable full coverage.

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
