import type { Doc, Id } from '../_generated/dataModel'

export type SnapshotKey = {
  inventoryUnitId: Id<'inventoryUnits'>
  date: string
  windowStart: string
}

export type ReservationLike = Pick<
  Doc<'reservations'>,
  'inventoryUnitId' | 'bookingSessionId'
>

export type SessionLike = Pick<Doc<'bookingSessions'>, 'date' | 'startTime'>

export function snapshotKeyHash(key: SnapshotKey): string {
  return `${key.inventoryUnitId}|${key.date}|${key.windowStart}`
}

export function buildSnapshotKey(
  reservation: ReservationLike,
  session: SessionLike,
): SnapshotKey {
  return {
    inventoryUnitId: reservation.inventoryUnitId,
    date: session.date,
    windowStart: session.startTime,
  }
}
