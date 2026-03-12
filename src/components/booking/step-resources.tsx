'use client'

import { useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { DetailsState, ResourcesState, WizardAction } from '@/lib/booking/wizard-state'
import { getCourseByCode } from '@/lib/constants/course-catalog'
import { ResourcePicker } from './resource-picker'
import type { ResourcePickerEntry } from './resource-picker'
import type { DirectoryEntry } from '../../../convex/directory'
import type { InventoryListItem } from '../../../convex/availability'

// ── Props ──────────────────────────────────────────────────────────────────────

interface ResourcesStepProps {
  resources: ResourcesState
  details: DetailsState
  dispatch: React.Dispatch<WizardAction>
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns every date from startDate to endDate (inclusive), YYYY-MM-DD strings. */
function buildDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const cursor = new Date(start)
  while (cursor <= end) {
    dates.push(cursor.toISOString().split('T')[0])
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

/**
 * Determines whether any selected activity type requires a confined water session.
 * Pool picker is only rendered when this returns true.
 */
function hasConfinedDay(activityTypes: string[]): boolean {
  return activityTypes.some((code) => {
    const entry = getCourseByCode(code as Parameters<typeof getCourseByCode>[0])
    return entry?.requiresConfined ?? false
  })
}

/**
 * Returns the set of owner slugs whose ALL inventory units are fully booked
 * on the booking dates. Owners with at least one available unit are excluded.
 */
function unavailableOwnerSlugSet(
  inventoryItems: InventoryListItem[],
  unavailableUnitIds: Set<string>,
): Set<string> {
  // Group unit IDs by owner slug
  const byOwner = new Map<string, string[]>()
  for (const item of inventoryItems) {
    const list = byOwner.get(item.ownerId) ?? []
    list.push(item.id)
    byOwner.set(item.ownerId, list)
  }

  const result = new Set<string>()
  for (const [ownerId, unitIds] of byOwner) {
    if (unitIds.every((id) => unavailableUnitIds.has(id))) {
      result.add(ownerId)
    }
  }
  return result
}

/**
 * Groups inventory items by owner slug, returning a map of slug → display names.
 * Used to surface vessel names under each boat operator.
 */
function buildSubItemMap(inventoryItems: InventoryListItem[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const item of inventoryItems) {
    const list = map.get(item.ownerId) ?? []
    list.push(item.name)
    map.set(item.ownerId, list)
  }
  return map
}

/** Converts DirectoryEntry[] + subItemMap + unavailableSet → ResourcePickerEntry[] */
function toPickerEntries(
  entries: DirectoryEntry[],
  subItemMap?: Map<string, string[]>,
): ResourcePickerEntry[] {
  return entries.map((e) => ({
    slug: e.slug,
    name: e.name,
    city: e.city,
    country: e.country,
    languages: e.languages,
    verified: e.verified,
    subItems: subItemMap?.get(e.slug),
  }))
}

// ── StepResources ──────────────────────────────────────────────────────────────

export function StepResources({ resources, details, dispatch }: ResourcesStepProps) {
  const dates = useMemo(
    () => buildDateRange(details.startDate, details.endDate),
    [details.startDate, details.endDate],
  )

  const needsPool = useMemo(
    () => hasConfinedDay(details.activityType),
    [details.activityType],
  )

  // ── Directory queries (ban-filtered, role-scoped) ──────────────────────────

  const instructors = useQuery(api.directory.listByRole, { role: 'Instructor' })
  const boats = useQuery(api.directory.listByRole, { role: 'Boat' })
  const equipment = useQuery(api.directory.listByRole, { role: 'Equipment' })
  const pools = useQuery(
    api.directory.listByRole,
    needsPool ? { role: 'Pool' } : 'skip',
  )
  const compressors = useQuery(api.directory.listByRole, { role: 'Compressor' })

  // ── Availability queries ───────────────────────────────────────────────────

  const unavailableUnitIdsRaw = useQuery(
    api.availability.getUnavailableUnitIdsForDates,
    { dates },
  )

  const instructorUnits = useQuery(api.availability.listInventoryByType, { type: 'Instructor' })
  const boatUnits = useQuery(api.availability.listInventoryByType, { type: 'Boat' })
  const equipmentUnits = useQuery(api.availability.listInventoryByType, { type: 'Equipment' })
  const poolUnits = useQuery(
    api.availability.listInventoryByType,
    needsPool ? { type: 'Pool' } : 'skip',
  )
  const compressorUnits = useQuery(api.availability.listInventoryByType, { type: 'Compressor' })

  // ── Derived sets ──────────────────────────────────────────────────────────

  const unavailableUnitIds = useMemo(
    () => new Set(unavailableUnitIdsRaw ?? []),
    [unavailableUnitIdsRaw],
  )

  const unavailableInstructors = useMemo(
    () => unavailableOwnerSlugSet(instructorUnits ?? [], unavailableUnitIds),
    [instructorUnits, unavailableUnitIds],
  )
  const unavailableBoats = useMemo(
    () => unavailableOwnerSlugSet(boatUnits ?? [], unavailableUnitIds),
    [boatUnits, unavailableUnitIds],
  )
  const unavailableEquipment = useMemo(
    () => unavailableOwnerSlugSet(equipmentUnits ?? [], unavailableUnitIds),
    [equipmentUnits, unavailableUnitIds],
  )
  const unavailablePools = useMemo(
    () => unavailableOwnerSlugSet(poolUnits ?? [], unavailableUnitIds),
    [poolUnits, unavailableUnitIds],
  )
  const unavailableCompressors = useMemo(
    () => unavailableOwnerSlugSet(compressorUnits ?? [], unavailableUnitIds),
    [compressorUnits, unavailableUnitIds],
  )

  // Boat vessel names grouped by operator slug (shown as sub-items in picker)
  const boatSubItems = useMemo(
    () => buildSubItemMap(boatUnits ?? []),
    [boatUnits],
  )

  // ── Picker entry arrays ────────────────────────────────────────────────────

  const instructorEntries = useMemo(
    () => toPickerEntries(instructors ?? []),
    [instructors],
  )
  const boatEntries = useMemo(
    () => toPickerEntries(boats ?? [], boatSubItems),
    [boats, boatSubItems],
  )
  const equipmentEntries = useMemo(
    () => toPickerEntries(equipment ?? []),
    [equipment],
  )
  const poolEntries = useMemo(
    () => toPickerEntries(pools ?? []),
    [pools],
  )
  const compressorEntries = useMemo(
    () => toPickerEntries(compressors ?? []),
    [compressors],
  )

  // ── Dispatch helpers ───────────────────────────────────────────────────────

  function setExternal(field: keyof NonNullable<ResourcesState['externalStakeholders']>, name: string) {
    dispatch({
      type: 'SET_RESOURCE',
      payload: {
        externalStakeholders: {
          ...resources.externalStakeholders,
          [field]: name || undefined,
        },
      },
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Instructor */}
      <section className="flex flex-col gap-2">
        <ResourcePicker
          label="Instructor"
          entries={instructorEntries}
          unavailableOwnerSlugs={unavailableInstructors}
          selectedSlug={resources.instructorId}
          freeformName={resources.externalStakeholders?.instructorName}
          onSelectSlug={(slug) =>
            dispatch({ type: 'SET_RESOURCE', payload: { instructorId: slug } })
          }
          onFreeformChange={(name) => setExternal('instructorName', name)}
          isLoading={instructors === undefined}
        />
      </section>

      {/* Boat */}
      <section className="flex flex-col gap-2">
        <ResourcePicker
          label="Boat"
          entries={boatEntries}
          unavailableOwnerSlugs={unavailableBoats}
          selectedSlug={resources.boatId}
          freeformName={resources.externalStakeholders?.boatName}
          onSelectSlug={(slug) =>
            dispatch({ type: 'SET_RESOURCE', payload: { boatId: slug } })
          }
          onFreeformChange={(name) => setExternal('boatName', name)}
          isLoading={boats === undefined}
          optional
        />
      </section>

      {/* Equipment Manager */}
      <section className="flex flex-col gap-2">
        <ResourcePicker
          label="Equipment Manager"
          entries={equipmentEntries}
          unavailableOwnerSlugs={unavailableEquipment}
          selectedSlug={resources.equipmentManagerId}
          freeformName={resources.externalStakeholders?.equipmentManagerName}
          onSelectSlug={(slug) =>
            dispatch({ type: 'SET_RESOURCE', payload: { equipmentManagerId: slug } })
          }
          onFreeformChange={(name) => setExternal('equipmentManagerName', name)}
          isLoading={equipment === undefined}
          optional
        />
      </section>

      {/* Pool — only shown when at least one activity requires confined water */}
      {needsPool && (
        <section className="flex flex-col gap-2">
          <ResourcePicker
            label="Pool"
            entries={poolEntries}
            unavailableOwnerSlugs={unavailablePools}
            selectedSlug={resources.poolId}
            freeformName={resources.externalStakeholders?.poolName}
            onSelectSlug={(slug) =>
              dispatch({ type: 'SET_RESOURCE', payload: { poolId: slug } })
            }
            onFreeformChange={(name) => setExternal('poolName', name)}
            isLoading={pools === undefined}
          />
        </section>
      )}

      {/* Compressor */}
      <section className="flex flex-col gap-2">
        <ResourcePicker
          label="Compressor"
          entries={compressorEntries}
          unavailableOwnerSlugs={unavailableCompressors}
          selectedSlug={resources.compressorId}
          freeformName={resources.externalStakeholders?.compressorName}
          onSelectSlug={(slug) =>
            dispatch({ type: 'SET_RESOURCE', payload: { compressorId: slug } })
          }
          onFreeformChange={(name) => setExternal('compressorName', name)}
          isLoading={compressors === undefined}
          optional
        />
      </section>
    </div>
  )
}
