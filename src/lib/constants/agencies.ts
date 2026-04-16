export const DIVE_AGENCIES = ['PADI', 'SSI', 'NAUI', 'BSAC', 'CMAS'] as const

export const DIVE_AGENCIES_EXTENDED = [
  ...DIVE_AGENCIES,
  'TDI',
  'SDI',
  'RAID',
  'GUE',
  'IANTD',
] as const

export {
  type AgencySpecialtyEntry,
  type AgencySpecialty,
  type AgencyCourse,
  type AgencyDefinition,
  AGENCIES,
  AGENCY_CODES,
  AOW_REQUIRED_SPECIALTY_COUNT,
  COURSE_DAY_RANGES,
  getMandatorySpecialties,
  getDefaultSpecialties,
} from '../../../convex/shared/activityCatalog'
