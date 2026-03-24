/**
 * PADI Advanced Open Water specialty options.
 *
 * Navigation and Deep are mandatory for all AOW candidates per PADI standards.
 * Operators choose 3+ additional electives from the remaining list.
 *
 * Labels are shortened for compact pill display. The `value` is the canonical
 * key stored in the database; `label` is what the user sees.
 */

export interface AowSpecialty {
  value: string
  label: string
  overflow?: true
}

export const AOW_SPECIALTIES: AowSpecialty[] = [
  { value: 'PPB', label: 'PPB' },
  { value: 'Navigation', label: 'Navigation' },
  { value: 'Wreck', label: 'Wreck' },
  { value: 'Deep', label: 'Deep' },
  { value: 'Night', label: 'Night' },
  { value: 'Boat', label: 'Boat' },
  { value: 'Drift', label: 'Drift' },
  { value: 'Dry Suit', label: 'Dry Suit' },
  { value: 'Fish ID', label: 'Fish ID' },
  // ── "More..." overflow ────────────────────────────────────────────
  { value: 'Photography', label: 'Photography', overflow: true },
  { value: 'S&R', label: 'S&R', overflow: true },
  { value: 'DUW Photo', label: 'DUW Photo', overflow: true },
]

export const AOW_MAIN = AOW_SPECIALTIES.filter((s) => !s.overflow)
export const AOW_OVERFLOW = AOW_SPECIALTIES.filter((s) => s.overflow)

export const MANDATORY_AOW_SPECIALTIES = new Set<string>([
  'Navigation',
  'Deep',
])
