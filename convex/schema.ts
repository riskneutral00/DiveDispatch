import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { courseCodeValidator as courseCode } from './shared/courseCodes'
import { operatorTypeValidator as operatorType } from './shared/operatorTypes'
import { resourceOwnerTypeValidator as resourceOwnerType } from './shared/resourceOwnerTypes'
import { boatTypeValidator as boatTypeUnion } from './shared/boatTypes'
import { gasMixValidator as gasMix } from './shared/gasMixes'
import { venueCategoryValidator, diveSiteTypeValidator } from './shared/venueTypes'
import { capacityModelValidator as capacityModel, genderValidator as gender, shoeSizeUnitValidator as shoeSizeUnit, acceptanceModeValidator as acceptanceMode } from './shared/schemaEnums'
import { stakeholderTypeValidator as stakeholderType, gearTypeValidator as gearType, finSizeSystemValidator, rentalChecklistValidator } from './lib/validators'
import { bookingStatusValidator as bookingStatus, reservationStatusValidator as reservationStatus, bagStatusValidator, notificationTypeValidator as notificationType, vacatedReasonValidator } from './shared/statuses'
import { addressStructuredValidator as addressStructured, structuredLocationFields } from './shared/addressValidator'

const accessControlFields = {
  isAllowed: v.optional(v.array(v.string())),
  notAllowed: v.optional(v.array(v.string())),
}

export default defineSchema({

  users: defineTable({
    tokenIdentifier: v.string(),
    originalTokenIdentifier: v.optional(v.string()),
    slug: v.string(),
    email: v.string(),
    name: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    nickname: v.optional(v.string()),
    appLanguage: v.union(
      v.literal('en'),
      v.literal('zh-CN'),
      v.literal('zh-TW'),
      v.literal('th'),
      v.literal('fr'),
      v.literal('ko'),
    ),
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    selectedThemeId: v.optional(v.id('themes')),
    savedThemeIds: v.optional(v.array(v.id('themes'))),
    defaultLocation: v.optional(v.string()),
    tcAcceptedAt: v.optional(v.number()),
    tcVersion: v.optional(v.string()),
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
    sortOrder: v.optional(v.number()),
    appearance: v.optional(
      v.union(v.literal('dark'), v.literal('light')),
    ),
    tier: v.optional(v.union(v.literal('free'), v.literal('premium'), v.literal('exclusive'))),
    price: v.optional(v.number()),
    previewUrl: v.optional(v.string()),
  })
    .index('by_slug', ['slug'])
    .index('by_isActive', ['isActive'])
    .index('by_isActive_appearance', ['isActive', 'appearance']),

  organizations: defineTable({
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(addressStructured),
    placeId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_clerkOrgId', ['clerkOrgId'])
    .index('by_slug', ['slug']),

  bookingResources: defineTable({
    bookingId: v.id('bookings'),
    resourceType: resourceOwnerType,
    resourceId: v.optional(v.string()),
    externalName: v.optional(v.string()),
    roleType: v.optional(v.union(v.literal('Instructor'), v.literal('DiveMaster'))),
  })
    .index('by_bookingId', ['bookingId'])
    .index('by_resourceId', ['resourceId'])
    .index('by_resourceType_resourceId', ['resourceType', 'resourceId']),

  bookings: defineTable({
    ownerId: v.string(),
    ownerType: operatorType,
    status: bookingStatus,
    createdAt: v.number(),
    holdTTL: v.number(),
    submittedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    paid: v.boolean(),
    activityType: v.array(courseCode),
    startDate: v.string(), // snapshot: frozen at creation, canonical truth is bookingSessions.date
    endDate: v.string(), // snapshot: frozen at creation, canonical truth is bookingSessions.date
    divers: v.array(
      v.object({
        name: v.string(),
        abbrev: v.string(),
        flag: v.object({ code: v.string(), label: v.string() }),
        startDate: v.string(),
        endDate: v.string(),
        agency: v.optional(v.string()),
        activityType: v.array(courseCode),
        specialtyCodes: v.optional(v.array(v.string())),
        contactType: v.optional(v.union(v.literal('email'), v.literal('whatsapp'), v.literal('line'))),
        contactValue: v.optional(v.string()),
      }),
    ),
    referrerId: v.optional(v.string()),
    referrerType: v.optional(operatorType),
    returnedToReferrerAt: v.optional(v.number()),
    operatorName: v.string(), // snapshot: frozen at creation; rewritten only by referral handoff + return
    portalContact: v.boolean(),
    portalMedical: v.boolean(),
    portalWaiver: v.boolean(),
    medicalHardBlock: v.boolean(),
    draftState: v.optional(v.string()),
    bookingFormComplete: v.boolean(),
    customerFormComplete: v.boolean(),
    needsAttention: v.optional(v.boolean()),
    isDemo: v.optional(v.boolean()),
    warnings: v.optional(v.array(v.object({
      type: v.string(),
      missing: v.array(v.string()),
    }))),
  })
    .index('by_ownerId_ownerType', ['ownerId', 'ownerType'])
    .index('by_ownerId_status', ['ownerId', 'status'])
    .index('by_status', ['status'])
    .index('by_status_expiresAt', ['status', 'expiresAt'])
    .index('by_referrerId_referrerType', ['referrerId', 'referrerType']),

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
    languages: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index('by_email', ['email']),

  customerProfiles: defineTable({
    bookingId: v.id('bookings'),
    customerId: v.optional(v.id('customers')),
    linkToken: v.string(),
    accommodationName: v.optional(v.string()),
    needsPickup: v.optional(v.boolean()),
    pickupLocation: v.optional(v.string()),
    pickupTime: v.optional(v.string()),
    medicalSchemaVersion: v.optional(v.string()),
    medicalAnswers: v.optional(v.string()),
    physicianClearanceRequired: v.optional(v.boolean()),
    physicianClearedAt: v.optional(v.number()),
    waiverSignedAt: v.optional(v.number()),
    signatureFileId: v.optional(v.id('_storage')),
    guardianSignatureFileId: v.optional(v.id('_storage')),
    rentalChecklist: v.optional(rentalChecklistValidator),
    submittedAt: v.optional(v.number()),
    bloodType: v.optional(v.string()),
    insurancePolicyNumber: v.optional(v.string()),
    allergies: v.optional(v.string()),
    medications: v.optional(v.string()),
    physicianClearanceFileId: v.optional(v.id('_storage')),
  })
    .index('by_bookingId', ['bookingId'])
    .index('by_linkToken', ['linkToken']),

  bookingLinks: defineTable({
    bookingId: v.id('bookings'),
    token: v.string(),
    expiresAt: v.number(),
    customerName: v.string(), // snapshot: frozen at link creation
    email: v.string(), // snapshot: frozen at link creation
    usedAt: v.optional(v.number()),
    channel: v.optional(v.union(v.literal('whatsapp'), v.literal('line'), v.literal('email'), v.literal('sms'))),
  })
    .index('by_bookingId', ['bookingId'])
    .index('by_token', ['token']),

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
    noShowAt: v.optional(v.number()),
    vacatedAt: v.optional(v.number()),
    vacatedBy: v.optional(vacatedReasonValidator),
  })
    .index('by_bookingId', ['bookingId'])
    .index('by_bookingId_status', ['bookingId', 'status'])
    .index('by_bookingId_inventoryUnitId', ['bookingId', 'inventoryUnitId'])
    .index('by_inventoryUnitId_status', ['inventoryUnitId', 'status'])
    .index('by_bookingSessionId', ['bookingSessionId']),

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

  stakeholderBlockedDates: defineTable({
    stakeholderId: v.string(),
    roleType: stakeholderType,
    dates: v.array(v.string()),
  }).index('by_stakeholderId_roleType', ['stakeholderId', 'roleType']),

  stakeholderPreferences: defineTable({
    stakeholderId: v.string(),
    stakeholderType: stakeholderType,
    acceptanceMode: acceptanceMode,
    useNamedUnits: v.boolean(),
    commonLanguageCodes: v.optional(v.array(v.string())),
    preferredInstructorSlugs: v.optional(v.array(v.string())),
    preferredVenueSlugs: v.optional(v.array(v.string())),
    preferredEquipmentSlugs: v.optional(v.array(v.string())),
    preferredBoatSlugs: v.optional(v.array(v.string())),
    preferredCompressorSlugs: v.optional(v.array(v.string())),
    preferredOperatorSlug: v.optional(v.string()),
    confirmOnAccept: v.boolean(),
    confirmOnDecline: v.boolean(),
    autoAssignPreferred: v.optional(v.boolean()),
  }).index('by_stakeholderId', ['stakeholderId']),

  notifications: defineTable({
    userId: v.string(),
    type: notificationType,
    bookingId: v.optional(v.id('bookings')),
    message: v.string(),
    code: v.optional(v.string()),
    params: v.optional(v.string()),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
    logistics: v.optional(v.object({
      pickupTime: v.optional(v.string()),
      pickupLocation: v.optional(v.string()),
      departureTime: v.optional(v.string()),
      departureLocation: v.optional(v.string()),
      boatName: v.optional(v.string()),
      meetingPoint: v.optional(v.string()),
    })),
  })
    .index('by_userId_readAt', ['userId', 'readAt'])
    .index('by_userId_createdAt', ['userId', 'createdAt'])
    .index('by_bookingId', ['bookingId']),

  diveCenters: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    ...structuredLocationFields,
    lat: v.number(),
    lng: v.number(),
    email: v.string(),
    phone: v.string(),
    associations: v.array(v.object({
      agency: v.string(),
      number: v.string(),
      owDays: v.optional(v.number()),
      aowDays: v.optional(v.number()),
      oaDays: v.optional(v.number()),
      selectedSpecialties: v.optional(v.array(v.string())),
    })),
    customerLanguages: v.optional(v.array(v.string())),
    ...accessControlFields,
    verified: v.boolean(),
  })
    .index('by_organizationId', ['organizationId']),

  diveStaff: defineTable({
    organizationId: v.id('organizations'),
    role: v.literal('Instructor'),
    name: v.string(),
    ...structuredLocationFields,
    lat: v.number(),
    lng: v.number(),
    email: v.string(),
    phone: v.string(),
    credential: v.array(
      v.object({
        agency: v.string(),
        level: v.string(),
        agencyID: v.string(),
        specialtyRatings: v.optional(v.array(v.string())),
      }),
    ),
    teachingLanguages: v.array(v.string()),
    ...accessControlFields,
    verified: v.boolean(),
  })
    .index('by_organizationId', ['organizationId']),

  boats: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    ...structuredLocationFields,
    lat: v.number(),
    lng: v.number(),
    email: v.string(),
    phone: v.string(),
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
    ...accessControlFields,
    verified: v.boolean(),
  })
    .index('by_organizationId', ['organizationId']),

  equipment: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    ...structuredLocationFields,
    lat: v.number(),
    lng: v.number(),
    email: v.string(),
    phone: v.string(),
    manufacturersByGearType: v.optional(v.record(v.string(), v.array(v.string()))),
    ...accessControlFields,
    verified: v.boolean(),
  })
    .index('by_organizationId', ['organizationId']),

  venues: defineTable({
    organizationId: v.optional(v.id('organizations')),
    name: v.string(),
    ...structuredLocationFields,
    lat: v.number(),
    lng: v.number(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    verified: v.boolean(),
    venueCategory: venueCategoryValidator,
    diveSiteTypes: v.optional(v.array(diveSiteTypeValidator)),
    ...accessControlFields,
    confinedCapable: v.optional(v.boolean()),
    hasCompressor: v.boolean(),
    maxDepth: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
  })
    .index('by_organizationId', ['organizationId']),

  compressors: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    ...structuredLocationFields,
    lat: v.number(),
    lng: v.number(),
    email: v.string(),
    phone: v.string(),
    gasMixes: v.optional(v.array(gasMix)),
    nitroxMin: v.optional(v.number()),
    nitroxMax: v.optional(v.number()),
    ...accessControlFields,
    verified: v.boolean(),
  })
    .index('by_organizationId', ['organizationId']),

  equipmentBags: defineTable({
    bagNumber: v.string(),
    equipmentManagerId: v.string(),
    bookingId: v.id('bookings'),
    status: bagStatusValidator,
    assignedAt: v.optional(v.number()),
    returnedAt: v.optional(v.number()),
    damageStatus: v.optional(v.union(v.literal('Damaged'), v.literal('Missing'))),
    damageReportedAt: v.optional(v.number()),
    damageNote: v.optional(v.string()),
    damageReportedBy: v.optional(v.string()),
  })
    .index('by_equipmentManagerId', ['equipmentManagerId'])
    .index('by_status', ['status'])
    .index('by_bookingId', ['bookingId']),

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
    createdBy: v.optional(v.string()),
  })
    .index('by_manufacturer_gearType', ['manufacturer', 'gearType']),

  equipmentInventory: defineTable({
    inventoryUnitId: v.id('inventoryUnits'),
    equipmentManagerId: v.string(),
    gearType: gearType,
    manufacturer: v.optional(v.string()),
    size: v.optional(v.string()),
    sizeSystem: v.optional(finSizeSystemValidator),
    diopter: v.optional(v.number()),
    isPrescription: v.optional(v.boolean()),
  })
    .index('by_inventoryUnitId', ['inventoryUnitId'])
    .index('by_equipmentManagerId', ['equipmentManagerId']),

  userRoles: defineTable({
    userId: v.id('users'),
    role: stakeholderType,
    createdAt: v.number(),
    profileComplete: v.optional(v.boolean()),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_role', ['userId', 'role'])
    .index('by_role', ['role']),

  bookingTemplates: defineTable({
    ownerId: v.string(),
    ownerType: operatorType,
    name: v.string(),
    activityType: v.array(courseCode),
    resources: v.optional(v.array(v.object({
      resourceType: resourceOwnerType,
      resourceId: v.string(),
    }))),
    createdAt: v.number(),
  }).index('by_ownerId_ownerType', ['ownerId', 'ownerType']),

  agents: defineTable({
    organizationId: v.id('organizations'),
    customerLanguages: v.optional(v.array(v.string())),
    name: v.string(),
    ...structuredLocationFields,
    lat: v.number(),
    lng: v.number(),
    email: v.string(),
    phone: v.string(),
    associations: v.array(v.object({ agency: v.string(), number: v.string() })),
    ...accessControlFields,
    verified: v.boolean(),
  })
    .index('by_organizationId', ['organizationId']),

  liveaboards: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    ...structuredLocationFields,
    lat: v.number(),
    lng: v.number(),
    email: v.string(),
    phone: v.string(),
    ...accessControlFields,
    verified: v.boolean(),
  })
    .index('by_organizationId', ['organizationId']),

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
    organizationId: v.id('organizations'),
    name: v.string(),
    ...structuredLocationFields,
    lat: v.number(),
    lng: v.number(),
    email: v.string(),
    phone: v.string(),
    ...accessControlFields,
    verified: v.boolean(),
  })
    .index('by_organizationId', ['organizationId']),

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
    organizationId: v.id('organizations'),
    name: v.string(),
    ...structuredLocationFields,
    lat: v.number(),
    lng: v.number(),
    email: v.string(),
    phone: v.string(),
    bedCount: v.number(),
    dormCount: v.number(),
    ...accessControlFields,
    verified: v.boolean(),
  })
    .index('by_organizationId', ['organizationId']),

  cronRunLog: defineTable({
    jobName: v.string(),
    status: v.union(v.literal('success'), v.literal('failure')),
    error: v.optional(v.string()),
    runAt: v.number(),
  }),

  idempotencyLog: defineTable({
    key: v.string(),
    mutationName: v.string(),
    createdAt: v.number(),
  })
    .index('by_key_mutationName', ['key', 'mutationName'])
    .index('by_createdAt', ['createdAt']),

  supportRequests: defineTable({
    userId: v.id('users'),
    userSlug: v.string(),
    subject: v.string(),
    category: v.string(),
    message: v.string(),
    screenshotStorageId: v.optional(v.id('_storage')),
    createdAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_createdAt', ['createdAt']),

  rateLimits: defineTable({
    key: v.string(),
    tokens: v.number(),
    lastRefill: v.number(),
  }).index('by_key', ['key'])
    .index('by_lastRefill', ['lastRefill']),

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
      v.literal('expired_draft_purged'),
      v.literal('user_deleted_cascade'),
      v.literal('referral_handoff'),
      v.literal('referral_returned'),
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
