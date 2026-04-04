import type { ClerkRole } from './roles'

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
  /** When true, the filter bar renders a multi-select (comma-separated values). */
  multiSelect?: boolean
}

// ── Per-role filter definitions ──────────────────────────────────────────────
// id values must match the filter args accepted by the listByRole query.

export const LANGUAGE_FILTER: FilterDef = {
  id: 'language',
  label: 'Language',
  placeholder: 'All Languages',
  multiSelect: true,
  options: [
    { label: 'All Languages', value: 'all' },
    { label: 'English', value: 'GB' },
    { label: 'Thai', value: 'TH' },
    { label: 'Mandarin', value: 'CN' },
    { label: 'Cantonese', value: 'HK' },
    { label: 'Japanese', value: 'JP' },
    { label: 'Korean', value: 'KR' },
    { label: 'French', value: 'FR' },
    { label: 'German', value: 'DE' },
    { label: 'Russian', value: 'RU' },
    { label: 'Spanish', value: 'ES' },
    { label: 'Italian', value: 'IT' },
    { label: 'Indonesian', value: 'ID' },
  ],
}

export const INSTRUCTOR_FILTERS: FilterDef[] = [
  {
    id: 'agency',
    label: 'Agency',
    placeholder: 'All Agencies',
    multiSelect: true,
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
  LANGUAGE_FILTER,
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
    multiSelect: true,
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

export const ROLE_FILTERS: Record<ClerkRole, FilterDef[]> = {
  Instructor: INSTRUCTOR_FILTERS,
  Boat: BOAT_FILTERS,
  Compressor: COMPRESSOR_FILTERS,
  Equipment: EQUIPMENT_FILTERS,
  DiveCenter: NO_FILTERS,
  Agent: NO_FILTERS,
  Pool: NO_FILTERS,
  DiveMaster: [LANGUAGE_FILTER],
  Liveaboard: NO_FILTERS,
  DiveResort: NO_FILTERS,
  DiveHostel: NO_FILTERS,
  DiveSite: NO_FILTERS,
}
