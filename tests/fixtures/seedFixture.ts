/**
 * Shared seed helpers for convex-test integration tests.
 *
 * Each helper accepts a MutationCtx (from t.run() or t.withIdentity().run())
 * and inserts the minimum required fields. Overrides let individual tests
 * customise only what matters for that scenario.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any

// ─── Well-known test identifiers ──────────────────────────────────────────────

export const TEST_TOKENS = {
  diveCenter: 'test|dc-user',
  instructor: 'test|instr-user',
  other: 'test|other-user',
} as const

export const TEST_SLUGS = {
  diveCenter: 'blue-ocean',
  instructor: 'instructor-john',
  em: 'em-slug',
  other: 'other-user',
} as const

// ─── User seeds ───────────────────────────────────────────────────────────────

export async function seedUser(
  ctx: AnyCtx,
  overrides: {
    tokenIdentifier?: string
    slug?: string
    role?: string
    email?: string
    name?: string
    firstName?: string
    lastName?: string
    businessName?: string
    blockedDates?: string[]
  } = {},
) {
  return ctx.db.insert('users', {
    tokenIdentifier: overrides.tokenIdentifier ?? TEST_TOKENS.diveCenter,
    slug: overrides.slug ?? TEST_SLUGS.diveCenter,
    email: overrides.email ?? 'test@test.com',
    name: overrides.name ?? 'Test User',
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
    businessName: overrides.businessName ?? 'Test Business',
    role: overrides.role ?? 'DiveCenter',
    isSeeded: true,
    preferredLocale: 'en',
    ...(overrides.blockedDates !== undefined ? { blockedDates: overrides.blockedDates } : {}),
  })
}

// ─── Inventory seeds ──────────────────────────────────────────────────────────

export async function seedInventoryUnit(
  ctx: AnyCtx,
  overrides: {
    resourceType?: string
    displayName?: string
    capacityModel?: 'Exclusive' | 'Pooled'
    totalUnits?: number
    ownerId?: string
    ownerType?: string
  } = {},
) {
  const resourceType = overrides.resourceType ?? 'Instructor'
  const ownerId = overrides.ownerId ?? TEST_SLUGS.instructor
  const ownerType = overrides.ownerType ?? resourceType
  return ctx.db.insert('inventoryUnits', {
    resourceType,
    resourceId: ownerId,
    displayName: overrides.displayName ?? 'John Doe',
    capacityModel: overrides.capacityModel ?? 'Exclusive',
    totalUnits: overrides.totalUnits ?? 1,
    ownerId,
    ownerType,
  })
}

// ─── Availability seeds ───────────────────────────────────────────────────────

export async function seedSnapshot(
  ctx: AnyCtx,
  inventoryUnitId: string,
  overrides: {
    date?: string
    windowStart?: string
    windowEnd?: string
    totalUnits?: number
    reservedUnits?: number
    availableUnits?: number
  } = {},
) {
  const totalUnits = overrides.totalUnits ?? 1
  const reservedUnits = overrides.reservedUnits ?? 0
  const availableUnits = overrides.availableUnits ?? totalUnits - reservedUnits
  return ctx.db.insert('availabilitySnapshots', {
    inventoryUnitId,
    date: overrides.date ?? '2024-06-01',
    windowStart: overrides.windowStart ?? '08:00',
    windowEnd: overrides.windowEnd ?? '16:00',
    totalUnits,
    reservedUnits,
    availableUnits,
  })
}

// ─── Notification seeds ───────────────────────────────────────────────────────

export async function seedNotification(
  ctx: AnyCtx,
  overrides: {
    userId?: string
    type?: string
    message?: string
    readAt?: number
    createdAt?: number
  } = {},
) {
  return ctx.db.insert('notifications', {
    userId: overrides.userId ?? TEST_SLUGS.diveCenter,
    type: overrides.type ?? 'hold_placed',
    message: overrides.message ?? 'Test notification',
    createdAt: overrides.createdAt ?? Date.now(),
    ...(overrides.readAt !== undefined ? { readAt: overrides.readAt } : {}),
  })
}
