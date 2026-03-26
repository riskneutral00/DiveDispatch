/**
 * Role precedence — single source of truth for default role computation.
 *
 * When a user holds multiple roles, the highest-precedence role determines
 * their default dashboard landing. Lower number = higher precedence.
 *
 * Order: operators first, then resources, matching the ROLES array
 * in src/lib/constants/roles.ts.
 */

/** Precedence index — lower number = higher precedence. */
export const ROLE_PRECEDENCE: Record<string, number> = {
  DiveCenter: 0,
  Agent: 1,
  Liveaboard: 2,
  DiveResort: 3,
  DiveHostel: 4,
  DiveSite: 5,
  Instructor: 6,
  DiveMaster: 7,
  Boat: 8,
  Equipment: 9,
  Pool: 10,
  Compressor: 11,
}

/**
 * Return the highest-precedence role from a list of assigned roles.
 * Used for default dashboard routing when no active role context exists.
 */
export function deriveDefaultRole(roles: string[]): string {
  if (roles.length === 0) throw new Error('User has no roles')
  const sorted = [...roles].sort(
    (a, b) => (ROLE_PRECEDENCE[a] ?? Infinity) - (ROLE_PRECEDENCE[b] ?? Infinity),
  )
  return sorted[0]
}
