'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { AlertTriangle, Calendar, Users, Send, ChevronLeft } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { GlassCard, GlassButton } from '@/components/glass'
import { countryCodeToEmoji } from '@/components/common/flag-emoji'
import { courseLabel } from '@/lib/constants/course-catalog'
import { deriveActivityType } from '@/lib/booking/wizard-state'
import type { WizardState, WizardAction } from '@/lib/booking/wizard-state'
import type { Dispatch } from 'react'

interface ReviewStepProps {
  state: WizardState
  dispatch: Dispatch<WizardAction>
  isEditMode?: boolean
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-semibold uppercase tracking-wider mb-2"
      style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-heading)' }}
    >
      {children}
    </p>
  )
}

function formatDateRange(a: string, b: string): string {
  if (!a && !b) return '–'
  if (a === b || !b) return a
  return `${a} – ${b}`
}

export function ReviewStep({ state, dispatch, isEditMode = false }: ReviewStepProps) {
  const router = useRouter()
  const submitToDraft = useMutation(api.bookings.create.submitToDraft)

  const [submitError, setSubmitError] = useState<string | null>(null)

  const { customers, days, bookingId, startDate, endDate, equipment, compressor,
    equipmentIsExternal, compressorIsExternal, externalEquipmentName, externalCompressorName,
    submitting, inventoryUnitMap } = state

  const activityType = deriveActivityType(customers)

  function validate(): string | null {
    if (customers.length === 0) return 'Add at least one customer'
    if (!startDate || !endDate) return 'No date range — add course entries in the Itinerary step'
    if (days.length === 0) return 'No days scheduled — build the schedule in the Itinerary step'
    return null
  }

  async function handleSubmit() {
    if (!bookingId) return
    const err = validate()
    if (err) { setSubmitError(err); return }
    setSubmitError(null)
    dispatch({ type: 'SET_SUBMITTING', value: true })

    try {
      // Build sessions from days — one per resource per day.
      // Each in-system resource (venue + instructor) needs its own session
      // so submitToDraft creates reservations and tracks availability.
      type CourseCodeLiteral = import('@/lib/constants/course-catalog').CourseCode
      type SessionEntry = {
        inventoryUnitId: Id<'inventoryUnits'>
        date: string
        startTime: string
        endTime: string
        timezone: string
        unitsRequested: number
        deliveryLocation: 'BoatPier' | 'Pool' | 'Beach'
        diveSlots?: { courseCode: CourseCodeLiteral; diveNumber: number; isConfined: boolean; diverIndex: number }[]
      }
      const sessions: SessionEntry[] = []
      const sessionKey = (unitId: string, date: string) => `${unitId}|${date}`
      const seen = new Set<string>()

      for (const d of days) {
        const deliveryLocation = (d.venueType === 'pool' ? 'Pool' : 'BoatPier') as 'BoatPier' | 'Pool' | 'Beach'

        // Venue session (boat or pool) — skip shore days and external venues
        if (d.venueType !== 'shore') {
          const venueSlug = d.venueType === 'pool' ? d.poolInventoryUnitId : d.inventoryUnitId
          const venueUnitId = venueSlug ? inventoryUnitMap[venueSlug] : undefined
          if (venueUnitId) {
            const key = sessionKey(venueUnitId, d.date)
            if (!seen.has(key)) {
              seen.add(key)
              sessions.push({
                inventoryUnitId: venueUnitId as Id<'inventoryUnits'>,
                date: d.date,
                startTime: d.startTime,
                endTime: d.endTime,
                timezone: d.timezone,
                unitsRequested: Math.max(customers.length, 1),
                deliveryLocation,
              })
            }
          }
        }

        // Instructor session — in-system instructors need reservations too
        if (d.instructorSlug && d.instructorSlug !== '__external__') {
          const instrUnitId = inventoryUnitMap[d.instructorSlug]
          if (instrUnitId) {
            const key = sessionKey(instrUnitId, d.date)
            if (!seen.has(key)) {
              seen.add(key)
              sessions.push({
                inventoryUnitId: instrUnitId as Id<'inventoryUnits'>,
                date: d.date,
                startTime: d.startTime,
                endTime: d.endTime,
                timezone: d.timezone,
                unitsRequested: 1, // Instructor = Exclusive (1 unit)
                deliveryLocation,
                diveSlots: d.dives.map((slot, idx) => ({
                  courseCode: slot.courseCode as CourseCodeLiteral,
                  diveNumber: slot.diveNumber,
                  isConfined: slot.isConfined,
                  diverIndex: idx,
                })),
              })
            }
          }
        }
      }

      // Build divers from customers
      const divers = customers.map((c) => {
        const firstEntry = c.courseEntries?.[0]
        const allCodes = [...new Set((c.courseEntries ?? []).map((e) => e.activityCode).filter(Boolean))]
        const primaryFlag = c.flags?.[0] ?? { code: 'GB', label: 'English' }
        return {
          name: c.name,
          abbrev: c.name.charAt(0).toUpperCase(),
          flag: { code: primaryFlag.code, label: primaryFlag.label },
          startDate: firstEntry?.dates[0] ?? startDate,
          endDate: firstEntry?.dates[1] ?? firstEntry?.dates[0] ?? endDate,
          agency: firstEntry?.agency ?? '',
          activityType: allCodes as import('@/lib/constants/course-catalog').CourseCode[],
        }
      })

      // Build generic resources array
      const resources: Array<{ resourceType: string; resourceSlug?: string; externalName?: string }> = []

      // Per-day resources (instructors, boats, pools) extracted from days
      for (const d of days) {
        if (d.instructorSlug && d.instructorSlug !== '__external__') {
          if (!resources.some(r => r.resourceType === 'Instructor' && r.resourceSlug === d.instructorSlug)) {
            resources.push({ resourceType: 'Instructor', resourceSlug: d.instructorSlug })
          }
        } else if (d.instructorSlug === '__external__' && d.externalInstructorName?.trim()) {
          if (!resources.some(r => r.resourceType === 'Instructor' && r.externalName === d.externalInstructorName)) {
            resources.push({ resourceType: 'Instructor', externalName: d.externalInstructorName })
          }
        }
        if (d.venueType === 'boat' && d.inventoryUnitId) {
          if (!resources.some(r => r.resourceType === 'Boat' && r.resourceSlug === d.inventoryUnitId)) {
            resources.push({ resourceType: 'Boat', resourceSlug: d.inventoryUnitId })
          }
        } else if (d.venueType === 'boat' && d.externalVenueName?.trim()) {
          if (!resources.some(r => r.resourceType === 'Boat' && r.externalName === d.externalVenueName)) {
            resources.push({ resourceType: 'Boat', externalName: d.externalVenueName })
          }
        }
        if (d.venueType === 'pool' && d.poolInventoryUnitId) {
          if (!resources.some(r => r.resourceType === 'Pool' && r.resourceSlug === d.poolInventoryUnitId)) {
            resources.push({ resourceType: 'Pool', resourceSlug: d.poolInventoryUnitId })
          }
        } else if (d.venueType === 'pool' && d.externalPoolName?.trim()) {
          if (!resources.some(r => r.resourceType === 'Pool' && r.externalName === d.externalPoolName)) {
            resources.push({ resourceType: 'Pool', externalName: d.externalPoolName })
          }
        }
      }

      // Equipment + Compressor
      if (!equipmentIsExternal && equipment) {
        resources.push({ resourceType: 'Equipment', resourceSlug: equipment })
      } else if (equipmentIsExternal && externalEquipmentName) {
        resources.push({ resourceType: 'Equipment', externalName: externalEquipmentName })
      }
      if (!compressorIsExternal && compressor) {
        resources.push({ resourceType: 'Compressor', resourceSlug: compressor })
      } else if (compressorIsExternal && externalCompressorName) {
        resources.push({ resourceType: 'Compressor', externalName: externalCompressorName })
      }

      await submitToDraft({
        bookingId: bookingId as Id<'bookings'>,
        sessions,
        bookingData: {
          activityType,
          startDate,
          endDate,
          portalContact: true,
          portalMedical: true,
          portalWaiver: false,
          resources,
          divers,
        },
      })

      dispatch({ type: 'SET_SUBMITTED_BOOKING_ID', id: bookingId })
      router.push(isEditMode ? `/booking/${bookingId}` : '/dashboard')
    } catch (err) {
      dispatch({ type: 'SET_SUBMITTING', value: false })
      if (err instanceof ConvexError) {
        const data = err.data as { code?: string; reason?: string }
        setSubmitError(data.reason ?? data.code ?? 'Submission failed. Please try again.')
      } else {
        setSubmitError('An unexpected error occurred. Please try again.')
      }
    }
  }

  const validationError = validate()

  return (
    <div className="flex flex-col gap-4">
      {/* Customers */}
      <GlassCard padding="md" elevated>
        <SectionLabel>
          <span className="flex items-center gap-1.5">
            <Users size={11} />
            Customers ({customers.length})
          </span>
        </SectionLabel>
        {customers.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No customers added.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {customers.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {c.flags?.[0] ? (
                  <span className="text-base leading-none">{countryCodeToEmoji(c.flags[0].code)}</span>
                ) : (
                  <span className="text-base leading-none">🌐</span>
                )}
                <span className="font-medium">{c.name || `Customer ${i + 1}`}</span>
                {(c.courseEntries?.length ?? 0) > 0 && (
                  <span className="ml-auto text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {c.courseEntries!.map((e) => e.activityCode).filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Date range + courses */}
      <GlassCard padding="md" elevated>
        <SectionLabel>
          <span className="flex items-center gap-1.5">
            <Calendar size={11} />
            Booking Overview
          </span>
        </SectionLabel>
        <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
          <p>{formatDateRange(startDate, endDate)}</p>
          {activityType.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {activityType.map((code) => (
                <span
                  key={code}
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                    color: 'var(--color-accent)',
                    border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
                  }}
                >
                  {courseLabel(code)}
                </span>
              ))}
            </div>
          )}
        </div>
      </GlassCard>

      {/* Days */}
      {days.length > 0 && (
        <GlassCard padding="md" elevated>
          <SectionLabel>Schedule ({days.length} day{days.length !== 1 ? 's' : ''})</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {days.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'var(--color-glass-bg)', border: '1px solid var(--color-glass-border)' }}
                >
                  {i + 1}
                </span>
                <span>{d.date}</span>
                <span className="capitalize" style={{ color: 'var(--color-text-secondary)' }}>{d.venueType}</span>
                <span className="ml-auto text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {d.startTime}–{d.endTime}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Error */}
      {submitError && (
        <div
          className="flex items-start gap-3 p-3 rounded-[var(--border-radius)] text-sm"
          role="alert"
          style={{
            background: 'color-mix(in srgb, var(--color-destructive) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-destructive) 30%, transparent)',
            color: 'var(--color-destructive)',
          }}
        >
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" aria-hidden />
          <span>{submitError}</span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center gap-4 mt-2">
        <GlassButton
          variant="secondary"
          size="md"
          disabled={submitting}
          onClick={() => dispatch({ type: 'SET_STEP', payload: 'itinerary' })}
        >
          <ChevronLeft size={16} />
          Back
        </GlassButton>
        <GlassButton
          variant="primary"
          size="md"
          disabled={submitting || !bookingId || !!validationError}
          loading={submitting}
          onClick={() => void handleSubmit()}
        >
          <Send size={16} />
          {isEditMode ? 'Update Booking' : 'Submit Booking'}
        </GlassButton>
      </div>

      {!submitting && validationError && (
        <p className="text-xs text-center" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
          {validationError}
        </p>
      )}
    </div>
  )
}
