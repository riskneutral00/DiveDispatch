/**
 * AOW specialty selection — derived from agency catalogs.
 *
 * Pure data — no framework dependencies. Lives in convex/shared/ so both
 * server (convex/) and client (src/lib/) can import.
 *
 * AOW-eligible specialties = those with an adventure dive version in the PADI
 * catalog (canonical ordering source). Split into main (shown by default)
 * and overflow ("More..." button).
 */

import { AGENCIES, type AgencySpecialtyEntry } from './agencies'

export type { AgencySpecialtyEntry }

export interface AowSpecialty {
  value: string
  label: string
  overflow?: true
}

// Derive AOW-eligible specialties from PADI catalog — only those with adventure dives
const PADI_AOW = AGENCIES.PADI.specialties.filter(
  (s) => s.adventureDiveName !== null,
)

// Main topics (shown by default) — first 10 adventure-dive specialties
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

// Build AOW_SPECIALTIES with stable ordering: main first, overflow second
const mainEntries: AowSpecialty[] = []
const overflowEntries: AowSpecialty[] = []

for (const s of PADI_AOW) {
  if (MAIN_CODES.has(s.code)) {
    mainEntries.push({ value: s.code, label: s.label })
  } else {
    overflowEntries.push({ value: s.code, label: s.label, overflow: true })
  }
}

// Stable main order matching the original file
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

/** Valid AOW specialty code. */
export type AowSpecialtyValue = (typeof AOW_SPECIALTIES)[number]['value']

export const AOW_MAIN = AOW_SPECIALTIES.filter((s) => !('overflow' in s))
export const AOW_OVERFLOW = AOW_SPECIALTIES.filter((s) => 'overflow' in s)

export const MANDATORY_AOW_SPECIALTIES = new Set<string>(
  AGENCIES.PADI.specialties
    .filter((s) => s.requiredForAOW)
    .map((s) => s.code),
)

/** All valid AOW specialty value strings. */
export const AOW_SPECIALTY_VALUES = AOW_SPECIALTIES.map((s) => s.value)
