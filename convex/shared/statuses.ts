import { v } from 'convex/values'

export const BOOKING_STATUS = {
  Draft: 'Draft',
  Upcoming: 'Upcoming',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  Archived: 'Archived',
} as const

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS]

export const bookingStatusValidator = v.union(
  v.literal(BOOKING_STATUS.Draft),
  v.literal(BOOKING_STATUS.Upcoming),
  v.literal(BOOKING_STATUS.Completed),
  v.literal(BOOKING_STATUS.Cancelled),
  v.literal(BOOKING_STATUS.Archived),
)

export const RESERVATION_STATUS = {
  PendingAcceptance: 'PendingAcceptance',
  Confirmed: 'Confirmed',
  Vacated: 'Vacated',
  NoShow: 'NoShow',
} as const

export type ReservationStatus = (typeof RESERVATION_STATUS)[keyof typeof RESERVATION_STATUS]

export const reservationStatusValidator = v.union(
  v.literal(RESERVATION_STATUS.PendingAcceptance),
  v.literal(RESERVATION_STATUS.Confirmed),
  v.literal(RESERVATION_STATUS.Vacated),
  v.literal(RESERVATION_STATUS.NoShow),
)

export const BAG_STATUS = {
  Assigned: 'Assigned',
  InUse: 'InUse',
  Returned: 'Returned',
} as const

export type BagStatus = (typeof BAG_STATUS)[keyof typeof BAG_STATUS]

export const bagStatusValidator = v.union(
  v.literal(BAG_STATUS.Assigned),
  v.literal(BAG_STATUS.InUse),
  v.literal(BAG_STATUS.Returned),
)

export const NOTIFICATION_TYPE = {
  HoldPlaced: 'hold_placed',
  HoldDeclined: 'hold_declined',
  BookingCancelled: 'booking_cancelled',
  BookingUpdated: 'booking_updated',
  BookingReferred: 'booking_referred',
  BookingConfirmed: 'booking_confirmed',
  MedicalHardBlock: 'medical_hard_block',
  MedicalCleared: 'medical_cleared',
  PhysicianClearanceSubmitted: 'physician_clearance_submitted',
  NoBackupAvailable: 'no_backup_available',
  MinPaxNotMet: 'min_pax_not_met',
  NoshowMarked: 'noshow_marked',
  NoshowReverted: 'noshow_reverted',
  PortalComplete: 'portal_complete',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE]

export const notificationTypeValidator = v.union(
  v.literal(NOTIFICATION_TYPE.HoldPlaced),
  v.literal(NOTIFICATION_TYPE.HoldDeclined),
  v.literal(NOTIFICATION_TYPE.BookingCancelled),
  v.literal(NOTIFICATION_TYPE.BookingUpdated),
  v.literal(NOTIFICATION_TYPE.BookingReferred),
  v.literal(NOTIFICATION_TYPE.BookingConfirmed),
  v.literal(NOTIFICATION_TYPE.MedicalHardBlock),
  v.literal(NOTIFICATION_TYPE.MedicalCleared),
  v.literal(NOTIFICATION_TYPE.PhysicianClearanceSubmitted),
  v.literal(NOTIFICATION_TYPE.NoBackupAvailable),
  v.literal(NOTIFICATION_TYPE.MinPaxNotMet),
  v.literal(NOTIFICATION_TYPE.NoshowMarked),
  v.literal(NOTIFICATION_TYPE.NoshowReverted),
  v.literal(NOTIFICATION_TYPE.PortalComplete),
)

export const clientNotificationTypeValidator = v.union(
  v.literal(NOTIFICATION_TYPE.HoldPlaced),
  v.literal(NOTIFICATION_TYPE.HoldDeclined),
  v.literal(NOTIFICATION_TYPE.BookingCancelled),
  v.literal(NOTIFICATION_TYPE.BookingUpdated),
  v.literal(NOTIFICATION_TYPE.BookingReferred),
  v.literal(NOTIFICATION_TYPE.MedicalHardBlock),
  v.literal(NOTIFICATION_TYPE.PhysicianClearanceSubmitted),
  v.literal(NOTIFICATION_TYPE.NoBackupAvailable),
  v.literal(NOTIFICATION_TYPE.MinPaxNotMet),
)

export const CLIENT_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set([
  NOTIFICATION_TYPE.HoldPlaced,
  NOTIFICATION_TYPE.HoldDeclined,
  NOTIFICATION_TYPE.BookingCancelled,
  NOTIFICATION_TYPE.BookingUpdated,
  NOTIFICATION_TYPE.BookingReferred,
  NOTIFICATION_TYPE.MedicalHardBlock,
  NOTIFICATION_TYPE.PhysicianClearanceSubmitted,
  NOTIFICATION_TYPE.NoBackupAvailable,
  NOTIFICATION_TYPE.MinPaxNotMet,
])

export const VACATED_REASON = {
  BookingCancelled: 'booking_cancelled',
  StakeholderDeclined: 'stakeholder_declined',
  DateBlocked: 'date_blocked',
  HoldExpired: 'hold_expired',
  OperatorEdit: 'operator_edit',
  NoshowReplacement: 'noshow_replacement',
  EquipmentNotNeeded: 'equipment_not_needed',
  UserDeleted: 'user_deleted',
} as const

export type VacatedReason = (typeof VACATED_REASON)[keyof typeof VACATED_REASON]

export const vacatedReasonValidator = v.union(
  v.literal(VACATED_REASON.BookingCancelled),
  v.literal(VACATED_REASON.StakeholderDeclined),
  v.literal(VACATED_REASON.DateBlocked),
  v.literal(VACATED_REASON.HoldExpired),
  v.literal(VACATED_REASON.OperatorEdit),
  v.literal(VACATED_REASON.NoshowReplacement),
  v.literal(VACATED_REASON.EquipmentNotNeeded),
  v.literal(VACATED_REASON.UserDeleted),
)
