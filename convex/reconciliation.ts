import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { log } from './lib/logger'
import { batchGet } from './lib/batch'
import type { Id } from './_generated/dataModel'
import { RESERVATION_STATUS } from './shared/statuses'

const BATCH_SIZE = 100

export const reconcileSnapshots = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ checked: number; discrepancies: number }> => {
    const allSnapshots = await ctx.db
      .query('availabilitySnapshots')
      .collect() // bounded: reconciliation cron, max ~1000 snapshots
    const withReserved = allSnapshots.filter((s) => s.reservedUnits > 0)
    const batch = withReserved.slice(0, BATCH_SIZE)

    const discrepancies: Array<{
      snapshotId: string
      inventoryUnitId: string
      date: string
      expected: number
      actual: number
    }> = []

    const unitIds = [...new Set(batch.map((s) => s.inventoryUnitId))]

    type ReservationSlice = Array<{ bookingSessionId: Id<'bookingSessions'>; unitsRequested: number }>
    const reservationsByUnit = new Map<string, ReservationSlice>()
    await Promise.all(
      unitIds.map(async (unitId) => {
        const pending = await ctx.db
          .query('reservations')
          .withIndex('by_inventoryUnitId_status', (q) =>
            q.eq('inventoryUnitId', unitId).eq('status', RESERVATION_STATUS.PendingAcceptance),
          )
          .collect() // bounded: per-unit per-status, max ~50
        const confirmed = await ctx.db
          .query('reservations')
          .withIndex('by_inventoryUnitId_status', (q) =>
            q.eq('inventoryUnitId', unitId).eq('status', RESERVATION_STATUS.Confirmed),
          )
          .collect() // bounded: per-unit per-status, max ~50
        reservationsByUnit.set(unitId, [...pending, ...confirmed])
      }),
    )

    const allReservations = [...reservationsByUnit.values()].flat()
    const sessionIds = [...new Set(allReservations.map((r) => r.bookingSessionId))]
    const sessions = await batchGet(ctx, sessionIds)
    const sessionMap = new Map(
      sessionIds.map((id, i) => [id, sessions[i]]),
    )

    for (const snapshot of batch) {
      const reservations = reservationsByUnit.get(snapshot.inventoryUnitId) ?? []
      let actualReserved = 0
      for (const res of reservations) {
        const session = sessionMap.get(res.bookingSessionId)
        if (!session) continue
        if (session.date === snapshot.date) {
          actualReserved += res.unitsRequested
        }
      }

      if (actualReserved !== snapshot.reservedUnits) {
        discrepancies.push({
          snapshotId: snapshot._id,
          inventoryUnitId: snapshot.inventoryUnitId,
          date: snapshot.date,
          expected: snapshot.reservedUnits,
          actual: actualReserved,
        })
      }
    }

    if (discrepancies.length > 0) {
      log.error('reconcileSnapshots: discrepancies found', {
        count: discrepancies.length,
        details: JSON.stringify(discrepancies.slice(0, 10)),
      })

      await ctx.scheduler.runAfter(0, internal.lib.alerts.sendAlertEmail, {
        jobName: 'reconcile-snapshots',
        error: `${discrepancies.length} snapshot discrepancies: ${discrepancies.map((d) => `unit=${d.inventoryUnitId} date=${d.date} expected=${d.expected} actual=${d.actual}`).join('; ')}`,
      })
    }

    await ctx.db.insert('cronRunLog', {
      jobName: 'reconcile-snapshots',
      status: discrepancies.length > 0 ? 'failure' : 'success',
      ...(discrepancies.length > 0 ? { error: `${discrepancies.length} discrepancies` } : {}),
      runAt: Date.now(),
    })

    return { checked: batch.length, discrepancies: discrepancies.length }
  },
})
