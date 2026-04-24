'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/convex-generated'
import { Card, Badge, Button, EmptyState, ErrorAlert, FormSectionHeader } from '@/components/ui'
import { parseConvexError } from '@/lib/utils/convex-error'
import { TOUCH_TARGET_CLASS } from '@/lib/constants/button-sizes'
import { LoadingCard } from '@/components/ui/loading-card'
import {
  suggestGearSizes,
  type DiverMeasurements,
} from '@/lib/utils/gear-size-suggest'
import { GEAR_TYPE_LABELS, GEAR_TYPES, type GearType } from '@/lib/constants/gear-sizing'
import type {
  DiverEquipmentWidgetData,
  BookingRow,
  DiverRow,
  GearInventoryItem,
  GearSizingRow,
} from '../../../convex/equipmentWidget'
import type { Id } from '@/lib/convex-generated'
import { countryCodeToEmoji } from '@/components/ui/flag-emoji'

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

function BagStatusBadge({ status }: { status: 'Assigned' | 'InUse' | 'Returned' }) {
  const variant =
    status === 'Returned' ? 'success' : status === 'InUse' ? 'warning' : 'default'
  return (
    <Badge variant={variant} size="sm" dot>
      {status}
    </Badge>
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
    ? GEAR_TYPES.filter(
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
    <Card padding="md">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl" /* design-ok: emoji size */ aria-label={diver.flag.label}>
            {countryCodeToEmoji(diver.flag.code)}
          </span>
          <div>
            <p className="font-medium text-body text-primary">
              {diver.name}
            </p>
            {diver.needsPoweredLenses && (
              <p className="text-label text-warning">
                Prescription lens
                {diver.prescriptionStrength ? ` ${diver.prescriptionStrength}` : ''}
              </p>
            )}
          </div>
        </div>

        {diver.bag ? (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-label text-secondary">
                Bag {diver.bag.bagNumber}
              </span>
              <BagStatusBadge status={diver.bag.status} />
            </div>
            {diver.bag.status === 'Assigned' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onPickUp(diver.bag!.bagId)}
                disabled={isActing}
              >
                Mark Picked Up
              </Button>
            )}
            {diver.bag.status === 'InUse' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onReturn(diver.bag!.bagId)}
                disabled={isActing}
              >
                Mark Returned
              </Button>
            )}
          </div>
        ) : (
          <Badge variant="default" size="sm">
            No bag assigned
          </Badge>
        )}
      </div>

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
          <p className="text-label italic text-secondary">
            Measurements not submitted yet
          </p>
        )}
      </div>

      {rentingTypes.length > 0 && (
        <div className="border-t pt-3 border-glass-border">
          <FormSectionHeader label="Rental Gear" className="mb-2" />
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
    </Card>
  )
}

function MeasurementChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="px-2 py-1 rounded-[var(--border-radius-button)] text-label glass-container"
    >
      <span className="text-secondary">{label}: </span>
      <span className="font-medium text-primary">
        {value}
      </span>
    </div>
  )
}

interface GearSizeRowProps {
  gearType: GearType
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
      <span className="text-label font-medium text-primary">
        {GEAR_TYPE_LABELS[gearType] ?? gearType}
      </span>

      <div className="flex items-center gap-1.5">
        {effectiveSuggestion.status === 'match' && !editing && (
          <>
            {/* design-ok: conditional variant dispatch — tokens not in @theme inline */}
            <span
              className="text-label px-2 py-0.5 rounded-[var(--border-radius-button)]"
              style={{
                background: isManualOverride
                  ? 'var(--color-warning-muted)'
                  : 'var(--color-primary-muted)',
                color: isManualOverride ? 'var(--color-warning)' : 'var(--color-primary)',
                border: `1px solid ${isManualOverride ? 'var(--color-warning-border)' : 'var(--color-primary-border)'}`,
              }}
            >
              {isManualOverride ? '✏ ' : ''}
              {effectiveSuggestion.manufacturer} {effectiveSuggestion.size}
            </span>

            {!isManualOverride && (effectiveSuggestion.status === 'match') && (
              <span
                className="text-label"
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
            className="text-label italic text-destructive"
          >
            No match — manual sizing needed
          </span>
        )}

        {effectiveSuggestion.status === 'no_data' && !editing && (
          <span className="text-label text-secondary">
            —
          </span>
        )}

        {editing && (
          <div className="flex items-center gap-1">
            <input /* design-ok: inline size edit in equipment row, --color-primary border not in @theme inline */
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="e.g. M"
              className="text-label px-2 py-0.5 rounded-[var(--border-radius-button)] w-16 outline-none text-primary bg-glass-bg"
              style={{ border: '1px solid var(--color-primary)' }}
              autoFocus
            />
            <button /* design-ok: inline confirm action inside size-override editor */
              onClick={() => {
                if (editValue.trim()) onOverride(editValue.trim())
                setEditing(false)
                setEditValue('')
              }}
              className={`text-label ${TOUCH_TARGET_CLASS} flex items-center justify-center rounded-[var(--border-radius-button)]`}
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-text-on-primary)',
              }}
            >
              ✓
            </button>
            <button /* design-ok: inline cancel action inside size-override editor */
              onClick={() => {
                setEditing(false)
                setEditValue('')
              }}
              className={`text-label ${TOUCH_TARGET_CLASS} flex items-center justify-center rounded-[var(--border-radius-button)] text-secondary bg-glass-bg border-glass-border border`}
            >
              ✕
            </button>
          </div>
        )}

        {!editing && (
          <div className="flex gap-1">
            <button /* design-ok: inline edit-size icon trigger inside row */
              onClick={() => {
                setEditValue(isManualOverride ? overrideSize : '')
                setEditing(true)
              }}
              className={`text-label text-secondary ${TOUCH_TARGET_CLASS} flex items-center justify-center`}
              title="Override size"
            >
              ✏
            </button>
            {isManualOverride && (<>
              <button /* design-ok: inline clear-override icon trigger inside row */
                onClick={onClearOverride}
                className={`text-label text-secondary ${TOUCH_TARGET_CLASS} flex items-center justify-center`}
                title="Clear override"
              >
                ↺
              </button>
            </>)}
          </div>
        )}
      </div>
    </div>
  )
}

export interface DiverEquipmentWidgetProps {
  visibleRange: { start: string; end: string }
}

export function DiverEquipmentWidget({ visibleRange }: DiverEquipmentWidgetProps) {
  const tEmpty = useTranslations('booking.emptyStates')
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

  if (data === undefined) {
    return (
      <LoadingCard variant="spinner" />
    )
  }

  if (data === null) {
    return (
      <Card padding="md">
        <EmptyState message={tEmpty('equipmentProfileNotSetUp')} />
      </Card>
    )
  }

  if (data.bookings.length === 0) {
    return (
      <Card padding="md">
        <EmptyState message={tEmpty('noBookingsInRange')} />
      </Card>
    )
  }

  const activeId = selectedBookingId ?? data.bookings[0].bookingId
  const activeBooking: BookingRow =
    data.bookings.find((b) => b.bookingId === activeId) ?? data.bookings[0]

  return (
    <div className="space-y-4">
      {mutationError && (
        <ErrorAlert className="justify-between">
          <span>{mutationError}</span>
          <Button variant="ghost" size="sm" onClick={() => setMutationError(null)} className="ml-2">
            Dismiss
          </Button>
        </ErrorAlert>
      )}

      {data.bookings.length > 1 && (
        <div className="flex flex-wrap gap-1.5 reading-plane rounded-theme p-1.5">
          {data.bookings.map((b) => {
            const isActive = b.bookingId === activeId
            return (
              <button /* design-ok: booking-tab pill inside multi-booking switcher, behaves like Tabs primitive but with custom pill chrome */
                key={b.bookingId}
                onClick={() => setSelectedBookingId(b.bookingId)}
                className={`px-3 py-1 rounded-full text-label font-medium border transition-all duration-theme ${TOUCH_TARGET_CLASS}`}
                style={{
                  background: isActive ? 'var(--color-primary)' : 'var(--color-glass-bg)',
                  color: isActive
                    ? 'var(--color-text-on-primary)'
                    : 'var(--color-text-secondary)',
                  borderColor: isActive
                    ? 'var(--color-primary)'
                    : 'var(--color-glass-border)',
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

      <div className="flex items-center justify-between">
        <div>
          <p className="text-body font-medium text-primary">
            {activeBooking.operatorName}
          </p>
          <p className="text-label text-secondary">
            {activeBooking.activityType.join(', ')} ·{' '}
            {activeBooking.startDate === activeBooking.endDate
              ? activeBooking.startDate
              : `${activeBooking.startDate} – ${activeBooking.endDate}`}{' '}
            · {activeBooking.diverCount} diver{activeBooking.diverCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

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
