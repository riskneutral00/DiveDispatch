// Deterministic seed data generator for bookings, customers, and related records.
// Produces ~140 bookings across 8 DCs + 1 agent, with ~420 unique customers.
// Consumed by seed mutations in convex/seed.ts.
//
// NO randomness — all assignments use modular arithmetic on indices.

// Id type not needed at data-generation layer — all references use slugs/indices.

// ── Constants ───────────────────────────────────────────────────────

import { HOLD_TTL_MS } from './lib/auth'
import { DAY_MS } from './lib/timeConstants'
import { dateStr, addDays, COURSE_DURATIONS } from './lib/seedUtils'

const HOLD_TTL = HOLD_TTL_MS
const NOW = Date.now()
const TIMEZONE = 'Asia/Bangkok'
const COMPRESSOR_SLUG = 'x4kp2m'

const TODAY = (() => {
  const d = new Date(NOW)
  return dateStr(d.getFullYear(), d.getMonth() + 1, d.getDate())
})()

function relativeDate(offset: number): string {
  return addDays(TODAY, offset)
}

import { type CourseCode } from './shared/courseCodes'
type BookingStatus = 'Draft' | 'Upcoming' | 'Completed' | 'Cancelled'
type ReservationStatus = 'PendingAcceptance' | 'Confirmed' | 'Vacated' | 'NoShow'
type Gender = 'M' | 'F' | 'Other'
type ShoeSizeUnit = 'EU' | 'US' | 'CM'
type OperatorType = 'DiveCenter' | 'Agent' | 'Liveaboard' | 'DiveResort' | 'DiveHostel'

// ── Exported Types ──────────────────────────────────────────────────

export interface SeedCustomer {
  legalFirstName: string
  legalLastName: string
  preferredName?: string
  email: string
  phone: string
  nationality: string
  dateOfBirth: string
  passportNumber: string
  passportIssuingCountry: string
  passportExpirationDate: string
  gender: Gender
  heightCm?: number
  weightKg?: number
  shoeSize?: number
  shoeSizeUnit?: ShoeSizeUnit
  needsPoweredLenses?: boolean
  prescriptionStrength?: string
  agency?: string
  agencyID?: string
  totalDives?: number
  lastDiveDate?: string
  allergies?: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelation: string
  createdAt: number
}

export interface SeedBooking {
  ownerId: string
  ownerType: OperatorType
  status: BookingStatus
  createdAt: number
  holdTTL: number
  expiresAt?: number
  paid: boolean
  activityType: CourseCode[]
  startDate: string
  endDate: string
  divers: {
    name: string
    abbrev: string
    flag: { code: string; label: string }
    startDate: string
    endDate: string
    agency?: string
    activityType: CourseCode[]
  }[]
  agentIsReferral?: boolean
  agentId?: string
  operatorName: string
  portalContact: boolean
  portalMedical: boolean
  portalWaiver: boolean
  medicalHardBlock: boolean
  draftState?: string
  bookingFormComplete: boolean
  customerFormComplete: boolean
}

export interface SeedCustomerProfile {
  bookingIndex: number // resolved to bookingId during insert
  customerIndex: number // resolved to customerId during insert
  linkToken: string
  accommodationName?: string
  needsPickup?: boolean
  pickupLocation?: string
  pickupTime?: string
  submittedAt?: number
}

export interface SeedBookingLink {
  bookingIndex: number
  token: string
  expiresAt: number
  customerName: string
  email: string
}

export interface SeedBookingSession {
  bookingIndex: number
  inventorySlug: string // resolved to inventoryUnitId during insert
  inventoryType: string // 'Instructor' | 'Boat' | 'Pool' | 'Compressor'
  date: string
  startTime: string
  endTime: string
  timezone: string
  deliveryLocation?: 'BoatPier' | 'Pool' | 'Beach'
}

export interface SeedReservation {
  bookingIndex: number
  sessionIndex: number // index within this booking's sessions
  inventorySlug: string
  inventoryType: string
  unitsRequested: number
  status: ReservationStatus
  confirmedAt?: number
  expiresAt?: number
  vacatedAt?: number
  vacatedBy?: 'booking_cancelled' | 'stakeholder_declined' | 'hold_expired' | 'operator_edit' | 'noshow_replacement'
}

export interface SeedAvailabilitySnapshot {
  inventorySlug: string
  inventoryType: string
  date: string
  windowStart: string
  windowEnd: string
  totalUnits: number
  reservedUnits: number
  availableUnits: number
}

export interface SeedEquipmentBag {
  bagNumber: string
  equipmentManagerId: string
  bookingIndex: number
  status: 'Assigned' | 'InUse' | 'Returned'
  assignedAt?: number
  returnedAt?: number
}

export interface SeedNotification {
  userId: string
  type: 'hold_declined' | 'booking_cancelled' | 'booking_updated' | 'booking_referred' | 'medical_hard_block' | 'physician_clearance_submitted' | 'no_backup_available' | 'min_pax_not_met'
  bookingIndex: number
  message: string
  readAt?: number
  createdAt: number
}

export interface SeedBlockedDate {
  ownerSlug: string
  roleType: string
  dates: string[]
}

export interface SeedBookingResource {
  bookingIndex: number
  resourceType: string
  resourceSlug?: string
  externalName?: string
}

export interface SeedData {
  customers: SeedCustomer[]
  bookings: SeedBooking[]
  bookingResources: SeedBookingResource[]
  customerProfiles: SeedCustomerProfile[]
  bookingLinks: SeedBookingLink[]
  bookingSessions: SeedBookingSession[]
  reservations: SeedReservation[]
  availabilitySnapshots: SeedAvailabilitySnapshot[]
  equipmentBags: SeedEquipmentBag[]
  notifications: SeedNotification[]
  blockedDates: SeedBlockedDate[]
}

// ── Booking Config ──────────────────────────────────────────────────

export interface BookingConfig {
  ownerSlug: string
  ownerName: string
  ownerType: OperatorType
  count: number
  activityMix: Record<string, number>
  statusMix: Record<string, number>
  ownBoatSlug?: string
  ownPoolSlug?: string
  ownEquipmentSlug?: string
  referralDCs?: string[]
}

export const BOOKING_CONFIGS: BookingConfig[] = [
  {
    ownerSlug: 'n7rq5j',
    ownerName: 'Hug Ocean',
    ownerType: 'DiveCenter',
    count: 44,
    activityMix: { DSD: 8, OW: 8, AOW: 5, 'OW+AOW': 2, FD: 11, TRY_DIVE: 3, RESCUE: 2, SPECIALTY: 2, REFRESH: 2 },
    statusMix: { Upcoming: 28, Draft: 2, Completed: 12, Cancelled: 1 },
    ownBoatSlug: 'n7rq5j',
    ownPoolSlug: 'n7rq5j',
    ownEquipmentSlug: 'n7rq5j',
  },
  {
    ownerSlug: 'z8mv4c',
    ownerName: 'Neptune',
    ownerType: 'DiveCenter',
    count: 10,
    activityMix: { DSD: 3, OW: 2, AOW: 2, 'OW+AOW': 1, FD: 2 },
    statusMix: { Upcoming: 6, Draft: 2, Completed: 2, Cancelled: 0 },
    ownPoolSlug: 'z8mv4c',
    ownEquipmentSlug: 'z8mv4c',
  },
  {
    ownerSlug: 'p5ky3w',
    ownerName: 'Phuket Dive Center',
    ownerType: 'DiveCenter',
    count: 20,
    activityMix: { DSD: 5, OW: 5, AOW: 3, 'OW+AOW': 3, FD: 4 },
    statusMix: { Upcoming: 13, Draft: 2, Completed: 4, Cancelled: 1 },
    ownBoatSlug: 'p5ky3w',
    ownEquipmentSlug: 'p5ky3w',
  },
  {
    ownerSlug: 'q9bz7r',
    ownerName: 'Nicole Dive Center',
    ownerType: 'DiveCenter',
    count: 20,
    activityMix: { DSD: 5, OW: 5, AOW: 3, 'OW+AOW': 3, FD: 4 },
    statusMix: { Upcoming: 13, Draft: 2, Completed: 4, Cancelled: 1 },
    ownEquipmentSlug: 'q9bz7r',
  },
  {
    ownerSlug: 'v6js2t',
    ownerName: 'Manta Dive Center',
    ownerType: 'DiveCenter',
    count: 10,
    activityMix: { DSD: 3, OW: 2, AOW: 2, 'OW+AOW': 1, FD: 2 },
    statusMix: { Upcoming: 6, Draft: 2, Completed: 2, Cancelled: 0 },
  },
  {
    ownerSlug: 'm4fx8d',
    ownerName: 'ScubaNicks',
    ownerType: 'DiveCenter',
    count: 10,
    activityMix: { DSD: 3, OW: 2, AOW: 2, 'OW+AOW': 1, FD: 2 },
    statusMix: { Upcoming: 6, Draft: 2, Completed: 2, Cancelled: 0 },
    ownEquipmentSlug: 'm4fx8d',
  },
  {
    ownerSlug: 'h3cp6n',
    ownerName: 'Scuba Deep',
    ownerType: 'DiveCenter',
    count: 20,
    activityMix: { DSD: 5, OW: 5, AOW: 3, 'OW+AOW': 3, FD: 4 },
    statusMix: { Upcoming: 13, Draft: 2, Completed: 4, Cancelled: 1 },
    ownBoatSlug: 'h3cp6n',
    ownEquipmentSlug: 'h3cp6n',
  },
  {
    ownerSlug: 't7gw1k',
    ownerName: 'Pray Dive Center',
    ownerType: 'DiveCenter',
    count: 10,
    activityMix: { DSD: 3, OW: 2, AOW: 2, 'OW+AOW': 1, FD: 2 },
    statusMix: { Upcoming: 6, Draft: 2, Completed: 2, Cancelled: 0 },
  },
  // Amanda own bookings
  {
    ownerSlug: 'r5yz4q',
    ownerName: 'Amanda',
    ownerType: 'Agent',
    count: 5,
    activityMix: { DSD: 2, OW: 1, AOW: 1, FD: 1 },
    statusMix: { Upcoming: 3, Draft: 1, Completed: 1, Cancelled: 0 },
  },
  // Amanda referral bookings — spread across DCs
  {
    ownerSlug: 'r5yz4q',
    ownerName: 'Amanda',
    ownerType: 'Agent',
    count: 15,
    activityMix: { DSD: 4, OW: 4, AOW: 3, 'OW+AOW': 2, FD: 2 },
    statusMix: { Upcoming: 9, Draft: 3, Completed: 3, Cancelled: 0 },
    referralDCs: ['n7rq5j', 'p5ky3w', 'q9bz7r', 'h3cp6n', 'z8mv4c', 'v6js2t', 'm4fx8d', 't7gw1k'],
  },
  // Andaman Explorer (Liveaboard)
  {
    ownerSlug: 'k8lv3a',
    ownerName: 'Andaman Explorer',
    ownerType: 'Liveaboard',
    count: 5,
    activityMix: { DSD: 1, OW: 1, AOW: 1, FD: 2 },
    statusMix: { Upcoming: 3, Draft: 1, Completed: 1, Cancelled: 0 },
  },
  // Coral Bay Resort (DiveResort)
  {
    ownerSlug: 'j2dn9f',
    ownerName: 'Coral Bay Resort',
    ownerType: 'DiveResort',
    count: 5,
    activityMix: { DSD: 2, OW: 1, AOW: 1, FD: 1 },
    statusMix: { Upcoming: 3, Draft: 1, Completed: 1, Cancelled: 0 },
  },
]

// ── Hug Ocean color stress-test booking definitions ─────────────────
// 40 hardcoded bookings covering every activity type, display status,
// and a packed day (Mar 25) with 11 bookings for scroll testing.

const HUG_OCEAN_BOOKINGS: {
  activityType: CourseCode[]
  startDate: string
  endDate: string
  status: BookingStatus
  diverCount: number
}[] = [
  // Week 1: ~2 weeks ago — Completed
  /* 0  */ { activityType: ['FD'], startDate: relativeDate(-14), endDate: relativeDate(-14), status: 'Completed', diverCount: 2 },
  /* 1  */ { activityType: ['DSD'], startDate: relativeDate(-13), endDate: relativeDate(-13), status: 'Completed', diverCount: 3 },
  /* 2  */ { activityType: ['OW'], startDate: relativeDate(-13), endDate: relativeDate(-11), status: 'Completed', diverCount: 2 },
  /* 3  */ { activityType: ['AOW'], startDate: relativeDate(-12), endDate: relativeDate(-11), status: 'Completed', diverCount: 2 },
  /* 4  */ { activityType: ['FD'], startDate: relativeDate(-11), endDate: relativeDate(-11), status: 'Completed', diverCount: 2 },
  /* 5  */ { activityType: ['RESCUE'], startDate: relativeDate(-12), endDate: relativeDate(-10), status: 'Completed', diverCount: 2 },
  /* 6  */ { activityType: ['TRY_DIVE'], startDate: relativeDate(-10), endDate: relativeDate(-10), status: 'Completed', diverCount: 4 },
  /* 7  */ { activityType: ['SPECIALTY'], startDate: relativeDate(-9), endDate: relativeDate(-8), status: 'Completed', diverCount: 2 },

  // Week 2: ~1 week ago — Active + transition
  /* 8  */ { activityType: ['FD'], startDate: relativeDate(-8), endDate: relativeDate(-8), status: 'Completed', diverCount: 2 },
  /* 9  */ { activityType: ['OW'], startDate: relativeDate(-6), endDate: relativeDate(-4), status: 'Upcoming', diverCount: 2 },
  /* 10 */ { activityType: ['OW', 'AOW'], startDate: relativeDate(-5), endDate: relativeDate(-1), status: 'Upcoming', diverCount: 3 },
  /* 11 */ { activityType: ['DSD'], startDate: relativeDate(-4), endDate: relativeDate(-4), status: 'Upcoming', diverCount: 2 },
  /* 12 */ { activityType: ['FD'], startDate: relativeDate(-3), endDate: relativeDate(-3), status: 'Upcoming', diverCount: 2 },
  /* 13 */ { activityType: ['AOW'], startDate: relativeDate(-3), endDate: relativeDate(-2), status: 'Upcoming', diverCount: 2 },
  /* 14 */ { activityType: ['DSD'], startDate: relativeDate(-3), endDate: relativeDate(-3), status: 'Upcoming', diverCount: 2 },
  /* 15 */ { activityType: ['OW'], startDate: relativeDate(-2), endDate: relativeDate(0), status: 'Upcoming', diverCount: 3 },
  /* 16 */ { activityType: ['TRY_DIVE'], startDate: relativeDate(-2), endDate: relativeDate(-2), status: 'Upcoming', diverCount: 2 },
  /* 17 */ { activityType: ['REFRESH'], startDate: relativeDate(-1), endDate: relativeDate(-1), status: 'Upcoming', diverCount: 2 },

  // Week 3: this week — Upcoming + PACKED day (today+3)
  /* 18 */ { activityType: ['AOW'], startDate: relativeDate(0), endDate: relativeDate(1), status: 'Upcoming', diverCount: 2 },
  /* 19 */ { activityType: ['FD'], startDate: relativeDate(1), endDate: relativeDate(1), status: 'Upcoming', diverCount: 2 },
  /* 20 */ { activityType: ['DSD'], startDate: relativeDate(2), endDate: relativeDate(2), status: 'Upcoming', diverCount: 3 },
  /* 21 */ { activityType: ['OW'], startDate: relativeDate(2), endDate: relativeDate(4), status: 'Upcoming', diverCount: 2 },
  /* 22 */ { activityType: ['OW'], startDate: relativeDate(3), endDate: relativeDate(5), status: 'Upcoming', diverCount: 3 },
  /* 23 */ { activityType: ['AOW'], startDate: relativeDate(3), endDate: relativeDate(4), status: 'Upcoming', diverCount: 2 },
  /* 24 */ { activityType: ['FD'], startDate: relativeDate(3), endDate: relativeDate(3), status: 'Upcoming', diverCount: 3 },
  /* 25 */ { activityType: ['FD'], startDate: relativeDate(3), endDate: relativeDate(3), status: 'Upcoming', diverCount: 3 },
  /* 26 */ { activityType: ['DSD'], startDate: relativeDate(3), endDate: relativeDate(3), status: 'Upcoming', diverCount: 4 },
  /* 27 */ { activityType: ['DSD'], startDate: relativeDate(3), endDate: relativeDate(3), status: 'Upcoming', diverCount: 2 },
  /* 28 */ { activityType: ['TRY_DIVE'], startDate: relativeDate(3), endDate: relativeDate(3), status: 'Upcoming', diverCount: 3 },
  /* 29 */ { activityType: ['RESCUE'], startDate: relativeDate(3), endDate: relativeDate(5), status: 'Upcoming', diverCount: 2 },
  /* 30 */ { activityType: ['SPECIALTY'], startDate: relativeDate(3), endDate: relativeDate(4), status: 'Upcoming', diverCount: 2 },
  /* 31 */ { activityType: ['OW', 'AOW'], startDate: relativeDate(3), endDate: relativeDate(6), status: 'Upcoming', diverCount: 2 },
  /* 32 */ { activityType: ['OW'], startDate: relativeDate(4), endDate: relativeDate(6), status: 'Upcoming', diverCount: 2 },
  /* 33 */ { activityType: ['FD'], startDate: relativeDate(5), endDate: relativeDate(5), status: 'Upcoming', diverCount: 2 },

  // Week 4: next week
  /* 34 */ { activityType: ['AOW'], startDate: relativeDate(7), endDate: relativeDate(8), status: 'Draft', diverCount: 2 },
  /* 35 */ { activityType: ['DSD'], startDate: relativeDate(8), endDate: relativeDate(8), status: 'Upcoming', diverCount: 3 },
  /* 36 */ { activityType: ['FD'], startDate: relativeDate(9), endDate: relativeDate(9), status: 'Upcoming', diverCount: 2 },
  /* 37 */ { activityType: ['OW'], startDate: relativeDate(10), endDate: relativeDate(12), status: 'Upcoming', diverCount: 2 },
  /* 38 */ { activityType: ['DSD'], startDate: relativeDate(11), endDate: relativeDate(11), status: 'Cancelled', diverCount: 2 },
  /* 39 */ { activityType: ['REFRESH'], startDate: relativeDate(13), endDate: relativeDate(13), status: 'Upcoming', diverCount: 2 },

  // Ghost instructor bookings (Kai Sørensen — not in the system)
  /* 40 */ { activityType: ['FD'], startDate: relativeDate(15), endDate: relativeDate(15), status: 'Upcoming', diverCount: 2 },
  /* 41 */ { activityType: ['DSD'], startDate: relativeDate(19), endDate: relativeDate(19), status: 'Draft', diverCount: 3 },
  /* 42 */ { activityType: ['OW'], startDate: relativeDate(23), endDate: relativeDate(26), status: 'Draft', diverCount: 2 },
  /* 43 */ { activityType: ['FD'], startDate: relativeDate(3), endDate: relativeDate(3), status: 'Upcoming', diverCount: 2 },
]

// Blocked dates for Hug Ocean Boat
const HUG_OCEAN_BLOCKED_DATES: SeedBlockedDate[] = [
  { ownerSlug: 'n7rq5j', roleType: 'Boat', dates: [relativeDate(-7), relativeDate(0), relativeDate(7)] },
]

// ── Name pools by region ────────────────────────────────────────────

interface RegionNames {
  nationality: string
  countries: string[]
  firstNames: string[]
  lastNames: string[]
  language: string
  weight: number // approximate percentage
}

const REGION_POOLS: RegionNames[] = [
  {
    nationality: 'Chinese',
    countries: ['CN', 'CN', 'CN', 'CN', 'HK', 'TW'], // Weighted: ~67% CN, ~17% HK, ~17% TW
    firstNames: [
      'Wei', 'Li', 'Jing', 'Fang', 'Ming', 'Yue', 'Xin', 'Hao', 'Ying', 'Chen',
      'Mei', 'Tao', 'Lan', 'Feng', 'Hua', 'Jun', 'Qiang', 'Rui', 'Bo', 'Yan',
      'Siu', 'Ka', 'Wai', 'Chi', 'Lok', 'Tsz', 'Hei', 'Man', 'Ting', 'Yat',
    ],
    lastNames: [
      'Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou',
      'Sun', 'Ma', 'Xu', 'He', 'Guo', 'Lam', 'Chan', 'Leung', 'Wong', 'Ng',
    ],
    language: 'Mandarin',
    weight: 30,
  },
  {
    nationality: 'European',
    countries: ['DE', 'FR', 'GB', 'IT', 'NO', 'NL', 'SE', 'IS', 'FI'],
    firstNames: [
      'Hans', 'Greta', 'Pierre', 'Marie', 'James', 'Emma', 'Marco', 'Giulia', 'Erik', 'Anna',
      'Lars', 'Sophie', 'Oliver', 'Ingrid', 'Thomas', 'Katrin', 'Frans', 'Elsa', 'Jan', 'Hilde',
    ],
    lastNames: [
      'Mueller', 'Dupont', 'Smith', 'Rossi', 'Hansen', 'de Vries', 'Johansson', 'Sigurdsson', 'Virtanen', 'Larsen',
      'Weber', 'Martin', 'Brown', 'Bianchi', 'Berg', 'Bakker', 'Lindqvist', 'Jonsdottir', 'Korhonen', 'Olsen',
    ],
    language: 'English',
    weight: 20,
  },
  {
    nationality: 'Russian/Eastern European',
    countries: ['RU', 'UA', 'PL'],
    firstNames: [
      'Dmitri', 'Olga', 'Ivan', 'Natasha', 'Alexei', 'Svetlana', 'Yuri', 'Katya', 'Boris', 'Elena',
      'Andrzej', 'Marta', 'Piotr', 'Anna', 'Sergei', 'Irina',
    ],
    lastNames: [
      'Volkov', 'Petrova', 'Ivanov', 'Sokolova', 'Kuznetsov', 'Popova', 'Smirnov', 'Fedorova',
      'Kowalski', 'Nowak', 'Bondarenko', 'Shevchenko', 'Morozov', 'Kozlov', 'Novikov', 'Lebedev',
    ],
    language: 'Russian',
    weight: 15,
  },
  {
    nationality: 'Korean/Japanese',
    countries: ['KR', 'JP'],
    firstNames: [
      'Joon', 'Soo-Yeon', 'Min-Ho', 'Hye-Jin', 'Sang-Woo', 'Ji-Eun',
      'Yuki', 'Kenji', 'Haruka', 'Takeshi', 'Sakura', 'Ren',
    ],
    lastNames: [
      'Kim', 'Park', 'Lee', 'Choi', 'Jung', 'Kang',
      'Tanaka', 'Suzuki', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura',
    ],
    language: 'Korean',
    weight: 10,
  },
  {
    nationality: 'Australian/NZ',
    countries: ['AU', 'NZ'],
    firstNames: [
      'Jack', 'Olivia', 'Liam', 'Charlotte', 'Noah', 'Amelia', 'William', 'Isla', 'Ethan', 'Mia',
    ],
    lastNames: [
      'Thompson', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Harris', 'Clark', 'Robinson', 'White', 'Walker',
    ],
    language: 'English',
    weight: 10,
  },
  {
    nationality: 'Middle Eastern',
    countries: ['SA', 'IL'],
    firstNames: [
      'Mohammed', 'Fatima', 'Ahmed', 'Layla', 'Omar', 'Noura',
      'David', 'Noa', 'Yosef', 'Tamar',
    ],
    lastNames: [
      'Al-Rashid', 'Al-Farsi', 'Al-Qadi', 'Hassan', 'Ibrahim',
      'Cohen', 'Levy', 'Mizrahi', 'Ben-David', 'Shapiro',
    ],
    language: 'Arabic',
    weight: 5,
  },
  {
    nationality: 'Thai',
    countries: ['TH'],
    firstNames: [
      'Somchai', 'Nattaya', 'Kittipong', 'Arisa', 'Prasit', 'Supachai',
      'Kanok', 'Pimchanok', 'Tanawat', 'Siriporn',
    ],
    lastNames: [
      'Phetpradap', 'Srisuk', 'Jaidee', 'Rattana', 'Wongsawat', 'Thammasiri',
      'Chainam', 'Suwan', 'Kongkaew', 'Thongkam',
    ],
    language: 'Thai',
    weight: 5,
  },
  {
    nationality: 'Americas/Africa',
    countries: ['US', 'BR', 'JM', 'ZA', 'KE'],
    firstNames: [
      'Brandon', 'Ashley', 'Carlos', 'Gabriela', 'Devon', 'Shanice',
      'Pieter', 'Zanele', 'Wanjiru', 'Kamau',
    ],
    lastNames: [
      'Johnson', 'Williams', 'Silva', 'Santos', 'Campbell', 'Brown',
      'van der Merwe', 'Ndlovu', 'Mwangi', 'Ochieng',
    ],
    language: 'English',
    weight: 5,
  },
]

// Pre-compute total weight for distribution
const TOTAL_WEIGHT = REGION_POOLS.reduce((sum, r) => sum + r.weight, 0)

// ── Instructor slugs (from seedInstructorData.ts roster order) ──────

const INSTRUCTOR_SLUGS: { slug: string; languages: string[] }[] = [
  // English-primary 0
  { slug: 'ryan-clarke', languages: ['English', 'French'] },
  // Thai-primary 1-5
  { slug: 'nattaya-srisuk', languages: ['Thai'] },
  { slug: 'kittipong-jaidee', languages: ['Thai', 'English'] },
  { slug: 'arisa-tanaka', languages: ['Thai', 'Japanese'] },
  { slug: 'prasit-wongsawat', languages: ['Thai'] },
  { slug: 'supachai-rattana', languages: ['Thai', 'English'] },
  // Mandarin-primary 6-13
  { slug: 'wei-chen', languages: ['Mandarin'] },
  { slug: 'li-ming', languages: ['Mandarin', 'English'] },
  { slug: 'zhang-yong', languages: ['Mandarin'] },
  { slug: 'wang-fei', languages: ['Mandarin', 'English'] },
  { slug: 'huang-jie', languages: ['Mandarin'] },
  { slug: 'chen-xiaoli', languages: ['Mandarin', 'Thai'] },
  { slug: 'liu-hao', languages: ['Mandarin'] },
  { slug: 'xu-wei', languages: ['Mandarin', 'English'] },
  // Chinese-primary 14-17
  { slug: 'zhou-peng', languages: ['Chinese'] },
  { slug: 'sun-jing', languages: ['Chinese', 'English'] },
  { slug: 'ma-lin', languages: ['Chinese'] },
  { slug: 'gao-tian', languages: ['Chinese', 'Thai'] },
  // French-primary 18-21
  { slug: 'pierre-dubois', languages: ['French', 'English'] },
  { slug: 'marie-lefevre', languages: ['French'] },
  { slug: 'antoine-bernard', languages: ['French', 'Thai'] },
  { slug: 'sophie-martin', languages: ['French', 'English'] },
  // German-primary 22-24
  { slug: 'klaus-weber', languages: ['German', 'English'] },
  { slug: 'stefan-braun', languages: ['German'] },
  { slug: 'heidi-fischer', languages: ['German', 'Thai'] },
  // Cantonese-primary 25-27
  { slug: 'chan-wing', languages: ['Cantonese', 'English'] },
  { slug: 'lam-ka-yan', languages: ['Cantonese'] },
  { slug: 'ho-siu-ming', languages: ['Cantonese', 'English'] },
  // Korean-primary 28-29
  { slug: 'park-joon', languages: ['Korean', 'English'] },
  { slug: 'kim-soo-yeon', languages: ['Korean'] },
  // SSI-only 30-35
  { slug: 'yuki-tanaka', languages: ['Japanese', 'English'] },
  { slug: 'kenji-nakamura', languages: ['Japanese'] },
  { slug: 'dmitri-volkov', languages: ['Russian', 'English'] },
  { slug: 'olga-petrova', languages: ['Russian'] },
  { slug: 'ben-walker', languages: ['English'] },
  { slug: 'alex-turner', languages: ['English', 'Thai'] },
  // Dual-certified 36-39
  { slug: 'mike-chen', languages: ['Mandarin', 'English'] },
  { slug: 'rachel-nguyen', languages: ['English', 'French'] },
  { slug: 'lee-min-ho', languages: ['Korean', 'English'] },
  { slug: 'david-schmidt', languages: ['German', 'English'] },
]

// Track how many times each instructor is assigned
const instructorUseCounts: number[] = new Array(INSTRUCTOR_SLUGS.length).fill(0)

// Track instructor assignments per date to prevent conflicts
const instructorDateAssignments = new Map<string, Set<string>>() // date -> Set<instructorSlug>

function isInstructorAvailableOnDate(slug: string, date: string): boolean {
  const assigned = instructorDateAssignments.get(date)
  return !assigned || !assigned.has(slug)
}

function markInstructorOnDate(slug: string, date: string): void {
  let assigned = instructorDateAssignments.get(date)
  if (!assigned) {
    assigned = new Set()
    instructorDateAssignments.set(date, assigned)
  }
  assigned.add(slug)
}

function markInstructorForDateRange(slug: string, startDate: string, endDate: string): void {
  let current = startDate
  while (current <= endDate) {
    markInstructorOnDate(slug, current)
    current = addDays(current, 1)
  }
}

// ── Country metadata ────────────────────────────────────────────────

const COUNTRY_LABELS: Record<string, string> = {
  CN: 'China', HK: 'Hong Kong', TW: 'Taiwan',
  DE: 'Germany', FR: 'France', GB: 'United Kingdom', IT: 'Italy',
  NO: 'Norway', NL: 'Netherlands', SE: 'Sweden', IS: 'Iceland', FI: 'Finland',
  RU: 'Russia', UA: 'Ukraine', PL: 'Poland',
  KR: 'South Korea', JP: 'Japan',
  AU: 'Australia', NZ: 'New Zealand',
  SA: 'Saudi Arabia', IL: 'Israel',
  TH: 'Thailand',
  US: 'United States', BR: 'Brazil', JM: 'Jamaica', ZA: 'South Africa', KE: 'Kenya',
}

const COUNTRY_LANGUAGES: Record<string, string> = {
  CN: 'Mandarin', HK: 'Cantonese', TW: 'Mandarin',
  DE: 'German', FR: 'French', GB: 'English', IT: 'Italian',
  NO: 'Norwegian', NL: 'Dutch', SE: 'Swedish', IS: 'Icelandic', FI: 'Finnish',
  RU: 'Russian', UA: 'Ukrainian', PL: 'Polish',
  KR: 'Korean', JP: 'Japanese',
  AU: 'English', NZ: 'English',
  SA: 'Arabic', IL: 'Hebrew',
  TH: 'Thai',
  US: 'English', BR: 'Portuguese', JM: 'Jamaican Patois', ZA: 'Afrikaans', KE: 'Swahili',
}

// ── Helpers ─────────────────────────────────────────────────────────

function deterministicUUID(prefix: string, index: number): string {
  const hex = (n: number, len: number) => n.toString(16).padStart(len, '0')
  const a = hex((index * 2654435761) >>> 0, 8)
  const b = hex((index * 2246822519 + 1) >>> 0, 4)
  const c = hex(((index * 3266489917 + 2) >>> 0) & 0x0fff | 0x4000, 4)
  const d = hex(((index * 668265263 + 3) >>> 0) & 0x3fff | 0x8000, 4)
  const e = hex((index * 374761393 + 4) >>> 0, 8)
  return `${prefix}-${a}-${b}-${c}-${d}-${e.padEnd(12, '0')}`
}

function getRegionForIndex(index: number): RegionNames {
  const bucket = index % TOTAL_WEIGHT
  let cumulative = 0
  for (const region of REGION_POOLS) {
    cumulative += region.weight
    if (bucket < cumulative) return region
  }
  return REGION_POOLS[REGION_POOLS.length - 1]
}

function getCountryForCustomer(region: RegionNames, index: number): string {
  return region.countries[index % region.countries.length]
}

// ── Body measurement distribution ───────────────────────────────────

interface BodyMeasurements {
  heightCm?: number
  weightKg?: number
  shoeSize?: number
  shoeSizeUnit?: ShoeSizeUnit
}

function getBodyMeasurements(index: number): BodyMeasurements {
  const bucket = index % 100

  // ~10% No measurements
  if (bucket >= 90) {
    return {}
  }

  // 2-3 Out-of-range (indices 88, 89)
  if (bucket === 88) {
    return { heightCm: 198, weightKg: 115, shoeSize: 48, shoeSizeUnit: 'EU' }
  }
  if (bucket === 89) {
    return { heightCm: 200, weightKg: 120, shoeSize: 47, shoeSizeUnit: 'EU' }
  }

  // ~20% Small (bucket 0-19)
  if (bucket < 20) {
    const h = 150 + (bucket % 16)
    const w = 42 + (bucket % 19)
    const shoe = 36 + (bucket % 3)
    return { heightCm: h, weightKg: w, shoeSize: shoe, shoeSizeUnit: 'EU' }
  }

  // ~40% Medium (bucket 20-59)
  if (bucket < 60) {
    const h = 165 + ((bucket - 20) % 16)
    const w = 60 + ((bucket - 20) % 26)
    const shoe = 39 + ((bucket - 20) % 5)
    return { heightCm: h, weightKg: w, shoeSize: shoe, shoeSizeUnit: 'EU' }
  }

  // ~25% Large (bucket 60-87, minus the 2 out-of-range)
  const h = 180 + ((bucket - 60) % 16)
  const w = 85 + ((bucket - 60) % 16)
  const shoe = 44 + ((bucket - 60) % 3)
  return { heightCm: h, weightKg: w, shoeSize: shoe, shoeSizeUnit: 'EU' }
}

// ── Gender distribution ─────────────────────────────────────────────

function getGender(index: number): Gender {
  const bucket = index % 20
  if (bucket < 10) return 'M'
  if (bucket < 19) return 'F'
  return 'Other'
}

// ── Emergency contact relation ──────────────────────────────────────

const RELATIONS = ['spouse', 'parent', 'sibling', 'partner', 'friend']

// ── Customer Generator ──────────────────────────────────────────────

export function generateCustomers(): SeedCustomer[] {
  const customers: SeedCustomer[] = []

  for (let i = 0; i < 420; i++) {
    const region = getRegionForIndex(i)
    const country = getCountryForCustomer(region, i)
    const firstName = region.firstNames[i % region.firstNames.length]
    const lastName = region.lastNames[(i * 7 + 3) % region.lastNames.length]
    const gender = getGender(i)
    const measurements = getBodyMeasurements(i)

    // Date of birth: spread between 1970 and 2005
    const birthYear = 1970 + (i % 36)
    const birthMonth = 1 + (i % 12)
    const birthDay = 1 + (i % 28)

    // Passport expiration: 2027-2030
    const passExpYear = 2027 + (i % 4)
    const passExpMonth = 1 + ((i * 3) % 12)

    const customer: SeedCustomer = {
      legalFirstName: firstName,
      legalLastName: lastName,
      email: `customer-${i}@test.divedispatch.dev`,
      phone: `+${getPhonePrefix(country)}-${String(1000000 + i).slice(1)}`,
      nationality: country,
      dateOfBirth: dateStr(birthYear, birthMonth, birthDay),
      passportNumber: `${country}${String(100000 + i)}`,
      passportIssuingCountry: country,
      passportExpirationDate: dateStr(passExpYear, passExpMonth, 15),
      gender,
      emergencyContactName: `EC ${lastName}`,
      emergencyContactPhone: `+${getPhonePrefix(country)}-${String(2000000 + i).slice(1)}`,
      emergencyContactRelation: RELATIONS[i % RELATIONS.length],
      createdAt: NOW,
      ...measurements,
    }

    customers.push(customer)
  }

  return customers
}

function getPhonePrefix(country: string): string {
  const prefixes: Record<string, string> = {
    CN: '86', HK: '852', TW: '886', DE: '49', FR: '33', GB: '44',
    IT: '39', NO: '47', NL: '31', SE: '46', IS: '354', FI: '358',
    RU: '7', UA: '380', PL: '48', KR: '82', JP: '81',
    AU: '61', NZ: '64', SA: '966', IL: '972', TH: '66',
    US: '1', BR: '55', JM: '1876', ZA: '27', KE: '254',
  }
  return prefixes[country] || '1'
}

// ── Instructor selection by language ────────────────────────────────

function findInstructorForLanguage(targetLang: string, bookingIndex: number, startDate?: string, endDate?: string): string {
  // Map customer languages to instructor languages
  const langMap: Record<string, string[]> = {
    Mandarin: ['Mandarin', 'Chinese'],
    Cantonese: ['Cantonese', 'Chinese'],
    Chinese: ['Chinese', 'Mandarin', 'Cantonese'],
    Korean: ['Korean'],
    Japanese: ['Japanese'],
    Russian: ['Russian'],
    Ukrainian: ['Russian', 'English'],
    German: ['German'],
    French: ['French'],
    Thai: ['Thai'],
    English: ['English'],
    Arabic: ['English'],
    Hebrew: ['English'],
    Italian: ['English'],
    Norwegian: ['English'],
    Dutch: ['English'],
    Swedish: ['English'],
    Icelandic: ['English'],
    Finnish: ['English'],
    Polish: ['English', 'Russian'],
    Portuguese: ['English'],
    'Jamaican Patois': ['English'],
    Afrikaans: ['English'],
    Swahili: ['English'],
  }

  const searchLangs = langMap[targetLang] || ['English']

  // Find instructors who speak any of the search languages
  const candidates: number[] = []
  for (let i = 0; i < INSTRUCTOR_SLUGS.length; i++) {
    const inst = INSTRUCTOR_SLUGS[i]
    if (inst.languages.some((l) => searchLangs.includes(l))) {
      candidates.push(i)
    }
  }

  if (candidates.length === 0) {
    // Fallback to English-speaking instructors
    for (let i = 0; i < 10; i++) {
      candidates.push(i)
    }
  }

  // If date range provided, filter to instructors available on all dates in range
  if (startDate && endDate) {
    const availableCandidates = candidates.filter(idx => {
      const slug = INSTRUCTOR_SLUGS[idx].slug
      let current = startDate!
      while (current <= endDate!) {
        if (!isInstructorAvailableOnDate(slug, current)) return false
        current = addDays(current, 1)
      }
      return true
    })
    if (availableCandidates.length > 0) {
      const pick = availableCandidates[bookingIndex % availableCandidates.length]
      instructorUseCounts[pick]++
      const slug = INSTRUCTOR_SLUGS[pick].slug
      markInstructorForDateRange(slug, startDate, endDate)
      return slug
    }

    // Language-matched candidates exhausted for this date range.
    // Fall back to ANY available instructor (prefer English) to avoid conflicts.
    const allAvailable: number[] = []
    for (let i = 0; i < INSTRUCTOR_SLUGS.length; i++) {
      const slug = INSTRUCTOR_SLUGS[i].slug
      let available = true
      let current = startDate!
      while (current <= endDate!) {
        if (!isInstructorAvailableOnDate(slug, current)) { available = false; break }
        current = addDays(current, 1)
      }
      if (available) allAvailable.push(i)
    }
    if (allAvailable.length > 0) {
      const pick = allAvailable[bookingIndex % allAvailable.length]
      instructorUseCounts[pick]++
      const slug = INSTRUCTOR_SLUGS[pick].slug
      markInstructorForDateRange(slug, startDate, endDate)
      return slug
    }
  }

  // Last resort fallback: try date-aware pick from ALL instructors before giving up
  if (startDate && endDate) {
    const allAvailableFallback: number[] = []
    for (let i = 0; i < INSTRUCTOR_SLUGS.length; i++) {
      const s = INSTRUCTOR_SLUGS[i].slug
      let available = true
      let cur = startDate!
      while (cur <= endDate!) {
        if (!isInstructorAvailableOnDate(s, cur)) { available = false; break }
        cur = addDays(cur, 1)
      }
      if (available) allAvailableFallback.push(i)
    }
    if (allAvailableFallback.length > 0) {
      const pick = allAvailableFallback[bookingIndex % allAvailableFallback.length]
      instructorUseCounts[pick]++
      const s = INSTRUCTOR_SLUGS[pick].slug
      markInstructorForDateRange(s, startDate, endDate)
      return s
    }
  }

  // Absolute last resort: modular pick (may conflict — all instructors exhausted on these dates)
  const pick = candidates[(bookingIndex) % candidates.length]
  instructorUseCounts[pick]++
  const slug = INSTRUCTOR_SLUGS[pick].slug
  if (startDate && endDate) {
    markInstructorForDateRange(slug, startDate, endDate)
  }
  return slug
}

// ── Boat assignment ─────────────────────────────────────────────────

function getBoatSlug(config: BookingConfig, bookingIndex: number): string | undefined {
  if (config.ownBoatSlug) return config.ownBoatSlug

  // DCs without own boats use shared boats from Phuket DC or Scuba Deep
  const sharedBoats = ['p5ky3w', 'h3cp6n']
  return sharedBoats[bookingIndex % sharedBoats.length]
}

// ── Pool assignment (only for OW and O+A courses) ───────────────────

function getPoolSlug(config: BookingConfig, bookingIndex: number): string | undefined {
  if (config.ownPoolSlug) return config.ownPoolSlug

  // DCs without own pools use shared pools
  const sharedPools = ['b3wt9f', 'g2hn6x', 'n7rq5j', 'z8mv4c']
  return sharedPools[bookingIndex % sharedPools.length]
}

// ── Equipment manager assignment ────────────────────────────────────

function getEquipmentSlug(config: BookingConfig, bookingIndex: number): string | undefined {
  if (config.ownEquipmentSlug) return config.ownEquipmentSlug

  // DCs without own EM use Nicole DC (main shared EM)
  return 'q9bz7r'
}

// ── Date scheduling ─────────────────────────────────────────────────

function getStartDate(status: BookingStatus, bookingIndex: number, configIndex: number, activityType?: CourseCode[], localIndex?: number, dcCount?: number): string {
  if (status === 'Completed') {
    // ~2 weeks ago, cap so endDate doesn't exceed day -8
    let maxDuration = 1
    if (activityType) {
      if (activityType.length === 2 && activityType.includes('OW' as CourseCode) && activityType.includes('AOW' as CourseCode)) {
        maxDuration = 4
      } else {
        maxDuration = COURSE_DURATIONS[activityType[0]] || 1
      }
    }
    const earliestOffset = -14
    const latestOffset = -8 - (maxDuration - 1) // e.g. OW(3): -10, AOW(2): -9, O+A(4): -11
    const rangeSize = latestOffset - earliestOffset + 1
    const offset = earliestOffset + (bookingIndex % rangeSize)
    return relativeDate(offset)
  }
  if (status === 'Cancelled') {
    // ~2 weeks ago
    const offset = -14 + (bookingIndex % 5)
    return relativeDate(offset)
  }
  // Active bookings: today through +25 days
  const li = localIndex ?? bookingIndex
  if (dcCount && dcCount <= 10) {
    // Compress: spread across ~10 days so multi-day courses overlap heavily
    const dayOffset = (li + configIndex * 2) % 10
    return relativeDate(dayOffset)
  }
  // Large DCs: spread across 25 days for denser overlap
  const dayOffset = (bookingIndex * 2 + configIndex * 5) % 25
  return relativeDate(dayOffset)
}

function getEndDate(startDate: string, activityType: CourseCode[]): string {
  // O+A is stored as ['OW','AOW'] — total duration is 4 days
  if (activityType.length === 2 && activityType.includes('OW' as CourseCode) && activityType.includes('AOW' as CourseCode)) {
    return addDays(startDate, 3) // 4 days total (day 0 to day 3)
  }
  const code = activityType[0]
  const duration = COURSE_DURATIONS[code] || 1
  return addDays(startDate, duration - 1)
}

// ── Booking generator ───────────────────────────────────────────────

export function generateAllSeedData(customers: SeedCustomer[]): SeedData {
  const bookings: SeedBooking[] = []
  const bookingResources: SeedBookingResource[] = []
  const customerProfiles: SeedCustomerProfile[] = []
  const bookingLinks: SeedBookingLink[] = []
  const bookingSessions: SeedBookingSession[] = []
  const reservations: SeedReservation[] = []
  const availabilitySnapshots: SeedAvailabilitySnapshot[] = []
  const equipmentBags: SeedEquipmentBag[] = []
  const notifications: SeedNotification[] = []

  let globalBookingIndex = 0
  let customerCursor = 0

  // Amanda referral DC rotation
  const amandaReferralDCs = ['n7rq5j', 'p5ky3w', 'q9bz7r', 'h3cp6n', 'z8mv4c', 'v6js2t', 'm4fx8d', 't7gw1k']
  const amandaReferralDCNames: Record<string, string> = {
    n7rq5j: 'Hug Ocean',
    p5ky3w: 'Phuket Dive Center',
    q9bz7r: 'Nicole Dive Center',
    h3cp6n: 'Scuba Deep',
    z8mv4c: 'Neptune',
    v6js2t: 'Manta Dive Center',
    m4fx8d: 'ScubaNicks',
    t7gw1k: 'Pray Dive Center',
  }

  // Identify the referral config (last one)
  const isReferralConfig = (ci: number) => ci === BOOKING_CONFIGS.length - 1

  for (let ci = 0; ci < BOOKING_CONFIGS.length; ci++) {
    const config = BOOKING_CONFIGS[ci]

    // Build activity list from mix
    const activities: CourseCode[][] = []
    for (const [code, count] of Object.entries(config.activityMix)) {
      for (let n = 0; n < count; n++) {
        if (code === 'OW+AOW') {
          activities.push(['OW', 'AOW'] as CourseCode[])
        } else {
          activities.push([code as CourseCode])
        }
      }
    }

    // Build status list from mix
    const statuses: BookingStatus[] = []
    for (const [status, count] of Object.entries(config.statusMix)) {
      for (let n = 0; n < count; n++) {
        statuses.push(status as BookingStatus)
      }
    }

    // Track urgent draft count for large DCs
    let urgentDraftCount = 0
    const isLargeDC = config.count >= 20

    // Check if this config uses hardcoded Hug Ocean bookings
    const useHugOceanDefs = config.ownerSlug === 'n7rq5j' && config.ownerType === 'DiveCenter' && HUG_OCEAN_BOOKINGS.length > 0

    for (let bi = 0; bi < config.count; bi++) {
      const bIdx = globalBookingIndex

      // Use hardcoded defs for Hug Ocean, generic mix for everything else
      let activityType: CourseCode[]
      let status: BookingStatus
      let startDate: string
      let endDate: string
      let diverCount: number

      if (useHugOceanDefs && bi < HUG_OCEAN_BOOKINGS.length) {
        const def = HUG_OCEAN_BOOKINGS[bi]
        activityType = def.activityType
        status = def.status
        startDate = def.startDate
        endDate = def.endDate
        diverCount = def.diverCount
      } else {
        activityType = activities[bi % activities.length]
        status = statuses[bi % statuses.length]
        startDate = getStartDate(status, bi, ci, activityType, bi, config.count)
        endDate = getEndDate(startDate, activityType)
        diverCount = getDiverCount(bIdx)
      }

      // Boat capacity test: pack March 25 for shared boats
      const isSharedBoatCapacity = !config.ownBoatSlug && config.ownerType === 'DiveCenter' && status === 'Upcoming' && bi === 0

      if (isSharedBoatCapacity) {
        diverCount = 5
      }

      // Assign customers from pool
      const bookingCustomers: SeedCustomer[] = []
      for (let d = 0; d < diverCount; d++) {
        bookingCustomers.push(customers[customerCursor % customers.length])
        customerCursor++
      }

      // Determine language from first customer
      const firstCustomerLang = COUNTRY_LANGUAGES[bookingCustomers[0].nationality] || 'English'

      // Determine owner info for referrals
      let actualOwnerId = config.ownerSlug
      let actualOwnerType: OperatorType = config.ownerType
      let operatorName = config.ownerName
      let agentId: string | undefined = undefined
      let agentIsReferral: boolean | undefined = undefined

      if (isReferralConfig(ci)) {
        // Amanda referral: DC is the owner
        const dcSlug = amandaReferralDCs[bi % amandaReferralDCs.length]
        actualOwnerId = dcSlug
        actualOwnerType = 'DiveCenter'
        operatorName = amandaReferralDCNames[dcSlug]
        agentId = 'r5yz4q'
        agentIsReferral = true
      }

      // Special scenario: language mismatch — Korean-only customer with English-only instructor
      const isLangMismatch = bIdx === 15

      // Compute final dates early (shared boat capacity test may override)
      let finalStartDate = startDate
      let finalEndDate = endDate
      if (isSharedBoatCapacity) {
        finalStartDate = relativeDate(3)
        finalEndDate = getEndDate(relativeDate(3), activityType)
      }

      // ── External stakeholders ─────────────────────────────────────
      // Build first: each field marks that resource as outside the system.
      // Then assign in-system IDs only for resources NOT marked external.
      // Sessions/reservations are only created for in-system resources.
      let externalStakeholders: {
        instructorName?: string
        boatName?: string
        equipmentManagerName?: string
        poolName?: string
        compressorName?: string
      } | undefined = undefined

      if (bIdx >= 130 && bIdx <= 137) {
        // All resources external — realistic name pools
        const ei = bIdx - 130
        const extInstructors = ['Tom Wilson', 'Lisa Chen', 'Marco Rossi', 'Sophie Laurent', 'Yuki Tanaka', 'James Cooper', 'Anna Berg', 'Carlos Mendez']
        const extBoats = ['Blue Horizon', 'Sea Dragon', 'Island Spirit', 'Deep Blue', 'Ocean Star', 'Coral Queen', 'Andaman Explorer', 'Reef Runner']
        const extEquipment = ['Dive Gear Phuket', 'Scuba Supply Co', 'Andaman Equipment', 'Ocean Gear Rental', 'Reef Tech', 'Island Dive Supply', 'Deep Blue Equipment', 'Thai Dive Gear']
        const extCompressors = ['Chalong Air Fill', 'Phuket Air Station', 'Island Compressor', 'Dive Air Thailand', 'Andaman Fill Station', 'Rawai Air Service', 'Kata Compressor', 'Patong Air Supply']
        const extPools = ['Kata Beach Resort Pool', 'Royal Phuket Hotel Pool', 'Coconut Island Pool', 'Laguna Pool Center']
        externalStakeholders = {
          instructorName: extInstructors[ei],
          boatName: extBoats[ei],
          equipmentManagerName: extEquipment[ei],
          compressorName: extCompressors[ei],
        }
        if (activityType.includes('OW' as CourseCode)) {
          externalStakeholders.poolName = extPools[ei % extPools.length]
        }
      } else if (config.ownerSlug === 'n7rq5j' && bi >= 40 && bi <= 43) {
        // Operator-added outside instructor, own resources in-system
        externalStakeholders = { instructorName: 'Kai Sørensen' }
      }

      // ── In-system resource assignments ────────────────────────────
      let bookingInstructorId: string | undefined = undefined
      let bookingBoatId: string | undefined = undefined
      let bookingEquipmentManagerId: string | undefined = undefined
      let bookingPoolId: string | undefined = undefined
      let bookingCompressorId: string | undefined = undefined

      const ownerConfig = isReferralConfig(ci)
        ? BOOKING_CONFIGS.find((c) => c.ownerSlug === actualOwnerId && c.ownerType === 'DiveCenter')
        : config

      // Compressor
      if (!externalStakeholders?.compressorName && status !== 'Cancelled') {
        bookingCompressorId = COMPRESSOR_SLUG
      }

      // Instructor
      if (!externalStakeholders?.instructorName) {
        if (isLangMismatch) {
          bookingInstructorId = 'ben-walker' // English only (lang mismatch test)
          markInstructorForDateRange('ben-walker', finalStartDate, finalEndDate)
        } else {
          bookingInstructorId = findInstructorForLanguage(firstCustomerLang, bIdx, finalStartDate, finalEndDate)
        }
      }

      // Boat
      if (!externalStakeholders?.boatName) {
        if (isSharedBoatCapacity) {
          bookingBoatId = 'n7rq5j' // Hug Ocean boat
        } else {
          bookingBoatId = getBoatSlug(ownerConfig || config, bIdx)
        }
      }

      // Equipment
      if (!externalStakeholders?.equipmentManagerName) {
        bookingEquipmentManagerId = getEquipmentSlug(ownerConfig || config, bIdx)
      }

      // Pool (OW or O+A only)
      if (!externalStakeholders?.poolName && activityType.includes('OW' as CourseCode)) {
        bookingPoolId = getPoolSlug(ownerConfig || config, bIdx)
      }

      // Portal flags
      const isDraftWaiting = status === 'Draft' && bi % 2 === 0
      const customerFormComplete = status === 'Draft' ? !isDraftWaiting : true

      // CreatedAt timing
      let createdAt = NOW
      if (status === 'Completed') {
        createdAt = NOW - 7 * DAY_MS // 7 days ago
      } else if (status === 'Cancelled') {
        createdAt = NOW - 5 * DAY_MS // 5 days ago
      }

      // ExpiresAt for drafts
      let expiresAt: number | undefined = undefined
      if (status === 'Draft') {
        // For Hug Ocean hardcoded bookings, make the first draft urgent (bi=14, starts today)
        const isUrgentHugOcean = useHugOceanDefs && bi < HUG_OCEAN_BOOKINGS.length && urgentDraftCount < 1
        if (isUrgentHugOcean || (!useHugOceanDefs && isLargeDC && urgentDraftCount < 2)) {
          // Urgent: ~2 hours remaining
          expiresAt = NOW - 36000000 + HOLD_TTL
          urgentDraftCount++
        } else {
          expiresAt = createdAt + HOLD_TTL
        }
      }

      // Build diver array
      const divers = bookingCustomers.map((c, di) => ({
        name: `${c.legalFirstName} ${c.legalLastName}`,
        abbrev: `${c.legalFirstName[0]}${c.legalLastName[0]}`,
        flag: {
          code: c.nationality,
          label: COUNTRY_LABELS[c.nationality] || c.nationality,
        },
        startDate: finalStartDate,
        endDate: finalEndDate,
        agency: 'PADI' as const,
        activityType,
      }))

      const booking: SeedBooking = {
        ownerId: actualOwnerId,
        ownerType: actualOwnerType,
        status,
        createdAt,
        holdTTL: HOLD_TTL,
        ...(expiresAt !== undefined && { expiresAt }),
        paid: status !== 'Draft',
        activityType,
        startDate: finalStartDate,
        endDate: finalEndDate,
        divers,
        ...(agentIsReferral !== undefined && { agentIsReferral }),
        ...(agentId !== undefined && { agentId }),
        operatorName,
        portalContact: true,
        portalMedical: true,
        portalWaiver: true,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete,
      }

      bookings.push(booking)

      // ── Booking resources (junction table dual-write) ───────────
      if (bookingInstructorId) {
        bookingResources.push({ bookingIndex: bIdx, resourceType: 'Instructor', resourceSlug: bookingInstructorId })
      } else if (externalStakeholders?.instructorName) {
        bookingResources.push({ bookingIndex: bIdx, resourceType: 'Instructor', externalName: externalStakeholders.instructorName })
      }
      if (bookingBoatId) {
        bookingResources.push({ bookingIndex: bIdx, resourceType: 'Boat', resourceSlug: bookingBoatId })
      } else if (externalStakeholders?.boatName) {
        bookingResources.push({ bookingIndex: bIdx, resourceType: 'Boat', externalName: externalStakeholders.boatName })
      }
      if (bookingEquipmentManagerId) {
        bookingResources.push({ bookingIndex: bIdx, resourceType: 'Equipment', resourceSlug: bookingEquipmentManagerId })
      } else if (externalStakeholders?.equipmentManagerName) {
        bookingResources.push({ bookingIndex: bIdx, resourceType: 'Equipment', externalName: externalStakeholders.equipmentManagerName })
      }
      if (bookingPoolId) {
        bookingResources.push({ bookingIndex: bIdx, resourceType: 'Pool', resourceSlug: bookingPoolId })
      } else if (externalStakeholders?.poolName) {
        bookingResources.push({ bookingIndex: bIdx, resourceType: 'Pool', externalName: externalStakeholders.poolName })
      }
      if (bookingCompressorId) {
        bookingResources.push({ bookingIndex: bIdx, resourceType: 'Compressor', resourceSlug: bookingCompressorId })
      } else if (externalStakeholders?.compressorName) {
        bookingResources.push({ bookingIndex: bIdx, resourceType: 'Compressor', externalName: externalStakeholders.compressorName })
      }

      // ── Customer profiles ───────────────────────────────────────
      for (let di = 0; di < bookingCustomers.length; di++) {
        const c = bookingCustomers[di]
        const custIdx = (customerCursor - diverCount + di) % customers.length

        customerProfiles.push({
          bookingIndex: bIdx,
          customerIndex: custIdx,
          linkToken: deterministicUUID('cp', bIdx * 10 + di),
          accommodationName: `Hotel ${COUNTRY_LABELS[c.nationality] || 'Phuket'} ${bIdx}`,
          needsPickup: di % 3 === 0,
          pickupLocation: di % 3 === 0 ? 'Patong Beach' : undefined,
          pickupTime: di % 3 === 0 ? '08:00' : undefined,
          submittedAt: customerFormComplete ? createdAt + 3600000 : undefined,
        })
      }

      // ── Booking links ───────────────────────────────────────────
      for (let di = 0; di < bookingCustomers.length; di++) {
        const c = bookingCustomers[di]
        const custIdx = (customerCursor - diverCount + di) % customers.length

        bookingLinks.push({
          bookingIndex: bIdx,
          token: deterministicUUID('bl', bIdx * 10 + di),
          expiresAt: createdAt + HOLD_TTL,
          customerName: `${c.legalFirstName} ${c.legalLastName}`,
          email: c.email,
        })
      }

      // ── Booking sessions and reservations ──
      // Sessions are created for each in-system resource (ID set).
      // External resources (name only in externalStakeholders) get no sessions.
      {
        const sessionStartIdx = bookingSessions.length

        // Calculate how many session days this booking covers
        const [sy, sm, sd] = finalStartDate.split('-').map(Number)
        const [ey, em, ed] = finalEndDate.split('-').map(Number)
        const startDt = new Date(sy, sm - 1, sd)
        const endDt = new Date(ey, em - 1, ed)
        const totalDays = Math.round((endDt.getTime() - startDt.getTime()) / (24 * 60 * 60 * 1000)) + 1

        // Determine reservation status based on booking status
        // For Draft bookings, self-owned resources auto-confirm (owner can't accept their own booking)
        let baseResStatus: ReservationStatus = 'PendingAcceptance'
        let confirmedAt: number | undefined = undefined
        let vacatedAt: number | undefined = undefined
        let vacatedBy: SeedReservation['vacatedBy'] = undefined

        if (status === 'Upcoming' || status === 'Completed') {
          baseResStatus = 'Confirmed'
          confirmedAt = createdAt + 1800000 // 30 min after creation
        } else if (status === 'Cancelled') {
          baseResStatus = 'Vacated'
          vacatedAt = createdAt + 3600000
          vacatedBy = 'booking_cancelled'
        }

        // For Draft bookings, auto-confirm resources owned by the booking operator
        // or resources with Auto acceptance preference (non-instructor types)
        function resStatusForResource(resourceSlug: string, resourceType?: string): ReservationStatus {
          if (status !== 'Draft') return baseResStatus
          // Self-booking: auto-confirm
          if (resourceSlug === actualOwnerId) return 'Confirmed'
          // Non-instructor resources have Auto acceptance preference
          if (resourceType && resourceType !== 'Instructor') return 'Confirmed'
          return baseResStatus
        }
        function confirmedAtForResource(resourceSlug: string, resourceType?: string): number | undefined {
          if (status !== 'Draft') return confirmedAt
          if (resourceSlug === actualOwnerId) return createdAt
          if (resourceType && resourceType !== 'Instructor') return createdAt
          return confirmedAt
        }

        // Push a session + its reservation in one call (closure over booking-scoped vars)
        function pushSession(
          slug: string,
          type: string,
          date: string,
          startTime: string,
          endTime: string,
          units: number,
          deliveryLocation?: 'BoatPier' | 'Pool' | 'Beach',
        ): void {
          const sIdx = bookingSessions.length - sessionStartIdx
          bookingSessions.push({
            bookingIndex: bIdx,
            inventorySlug: slug,
            inventoryType: type,
            date,
            startTime,
            endTime,
            timezone: TIMEZONE,
            ...(deliveryLocation && { deliveryLocation }),
          })
          const resConfirmedAt = confirmedAtForResource(slug, type)
          reservations.push({
            bookingIndex: bIdx,
            sessionIndex: sIdx,
            inventorySlug: slug,
            inventoryType: type,
            unitsRequested: units,
            status: resStatusForResource(slug, type),
            ...(resConfirmedAt !== undefined && { confirmedAt: resConfirmedAt }),
            ...(status === 'Draft' && { expiresAt: expiresAt }),
            ...(vacatedAt !== undefined && { vacatedAt }),
            ...(vacatedBy !== undefined && { vacatedBy }),
          })
        }

        // Generate sessions per day for each resource
        for (let day = 0; day < totalDays; day++) {
          const sessionDate = addDays(finalStartDate, day)
          const isPoolOnlyDay = day === 0 && activityType.includes('OW' as CourseCode)
          const location: 'Pool' | 'BoatPier' = isPoolOnlyDay ? 'Pool' : 'BoatPier'

          // Instructor
          if (bookingInstructorId) {
            pushSession(bookingInstructorId, 'Instructor', sessionDate, '08:00', '16:00', 1, location)
          }

          // Helper instructors (5+ divers)
          if (diverCount >= 5 && bookingInstructorId) {
            const helpersNeeded = Math.ceil(diverCount / 4) - 1
            for (let h = 0; h < helpersNeeded; h++) {
              const helperSlug = findHelperInstructor(bookingInstructorId, bIdx, h, sessionDate)
              pushSession(helperSlug, 'Instructor', sessionDate, '08:00', '16:00', 1, location)
            }
          }

          // Boat (skip pool-only days)
          if (bookingBoatId && !isPoolOnlyDay) {
            pushSession(bookingBoatId, 'Boat', sessionDate, '07:30', '16:30', diverCount, 'BoatPier')
          }

          // Pool (day 0 only for OW)
          if (bookingPoolId && isPoolOnlyDay) {
            pushSession(bookingPoolId, 'Pool', sessionDate, '09:00', '12:00', diverCount, 'Pool')
          }

          // Compressor (all boat days, 2 tanks per diver)
          if (bookingCompressorId && !isPoolOnlyDay) {
            pushSession(bookingCompressorId, 'Compressor', sessionDate, '06:00', '07:00', diverCount * 2)
          }
        }
      }

      // ── Equipment bags (for bookings with in-system equipment manager) ──
      if (status !== 'Cancelled' && bookingEquipmentManagerId) {
        for (let di = 0; di < diverCount; di++) {
          equipmentBags.push({
            bagNumber: `BAG-${String(bIdx).padStart(3, '0')}-${String(di + 1).padStart(2, '0')}`,
            equipmentManagerId: bookingEquipmentManagerId,
            bookingIndex: bIdx,
            status: status === 'Completed' ? 'Returned' : 'Assigned',
            assignedAt: createdAt + 7200000,
            ...(status === 'Completed' && { returnedAt: createdAt + 8 * 24 * 60 * 60 * 1000 }),
          })
        }
      }

      // ── Notifications ───────────────────────────────────────────
      if (status !== 'Draft') {
        // Referral notifications
        if (agentIsReferral) {
          notifications.push({
            userId: actualOwnerId,
            type: 'booking_referred',
            bookingIndex: bIdx,
            message: `Referral from Amanda: ${activityType.join('+')} on ${finalStartDate}`,
            createdAt,
          })
        }

        // Cancelled booking notifications
        if (status === 'Cancelled') {
          notifications.push({
            userId: actualOwnerId,
            type: 'booking_cancelled',
            bookingIndex: bIdx,
            message: `Booking cancelled: ${activityType.join('+')} on ${finalStartDate}`,
            createdAt: createdAt + 3600000,
          })
        }
      }

      globalBookingIndex++
    }
  }

  // ── Availability snapshots ──────────────────────────────────────
  // Build from sessions: aggregate reserved units per inventory+date
  const snapshotMap = new Map<string, SeedAvailabilitySnapshot>()

  for (let ri = 0; ri < reservations.length; ri++) {
    const res = reservations[ri]
    if (res.status === 'Vacated') continue // Don't count vacated

    // Find the matching session
    const booking = bookings[res.bookingIndex]
    const sessionKey = `${res.inventorySlug}|${res.inventoryType}`

    // Get the session to find the date
    // Find all sessions for this booking and pick by sessionIndex
    let sessionCount = 0
    let targetSession: SeedBookingSession | undefined
    for (const s of bookingSessions) {
      if (s.bookingIndex === res.bookingIndex) {
        if (sessionCount === res.sessionIndex) {
          targetSession = s
          break
        }
        sessionCount++
      }
    }

    if (!targetSession) continue

    const snapKey = `${res.inventorySlug}|${res.inventoryType}|${targetSession.date}|${targetSession.startTime}|${targetSession.endTime}`

    const existing = snapshotMap.get(snapKey)
    if (existing) {
      existing.reservedUnits += res.unitsRequested
      existing.availableUnits = existing.totalUnits - existing.reservedUnits
    } else {
      const totalUnits = getTotalUnitsForResource(res.inventorySlug, res.inventoryType)
      snapshotMap.set(snapKey, {
        inventorySlug: res.inventorySlug,
        inventoryType: res.inventoryType,
        date: targetSession.date,
        windowStart: targetSession.startTime,
        windowEnd: targetSession.endTime,
        totalUnits,
        reservedUnits: res.unitsRequested,
        availableUnits: totalUnits - res.unitsRequested,
      })
    }
  }

  const snapshots = Array.from(snapshotMap.values())

  return {
    customers,
    bookings,
    bookingResources,
    customerProfiles,
    bookingLinks,
    bookingSessions,
    reservations,
    availabilitySnapshots: snapshots,
    equipmentBags,
    notifications,
    blockedDates: HUG_OCEAN_BLOCKED_DATES,
  }
}

// ── Diver count distribution ────────────────────────────────────────

function getDiverCount(bookingIndex: number): number {
  const bucket = bookingIndex % 20

  // ~5% have 7+ divers
  if (bucket === 19) return 7 + (bookingIndex % 3)

  // ~20% have 5-6 divers
  if (bucket >= 15) return 5 + (bookingIndex % 2)

  // ~75% have 2-4 divers
  return 2 + (bookingIndex % 3)
}

// ── Helper instructor for large groups ──────────────────────────────

function findHelperInstructor(primarySlug: string, bookingIndex: number, helperIndex: number, sessionDate?: string): string {
  // Pick from English-speaking pool, skipping the primary
  const pool = INSTRUCTOR_SLUGS
    .filter((i) => i.slug !== primarySlug && i.languages.includes('English'))
    .map((i) => i.slug)

  // If date provided, prefer instructors available on that date
  if (sessionDate) {
    const availablePool = pool.filter(slug => isInstructorAvailableOnDate(slug, sessionDate))
    if (availablePool.length > 0) {
      const slug = availablePool[(bookingIndex + helperIndex) % availablePool.length]
      markInstructorOnDate(slug, sessionDate)
      return slug
    }
  }

  // Try any instructor (not just English-speaking) who is available on this date
  if (sessionDate) {
    const allPool = INSTRUCTOR_SLUGS
      .filter((i) => i.slug !== primarySlug)
      .map((i) => i.slug)
    const allAvailable = allPool.filter(s => isInstructorAvailableOnDate(s, sessionDate))
    if (allAvailable.length > 0) {
      const s = allAvailable[(bookingIndex + helperIndex) % allAvailable.length]
      markInstructorOnDate(s, sessionDate)
      return s
    }
  }

  // Absolute last resort
  const slug = pool[(bookingIndex + helperIndex) % pool.length]
  if (sessionDate) markInstructorOnDate(slug, sessionDate)
  return slug
}

// ── Total units for known resources ─────────────────────────────────

function getTotalUnitsForResource(slug: string, type: string): number {
  // Instructors are exclusive (1 unit)
  if (type === 'Instructor') return 1

  // Boats
  if (type === 'Boat') {
    const boatCapacities: Record<string, number> = {
      'n7rq5j': 50,  // M.V. Hug Ocean
      'p5ky3w': 70,  // M.V.MQ5 (using first fleet entry)
      'h3cp6n': 70,  // M.V. Sirolo
    }
    return boatCapacities[slug] || 70
  }

  // Pools
  if (type === 'Pool') {
    const poolCapacities: Record<string, number> = {
      'b3wt9f': 25,  // Water Pro
      'g2hn6x': 8,   // Shark Bites
      'n7rq5j': 15,  // Hug Ocean
      'z8mv4c': 6,   // Neptune
    }
    return poolCapacities[slug] || 10
  }

  // Compressors are effectively unlimited
  if (type === 'Compressor') return 999999

  return 1
}
