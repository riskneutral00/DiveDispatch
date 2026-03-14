import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// ── Typed Unions ────────────────────────────────────────────────────

const operatorType = v.union(
  v.literal('DiveCenter'),
  v.literal('Agent'),
  v.literal('Liveaboard'),
  v.literal('DiveResort'),
  v.literal('DiveHostel'),
  v.literal('DiveSite'),
)

const resourceOwnerType = v.union(
  v.literal('Boat'),
  v.literal('Equipment'),
  v.literal('Pool'),
  v.literal('Compressor'),
  v.literal('Instructor'),
  v.literal('Liveaboard'),
  v.literal('DiveSite'),
)
// Liveaboard and DiveSite are dual-role (organizer + resource).
// DiveMaster inherits Instructor's reservation path (resourceType: 'Instructor') — NOT added to this union.
// DiveHostel inherits DiveResort's path — NOT added to this union.

const bookingStatus = v.union(
  v.literal('Draft'),
  v.literal('Upcoming'),
  v.literal('Completed'),
  v.literal('Cancelled'),
)

const reservationStatus = v.union(
  v.literal('PendingAcceptance'),
  v.literal('Confirmed'),
  v.literal('Vacated'),
  v.literal('NoShow'),
)

const capacityModel = v.union(v.literal('Exclusive'), v.literal('Pooled'))

const gearType = v.union(
  v.literal('wetsuit'),
  v.literal('bcd'),
  v.literal('fins'),
  v.literal('mask'),
  v.literal('regulator'),
)

const gender = v.union(v.literal('M'), v.literal('F'), v.literal('Other'))

const shoeSizeUnit = v.union(v.literal('EU'), v.literal('US'), v.literal('CM'))

const boatTypeUnion = v.union(
  v.literal('day_boat'),
  v.literal('speedboat'),
  v.literal('longtail'),
  v.literal('liveaboard'),
  v.literal('catamaran'),
  v.literal('rib'),
)

const gasMix = v.union(v.literal('air'), v.literal('nitrox'), v.literal('trimix'))

const courseCode = v.union(
  v.literal('DSD'),
  v.literal('TRY_DIVE'),
  v.literal('OW'),
  v.literal('AOW'),
  v.literal('RESCUE'),
  v.literal('DM'),
  v.literal('FD'),
  v.literal('REFRESH'),
  v.literal('SPECIALTY'),
)

// PrePayRequired and PostPayAllowed behave identically to Auto until Stripe integration. Schema placeholders retained.
const acceptanceMode = v.union(
  v.literal('Auto'),
  v.literal('PrePayRequired'),
  v.literal('PostPayAllowed'),
)

const stakeholderType = v.union(
  v.literal('DiveCenter'),
  v.literal('Agent'),
  v.literal('Instructor'),
  v.literal('Boat'),
  v.literal('Equipment'),
  v.literal('Pool'),
  v.literal('Compressor'),
  v.literal('DiveMaster'),
  v.literal('Liveaboard'),
  v.literal('DiveResort'),
  v.literal('DiveHostel'),
  v.literal('DiveSite'),
)

const notificationType = v.union(
  v.literal('hold_placed'),
  v.literal('hold_declined'),
  v.literal('booking_cancelled'),
  v.literal('booking_updated'),
  v.literal('booking_referred'),
  v.literal('medical_hard_block'),
  v.literal('physician_clearance_submitted'),
  v.literal('no_backup_available'),
  v.literal('min_pax_not_met'),
)

// ── Schema ──────────────────────────────────────────────────────────

export default defineSchema({
  // ── L0: Foundation ──────────────────────────────────────────────────

  users: defineTable({
    tokenIdentifier: v.string(),
    slug: v.string(),
    email: v.string(),
    name: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    nickname: v.optional(v.string()),
    businessName: v.string(),
    role: stakeholderType,
    additionalRoles: v.optional(v.array(stakeholderType)),
    isSeeded: v.boolean(),
    blockedDates: v.optional(v.array(v.string())),
    preferredLocale: v.string(),
    selectedThemeId: v.optional(v.id('themes')),
  })
    .index('by_tokenIdentifier', ['tokenIdentifier'])
    .index('by_slug', ['slug'])
    .index('by_email', ['email'])
    .index('by_role', ['role']),

  themes: defineTable({
    name: v.string(),
    slug: v.string(),
    config: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_isActive', ['isActive']),

  // ── L1: Core Booking Tables ─────────────────────────────────────────

  bookings: defineTable({
    ownerId: v.string(),
    ownerType: operatorType,
    status: bookingStatus,
    createdAt: v.number(),
    holdTTL: v.number(),
    customerProfileIds: v.optional(v.array(v.id('customerProfiles'))),
    submittedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    paid: v.boolean(),
    activityType: v.array(courseCode),
    startDate: v.string(),
    endDate: v.string(),
    divers: v.array(
      v.object({
        name: v.string(),
        abbrev: v.string(),
        flag: v.object({ code: v.string(), label: v.string() }),
        startDate: v.string(),
        endDate: v.string(),
        agency: v.optional(v.string()),
        activityType: v.array(courseCode),
      }),
    ),
    agentIsReferral: v.optional(v.boolean()),
    instructorId: v.optional(v.string()),
    boatId: v.optional(v.string()),
    equipmentManagerId: v.optional(v.string()),
    poolId: v.optional(v.string()),
    compressorId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    externalStakeholders: v.optional(
      v.object({
        instructorName: v.optional(v.string()),
        boatName: v.optional(v.string()),
        equipmentManagerName: v.optional(v.string()),
        poolName: v.optional(v.string()),
        compressorName: v.optional(v.string()),
      }),
    ),
    operatorName: v.string(),
    portalContact: v.boolean(),
    portalMedical: v.boolean(),
    portalWaiver: v.boolean(),
    medicalHardBlock: v.boolean(),
    draftState: v.optional(v.string()),
    bookingFormComplete: v.boolean(),
    customerFormComplete: v.boolean(),
  })
    .index('by_ownerId_ownerType', ['ownerId', 'ownerType'])
    .index('by_status', ['status'])
    .index('by_instructorId', ['instructorId'])
    .index('by_boatId', ['boatId'])
    .index('by_equipmentManagerId', ['equipmentManagerId'])
    .index('by_poolId', ['poolId'])
    .index('by_compressorId', ['compressorId'])
    .index('by_agentId', ['agentId']),

  bookingSessions: defineTable({
    bookingId: v.id('bookings'),
    inventoryUnitId: v.id('inventoryUnits'),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    timezone: v.string(),
    deliveryLocation: v.optional(
      v.union(v.literal('BoatPier'), v.literal('Pool'), v.literal('Beach')),
    ),
    diveSlots: v.optional(
      v.array(
        v.object({
          courseCode: courseCode,
          diveNumber: v.number(),
          isConfined: v.boolean(),
          diverIndex: v.number(),
        }),
      ),
    ),
  })
    .index('by_bookingId', ['bookingId'])
    .index('by_inventoryUnitId_date', ['inventoryUnitId', 'date'])
    .index('by_date', ['date']),

  // ── L1: Customer Tables ─────────────────────────────────────────────

  customers: defineTable({
    legalFirstName: v.string(),
    legalLastName: v.string(),
    preferredName: v.optional(v.string()),
    email: v.string(),
    phone: v.string(),
    nationality: v.string(),
    dateOfBirth: v.string(),
    passportNumber: v.string(),
    passportIssuingCountry: v.string(),
    passportExpirationDate: v.string(),
    gender: gender,
    heightCm: v.optional(v.number()),
    weightKg: v.optional(v.number()),
    shoeSize: v.optional(v.number()),
    shoeSizeUnit: v.optional(shoeSizeUnit),
    needsPoweredLenses: v.optional(v.boolean()),
    prescriptionStrength: v.optional(v.string()),
    agency: v.optional(v.string()),
    agencyID: v.optional(v.string()),
    totalDives: v.optional(v.number()),
    lastDiveDate: v.optional(v.string()),
    allergies: v.optional(v.string()),
    emergencyContactName: v.string(),
    emergencyContactPhone: v.string(),
    emergencyContactRelation: v.string(),
    clerkUserId: v.optional(v.string()),
    flags: v.optional(v.array(v.literal('medical_block'))),
    createdAt: v.number(),
  })
    .index('by_email', ['email'])
    .index('by_clerkUserId', ['clerkUserId']),

  customerProfiles: defineTable({
    bookingId: v.id('bookings'),
    customerId: v.id('customers'),
    linkToken: v.string(),
    accommodationName: v.optional(v.string()),
    needsPickup: v.optional(v.boolean()),
    pickupLocation: v.optional(v.string()),
    pickupTime: v.optional(v.string()),
    medicalSchemaVersion: v.string(),
    medicalAnswers: v.record(v.string(), v.union(v.boolean(), v.string())),
    physicianClearanceRequired: v.boolean(),
    physicianClearedAt: v.optional(v.number()),
    waiverSignedAt: v.optional(v.number()),
    signatureFileId: v.optional(v.id('_storage')),
    guardianSignatureFileId: v.optional(v.id('_storage')),
    rentalChecklist: v.optional(
      v.object({
        mask: v.union(v.literal('own'), v.literal('rent')),
        bcd: v.union(v.literal('own'), v.literal('rent')),
        wetsuit: v.union(v.literal('own'), v.literal('rent')),
        fins: v.union(v.literal('own'), v.literal('rent')),
        regulator: v.union(v.literal('own'), v.literal('rent')),
        maskPrescription: v.optional(v.string()),
      }),
    ),
    submittedAt: v.optional(v.number()),
    bloodType: v.optional(v.string()),
    insurancePolicyNumber: v.optional(v.string()),
    physicianClearanceFileId: v.optional(v.id('_storage')),
  })
    .index('by_bookingId', ['bookingId'])
    .index('by_customerId', ['customerId'])
    .index('by_linkToken', ['linkToken']),

  bookingLinks: defineTable({
    bookingId: v.id('bookings'),
    token: v.string(),
    expiresAt: v.number(),
    customerName: v.string(),
    email: v.string(),
  })
    .index('by_bookingId', ['bookingId'])
    .index('by_token', ['token']),

  // ── L1: Inventory & Reservation Tables ──────────────────────────────

  inventoryUnits: defineTable({
    resourceType: resourceOwnerType,
    resourceId: v.string(),
    displayName: v.string(),
    capacityModel: capacityModel,
    totalUnits: v.number(),
    ownerId: v.string(),
    ownerType: resourceOwnerType,
  })
    .index('by_ownerId_ownerType', ['ownerId', 'ownerType'])
    .index('by_resourceType', ['resourceType'])
    .index('by_resourceId', ['resourceId']),

  reservations: defineTable({
    bookingId: v.id('bookings'),
    inventoryUnitId: v.id('inventoryUnits'),
    bookingSessionId: v.id('bookingSessions'),
    unitsRequested: v.number(),
    status: reservationStatus,
    confirmedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    vacatedAt: v.optional(v.number()),
    vacatedBy: v.optional(
      v.union(
        v.literal('booking_cancelled'),
        v.literal('stakeholder_declined'),
        v.literal('hold_expired'),
        v.literal('operator_edit'),
        v.literal('noshow_replacement'),
      ),
    ),
  })
    .index('by_bookingId', ['bookingId'])
    .index('by_inventoryUnitId_status', ['inventoryUnitId', 'status'])
    .index('by_expiresAt_status', ['expiresAt', 'status']),

  availabilitySnapshots: defineTable({
    inventoryUnitId: v.id('inventoryUnits'),
    date: v.string(),
    windowStart: v.string(),
    windowEnd: v.string(),
    totalUnits: v.number(),
    reservedUnits: v.number(),
    availableUnits: v.number(),
  })
    .index('by_inventoryUnitId_date', ['inventoryUnitId', 'date'])
    .index('by_inventoryUnitId_date_windowStart', ['inventoryUnitId', 'date', 'windowStart']),

  // ── L1: Stakeholder Preferences ─────────────────────────────────────

  stakeholderPreferences: defineTable({
    stakeholderId: v.string(),
    stakeholderType: stakeholderType,
    acceptanceMode: acceptanceMode,
    maxHoursPerDay: v.number(),
    noWorkAfterTime: v.optional(v.string()),
    postJobBlockDuration: v.number(),
    useNamedUnits: v.boolean(),
    commonLanguageCodes: v.array(v.string()),
    preferredInstructorSlugs: v.optional(v.array(v.string())),
    confirmOnAccept: v.boolean(),
    confirmOnDecline: v.boolean(),
  }).index('by_stakeholderId', ['stakeholderId']),

  // ── L1: Notifications ───────────────────────────────────────────────

  notifications: defineTable({
    userId: v.string(),
    type: notificationType,
    bookingId: v.optional(v.id('bookings')),
    message: v.string(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_readAt', ['userId', 'readAt']),

  // ── L1: Stakeholder Profile Tables ──────────────────────────────────

  diveCenters: defineTable({
    userId: v.id('users'),
    name: v.string(),
    city: v.string(),
    country: v.string(),
    contactEmail: v.string(),
    contactPhone: v.string(),
    associations: v.array(v.object({ agency: v.string(), number: v.string() })),
    focusedLanguages: v.array(v.string()),
    verified: v.boolean(),
    bookingPreferences: v.optional(
      v.object({
        owDays: v.optional(v.number()),
        aowDays: v.optional(v.number()),
        oaDays: v.optional(v.number()),
        aowSpecialties: v.optional(v.array(v.string())),
      }),
    ),
  }).index('by_userId', ['userId']),

  instructors: defineTable({
    userId: v.id('users'),
    name: v.string(),
    city: v.string(),
    country: v.string(),
    contactEmail: v.string(),
    contactPhone: v.string(),
    credential: v.array(
      v.object({
        agency: v.string(),
        level: v.string(),
        agencyID: v.string(),
        courses: v.array(v.string()),
      }),
    ),
    languages: v.array(v.string()),
    verified: v.boolean(),
  }).index('by_userId', ['userId']),

  boats: defineTable({
    userId: v.id('users'),
    name: v.string(),
    city: v.string(),
    country: v.string(),
    contactEmail: v.string(),
    contactPhone: v.string(),
    fleet: v.array(
      v.object({
        boatName: v.string(),
        maxPax: v.number(),
        minPax: v.optional(v.number()),
        boatType: boatTypeUnion,
        seatCapacity: v.optional(v.number()),
        routes: v.optional(
          v.array(
            v.object({
              diveSite: v.string(),
              daysOfWeek: v.array(v.number()),
            }),
          ),
        ),
        cutoffHours: v.optional(v.number()),
      }),
    ),
    focusedLanguages: v.array(v.string()),
    verified: v.boolean(),
  }).index('by_userId', ['userId']),

  equipment: defineTable({
    userId: v.id('users'),
    name: v.string(),
    city: v.string(),
    country: v.string(),
    contactEmail: v.string(),
    contactPhone: v.string(),
    focusedLanguages: v.array(v.string()),
    manufacturersByGearType: v.optional(v.record(v.string(), v.array(v.string()))),
    verified: v.boolean(),
  }).index('by_userId', ['userId']),

  pools: defineTable({
    userId: v.id('users'),
    name: v.string(),
    city: v.string(),
    country: v.string(),
    contactEmail: v.string(),
    contactPhone: v.string(),
    maxDepth: v.number(),
    maxCapacity: v.number(),
    focusedLanguages: v.array(v.string()),
    verified: v.boolean(),
  }).index('by_userId', ['userId']),

  compressors: defineTable({
    userId: v.id('users'),
    name: v.string(),
    city: v.string(),
    country: v.string(),
    contactEmail: v.string(),
    contactPhone: v.string(),
    gasMixes: v.optional(v.array(gasMix)),
    focusedLanguages: v.array(v.string()),
    verified: v.boolean(),
  }).index('by_userId', ['userId']),

  // ── L1: Equipment Tracking ──────────────────────────────────────────

  equipmentBags: defineTable({
    bagNumber: v.string(),
    equipmentManagerId: v.string(),
    bookingId: v.id('bookings'),
    status: v.union(
      v.literal('Assigned'),
      v.literal('InUse'),
      v.literal('Returned'),
    ),
    assignedAt: v.optional(v.number()),
    returnedAt: v.optional(v.number()),
    damageStatus: v.optional(v.union(v.literal('Damaged'), v.literal('Missing'))),
    damageReportedAt: v.optional(v.number()),
    damageNote: v.optional(v.string()),
    damageReportedBy: v.optional(v.string()),
  })
    .index('by_equipmentManagerId', ['equipmentManagerId'])
    .index('by_bookingId', ['bookingId'])
    .index('by_bagNumber', ['bagNumber']),

  // ── L1: Gear Sizing ─────────────────────────────────────────────────

  gearSizingLookup: defineTable({
    manufacturer: v.string(),
    gearType: gearType,
    size: v.string(),
    minHeight: v.number(),
    maxHeight: v.number(),
    minWeight: v.number(),
    maxWeight: v.number(),
    shoeSize: v.optional(v.number()),
    shoeSizeUnit: v.optional(shoeSizeUnit),
  })
    .index('by_manufacturer_gearType', ['manufacturer', 'gearType'])
    .index('by_gearType', ['gearType']),

  equipmentInventory: defineTable({
    inventoryUnitId: v.id('inventoryUnits'),
    equipmentManagerId: v.string(),
    gearType: gearType,
    manufacturer: v.optional(v.string()),
    size: v.optional(v.string()),
    diopter: v.optional(v.number()),
    isPrescription: v.optional(v.boolean()),
  })
    .index('by_inventoryUnitId', ['inventoryUnitId'])
    .index('by_equipmentManagerId', ['equipmentManagerId'])
    .index('by_equipmentManagerId_gearType', ['equipmentManagerId', 'gearType']),

  // ── L1: Relationships & Moderation ──────────────────────────────────

  stakeholderHierarchy: defineTable({
    parentSlug: v.string(),
    parentType: stakeholderType,
    childSlug: v.string(),
    childType: stakeholderType,
    createdAt: v.number(),
  })
    .index('by_parentSlug', ['parentSlug'])
    .index('by_childSlug', ['childSlug'])
    .index('by_parentSlug_childType', ['parentSlug', 'childType']),

  bans: defineTable({
    bannerSlug: v.string(),
    bannedSlug: v.string(),
    createdAt: v.number(),
  })
    .index('by_bannerSlug', ['bannerSlug'])
    .index('by_bannedSlug', ['bannedSlug']),

  // ── L1: Booking Templates ───────────────────────────────────────────

  bookingTemplates: defineTable({
    ownerId: v.string(),
    ownerType: operatorType,
    name: v.string(),
    activityType: v.array(courseCode),
    instructorId: v.optional(v.string()),
    boatId: v.optional(v.string()),
    equipmentManagerId: v.optional(v.string()),
    poolId: v.optional(v.string()),
    compressorId: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_ownerId_ownerType', ['ownerId', 'ownerType']),

  // ── L2: Agent ───────────────────────────────────────────────────────

  agents: defineTable({
    userId: v.id('users'),
    name: v.string(),
    locations: v.array(v.object({ city: v.string(), country: v.string() })),
    contactEmail: v.string(),
    contactPhone: v.string(),
    associations: v.array(v.object({ agency: v.string(), number: v.string() })),
    focusedLanguages: v.array(v.string()),
    defaultReferralMode: v.union(v.literal('independent'), v.literal('referral')),
    verified: v.boolean(),
  }).index('by_userId', ['userId']),

  // ── L4: DiveMaster ─────────────────────────────────────────────────

  diveMasters: defineTable({
    userId: v.id('users'),
    name: v.string(),
    city: v.string(),
    country: v.string(),
    contactEmail: v.string(),
    contactPhone: v.string(),
    credential: v.array(
      v.object({
        agency: v.string(),
        level: v.string(),
        agencyID: v.string(),
      }),
    ),
    languages: v.array(v.string()),
    verified: v.boolean(),
  }).index('by_userId', ['userId']),

  // ── L5: Liveaboard Ecosystem (field sketches — refine during implementation) ──

  liveaboards: defineTable({
    userId: v.id('users'),
    name: v.string(),
    city: v.string(),
    country: v.string(),
    contactEmail: v.string(),
    contactPhone: v.string(),
    focusedLanguages: v.array(v.string()),
    verified: v.boolean(),
  }).index('by_userId', ['userId']),

  cabins: defineTable({
    liveaboardId: v.id('liveaboards'),
    name: v.string(),
    cabinType: v.union(
      v.literal('Single'),
      v.literal('Double'),
      v.literal('Twin'),
      v.literal('Quad'),
      v.literal('Dormitory'),
    ),
    totalBerths: v.number(),
    amenities: v.array(v.string()),
  }).index('by_liveaboardId', ['liveaboardId']),

  tripSchedules: defineTable({
    liveaboardId: v.id('liveaboards'),
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    itinerary: v.string(),
    maxPassengers: v.number(),
    currentPassengers: v.number(),
    status: v.union(
      v.literal('Scheduled'),
      v.literal('Full'),
      v.literal('Completed'),
      v.literal('Cancelled'),
    ),
  })
    .index('by_liveaboardId', ['liveaboardId'])
    .index('by_startDate', ['startDate']),

  diveResorts: defineTable({
    userId: v.id('users'),
    name: v.string(),
    city: v.string(),
    country: v.string(),
    contactEmail: v.string(),
    contactPhone: v.string(),
    focusedLanguages: v.array(v.string()),
    verified: v.boolean(),
  }).index('by_userId', ['userId']),

  rooms: defineTable({
    diveResortId: v.id('diveResorts'),
    name: v.string(),
    roomType: v.union(
      v.literal('Standard'),
      v.literal('Deluxe'),
      v.literal('Suite'),
      v.literal('Dormitory'),
      v.literal('Bungalow'),
    ),
    totalCount: v.number(),
    maxOccupancy: v.number(),
    amenities: v.array(v.string()),
  }).index('by_diveResortId', ['diveResortId']),

  diveHostels: defineTable({
    userId: v.id('users'),
    name: v.string(),
    city: v.string(),
    country: v.string(),
    contactEmail: v.string(),
    contactPhone: v.string(),
    bedCount: v.number(),
    dormCount: v.number(),
    focusedLanguages: v.array(v.string()),
    verified: v.boolean(),
  }).index('by_userId', ['userId']),

  diveSites: defineTable({
    userId: v.id('users'),
    name: v.string(),
    city: v.string(),
    country: v.string(),
    contactEmail: v.string(),
    contactPhone: v.string(),
    focusedLanguages: v.array(v.string()),
    verified: v.boolean(),
  }).index('by_userId', ['userId']),
})
