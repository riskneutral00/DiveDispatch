/**
 * Centralized Doc<T> and Id<T> type exports for all schema tables.
 * Single source of truth — consuming files import named types from here
 * instead of using inline Doc<"tableName"> references.
 */

import type { Doc, Id } from '../_generated/dataModel'

// ── Document types ──────────────────────────────────────────────────────────

export type UserDoc = Doc<'users'>
export type ThemeDoc = Doc<'themes'>
export type BookingResourceDoc = Doc<'bookingResources'>
export type BookingDoc = Doc<'bookings'>
export type BookingSessionDoc = Doc<'bookingSessions'>
export type CustomerDoc = Doc<'customers'>
export type CustomerProfileDoc = Doc<'customerProfiles'>
export type BookingLinkDoc = Doc<'bookingLinks'>
export type InventoryUnitDoc = Doc<'inventoryUnits'>
export type ReservationDoc = Doc<'reservations'>
export type AvailabilitySnapshotDoc = Doc<'availabilitySnapshots'>
export type StakeholderBlockedDateDoc = Doc<'stakeholderBlockedDates'>
export type StakeholderPreferenceDoc = Doc<'stakeholderPreferences'>
export type NotificationDoc = Doc<'notifications'>
export type DiveCenterDoc = Doc<'diveCenters'>
export type InstructorDoc = Doc<'instructors'>
export type BoatDoc = Doc<'boats'>
export type EquipmentDoc = Doc<'equipment'>
export type VenueDoc = Doc<'venues'>
export type CompressorDoc = Doc<'compressors'>
export type EquipmentBagDoc = Doc<'equipmentBags'>
export type GearSizingLookupDoc = Doc<'gearSizingLookup'>
export type EquipmentInventoryDoc = Doc<'equipmentInventory'>
export type UserRoleDoc = Doc<'userRoles'>
export type StakeholderHierarchyDoc = Doc<'stakeholderHierarchy'>
export type BanDoc = Doc<'bans'>
export type BookingTemplateDoc = Doc<'bookingTemplates'>
export type AgentDoc = Doc<'agents'>
export type DiveMasterDoc = Doc<'diveMasters'>
export type LiveaboardDoc = Doc<'liveaboards'>
export type CabinDoc = Doc<'cabins'>
export type TripScheduleDoc = Doc<'tripSchedules'>
export type DiveResortDoc = Doc<'diveResorts'>
export type RoomDoc = Doc<'rooms'>
export type DiveHostelDoc = Doc<'diveHostels'>
export type SupportRequestDoc = Doc<'supportRequests'>
export type CronRunLogDoc = Doc<'cronRunLog'>
export type BookingAuditLogDoc = Doc<'bookingAuditLog'>

// ── Id types ────────────────────────────────────────────────────────────────

export type BookingId = Id<'bookings'>
export type InventoryUnitId = Id<'inventoryUnits'>
export type BookingSessionId = Id<'bookingSessions'>
export type ReservationId = Id<'reservations'>
export type CustomerProfileId = Id<'customerProfiles'>
export type UserId = Id<'users'>
