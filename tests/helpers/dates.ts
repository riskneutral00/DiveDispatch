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

// ── Deterministic Token Helper ──────────────────────────────────────────────
// Replaces Math.random() in tests. Counter resets per test run — no collisions
// within a single vitest execution.

let _tokenCounter = 0

/** Returns a deterministic, unique token string for test fixtures. */
export function testToken(prefix = 'tok'): string {
  return `${prefix}-${++_tokenCounter}`
}
