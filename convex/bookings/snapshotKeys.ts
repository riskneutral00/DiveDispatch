import type { Doc, Id } from '../_generated/dataModel'

export type SnapshotKey = {
  inventoryUnitId: Id<'inventoryUnits'>
  date: string
  windowStart: string
}

export function snapshotKeyHash(key: SnapshotKey): string {
  return `${key.inventoryUnitId}|${key.date}|${key.windowStart}`
}

export function buildSnapshotKey(
  reservation: Pick<Doc<'reservations'>, 'inventoryUnitId' | 'bookingSessionId'>,
  session: Pick<Doc<'bookingSessions'>, 'date' | 'startTime'>,
): SnapshotKey {
  return {
    inventoryUnitId: reservation.inventoryUnitId,
    date: session.date,
    windowStart: session.startTime,
  }
}
