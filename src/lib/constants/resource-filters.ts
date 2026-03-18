export type FilterOption = {
  label: string
  value: string
}

export type FilterDef = {
  /** Matches the query arg key in convex/directory.ts */
  id: string
  label: string
  placeholder: string
  options: FilterOption[]
}

// ── Per-role filter definitions ──────────────────────────────────────────────
// id values must match the filter args accepted by the listByRole query.

export const INSTRUCTOR_FILTERS: FilterDef[] = [
  {
    id: 'agency',
    label: 'Agency',
    placeholder: 'All Agencies',
    options: [
      { label: 'All Agencies', value: 'all' },
      { label: 'PADI', value: 'PADI' },
      { label: 'SSI', value: 'SSI' },
      { label: 'NAUI', value: 'NAUI' },
      { label: 'CMAS', value: 'CMAS' },
      { label: 'IANTD', value: 'IANTD' },
      { label: 'TDI', value: 'TDI' },
      { label: 'SDI', value: 'SDI' },
      { label: 'RAID', value: 'RAID' },
      { label: 'BSAC', value: 'BSAC' },
    ],
  },
  // Language picker (id: 'language') is rendered separately by the L5-41
  // LanguagePicker component using the caller's commonLanguageCodes.
]

export const BOAT_FILTERS: FilterDef[] = [
  {
    id: 'minCapacity',
    label: 'Capacity',
    placeholder: 'Any Capacity',
    options: [
      { label: 'Any', value: 'any' },
      { label: '6+ divers', value: '6' },
      { label: '10+ divers', value: '10' },
      { label: '20+ divers', value: '20' },
    ],
  },
]

export const COMPRESSOR_FILTERS: FilterDef[] = [
  {
    id: 'gasMix',
    label: 'Gas Mix',
    placeholder: 'All Gas Mixes',
    options: [
      { label: 'All', value: 'all' },
      { label: 'Air', value: 'air' },
      { label: 'Nitrox', value: 'nitrox' },
      { label: 'Trimix', value: 'trimix' },
    ],
  },
]

export const EQUIPMENT_FILTERS: FilterDef[] = [
  {
    id: 'category',
    label: 'Category',
    placeholder: 'All Categories',
    options: [
      { label: 'All Categories', value: 'all' },
      { label: 'Wetsuits', value: 'wetsuit' },
      { label: 'BCDs', value: 'bcd' },
      { label: 'Fins', value: 'fins' },
      { label: 'Masks', value: 'mask' },
      { label: 'Regulators', value: 'regulator' },
    ],
  },
]

// Roles with no role-specific dropdown filters (search bar only).
export const NO_FILTERS: FilterDef[] = []

// ── Role → filters lookup ─────────────────────────────────────────────────────

type StakeholderRole =
  | 'DiveCenter'
  | 'Agent'
  | 'Instructor'
  | 'Boat'
  | 'Equipment'
  | 'Pool'
  | 'Compressor'
  | 'DiveMaster'
  | 'Liveaboard'
  | 'DiveResort'
  | 'DiveHostel'
  | 'DiveSite'

export const ROLE_FILTERS: Record<StakeholderRole, FilterDef[]> = {
  Instructor: INSTRUCTOR_FILTERS,
  Boat: BOAT_FILTERS,
  Compressor: COMPRESSOR_FILTERS,
  Equipment: EQUIPMENT_FILTERS,
  DiveCenter: NO_FILTERS,
  Agent: NO_FILTERS,
  Pool: NO_FILTERS,
  DiveMaster: NO_FILTERS,
  Liveaboard: NO_FILTERS,
  DiveResort: NO_FILTERS,
  DiveHostel: NO_FILTERS,
  DiveSite: NO_FILTERS,
}
