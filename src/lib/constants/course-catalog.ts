import { COURSE_CODES, type CourseCode } from '../../../convex/shared/courseCodes';
export { COURSE_CODES, type CourseCode } from '../../../convex/shared/courseCodes';

export type Agency = 'PADI' | 'SSI' | 'Universal';

export interface CourseCatalogEntry {
  code: CourseCode;
  name: string;
  agency: Agency;
  minDays: number;
  requiresConfined: boolean;
  maxDiversPerInstructor: number;
  prerequisites: CourseCode[];
  description: string;
  repeatable: boolean;
}

const PADI_COURSES: CourseCatalogEntry[] = [
  {
    code: 'DSD',
    name: 'PADI Discover Scuba Diving',
    agency: 'PADI',
    minDays: 1,
    requiresConfined: true,
    maxDiversPerInstructor: 4,
    prerequisites: [],
    repeatable: true,
    description: 'Introductory dive for non-certified divers',
  },
  {
    code: 'OW',
    name: 'PADI Open Water Diver',
    agency: 'PADI',
    minDays: 3,
    requiresConfined: true,
    maxDiversPerInstructor: 4,
    prerequisites: [],
    repeatable: false,
    description: 'Entry-level certification with confined and open water dives',
  },
  {
    code: 'AOW',
    name: 'PADI Advanced Open Water Diver',
    agency: 'PADI',
    minDays: 2,
    requiresConfined: false,
    maxDiversPerInstructor: 4,
    prerequisites: ['OW'],
    repeatable: false,
    description: 'Five adventure dives including deep and navigation',
  },
  {
    code: 'RESCUE',
    name: 'PADI Rescue Diver',
    agency: 'PADI',
    minDays: 2,
    requiresConfined: false,
    maxDiversPerInstructor: 4,
    prerequisites: ['AOW'],
    repeatable: false,
    description: 'Self-rescue and diver-rescue skills with emergency scenarios',
  },
  {
    code: 'DM',
    name: 'PADI Divemaster',
    agency: 'PADI',
    minDays: 5,
    requiresConfined: false,
    maxDiversPerInstructor: 1,
    prerequisites: ['RESCUE'],
    repeatable: false,
    description: 'Professional-level training to lead and assist dive activities',
  },
  {
    code: 'TRY_DIVE',
    name: 'PADI Try Dive',
    agency: 'PADI',
    minDays: 1,
    requiresConfined: true,
    maxDiversPerInstructor: 4,
    prerequisites: [],
    repeatable: true,
    description: 'Informal DSD alternative for dive centers not following official PADI SOP',
  },
  {
    code: 'SPECIALTY',
    name: 'PADI Specialty Course',
    agency: 'PADI',
    minDays: 1,
    requiresConfined: false,
    maxDiversPerInstructor: 4,
    prerequisites: ['OW'],
    repeatable: true,
    description: 'Specialty diving courses (Deep, Wreck, Nitrox, etc.)',
  },
];

const SSI_COURSES: CourseCatalogEntry[] = [
  {
    code: 'DSD',
    name: 'SSI Try Scuba Diving',
    agency: 'SSI',
    minDays: 1,
    requiresConfined: true,
    maxDiversPerInstructor: 4,
    prerequisites: [],
    repeatable: true,
    description: 'Introductory dive for non-certified divers',
  },
  {
    code: 'OW',
    name: 'SSI Open Water Diver',
    agency: 'SSI',
    minDays: 3,
    requiresConfined: true,
    maxDiversPerInstructor: 8,
    prerequisites: [],
    repeatable: false,
    description: 'Entry-level certification with confined and open water dives',
  },
  {
    code: 'AOW',
    name: 'SSI Advanced Adventurer',
    agency: 'SSI',
    minDays: 2,
    requiresConfined: false,
    maxDiversPerInstructor: 4,
    prerequisites: ['OW'],
    repeatable: false,
    description: 'Five specialty dives to explore advanced techniques',
  },
  {
    code: 'RESCUE',
    name: 'SSI Diver Stress & Rescue',
    agency: 'SSI',
    minDays: 2,
    requiresConfined: false,
    maxDiversPerInstructor: 4,
    prerequisites: ['AOW'],
    repeatable: false,
    description: 'Stress management and rescue techniques for real-world scenarios',
  },
  {
    code: 'DM',
    name: 'SSI Dive Guide',
    agency: 'SSI',
    minDays: 5,
    requiresConfined: false,
    maxDiversPerInstructor: 1,
    prerequisites: ['RESCUE'],
    repeatable: false,
    description: 'Professional-level training to guide certified divers',
  },
  {
    code: 'TRY_DIVE',
    name: 'SSI Try Dive',
    agency: 'SSI',
    minDays: 1,
    requiresConfined: true,
    maxDiversPerInstructor: 4,
    prerequisites: [],
    repeatable: true,
    description: 'Informal introductory dive alternative for dive centers not following official SSI SOP',
  },
  {
    code: 'SPECIALTY',
    name: 'SSI Specialty Course',
    agency: 'SSI',
    minDays: 1,
    requiresConfined: false,
    maxDiversPerInstructor: 4,
    prerequisites: ['OW'],
    repeatable: true,
    description: 'Specialty diving courses (Deep, Wreck, Enriched Air, etc.)',
  },
];

const UNIVERSAL_COURSES: CourseCatalogEntry[] = [
  {
    code: 'FD',
    name: 'Fun Dive',
    agency: 'Universal',
    minDays: 1,
    requiresConfined: false,
    maxDiversPerInstructor: 4,
    prerequisites: ['OW'],
    repeatable: true,
    description: 'Recreational diving for certified divers',
  },
  {
    code: 'REFRESH',
    name: 'Refresher / ReActivate',
    agency: 'Universal',
    minDays: 1,
    requiresConfined: true,
    maxDiversPerInstructor: 2,
    prerequisites: ['OW'],
    repeatable: false,
    description: 'Skills review for certified divers returning after a break',
  },
];

export const COURSE_CATALOG: CourseCatalogEntry[] = [
  ...PADI_COURSES,
  ...SSI_COURSES,
  ...UNIVERSAL_COURSES,
];

export const ALL_COURSE_CODES: CourseCode[] = [...COURSE_CODES];

export const COURSE_DISPLAY_LABELS: Record<CourseCode, string> = {
  DSD: 'DSD',
  TRY_DIVE: 'Try Dive',
  OW: 'OW',
  AOW: 'AOW',
  RESCUE: 'Rescue',
  DM: 'DM',
  FD: 'FD',
  REFRESH: 'Refresh',
  SPECIALTY: 'Specialty',
};

export function courseLabel(code: string): string {
  return COURSE_DISPLAY_LABELS[code as CourseCode] ?? code;
}

export function getCourseByCode(code: CourseCode): CourseCatalogEntry | undefined {
  return COURSE_CATALOG.find((entry) => entry.code === code);
}

export function getCoursesForAgency(agency: Agency): CourseCatalogEntry[] {
  return COURSE_CATALOG.filter((entry) => entry.agency === agency);
}

export const COMBO_COURSES = {
  'O+A': { codes: ['OW', 'AOW'] as CourseCode[], label: 'O+A (OW + AOW)', minDays: 4 },
} as const;
