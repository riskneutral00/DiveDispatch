export const ROLE_PRECEDENCE: Record<string, number> = {
  Agent: 0,
  DiveCenter: 1,
  Venue: 2,
  Boat: 3,
  Equipment: 4,
  Compressor: 5,
  Instructor: 6,
}

export function deriveDefaultRole(roles: string[]): string {
  if (roles.length === 0) throw new Error('User has no roles')
  const sorted = [...roles].sort(
    (a, b) => (ROLE_PRECEDENCE[a] ?? Infinity) - (ROLE_PRECEDENCE[b] ?? Infinity),
  )
  return sorted[0]
}
