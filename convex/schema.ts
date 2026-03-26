import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { courseCodeValidator as courseCode } from './shared/courseCodes'
import { resourceOwnerTypeValidator as resourceOwnerType } from './shared/resourceOwnerTypes'
import { stakeholderTypeValidator as stakeholderType } from './lib/validators'

// ── Typed Unions ────────────────────────────────────────────────────

const operatorType = v.union(
  v.literal('DiveCenter'),
  v.literal('Agent'),
  v.literal('Liveaboard'),
  v.literal('DiveResort'),
  v.literal('DiveHostel'),
  v.literal('DiveSite'),
)

// Liveaboard is a pure operator; DiveSite is a pure resource.
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

const venueType = v.union(
  v.literal('Pool'),
  v.literal('Shore'),
  v.literal('Reef'),
  v.literal('Lake'),
  v.literal('River'),
  v.literal('Quarry'),
  v.literal('Other'),
)

const gasMix = v.union(v.literal('air'), v.literal('nitrox'), v.literal('trimix'))


// PrePayRequired and PostPayAllowed behave identically to Auto until Stripe integration. Schema placeholders retained.
const acceptanceMode = v.union(
  v.literal('Auto'),
  v.literal('PrePayRequired'),
  v.literal('PostPayAllowed'),
)


const notificationType = v.union(
  v.literal('hold_placed'),
  v.literal('hold_declined'),
  v.literal('booking_cancelled'),
  v.literal('booking_updated'),
  v.literal('booking_referred'),
  v.literal('medical_hard_block'),
  v.literal('medical_cleared'),
  v.literal('physician_clearance_submitted'),
  v.literal('no_backup_available'),
  v.literal('min_pax_not_met'),
  v.literal('noshow_marked'),
  v.literal('noshow_reverted'),
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
    appLanguage: v.optional(v.string()),
    customerLanguages: v.optional(v.array(v.string())),
    phone: v.optional(v.string()),
    preferredChannel: v.optional(
      v.union(
        v.literal('WhatsApp'),
        v.literal('LINE'),
        v.literal('Messenger'),
        v.literal('WeChat'),
        v.literal('KakaoTalk'),
        v.literal('Instagram'),
      ),
    ),
    isSeeded: v.boolean(),
    preferredLocale: v.string(),
    selectedThemeId: v.optional(v.id('themes')),
    onboardingComplete: v.optional(v.boolean()),
    defaultLocation: v.optional(v.string()),
    defaultContactEmail: v.optional(v.string()),
    defaultContactPhone: v.optional(v.string()),
  })
    .index('by_tokenIdentifier', ['tokenIdentifier'])
    .index('by_slug', ['slug'])
    .index('by_email', ['email']),

  themes: defineTable({
    name: v.string(),
    slug: v.string(),
    config: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_isActive', ['isActive']),

  // ── L1: Booking Resources (junction table) ────────────────────────────

  bookingResources: defineTable({
    bookingId: v.id('bookings'),
    resourceType: resourceOwnerType,
    resourceSlug: v.optional(v.string()),
    externalName: v.optional(v.string()),
  })
    .index('by_bookingId', ['bookingId'])
    .index('by_resourceSlug', ['resourceSlug'])
    .index('by_resourceType_resourceSlug', ['resourceType', 'resourceSlug']),

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
    agentId: v.optional(v.string()),
    operatorName: v.string(),
    portalContact: v.boolean(),
    portalMedical: v.boolean(),
    portalWaiver: v.boolean(),
    medicalHardBlock: v.boolean(),
    draftState: v.optional(v.string()),
    bookingFormComplete: v.boolean(),
    customerFormComplete: v.boolean(),
    needsAttention: v.optional(v.boolean()),
    isDemo: v.optional(v.boolean()),
  })
    .index('by_ownerId_ownerType', ['ownerId', 'ownerType'])
    .index('by_status', ['status'])
    .index('by_status_createdAt', ['status', 'createdAt'])
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
    .index('by_inventoryUnitId', ['inventoryUnitId'])
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
    customerId: v.optional(v.id('customers')), // set by savePortalContact
    linkToken: v.string(),
    accommodationName: v.optional(v.string()),
    needsPickup: v.optional(v.boolean()),
    pickupLocation: v.optional(v.string()),
    pickupTime: v.optional(v.string()),
    medicalSchemaVersion: v.optional(v.string()), // set by saveMedicalAnswers
    medicalAnswers: v.optional(v.record(v.string(), v.union(v.boolean(), v.string()))), // set by saveMedicalAnswers
    physicianClearanceRequired: v.optional(v.boolean()), // set by saveMedicalAnswers
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
    allergies: v.optional(v.string()),
    medications: v.optional(v.string()),
    physicianClearanceFileId: v.optional(v.id('_storage')),
  })
    .index('by_bookingId', ['bookingId'])
    .index('by_bookingId_customerId', ['bookingId', 'customerId'])
    .index('by_customerId', ['customerId'])
    .index('by_linkToken', ['linkToken']),

  bookingLinks: defineTable({
    bookingId: v.id('bookings'),
    token: v.string(),
    expiresAt: v.number(),
    customerName: v.string(),
    email: v.string(),
    usedAt: v.optional(v.number()),
    channel: v.optional(v.union(v.literal('whatsapp'), v.literal('line'), v.literal('email'), v.literal('sms'))),
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
    boatType: v.optional(boatTypeUnion),
  })
    .index('by_ownerId_ownerType', ['ownerId', 'ownerType'])
    .index('by_ownerId_resourceType', ['ownerId', 'resourceType'])
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
    noShowAt: v.optional(v.number()),
    vacatedAt: v.optional(v.number()),
    vacatedBy: v.optional(
      v.union(
        v.literal('booking_cancelled'),
        v.literal('stakeholder_declined'),
        v.literal('hold_expired'),
        v.literal('operator_edit'),
        v.literal('noshow_replacement'),
        v.literal('equipment_not_needed'),
      ),
    ),
  })
    .index('by_bookingId', ['bookingId'])
    .index('by_bookingId_status', ['bookingId', 'status'])
    .index('by_bookingId_inventoryUnitId', ['bookingId', 'inventoryUnitId'])
    .index('by_inventoryUnitId_status', ['inventoryUnitId', 'status'])
    .index('by_bookingSessionId', ['bookingSessionId'])
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
    .index('by_inventoryUnitId_date_windowStart', ['inventoryUnitId', 'date', 'windowStart'])
    .index('by_date', ['date']),

  // ── L1: Stakeholder Blocked Dates ───────────────────────────────────

  stakeholderBlockedDates: defineTable({
    ownerSlug: v.string(),
    roleType: v.string(), // matches ClerkRole: 'Boat', 'Instructor', etc.
    dates: v.array(v.string()),
  }).index('by_ownerSlug_roleType', ['ownerSlug', 'roleType']),

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
    preferredVenueSlugs: v.optional(v.array(v.string())),
    preferredEquipmentSlugs: v.optional(v.array(v.string())),
    preferredBoatSlugs: v.optional(v.array(v.string())),
    preferredCompressorSlugs: v.optional(v.array(v.string())),
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
    .index('by_userId_readAt', ['userId', 'readAt'])
    .index('by_userId_createdAt', ['userId', 'createdAt']),

  // ── L1: Stakeholder Profile Tables ──────────────────────────────────

  diveCenters: defineTable({
    userId: v.id('users'),
    name: v.string(),
    placeName: v.string(),
    country: v.string(),
    lat: v.number(),
    lng: v.number(),
    placeId: v.optional(v.string()),
    contactEmail: v.string(),
    contactPhone: v.string(),
    associations: v.array(v.object({ agency: v.string(), number: v.string() })),
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
    placeName: v.string(),
    country: v.string(),
    lat: v.number(),
    lng: v.number(),
    placeId: v.optional(v.string()),
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
    verified: v.boolean(),
  }).index('by_userId', ['userId']),

  boats: defineTable({
    userId: v.id('users'),
    name: v.string(),
    placeName: v.string(),
    country: v.string(),
    lat: v.number(),
    lng: v.number(),
    placeId: v.optional(v.string()),
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
    hasCompressor: v.boolean(),
    verified: v.boolean(),
  }).index('by_userId', ['userId']),

  equipment: defineTable({
    userId: v.id('users'),
    name: v.string(),
    placeName: v.string(),
    country: v.string(),
    lat: v.number(),
    lng: v.number(),
    placeId: v.optional(v.string()),
    contactEmail: v.string(),
    contactPhone: v.string(),
    manufacturersByGearType: v.optional(v.record(v.string(), v.array(v.string()))),
    verified: v.boolean(),
  }).index('by_userId', ['userId']),

  venues: defineTable({
    userId: v.optional(v.id('users')),
    name: v.string(),
    placeName: v.string(),
    country: v.string(),
    lat: v.number(),
    lng: v.number(),
    placeId: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    verified: v.boolean(),
    venueType: venueType,
    isPublic: v.boolean(),
    confinedCapable: v.boolean(),
    openWaterCapable: v.boolean(),
    hasCompressor: v.boolean(),
    maxDepth: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
  }).index('by_userId', ['userId']),

  compressors: defineTable({
    userId: v.id('users'),
    name: v.string(),
    placeName: v.string(),
    country: v.string(),
    lat: v.number(),
    lng: v.number(),
    placeId: v.optional(v.string()),
    contactEmail: v.string(),
    contactPhone: v.string(),
    gasMixes: v.optional(v.array(gasMix)),
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
    .index('by_equipmentManagerId_status', ['equipmentManagerId', 'status'])
    .index('by_status', ['status'])
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

  // ── L0: Multi-Role ─────────────────────────────────────────────────

  userRoles: defineTable({
    userId: v.id('users'),
    role: stakeholderType,
    createdAt: v.number(),
    profileComplete: v.boolean(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_role', ['userId', 'role'])
    .index('by_role', ['role']),

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
    .index('by_bannedSlug', ['bannedSlug'])
    .index('by_bannerSlug_bannedSlug', ['bannerSlug', 'bannedSlug']),

  // ── L1: Booking Templates ───────────────────────────────────────────

  bookingTemplates: defineTable({
    ownerId: v.string(),
    ownerType: operatorType,
    name: v.string(),
    activityType: v.array(courseCode),
    resources: v.optional(v.array(v.object({
      resourceType: resourceOwnerType,
      resourceSlug: v.string(),
    }))),
    createdAt: v.number(),
  }).index('by_ownerId_ownerType', ['ownerId', 'ownerType']),

  // ── L2: Agent ───────────────────────────────────────────────────────

  agents: defineTable({
    userId: v.id('users'),
    name: v.string(),
    locations: v.array(v.object({ placeName: v.string(), country: v.string(), lat: v.number(), lng: v.number(), placeId: v.optional(v.string()) })),
    contactEmail: v.string(),
    contactPhone: v.string(),
    associations: v.array(v.object({ agency: v.string(), number: v.string() })),
    defaultReferralMode: v.union(v.literal('independent'), v.literal('referral')),
    verified: v.boolean(),
  }).index('by_userId', ['userId']),

  // ── L4: DiveMaster ─────────────────────────────────────────────────

  diveMasters: defineTable({
    userId: v.id('users'),
    name: v.string(),
    placeName: v.string(),
    country: v.string(),
    lat: v.number(),
    lng: v.number(),
    placeId: v.optional(v.string()),
    contactEmail: v.string(),
    contactPhone: v.string(),
    credential: v.array(
      v.object({
        agency: v.string(),
        level: v.string(),
        agencyID: v.string(),
      }),
    ),
    verified: v.boolean(),
  }).index('by_userId', ['userId']),

  // ── L5: Liveaboard Ecosystem (field sketches — refine during implementation) ──

  liveaboards: defineTable({
    userId: v.id('users'),
    name: v.string(),
    placeName: v.string(),
    country: v.string(),
    lat: v.number(),
    lng: v.number(),
    placeId: v.optional(v.string()),
    contactEmail: v.string(),
    contactPhone: v.string(),
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
    placeName: v.string(),
    country: v.string(),
    lat: v.number(),
    lng: v.number(),
    placeId: v.optional(v.string()),
    contactEmail: v.string(),
    contactPhone: v.string(),
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
    placeName: v.string(),
    country: v.string(),
    lat: v.number(),
    lng: v.number(),
    placeId: v.optional(v.string()),
    contactEmail: v.string(),
    contactPhone: v.string(),
    bedCount: v.number(),
    dormCount: v.number(),
    verified: v.boolean(),
  }).index('by_userId', ['userId']),

  // diveSites table removed — absorbed into `venues` table with venueType discriminator

  // ── L5: Support ─────────────────────────────────────────────────────────────

  supportRequests: defineTable({
    userId: v.string(),
    subject: v.string(),
    category: v.string(),
    message: v.string(),
    screenshotFileId: v.optional(v.id('_storage')),
    status: v.string(),
    createdAt: v.number(),
  }).index('by_userId', ['userId']),

  // ── L6: Cron Monitoring ────────────────────────────────────────────────────────

  cronRunLog: defineTable({
    jobName: v.string(),
    status: v.union(v.literal('success'), v.literal('failure')),
    error: v.optional(v.string()),
    runAt: v.number(),
  }).index('by_jobName_runAt', ['jobName', 'runAt']),

  // ── L7: Rate Limiting ──────────────────────────────────────────────────────

  rateLimits: defineTable({
    key: v.string(),
    tokens: v.number(),
    lastRefill: v.number(),
  }).index('by_key', ['key']),

  // ── L7: Audit Trail ──────────────────────────────────────────────────────────

  bookingAuditLog: defineTable({
    bookingId: v.id('bookings'),
    action: v.union(
      v.literal('created'),
      v.literal('submitted'),
      v.literal('confirmed'),
      v.literal('cancelled'),
      v.literal('expired'),
      v.literal('completed'),
      v.literal('edited'),
      v.literal('reservation_accepted'),
      v.literal('reservation_declined'),
      v.literal('portal_submitted'),
      v.literal('medical_blocked'),
      v.literal('medical_cleared'),
      v.literal('noshow_marked'),
      v.literal('noshow_reverted'),
    ),
    actorSlug: v.string(),
    actorType: v.union(
      v.literal('operator'),
      v.literal('resource'),
      v.literal('customer'),
      v.literal('system'),
    ),
    timestamp: v.number(),
    diff: v.optional(v.string()),
    note: v.optional(v.string()),
  })
    .index('by_bookingId', ['bookingId'])
    .index('by_bookingId_timestamp', ['bookingId', 'timestamp']),
})
