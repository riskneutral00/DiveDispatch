import { describe, it, expect } from 'vitest'
import type {
  UserDoc,
  ThemeDoc,
  BookingResourceDoc,
  BookingDoc,
  BookingSessionDoc,
  CustomerDoc,
  CustomerProfileDoc,
  BookingLinkDoc,
  InventoryUnitDoc,
  ReservationDoc,
  AvailabilitySnapshotDoc,
  StakeholderBlockedDateDoc,
  StakeholderPreferenceDoc,
  NotificationDoc,
  DiveCenterDoc,
  InstructorDoc,
  BoatDoc,
  EquipmentDoc,
  VenueDoc,
  CompressorDoc,
  EquipmentBagDoc,
  GearSizingLookupDoc,
  EquipmentInventoryDoc,
  UserRoleDoc,
  BookingTemplateDoc,
  AgentDoc,
  LiveaboardDoc,
  CabinDoc,
  TripScheduleDoc,
  DiveResortDoc,
  RoomDoc,
  DiveHostelDoc,
  CronRunLogDoc,
  BookingAuditLogDoc,
  BookingId,
  InventoryUnitId,
  BookingSessionId,
  ReservationId,
  CustomerProfileId,
  UserId,
} from './types'

type IsNever<T> = [T] extends [never] ? true : false

describe('convex/lib/types — Doc exports', () => {
  it('all document types are not never (compile-time check)', () => {
    false satisfies IsNever<UserDoc>
    false satisfies IsNever<ThemeDoc>
    false satisfies IsNever<BookingResourceDoc>
    false satisfies IsNever<BookingDoc>
    false satisfies IsNever<BookingSessionDoc>
    false satisfies IsNever<CustomerDoc>
    false satisfies IsNever<CustomerProfileDoc>
    false satisfies IsNever<BookingLinkDoc>
    false satisfies IsNever<InventoryUnitDoc>
    false satisfies IsNever<ReservationDoc>
    false satisfies IsNever<AvailabilitySnapshotDoc>
    false satisfies IsNever<StakeholderBlockedDateDoc>
    false satisfies IsNever<StakeholderPreferenceDoc>
    false satisfies IsNever<NotificationDoc>
    false satisfies IsNever<DiveCenterDoc>
    false satisfies IsNever<InstructorDoc>
    false satisfies IsNever<BoatDoc>
    false satisfies IsNever<EquipmentDoc>
    false satisfies IsNever<VenueDoc>
    false satisfies IsNever<CompressorDoc>
    false satisfies IsNever<EquipmentBagDoc>
    false satisfies IsNever<GearSizingLookupDoc>
    false satisfies IsNever<EquipmentInventoryDoc>
    false satisfies IsNever<UserRoleDoc>
    false satisfies IsNever<BookingTemplateDoc>
    false satisfies IsNever<AgentDoc>
    false satisfies IsNever<LiveaboardDoc>
    false satisfies IsNever<CabinDoc>
    false satisfies IsNever<TripScheduleDoc>
    false satisfies IsNever<DiveResortDoc>
    false satisfies IsNever<RoomDoc>
    false satisfies IsNever<DiveHostelDoc>
    false satisfies IsNever<CronRunLogDoc>
    false satisfies IsNever<BookingAuditLogDoc>

    expect(true).toBe(true)
  })

  it('all Id types are not never (compile-time check)', () => {
    false satisfies IsNever<BookingId>
    false satisfies IsNever<InventoryUnitId>
    false satisfies IsNever<BookingSessionId>
    false satisfies IsNever<ReservationId>
    false satisfies IsNever<CustomerProfileId>
    false satisfies IsNever<UserId>

    expect(true).toBe(true)
  })
})
