export const ROLE_PRECEDENCE: Record<string, number> = {
  DiveCenter: 0,
  Agent: 1,
  Liveaboard: 2,
  DiveResort: 3,
  DiveHostel: 4,
  Instructor: 6,
  Boat: 8,
  Equipment: 9,
  Venue: 10,
  Compressor: 11,
}

export function deriveDefaultRole(roles: string[]): string {
  if (roles.length === 0) throw new Error('User has no roles')
  const sorted = [...roles].sort(
    (a, b) => (ROLE_PRECEDENCE[a] ?? Infinity) - (ROLE_PRECEDENCE[b] ?? Infinity),
  )
  return sorted[0]
}
