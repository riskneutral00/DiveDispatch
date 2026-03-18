/**
 * Dive certification agency constants.
 *
 * DIVE_AGENCIES — the 5 major agencies used by individual profiles
 *   (instructor, divemaster, agent, customer portal).
 *
 * DIVE_AGENCIES_EXTENDED — the full 10-agency list used by dive centers,
 *   which may hold affiliations with smaller / technical agencies.
 */

export const DIVE_AGENCIES = ['PADI', 'SSI', 'NAUI', 'BSAC', 'CMAS'] as const

export const DIVE_AGENCIES_EXTENDED = [
  ...DIVE_AGENCIES,
  'TDI',
  'SDI',
  'RAID',
  'GUE',
  'IANTD',
] as const
