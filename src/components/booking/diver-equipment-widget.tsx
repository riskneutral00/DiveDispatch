'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { GlassCard, GlassBadge, GlassButton } from '@/components/ui'
import { parseConvexError } from '@/lib/utils/convex-error'
import { Spinner } from '@/components/ui/spinner'
import {
  suggestGearSizes,
  type DiverMeasurements,
  type GearType,
} from '@/lib/utils/gear-size-suggest'
import type {
  DiverEquipmentWidgetData,
  BookingRow,
  DiverRow,
  GearInventoryItem,
  GearSizingRow,
} from '../../../convex/equipmentWidget'
import type { Id } from '../../../convex/_generated/dataModel'

// ── Helpers ───────────────────────────────────────────────────────────────────

function countryCodeToFlag(code: string): string {
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
}

function inventoryCount(
  inventory: GearInventoryItem[],
  gearType: string,
  manufacturer: string,
  size: string,
): number {
  return inventory
    .filter(
      (item) =>
        item.gearType === gearType &&
        item.manufacturer === manufacturer &&
        item.size === size,
    )
    .reduce((sum, item) => sum + item.totalUnits, 0)
}

const GEAR_LABELS: Record<string, string> = {
  mask: 'Mask',
  bcd: 'BCD',
  wetsuit: 'Wetsuit',
  fins: 'Fins',
  regulator: 'Regulator',
}

const RENTING_TYPES: GearType[] = ['mask', 'bcd', 'wetsuit', 'fins', 'regulator']

// ── Sub-components ────────────────────────────────────────────────────────────

function BagStatusBadge({ status }: { status: 'Assigned' | 'InUse' | 'Returned' }) {
  const variant =
    status === 'Returned' ? 'success' : status === 'InUse' ? 'warning' : 'default'
  return (
    <GlassBadge variant={variant} size="sm" dot>
      {status}
    </GlassBadge>
  )
}

interface DiverCardProps {
  diver: DiverRow
  sizingEntries: GearSizingRow[]
  inventory: GearInventoryItem[]
  manufacturersByGearType?: Record<string, string[]>
  onPickUp: (bagId: string) => void
  onReturn: (bagId: string) => void
  isActing: boolean
}

function DiverCard({
  diver,
  sizingEntries,
  inventory,
  manufacturersByGearType,
  onPickUp,
  onReturn,
  isActing,
}: DiverCardProps) {
  const [sizeOverrides, setSizeOverrides] = useState<Record<string, string>>({})

  const measurements: DiverMeasurements = {
    heightCm: diver.heightCm,
    weightKg: diver.weightKg,
    shoeSize: diver.shoeSize,
    shoeSizeUnit: diver.shoeSizeUnit as 'EU' | 'US' | 'CM' | undefined,
  }

  const rentingTypes: GearType[] = diver.rentalChecklist
    ? RENTING_TYPES.filter(
        (g) => (diver.rentalChecklist as Record<string, string>)[g] === 'rent',
      )
    : []

  const suggestions = suggestGearSizes(
    measurements,
    sizingEntries,
    rentingTypes,
    manufacturersByGearType,
  )

  const hasMeasurements = diver.heightCm != null || diver.weightKg != null || diver.shoeSize != null

  return (
    <GlassCard padding="md">
      {/* Diver header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-label={diver.flag.label}>
            {countryCodeToFlag(diver.flag.code)}
          </span>
          <div>
            <p className="font-medium text-sm text-primary">
              {diver.name}
            </p>
            {diver.needsPoweredLenses && (
              <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
                Prescription lens
                {diver.prescriptionStrength ? ` ${diver.prescriptionStrength}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Bag status */}
        {diver.bag ? (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-secondary">
                Bag {diver.bag.bagNumber}
              </span>
              <BagStatusBadge status={diver.bag.status} />
            </div>
            {diver.bag.status === 'Assigned' && (
              <GlassButton
                size="sm"
                variant="secondary"
                onClick={() => onPickUp(diver.bag!.bagId)}
                disabled={isActing}
              >
                Mark Picked Up
              </GlassButton>
            )}
            {diver.bag.status === 'InUse' && (
              <GlassButton
                size="sm"
                variant="secondary"
                onClick={() => onReturn(diver.bag!.bagId)}
                disabled={isActing}
              >
                Mark Returned
              </GlassButton>
            )}
          </div>
        ) : (
          <GlassBadge variant="default" size="sm">
            No bag assigned
          </GlassBadge>
        )}
      </div>

      {/* Measurements */}
      <div className="flex flex-wrap gap-3 mb-3">
        {diver.heightCm != null && (
          <MeasurementChip label="Height" value={`${diver.heightCm} cm`} />
        )}
        {diver.weightKg != null && (
          <MeasurementChip label="Weight" value={`${diver.weightKg} kg`} />
        )}
        {diver.shoeSize != null && (
          <MeasurementChip
            label="Shoe"
            value={`${diver.shoeSize} ${diver.shoeSizeUnit ?? 'EU'}`}
          />
        )}
        {!hasMeasurements && (
          <p className="text-xs italic text-secondary">
            Measurements not submitted yet
          </p>
        )}
      </div>

      {/* Gear sizing suggestions */}
      {rentingTypes.length > 0 && (
        <div className="border-t pt-3" style={{ borderColor: 'var(--color-glass-border)' }}>
          <p
            className="text-xs font-semibold uppercase mb-2 text-secondary"
          >
            Rental Gear
          </p>
          <div className="space-y-1.5">
            {rentingTypes.map((gearType) => {
              const suggestion = suggestions[gearType]
              const overrideKey = `${diver.diverIndex}_${gearType}`
              const overrideSize = sizeOverrides[overrideKey]
              return (
                <GearSizeRow
                  key={gearType}
                  gearType={gearType}
                  suggestion={suggestion}
                  inventory={inventory}
                  overrideSize={overrideSize}
                  onOverride={(size) =>
                    setSizeOverrides((prev) => ({ ...prev, [overrideKey]: size }))
                  }
                  onClearOverride={() =>
                    setSizeOverrides((prev) => {
                      const next = { ...prev }
                      delete next[overrideKey]
                      return next
                    })
                  }
                />
              )
            })}
          </div>
        </div>
      )}
    </GlassCard>
  )
}

function MeasurementChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="px-2 py-1 rounded-md text-xs"
      style={{
        background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
      }}
    >
      <span className="text-secondary">{label}: </span>
      <span className="font-medium text-primary">
        {value}
      </span>
    </div>
  )
}

interface GearSizeRowProps {
  gearType: string
  suggestion: ReturnType<typeof suggestGearSizes>[string]
  inventory: GearInventoryItem[]
  overrideSize?: string
  onOverride: (size: string) => void
  onClearOverride: () => void
}

function GearSizeRow({
  gearType,
  suggestion,
  inventory,
  overrideSize,
  onOverride,
  onClearOverride,
}: GearSizeRowProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const effectiveSuggestion = overrideSize
    ? { status: 'match' as const, manufacturer: 'Manual', size: overrideSize }
    : suggestion

  let inventoryCount_ = 0
  let inventoryTotal = 0
  if (effectiveSuggestion.status === 'match' && !overrideSize) {
    inventoryTotal = inventoryCount(
      inventory,
      gearType,
      effectiveSuggestion.manufacturer,
      effectiveSuggestion.size,
    )
    inventoryCount_ = inventoryTotal
  }

  const isManualOverride = !!overrideSize

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-primary">
        {GEAR_LABELS[gearType] ?? gearType}
      </span>

      <div className="flex items-center gap-1.5">
        {/* Suggestion display */}
        {effectiveSuggestion.status === 'match' && !editing && (
          <>
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                background: isManualOverride
                  ? 'color-mix(in srgb, var(--color-warning) 15%, transparent)'
                  : 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                color: isManualOverride ? 'var(--color-warning)' : 'var(--color-primary)',
                border: `1px solid ${isManualOverride ? 'color-mix(in srgb, var(--color-warning) 30%, transparent)' : 'color-mix(in srgb, var(--color-primary) 30%, transparent)'}`,
              }}
            >
              {isManualOverride ? '✏ ' : ''}
              {effectiveSuggestion.manufacturer} {effectiveSuggestion.size}
            </span>

            {/* Inventory availability (only for auto-suggested, not manual override) */}
            {!isManualOverride && (effectiveSuggestion.status === 'match') && (
              <span
                className="text-xs"
                style={{
                  color: inventoryCount_ > 0 ? 'var(--color-success)' : 'var(--color-destructive)',
                }}
              >
                {inventoryCount_} / {inventoryTotal}
              </span>
            )}
          </>
        )}

        {effectiveSuggestion.status === 'no_match' && !editing && (
          <span
            className="text-xs italic"
            style={{ color: 'var(--color-destructive)' }}
          >
            No match — manual sizing needed
          </span>
        )}

        {effectiveSuggestion.status === 'no_data' && !editing && (
          <span className="text-xs text-secondary">
            —
          </span>
        )}

        {/* Inline edit */}
        {editing && (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="e.g. M"
              className="text-xs px-2 py-0.5 rounded w-16 outline-none text-primary"
              style={{ background: 'var(--color-glass-bg)',
                border: '1px solid var(--color-primary)' }}
              autoFocus
            />
            <button
              onClick={() => {
                if (editValue.trim()) onOverride(editValue.trim())
                setEditing(false)
                setEditValue('')
              }}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-text-on-primary)',
              }}
            >
              ✓
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setEditValue('')
              }}
              className="text-xs px-1.5 py-0.5 rounded text-secondary"
              style={{ background: 'var(--color-glass-bg)',
                border: '1px solid var(--color-glass-border)' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Edit / clear override button */}
        {!editing && (
          <div className="flex gap-1">
            <button
              onClick={() => {
                setEditValue(isManualOverride ? overrideSize : '')
                setEditing(true)
              }}
              className="text-xs text-secondary"
              title="Override size"
            >
              ✏
            </button>
            {isManualOverride && (
              <button
                onClick={onClearOverride}
                className="text-xs text-secondary"
                title="Clear override"
              >
                ↺
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────

export interface DiverEquipmentWidgetProps {
  visibleRange: { start: string; end: string }
}

export function DiverEquipmentWidget({ visibleRange }: DiverEquipmentWidgetProps) {
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [isActing, setIsActing] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)

  const data = useQuery(api.equipmentWidget.getDiverEquipmentData, {
    dateRangeStart: visibleRange.start,
    dateRangeEnd: visibleRange.end,
  }) as DiverEquipmentWidgetData | null | undefined

  const markPickedUp = useMutation(api.equipmentWidget.markBagPickedUp)
  const markReturned = useMutation(api.equipmentWidget.markBagReturned)

  const handlePickUp = async (bagId: string) => {
    setIsActing(true)
    setMutationError(null)
    try {
      await markPickedUp({ bagId: bagId as Id<'equipmentBags'> })
    } catch (err) {
      setMutationError(parseConvexError(err, 'Failed to mark bag as picked up'))
    } finally {
      setIsActing(false)
    }
  }

  const handleReturn = async (bagId: string) => {
    setIsActing(true)
    setMutationError(null)
    try {
      await markReturned({ bagId: bagId as Id<'equipmentBags'> })
    } catch (err) {
      setMutationError(parseConvexError(err, 'Failed to mark bag as returned'))
    } finally {
      setIsActing(false)
    }
  }

  // Loading state
  if (data === undefined) {
    return (
      <GlassCard padding="md">
        <div className="flex items-center justify-center py-6" style={{ color: 'var(--color-primary)' }}>
          <Spinner />
        </div>
      </GlassCard>
    )
  }

  // No EM profile
  if (data === null) {
    return (
      <GlassCard padding="md">
        <p className="text-sm text-center text-secondary">
          Equipment profile not set up.
        </p>
      </GlassCard>
    )
  }

  // No bookings in range
  if (data.bookings.length === 0) {
    return (
      <GlassCard padding="md">
        <p className="text-sm text-center text-secondary">
          No bookings in this date range.
        </p>
      </GlassCard>
    )
  }

  // Auto-select first booking
  const activeId = selectedBookingId ?? data.bookings[0].bookingId
  const activeBooking: BookingRow =
    data.bookings.find((b) => b.bookingId === activeId) ?? data.bookings[0]

  return (
    <div className="space-y-4">
      {/* Mutation error banner */}
      {mutationError && (
        <div
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-md text-xs"
          style={{
            background: 'color-mix(in srgb, var(--color-destructive) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-destructive) 30%, transparent)',
            color: 'var(--color-destructive)',
          }}
        >
          <span>{mutationError}</span>
          <button onClick={() => setMutationError(null)} className="font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* Booking filter tabs (shown only when multiple bookings) */}
      {data.bookings.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {data.bookings.map((b) => {
            const isActive = b.bookingId === activeId
            return (
              <button
                key={b.bookingId}
                onClick={() => setSelectedBookingId(b.bookingId)}
                className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
                style={{
                  background: isActive ? 'var(--color-primary)' : 'var(--color-glass-bg)',
                  color: isActive
                    ? 'var(--color-text-on-primary)'
                    : 'var(--color-text-secondary)',
                  borderColor: isActive
                    ? 'var(--color-primary)'
                    : 'var(--color-glass-border)',
                  transitionDuration: 'var(--transition-speed)',
                }}
              >
                {b.startDate === b.endDate ? b.startDate : `${b.startDate} – ${b.endDate}`}
                <span
                  className="ml-1 opacity-70"
                >
                  ({b.diverCount})
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Booking header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-primary">
            {activeBooking.operatorName}
          </p>
          <p className="text-xs text-secondary">
            {activeBooking.activityType.join(', ')} ·{' '}
            {activeBooking.startDate === activeBooking.endDate
              ? activeBooking.startDate
              : `${activeBooking.startDate} – ${activeBooking.endDate}`}{' '}
            · {activeBooking.diverCount} diver{activeBooking.diverCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Per-diver cards */}
      <div className="space-y-3">
        {activeBooking.divers.map((diver) => (
          <DiverCard
            key={diver.diverIndex}
            diver={diver}
            sizingEntries={data.gearSizingEntries}
            inventory={data.inventory}
            manufacturersByGearType={data.manufacturersByGearType}
            onPickUp={handlePickUp}
            onReturn={handleReturn}
            isActing={isActing}
          />
        ))}
      </div>
    </div>
  )
}
