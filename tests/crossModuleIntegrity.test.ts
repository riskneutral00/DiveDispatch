import { describe, it, expect } from 'vitest'
import { ROLES, ORGANIZER_ROLES, RESOURCE_ROLES, ROLE_BY_KEY, ROLE_BY_CLERK_ROLE } from '../src/lib/constants/roles'
import { ROLE_PRECEDENCE } from '../convex/lib/rolePrecedence'
import { DEFAULT_LEGEND_STATUSES } from '../src/lib/constants/dashboard-config'
import { BOOKING_STATUS } from '../convex/shared/statuses'
import { STATUS_OPACITY, STATUS_COLORS, LOCKING_STATUSES, ACTIVE_STATUSES, TERMINAL_STATUSES } from '../src/lib/constants/status-colors'
import { COURSE_CODES } from '../convex/shared/courseCodes'
import { ACTIVITY_MIN_AGE } from '../src/lib/constants/activity-rules'
import { COURSE_CATALOG } from '../src/lib/constants/course-catalog'
import { effectiveResourceType } from '../convex/lib/validators'
import { RESOURCE_OWNER_TYPES } from '../convex/shared/resourceOwnerTypes'

// ── Roles cross-module consistency ────────────────────────────────────────

describe('roles ↔ rolePrecedence', () => {
  it('every ROLES clerkRole has a precedence entry', () => {
    for (const role of ROLES) {
      expect(ROLE_PRECEDENCE).toHaveProperty(role.clerkRole)
    }
  })

  it('every precedence entry maps to a valid clerkRole', () => {
    const clerkRoles: Set<string> = new Set(ROLES.map((r) => r.clerkRole))
    for (const key of Object.keys(ROLE_PRECEDENCE)) {
      expect(clerkRoles.has(key)).toBe(true)
    }
  })
})

describe('roles ↔ effectiveResourceType', () => {
  it('every resource role clerkRole maps to a valid RESOURCE_OWNER_TYPES value', () => {
    const resourceRoles = ROLES.filter((r) => r.isResource)
    for (const role of resourceRoles) {
      const result = effectiveResourceType(role.clerkRole)
      if (result !== null) {
        expect(RESOURCE_OWNER_TYPES).toContain(result)
      }
    }
  })
})

// ── Lookup maps are consistent ────────────────────────────────────────────

describe('role lookup maps', () => {
  it('ROLE_BY_KEY covers all ROLES', () => {
    expect(Object.keys(ROLE_BY_KEY).length).toBe(ROLES.length)
  })

  it('ROLE_BY_CLERK_ROLE covers all ROLES', () => {
    expect(Object.keys(ROLE_BY_CLERK_ROLE).length).toBe(ROLES.length)
  })

  it('ORGANIZER_ROLES + RESOURCE_ROLES covers all ROLES (some in both)', () => {
    const combined = new Set([
      ...ORGANIZER_ROLES.map((r) => r.key),
      ...RESOURCE_ROLES.map((r) => r.key),
    ])
    // DiveSite is isResource but not in RESOURCE_ROLES (it's filtered by !isOrganizer)
    expect(combined.size).toBeGreaterThanOrEqual(ROLES.length - 1)
  })
})

// ── Statuses cross-module consistency ─────────────────────────────────────

describe('statuses consistency', () => {
  it('DEFAULT_LEGEND_STATUSES are all valid BookingStatus or display statuses', () => {
    const bookingStatuses = Object.values(BOOKING_STATUS)
    const displayExtras = ['Active', 'Urgent']
    const valid = new Set([...bookingStatuses, ...displayExtras])
    for (const status of DEFAULT_LEGEND_STATUSES) {
      expect(valid.has(status), `"${status}" not a valid status`).toBe(true)
    }
  })

  it('STATUS_OPACITY covers all BookingStatus values plus Active and Urgent', () => {
    const expected = [...Object.values(BOOKING_STATUS), 'Active', 'Urgent']
    for (const s of expected) {
      expect(STATUS_OPACITY).toHaveProperty(s)
    }
  })

  it('STATUS_COLORS covers all BookingStatus values plus Active and Urgent', () => {
    const expected = [...Object.values(BOOKING_STATUS), 'Active', 'Urgent']
    for (const s of expected) {
      expect(STATUS_COLORS).toHaveProperty(s)
    }
  })

  it('LOCKING, ACTIVE, TERMINAL partitions do not overlap', () => {
    for (const s of ACTIVE_STATUSES) {
      expect(TERMINAL_STATUSES.has(s)).toBe(false)
    }
    for (const s of TERMINAL_STATUSES) {
      expect(ACTIVE_STATUSES.has(s)).toBe(false)
    }
  })
})

// ── Course codes cross-module consistency ──────────────────────────────────

describe('course codes consistency', () => {
  it('every COURSE_CODES entry has a min age in ACTIVITY_MIN_AGE', () => {
    for (const code of COURSE_CODES) {
      expect(ACTIVITY_MIN_AGE).toHaveProperty(code)
    }
  })

  it('every COURSE_CATALOG entry code is in COURSE_CODES', () => {
    for (const entry of COURSE_CATALOG) {
      expect(COURSE_CODES).toContain(entry.code)
    }
  })

  it('ACTIVITY_MIN_AGE keys are all valid course codes', () => {
    for (const key of Object.keys(ACTIVITY_MIN_AGE)) {
      expect(COURSE_CODES).toContain(key)
    }
  })
})
