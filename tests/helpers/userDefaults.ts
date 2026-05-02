import type { Id } from '../../convex/_generated/dataModel'

export const TEST_USER_REQUIRED = {
  phone: '+66812345678',
  dateOfBirth: '1990-01-01',
  tcAcceptedAt: 1700000000000,
  tcVersion: '1.0',
} as const

export function testUserDefaults(organizationId: Id<'organizations'>) {
  return { ...TEST_USER_REQUIRED, organizationId }
}
