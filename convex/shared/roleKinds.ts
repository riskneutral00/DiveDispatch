import type { TableNames } from '../_generated/dataModel'

export const PERSON_ROLES = ['Instructor', 'Agent'] as const
export const ENTITY_ROLES = ['DiveCenter', 'Equipment', 'Boat', 'Compressor', 'Venue'] as const

export type PersonRole = (typeof PERSON_ROLES)[number]
export type EntityRole = (typeof ENTITY_ROLES)[number]
export type StakeholderRole = PersonRole | EntityRole

export type RoleKind = 'person' | 'entity'

interface RoleSpec {
  table: TableNames
  kind: RoleKind
}

export const ROLE_SPECS = {
  Instructor: { table: 'diveStaff', kind: 'person' },
  Agent: { table: 'agents', kind: 'person' },
  DiveCenter: { table: 'diveCenters', kind: 'entity' },
  Equipment: { table: 'equipment', kind: 'entity' },
  Boat: { table: 'boats', kind: 'entity' },
  Venue: { table: 'venues', kind: 'entity' },
  Compressor: { table: 'compressors', kind: 'entity' },
} as const satisfies Record<StakeholderRole, RoleSpec>

const PERSON_ROLE_SET = new Set<string>(PERSON_ROLES)
const ENTITY_ROLE_SET = new Set<string>(ENTITY_ROLES)

export const isPersonRole = (r: string): r is PersonRole => PERSON_ROLE_SET.has(r)
export const isEntityRole = (r: string): r is EntityRole => ENTITY_ROLE_SET.has(r)

export function tableForRole<R extends StakeholderRole>(role: R): (typeof ROLE_SPECS)[R]['table'] {
  return ROLE_SPECS[role].table
}

export function kindForRole<R extends StakeholderRole>(role: R): (typeof ROLE_SPECS)[R]['kind'] {
  return ROLE_SPECS[role].kind
}
