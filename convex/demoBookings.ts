import { v, type Infer } from 'convex/values'
import { internalAction, internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { HOLD_TTL_MS } from './lib/auth'
import { BOOKING_LINK_TTL_MS } from './lib/timeConstants'
import { type CourseCode, courseCodeValidator } from './shared/courseCodes'
import { batchDelete } from './lib/batch'
import { dateStr, addDays, COURSE_DURATIONS } from './lib/seedUtils'
import type { BookingStatus } from './shared/statuses'
import { BOOKING_STATUS, bookingStatusValidator } from './shared/statuses'
import { operatorTypeValidator } from './shared/operatorTypes'
import { resourceOwnerTypeValidator } from './shared/resourceOwnerTypes'

const NOW = Date.now()

const DEMO_BOOKINGS_CONFIG: {
  activityType: CourseCode[]
  status: BookingStatus
  dayOffset: number
  diverCount: number
}[] = [
  { activityType: ['FD'], status: 'Completed', dayOffset: -12, diverCount: 2 },
  { activityType: ['DSD'], status: 'Completed', dayOffset: -10, diverCount: 3 },
  { activityType: ['OW'], status: 'Completed', dayOffset: -8, diverCount: 2 },
  { activityType: ['DSD'], status: 'Cancelled', dayOffset: -11, diverCount: 2 },
  { activityType: ['FD'], status: 'Cancelled', dayOffset: -9, diverCount: 2 },
  { activityType: ['DSD'], status: 'Upcoming', dayOffset: 1, diverCount: 3 },
  { activityType: ['OW'], status: 'Upcoming', dayOffset: 2, diverCount: 2 },
  { activityType: ['AOW'], status: 'Upcoming', dayOffset: 4, diverCount: 2 },
  { activityType: ['FD'], status: 'Upcoming', dayOffset: 6, diverCount: 4 },
  { activityType: ['OW'], status: 'Draft', dayOffset: 3, diverCount: 2 },
  { activityType: ['DSD'], status: 'Draft', dayOffset: 5, diverCount: 3 },
  { activityType: ['AOW'], status: 'Draft', dayOffset: 7, diverCount: 2 },
]

const DEMO_NAMES = [
  { first: 'Wei', last: 'Wang' }, { first: 'Emma', last: 'Smith' },
  { first: 'Joon', last: 'Kim' }, { first: 'Marie', last: 'Dupont' },
  { first: 'Somchai', last: 'Srisuk' }, { first: 'Yuki', last: 'Tanaka' },
  { first: 'Hans', last: 'Mueller' }, { first: 'Olivia', last: 'Thompson' },
  { first: 'Carlos', last: 'Silva' }, { first: 'Fatima', last: 'Al-Rashid' },
  { first: 'Dmitri', last: 'Volkov' }, { first: 'Nattaya', last: 'Jaidee' },
]

const DEMO_COUNTRIES = ['CN', 'GB', 'KR', 'FR', 'TH', 'JP', 'DE', 'AU', 'BR', 'SA', 'RU', 'TH']
const COUNTRY_LABELS: Record<string, string> = {
  CN: 'China', GB: 'United Kingdom', KR: 'South Korea', FR: 'France', TH: 'Thailand',
  JP: 'Japan', DE: 'Germany', AU: 'Australia', BR: 'Brazil', SA: 'Saudi Arabia', RU: 'Russia',
}

function todayStr(): string {
  const d = new Date(NOW)
  return dateStr(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export const scheduleDemoBookings = internalAction({
  args: {
    slug: v.string(),
    role: operatorTypeValidator,
    operatorName: v.string(),
  },
  handler: async (ctx, args) => {
    const today = todayStr()
    const bookingRecords: Infer<typeof demoBookingValidator>[] = []
    const customerRecords: Infer<typeof demoCustomerValidator>[] = []
    const profileRecords: Infer<typeof demoProfileValidator>[] = []
    const resourceRecords: Infer<typeof demoResourceValidator>[] = []

    let customerCursor = 0

    for (let i = 0; i < DEMO_BOOKINGS_CONFIG.length; i++) {
      const cfg = DEMO_BOOKINGS_CONFIG[i]
      const startDate = addDays(today, cfg.dayOffset)
      const code = cfg.activityType[0]
      const duration = COURSE_DURATIONS[code] || 1
      const endDate = addDays(startDate, duration - 1)

      const createdAt = cfg.status === BOOKING_STATUS.Completed ? NOW - 7 * 86400000
        : cfg.status === BOOKING_STATUS.Cancelled ? NOW - 5 * 86400000
        : NOW

      const divers = []
      for (let d = 0; d < cfg.diverCount; d++) {
        const nameIdx = (customerCursor + d) % DEMO_NAMES.length
        const name = DEMO_NAMES[nameIdx]
        const country = DEMO_COUNTRIES[nameIdx]
        divers.push({
          name: `${name.first} ${name.last}`,
          abbrev: `${name.first[0]}${name.last[0]}`,
          flag: { code: country, label: COUNTRY_LABELS[country] || country },
          startDate,
          endDate,
          agency: 'PADI',
          activityType: cfg.activityType,
        })
      }

      for (let d = 0; d < cfg.diverCount; d++) {
        const nameIdx = (customerCursor + d) % DEMO_NAMES.length
        const name = DEMO_NAMES[nameIdx]
        const country = DEMO_COUNTRIES[nameIdx]
        customerRecords.push({
          legalFirstName: name.first,
          legalLastName: name.last,
          email: `demo-${customerCursor + d}@example.com`,
          phone: `+1-555-${String(1000 + customerCursor + d)}`,
          nationality: country,
          dateOfBirth: '1990-06-15',
          passportNumber: `DEMO${String(100000 + customerCursor + d)}`,
          passportIssuingCountry: country,
          passportExpirationDate: '2029-01-15',
          gender: d % 2 === 0 ? 'M' : 'F',
          emergencyContactName: `EC ${name.last}`,
          emergencyContactPhone: `+1-555-${String(2000 + customerCursor + d)}`,
          emergencyContactRelation: 'spouse',
          createdAt: NOW,
        })

        profileRecords.push({
          bookingLocalIndex: i,
          customerLocalIndex: customerCursor + d,
          linkToken: `demo-link-${i}-${d}`,
        })
      }

      resourceRecords.push({ bookingLocalIndex: i, resourceType: 'Instructor', externalName: 'Demo Instructor' })
      resourceRecords.push({ bookingLocalIndex: i, resourceType: 'Boat', externalName: 'Demo Boat' })
      resourceRecords.push({ bookingLocalIndex: i, resourceType: 'Equipment', externalName: 'Demo Equipment' })

      bookingRecords.push({
        ownerId: args.slug,
        ownerType: args.role,
        status: cfg.status,
        createdAt,
        holdTTL: HOLD_TTL_MS,
        ...(cfg.status === BOOKING_STATUS.Draft && { expiresAt: createdAt + HOLD_TTL_MS }),
        paid: cfg.status !== BOOKING_STATUS.Draft,
        activityType: cfg.activityType,
        startDate,
        endDate,
        divers,
        operatorName: args.operatorName,
        portalContact: true,
        portalMedical: true,
        portalWaiver: true,
        medicalHardBlock: false,
        bookingFormComplete: true,
        customerFormComplete: cfg.status !== BOOKING_STATUS.Draft,
        isDemo: true,
      })

      customerCursor += cfg.diverCount
    }

    await ctx.runMutation(internal.demoBookings.insertDemoBatch, {
      bookings: bookingRecords,
      customers: customerRecords,
      profiles: profileRecords,
      resources: resourceRecords,
    })
  },
})

// comments-ok validator-guard-ok: internal-only seeder; nested phone/country are server-generated literals
const demoDiverValidator = v.object({
  name: v.string(),
  abbrev: v.string(),
  flag: v.object({ code: v.string(), label: v.string() }),
  startDate: v.string(),
  endDate: v.string(),
  agency: v.string(),
  activityType: v.array(courseCodeValidator),
})

const demoBookingValidator = v.object({
  ownerId: v.string(),
  ownerType: operatorTypeValidator,
  status: bookingStatusValidator,
  createdAt: v.number(),
  holdTTL: v.number(),
  expiresAt: v.optional(v.number()),
  paid: v.boolean(),
  activityType: v.array(courseCodeValidator),
  startDate: v.string(),
  endDate: v.string(),
  divers: v.array(demoDiverValidator),
  operatorName: v.string(),
  portalContact: v.boolean(),
  portalMedical: v.boolean(),
  portalWaiver: v.boolean(),
  medicalHardBlock: v.boolean(),
  bookingFormComplete: v.boolean(),
  customerFormComplete: v.boolean(),
  isDemo: v.boolean(),
})

const demoCustomerValidator = v.object({
  legalFirstName: v.string(),
  legalLastName: v.string(),
  email: v.string(),
  phone: v.string(),
  nationality: v.string(),
  dateOfBirth: v.string(),
  passportNumber: v.string(),
  passportIssuingCountry: v.string(),
  passportExpirationDate: v.string(),
  gender: v.union(v.literal('M'), v.literal('F'), v.literal('Other')),
  emergencyContactName: v.string(),
  emergencyContactPhone: v.string(),
  emergencyContactRelation: v.string(),
  createdAt: v.number(),
})

const demoProfileValidator = v.object({
  bookingLocalIndex: v.number(),
  customerLocalIndex: v.number(),
  linkToken: v.string(),
})

const demoResourceValidator = v.object({
  bookingLocalIndex: v.number(),
  resourceType: resourceOwnerTypeValidator,
  externalName: v.string(),
})

export const insertDemoBatch = internalMutation({
  args: {
    bookings: v.array(demoBookingValidator),
    customers: v.array(demoCustomerValidator),
    profiles: v.array(demoProfileValidator),
    resources: v.array(demoResourceValidator),
  },
  handler: async (ctx, args) => {
    const [customerIds, bookingIds] = await Promise.all([
      Promise.all(args.customers.map((c) => ctx.db.insert('customers', c))),
      Promise.all(args.bookings.map((b) => ctx.db.insert('bookings', b))),
    ])

    await Promise.all([
      Promise.all(
        args.profiles
          .filter((p) => bookingIds[p.bookingLocalIndex] && customerIds[p.customerLocalIndex])
          .map((p) => {
            const bookingDoc = args.bookings[p.bookingLocalIndex]
            const customerDoc = args.customers[p.customerLocalIndex]
            const now = Date.now()
            return ctx.db.insert('bookingLinks', {
              bookingId: bookingIds[p.bookingLocalIndex],
              token: p.linkToken,
              expiresAt: now + BOOKING_LINK_TTL_MS,
              customerName: `${customerDoc.legalFirstName} ${customerDoc.legalLastName}`,
              email: customerDoc.email,
              ...(bookingDoc?.status !== BOOKING_STATUS.Draft ? { usedAt: now } : {}),
            })
          }),
      ),
      Promise.all(
        args.profiles
          .filter((p) => bookingIds[p.bookingLocalIndex] && customerIds[p.customerLocalIndex])
          .map((p) =>
            ctx.db.insert('customerProfiles', {
              bookingId: bookingIds[p.bookingLocalIndex],
              customerId: customerIds[p.customerLocalIndex],
              linkToken: p.linkToken,
              accommodationName: 'Demo Hotel',
              needsPickup: false,
            })),
      ),
      Promise.all(
        args.resources
          .filter((r) => bookingIds[r.bookingLocalIndex])
          .map((r) =>
            ctx.db.insert('bookingResources', {
              bookingId: bookingIds[r.bookingLocalIndex],
              resourceType: r.resourceType,
              externalName: r.externalName,
            })),
      ),
    ])
  },
})

export const cleanupDemoBookings = internalMutation({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) => {
    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_ownerId_ownerType', q => q.eq('ownerId', ownerId))
      .collect() // bounded: per-owner demo bookings

    const demoBookings = bookings.filter(b => b.isDemo === true)
    if (demoBookings.length === 0) return

    const demoIds = demoBookings.map(b => b._id)
    const [profileArrays, resourceArrays, linkArrays, sessionArrays, reservationArrays, auditArrays, bagArrays] = await Promise.all([
      Promise.all(demoIds.map(id => ctx.db.query('customerProfiles').withIndex('by_bookingId', q => q.eq('bookingId', id)).collect())), // bounded: per-demo-booking scope
      Promise.all(demoIds.map(id => ctx.db.query('bookingResources').withIndex('by_bookingId', q => q.eq('bookingId', id)).collect())), // bounded: per-demo-booking scope
      Promise.all(demoIds.map(id => ctx.db.query('bookingLinks').withIndex('by_bookingId', q => q.eq('bookingId', id)).collect())), // bounded: per-demo-booking scope
      Promise.all(demoIds.map(id => ctx.db.query('bookingSessions').withIndex('by_bookingId', q => q.eq('bookingId', id)).collect())), // bounded: per-demo-booking scope
      Promise.all(demoIds.map(id => ctx.db.query('reservations').withIndex('by_bookingId', q => q.eq('bookingId', id)).collect())), // bounded: per-demo-booking scope
      Promise.all(demoIds.map(id => ctx.db.query('bookingAuditLog').withIndex('by_bookingId', q => q.eq('bookingId', id)).collect())), // bounded: per-demo-booking scope
      Promise.all(demoIds.map(id => ctx.db.query('equipmentBags').withIndex('by_bookingId', q => q.eq('bookingId', id)).collect())), // bounded: per-demo-booking scope
    ])

    await Promise.all([
      batchDelete(ctx, profileArrays.flat()),
      batchDelete(ctx, resourceArrays.flat()),
      batchDelete(ctx, linkArrays.flat()),
      batchDelete(ctx, sessionArrays.flat()),
      batchDelete(ctx, reservationArrays.flat()),
      batchDelete(ctx, auditArrays.flat()),
      batchDelete(ctx, bagArrays.flat()),
    ])
    await batchDelete(ctx, demoBookings)

  },
})
