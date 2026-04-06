// ── Build Submit Payload ──────────────────────────────────────────────────────
// Pure data transformation: WizardState → submitToDraft mutation arguments.
// Extracted from review-step.tsx — zero React, zero side effects.

import type { Id } from '@/lib/convex-generated'
import type { CourseCode } from '@/lib/constants/course-catalog'
import type { WizardState } from '@/lib/booking/wizard-state'
import { deriveActivityType } from '@/lib/booking/wizard-state'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SessionEntry {
  inventoryUnitId: Id<'inventoryUnits'>
  date: string
  startTime: string
  endTime: string
  timezone: string
  unitsRequested: number
  deliveryLocation: 'BoatPier' | 'Pool' | 'Beach'
  diveSlots?: { courseCode: CourseCode; diveNumber: number; isConfined: boolean; diverIndex: number }[]
}

export interface DiverEntry {
  name: string
  abbrev: string
  flag: { code: string; label: string }
  startDate: string
  endDate: string
  agency: string
  activityType: CourseCode[]
  contactType?: 'email' | 'whatsapp' | 'line'
  contactValue?: string
}

export interface ResourceEntry {
  resourceType: string
  resourceSlug?: string
  externalName?: string
  roleType?: 'Instructor' | 'DiveMaster'
}

export interface SubmitPayload {
  bookingId: Id<'bookings'>
  sessions: SessionEntry[]
  bookingData: {
    activityType: CourseCode[]
    startDate: string
    endDate: string
    portalContact: true
    portalMedical: true
    portalWaiver: false
    resources: ResourceEntry[]
    divers: DiverEntry[]
  }
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validateReviewStep(state: WizardState): string | null {
  if (state.customers.length === 0) return 'Add at least one customer'
  if (!state.startDate || !state.endDate) return 'No date range.'
  if (state.days.length === 0) return 'No days scheduled.'
  return null
}

// ── Payload Builder ──────────────────────────────────────────────────────────

export function buildSubmitPayload(state: WizardState): SubmitPayload {
  const { customers, days, bookingId, startDate, endDate, equipment, compressor,
    equipmentIsExternal, compressorIsExternal, externalEquipmentName, externalCompressorName,
    inventoryUnitMap } = state

  const activityType = deriveActivityType(customers)

  // Build sessions from days — one per resource per day.
  // Each in-system resource (venue + instructor) needs its own session
  // so submitToDraft creates reservations and tracks availability.
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
              courseCode: slot.courseCode as CourseCode,
              diveNumber: slot.diveNumber,
              isConfined: slot.isConfined,
              diverIndex: idx,
            })),
          })
        }
      }
    }

    // Dive Master — same Instructor inventory path, no diveSlots (lead instructor carries teaching slots)
    if (d.diveMasterSlug && d.diveMasterSlug !== '__external__') {
      const dmUnitId = inventoryUnitMap[d.diveMasterSlug]
      if (dmUnitId) {
        const key = sessionKey(dmUnitId, d.date)
        if (!seen.has(key)) {
          seen.add(key)
          sessions.push({
            inventoryUnitId: dmUnitId as Id<'inventoryUnits'>,
            date: d.date,
            startTime: d.startTime,
            endTime: d.endTime,
            timezone: d.timezone,
            unitsRequested: 1,
            deliveryLocation,
          })
        }
      }
    }
  }

  // Build divers from customers
  const divers: DiverEntry[] = customers.map((c) => {
    const firstEntry = c.courseEntries?.[0]
    const allCodes = [...new Set((c.courseEntries ?? []).map((e) => e.activityCode).filter(Boolean))]
    const primaryFlag = c.flags?.[0] ?? { code: 'GB', label: 'English' }

    const contactType: 'email' | 'whatsapp' | 'line' | undefined =
      c.contact?.whatsapp ? 'whatsapp'
        : c.contact?.line ? 'line'
          : c.contact?.email ? 'email'
            : undefined
    const contactValue =
      c.contact?.whatsapp ?? c.contact?.line ?? c.contact?.email

    return {
      name: c.name,
      abbrev: c.name.charAt(0).toUpperCase(),
      flag: { code: primaryFlag.code, label: primaryFlag.label },
      startDate: firstEntry?.dates[0] ?? startDate,
      endDate: firstEntry?.dates[1] ?? firstEntry?.dates[0] ?? endDate,
      agency: firstEntry?.agency ?? '',
      activityType: allCodes as CourseCode[],
      ...(contactType && contactValue ? { contactType, contactValue } : {}),
    }
  })

  // Build generic resources array
  const resources: ResourceEntry[] = []

  // Per-day resources (instructors, boats, pools) extracted from days
  for (const d of days) {
    if (d.instructorSlug && d.instructorSlug !== '__external__') {
      if (!resources.some(r => r.resourceType === 'Instructor' && r.resourceSlug === d.instructorSlug && (r.roleType ?? 'Instructor') !== 'DiveMaster')) {
        resources.push({ resourceType: 'Instructor', resourceSlug: d.instructorSlug })
      }
    } else if (d.instructorSlug === '__external__' && d.externalInstructorName?.trim()) {
      if (!resources.some(r => r.resourceType === 'Instructor' && r.externalName === d.externalInstructorName && (r.roleType ?? 'Instructor') !== 'DiveMaster')) {
        resources.push({ resourceType: 'Instructor', externalName: d.externalInstructorName })
      }
    }
    if (d.diveMasterSlug && d.diveMasterSlug !== '__external__') {
      if (!resources.some(r => r.resourceType === 'Instructor' && r.resourceSlug === d.diveMasterSlug && r.roleType === 'DiveMaster')) {
        resources.push({ resourceType: 'Instructor', roleType: 'DiveMaster', resourceSlug: d.diveMasterSlug })
      }
    } else if (d.diveMasterSlug === '__external__' && d.externalDiveMasterName?.trim()) {
      if (!resources.some(r => r.resourceType === 'Instructor' && r.externalName === d.externalDiveMasterName && r.roleType === 'DiveMaster')) {
        resources.push({ resourceType: 'Instructor', roleType: 'DiveMaster', externalName: d.externalDiveMasterName })
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

  return {
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
  }
}
