'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from 'convex/react'
import { api, type Id } from '@/lib/convex-generated'

import { DayToggleGroup } from '@/components/ui/day-toggle-group'
import { CheckboxGroup } from '@/components/ui/checkbox-group'
import { FieldRow } from '@/components/ui/field-row'
import { Input } from '@/components/ui/input'
import { NumberPicker } from '@/components/ui/number-picker'
import { SimpleSelect } from '@/components/ui/simple-select'
import { ExpandingCardList, InlineRowList } from '@/components/profiles/collection-editors'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { GasMixFields } from '@/components/capabilities/gas-mix-fields'
import {
  boatFleetSchema,
  makeDefaultBoatFleetEntry,
  makeDefaultBoatRoute,
  type BoatFleetEntry,
  type BoatRoute,
} from '@/lib/schemas/profile-shared'
import {
  buildParentContactDefaults,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { BOAT_TYPE_OPTIONS } from '@/lib/constants/boat-types'
import { type GasMix } from '@/lib/constants/gas-mixes'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

export type BoatProfileSection = 'contact' | 'fleet'

type RouteState = BoatRoute

type FleetState = Omit<BoatFleetEntry, 'routes'> & { routes: RouteState[] }

function freshFleetEntry(): FleetState {
  return { ...makeDefaultBoatFleetEntry(), routes: [] }
}

function freshRoute(): RouteState {
  return makeDefaultBoatRoute()
}

export function applyDayToggle(
  fleet: FleetState[],
  fleetIndex: number,
  routeIndex: number,
  day: number,
): FleetState[] {
  return fleet.map((vessel, vi) => {
    if (vi !== fleetIndex) return vessel
    const targetRoute = vessel.routes[routeIndex]
    if (!targetRoute) return vessel
    const alreadyHasDay = targetRoute.daysOfWeek.includes(day)
    if (alreadyHasDay) {
      return {
        ...vessel,
        routes: vessel.routes.map((r, ri) =>
          ri === routeIndex ? { ...r, daysOfWeek: r.daysOfWeek.filter((d) => d !== day) } : r,
        ),
      }
    }
    return {
      ...vessel,
      routes: vessel.routes.map((r, ri) => {
        if (ri === routeIndex) return { ...r, daysOfWeek: [...r.daysOfWeek, day] }
        return { ...r, daysOfWeek: r.daysOfWeek.filter((d) => d !== day) }
      }),
    }
  })
}

export type BoatFleetFormState = {
  fleet: FleetState[]
  hasCompressor: boolean
  gasMixes: GasMix[]
  nitroxMin: number | undefined
  nitroxMax: number | undefined
}

export const INITIAL_BOAT_FLEET_FORM: BoatFleetFormState = {
  fleet: [freshFleetEntry()],
  hasCompressor: false,
  gasMixes: [],
  nitroxMin: undefined,
  nitroxMax: undefined,
}

export function boatFleetFromProfile(p: Record<string, unknown>): BoatFleetFormState {
  const fleet = (p.fleet as Record<string, unknown>[] | undefined) ?? []
  const gasMixes = (p.gasMixes ?? []) as GasMix[]
  return {
    fleet:
      fleet.length > 0
        ? fleet.map((f) => {
            const rawRoutes = (f.routes as Array<{ venueIds?: string[]; daysOfWeek?: number[] }> | undefined) ?? []
            return {
              boatName: f.boatName as string,
              maxPax: (f.maxPax as number | undefined) ?? (undefined as unknown as number),
              minPax: f.minPax != null ? (f.minPax as number) : undefined,
              boatType: f.boatType as BoatFleetEntry['boatType'],
              routes: rawRoutes.map((r) => ({
                venueIds: r.venueIds ?? [],
                daysOfWeek: r.daysOfWeek ?? [],
              })),
              cutoffHours: f.cutoffHours != null ? (f.cutoffHours as number) : undefined,
            }
          })
        : [freshFleetEntry()],
    hasCompressor: gasMixes.length > 0,
    gasMixes,
    nitroxMin: typeof p.nitroxMin === 'number' ? p.nitroxMin : undefined,
    nitroxMax: typeof p.nitroxMax === 'number' ? p.nitroxMax : undefined,
  }
}

export function boatFleetToPayload(f: BoatFleetFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    fleet: f.fleet.map((v) => ({
      boatName: v.boatName,
      maxPax: v.maxPax,
      minPax: v.minPax,
      boatType: v.boatType,
      routes: v.routes.length > 0 ? v.routes : undefined,
      cutoffHours: v.cutoffHours,
    })),
  }
  if (f.hasCompressor && f.gasMixes.length > 0) {
    payload.gasMixes = f.gasMixes
    if (f.gasMixes.includes('nitrox')) {
      payload.nitroxMin = f.nitroxMin
      payload.nitroxMax = f.nitroxMax
    }
  } else {
    payload.gasMixes = []
  }
  return payload
}

export function BoatFleetSection({ profile: existing, me, create, update, onClose }: BaseProfileSectionProps) {
  const t = useTranslations('common')
  const venues = useQuery(api.venues.visibleToMe)
  const venueOptions = (venues ?? [])
    .filter((v) => v.kind === 'dive_site')
    .map((v) => ({ value: v._id, label: v.name }))

  const newBoatIdRef = useRef<Id<'boats'> | null>(null)

  const createOverride = async (payload: Record<string, unknown>) => {
    const id = await create({ ...buildParentContactDefaults(me), ...payload })
    if (typeof id === 'string') newBoatIdRef.current = id as Id<'boats'>
    return id
  }

  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit, resetToBaseline } =
    useProfileForm({
      profile: existing,
      schema: boatFleetSchema,
      defaults: INITIAL_BOAT_FLEET_FORM,
      fromProfile: boatFleetFromProfile,
      toPayload: boatFleetToPayload,
      create: createOverride,
      update,
    })

  function toggleDay(fi: number, ri: number, day: number) {
    setField('fleet', applyDayToggle(form.fleet, fi, ri, day))
  }

  return (
    <ProfileFormShell
      loading={loading}
      onSubmit={handleSubmit}
      onCancel={() => { resetToBaseline(); onClose?.() }}
      footerErrorMessage={footerErrorMessage}
      saving={saving}
      saved={saved}
      isDirty={isDirty}
      isUpdate={isUpdate}
      disableSaveWhenInvalid
      isValid={isValid}
      className="space-y-6"
    >
      <GasMixFields
        checkboxLabel={t('hasCompressorOnBoat')}
        value={{
          hasCompressor: form.hasCompressor,
          gasMixes: form.gasMixes,
          nitroxMin: form.nitroxMin,
          nitroxMax: form.nitroxMax,
        }}
        onChange={(next) => {
          setField('hasCompressor', next.hasCompressor)
          setField('gasMixes', next.gasMixes)
          setField('nitroxMin', next.nitroxMin)
          setField('nitroxMax', next.nitroxMax)
        }}
      />
      <ExpandingCardList<FleetState>
        label="Fleet"
        addLabel="Add Vessel"
        items={form.fleet}
        emptyItem={freshFleetEntry}
        onChange={(next) => setField('fleet', next)}
        itemKey={(_v, fi) => String(fi)}
        defaultExpandFirst
        minItems={1}
        removeAriaLabel={(_v, fi) => `Remove vessel ${fi + 1}`}
        renderCardTitle={(vessel, fi) =>
          `Vessel ${fi + 1}${vessel.boatName ? ` — ${vessel.boatName}` : ''}`
        }
        renderExpandedBody={(vessel, update, fi) => (
          <FleetEntryBody
            vessel={vessel}
            fleetIdx={fi}
            errors={errors}
            venueOptions={venueOptions}
            onUpdate={(patch) => update({ ...vessel, ...patch })}
            onUpdateRoutes={(routes) => update({ ...vessel, routes })}
            onToggleDay={(ri, day) => toggleDay(fi, ri, day)}
          />
        )}
      />
    </ProfileFormShell>
  )
}

interface FleetEntryBodyProps {
  vessel: FleetState
  fleetIdx: number
  errors: Record<string, string>
  venueOptions: { value: string; label: string }[]
  onUpdate: (patch: Partial<FleetState>) => void
  onUpdateRoutes: (next: RouteState[]) => void
  onToggleDay: (ri: number, day: number) => void
}

function FleetEntryBody({ vessel, fleetIdx: fi, errors, venueOptions, onUpdate, onUpdateRoutes, onToggleDay }: FleetEntryBodyProps) {
  return (
    <>
      <FieldRow className="mb-5">
        <Input
          className="field-md"
          label="Boat Name"
          required
          value={vessel.boatName}
          onChange={(e) => onUpdate({ boatName: e.target.value })}
          error={errors[`fleet.${fi}.boatName`]}
        />
        <SimpleSelect
          className="field-md"
          label="Boat Type"
          required
          value={vessel.boatType}
          onChange={(v) => onUpdate({ boatType: v as BoatFleetEntry['boatType'] })}
          options={BOAT_TYPE_OPTIONS}
          error={errors[`fleet.${fi}.boatType`]}
        />
        <NumberPicker
          className="field-md"
          label="Max Passengers"
          required
          min={1}
          max={100}
          value={vessel.maxPax}
          onChange={(v) => onUpdate({ maxPax: v as number })}
          error={errors[`fleet.${fi}.maxPax`]}
        />
        <NumberPicker
          className="field-md"
          label="Min Passengers"
          min={1}
          max={100}
          value={vessel.minPax}
          onChange={(v) => onUpdate({ minPax: v })}
          error={errors[`fleet.${fi}.minPax`]}
        />
        <NumberPicker
          className="field-md"
          label="Cutoff Hours"
          min={0}
          max={168}
          value={vessel.cutoffHours}
          onChange={(v) => onUpdate({ cutoffHours: v })}
          error={errors[`fleet.${fi}.cutoffHours`]}
        />
      </FieldRow>

      <InlineRowList<RouteState>
        label="Routes"
        addLabel="Add Route"
        items={vessel.routes}
        emptyItem={freshRoute}
        onChange={onUpdateRoutes}
        emptyMessage="No routes added. Routes define which dive sites this vessel visits and on which days."
        removeAriaLabel={() => 'Remove route'}
        renderRow={(route, _update, ri) => (
          <RouteRowBody
            route={route}
            fleetIdx={fi}
            routeIdx={ri}
            errors={errors}
            venueOptions={venueOptions}
            onUpdate={(patch) => {
              onUpdateRoutes(vessel.routes.map((r, i) => (i === ri ? { ...r, ...patch } : r)))
            }}
            onToggleDay={(day) => onToggleDay(ri, day)}
          />
        )}
      />
    </>
  )
}

interface RouteRowBodyProps {
  route: RouteState
  fleetIdx: number
  routeIdx: number
  errors: Record<string, string>
  venueOptions: { value: string; label: string }[]
  onUpdate: (patch: Partial<RouteState>) => void
  onToggleDay: (day: number) => void
}

function RouteRowBody({ route, fleetIdx: fi, routeIdx: ri, errors, venueOptions, onUpdate, onToggleDay }: RouteRowBodyProps) {
  return (
    <>
      <CheckboxGroup
        label="Venues"
        required
        items={venueOptions}
        selected={route.venueIds}
        onChange={(values) => onUpdate({ venueIds: values })}
        error={errors[`fleet.${fi}.routes.${ri}.venueIds`]}
      />
      <DayToggleGroup
        selected={route.daysOfWeek}
        onChange={(newDays) => {
          const added = newDays.find((d) => !route.daysOfWeek.includes(d))
          const removed = route.daysOfWeek.find((d) => !newDays.includes(d))
          if (added !== undefined) onToggleDay(added)
          else if (removed !== undefined) onToggleDay(removed)
        }}
        error={errors[`fleet.${fi}.routes.${ri}.daysOfWeek`]}
      />
    </>
  )
}

