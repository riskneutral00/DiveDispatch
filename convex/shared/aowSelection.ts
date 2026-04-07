import { AGENCIES, type AgencySpecialtyEntry } from './agencies'

export type { AgencySpecialtyEntry }

export interface AowSpecialty {
  value: string
  label: string
  overflow?: true
}

const PADI_AOW = AGENCIES.PADI.specialties.filter(
  (s) => s.adventureDiveName !== null,
)

const MAIN_CODES = new Set([
  'PPB',
  'Navigation',
  'Wreck',
  'Deep',
  'Night',
  'Boat',
  'Drift',
  'Dry Suit',
  'Fish ID',
  'DPV',
])

const mainEntries: AowSpecialty[] = []
const overflowEntries: AowSpecialty[] = []

for (const s of PADI_AOW) {
  if (MAIN_CODES.has(s.code)) {
    mainEntries.push({ value: s.code, label: s.label })
  } else {
    overflowEntries.push({ value: s.code, label: s.label, overflow: true })
  }
}

const MAIN_ORDER = [
  'PPB',
  'Navigation',
  'Wreck',
  'Deep',
  'Night',
  'Boat',
  'Drift',
  'Dry Suit',
  'Fish ID',
  'DPV',
]
mainEntries.sort(
  (a, b) => MAIN_ORDER.indexOf(a.value) - MAIN_ORDER.indexOf(b.value),
)

export const AOW_SPECIALTIES = [
  ...mainEntries,
  ...overflowEntries,
] as const satisfies readonly AowSpecialty[]

export type AowSpecialtyValue = (typeof AOW_SPECIALTIES)[number]['value']

export const AOW_MAIN = AOW_SPECIALTIES.filter((s) => !('overflow' in s))
export const AOW_OVERFLOW = AOW_SPECIALTIES.filter((s) => 'overflow' in s)

export const MANDATORY_AOW_SPECIALTIES = new Set<string>(
  AGENCIES.PADI.specialties
    .filter((s) => s.requiredForAOW)
    .map((s) => s.code),
)

export const AOW_SPECIALTY_VALUES = AOW_SPECIALTIES.map((s) => s.value)
