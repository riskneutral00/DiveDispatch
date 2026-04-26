'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation, useQuery } from 'convex/react'
import { api, type Id } from '@/lib/convex-generated'
import { BusinessContactSection } from '@/components/profiles/business-contact-section'

import { DayToggleGroup } from '@/components/ui/day-toggle-group'
import { CheckboxGroup } from '@/components/ui/checkbox-group'
import { FieldRow } from '@/components/ui/field-row'
import { Input } from '@/components/ui/input'
import { NumberPicker } from '@/components/ui/number-picker'
import { SimpleSelect } from '@/components/ui/simple-select'
import { EntityCardList } from '@/components/ui/entity-card-list'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { compressorGasMixesToPayload } from '@/components/profiles/compressor-profile-form'
import { CompressorGasMixFields } from '@/components/profiles/compressor-gas-mix-fields'
import {
  contactSchema,
  boatFleetSchema,
} from '@/lib/schemas/profile-shared'
import {
  buildParentContactDefaults,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { BoatType, BOAT_TYPE_OPTIONS } from '@/lib/constants/boat-types'
import { type GasMix } from '@/lib/constants/gas-mixes'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

export type BoatProfileSection = 'contact' | 'fleet'

interface RouteState {
  venueIds: string[]
  daysOfWeek: number[]
}

interface FleetState {
  boatName: string
  maxPax: number
  minPax: number | undefined
  boatType: BoatType | ''
  routes: RouteState[]
  cutoffHours: number | undefined
  hasCompressor?: boolean
  compressorGasMixes?: GasMix[]
  compressorNitroxMin?: number
  compressorNitroxMax?: number
}

export function emptyFleet(): FleetState {
  return {
    boatName: '',
    maxPax: 0,
    minPax: undefined,
    boatType: '',
    routes: [],
    cutoffHours: undefined,
    hasCompressor: false,
    compressorGasMixes: [],
    compressorNitroxMin: undefined,
    compressorNitroxMax: undefined,
  }
}

export function emptyRoute(): RouteState {
  return { venueIds: [], daysOfWeek: [] }
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

export function BoatContactSection(props: BaseProfileSectionProps) {
  return (
    <BusinessContactSection
      {...props}
      nameLabel="Business Name"
      schema={contactSchema}
      inheritFromOtherRoles="Boat"
    />
  )
}

type CompressorDoc = {
  _id: Id<'compressors'>
  name: string
  location: 'fixed' | 'boat' | 'venue'
  boatId?: Id<'boats'>
  gasMixes?: GasMix[]
  nitroxMin?: number
  nitroxMax?: number
  address?: Record<string, string | undefined>
  lat?: number
  lng?: number
  email?: string
  phone?: string
}

interface ReconcileArgs {
  boatId: Id<'boats'>
  vessels: FleetState[]
  existing: CompressorDoc[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- comments-ok react mutation return type from useMutation has precise generics that can't be narrowed to Record<string, unknown>
  createCompressor: (args: any) => Promise<unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- comments-ok same as above
  updateCompressor: (args: any) => Promise<unknown>
  removeCompressor: (args: { compressorId: Id<'compressors'> }) => Promise<unknown>
  me: BaseProfileSectionProps['me']
  formatMultipleCompressorsError: (name: string) => string
}

async function reconcileCompressors({
  boatId,
  vessels,
  existing,
  createCompressor,
  updateCompressor,
  removeCompressor,
  me,
  formatMultipleCompressorsError,
}: ReconcileArgs): Promise<void> {
  for (const vessel of vessels) {
    const key = vessel.boatName.trim().toLowerCase()
    if (!key) continue
    const matches = existing.filter((c) => c.name.trim().toLowerCase() === key)

    if (matches.length > 1) {
      throw new Error(formatMultipleCompressorsError(vessel.boatName))
    }

    const gasPayload = compressorGasMixesToPayload({
      gasMixes: vessel.compressorGasMixes ?? [],
      nitroxMin: vessel.compressorNitroxMin,
      nitroxMax: vessel.compressorNitroxMax,
    })

    if (vessel.hasCompressor) {
      if (matches.length === 0) {
        const parentDefaults = buildParentContactDefaults(me) as Record<string, unknown>
        await createCompressor({
          ...parentDefaults,
          name: vessel.boatName,
          location: 'boat',
          boatId,
          ...gasPayload,
        })
      } else {
        const existingRow = matches[0]!
        await updateCompressor({
          compressorId: existingRow._id,
          location: 'boat',
          boatId,
          ...gasPayload,
        })
      }
    } else if (matches.length === 1) {
      await removeCompressor({ compressorId: matches[0]!._id })
    }
  }
}

export type BoatFleetFormState = {
  fleet: FleetState[]
}

export const INITIAL_BOAT_FLEET_FORM: BoatFleetFormState = {
  fleet: [emptyFleet()],
}

export function boatFleetFromProfile(p: Record<string, unknown>): BoatFleetFormState {
  const fleet = (p.fleet as Record<string, unknown>[] | undefined) ?? []
  return {
    fleet:
      fleet.length > 0
        ? fleet.map((f) => {
            const rawRoutes = (f.routes as Array<{ venueIds?: string[]; daysOfWeek?: number[] }> | undefined) ?? []
            return {
              boatName: f.boatName as string,
              maxPax: (f.maxPax as number) ?? 0,
              minPax: f.minPax != null ? (f.minPax as number) : undefined,
              boatType: f.boatType as BoatType,
              routes: rawRoutes.map((r) => ({
                venueIds: r.venueIds ?? [],
                daysOfWeek: r.daysOfWeek ?? [],
              })),
              cutoffHours: f.cutoffHours != null ? (f.cutoffHours as number) : undefined,
              hasCompressor: false,
              compressorGasMixes: [],
              compressorNitroxMin: undefined,
              compressorNitroxMax: undefined,
            }
          })
        : [emptyFleet()],
  }
}

export function boatFleetToPayload(f: BoatFleetFormState): Record<string, unknown> {
  return {
    fleet: f.fleet.map((v) => ({
      boatName: v.boatName,
      maxPax: v.maxPax,
      minPax: v.minPax,
      boatType: v.boatType as BoatType,
      routes: v.routes.length > 0 ? v.routes : undefined,
      cutoffHours: v.cutoffHours,
    })),
  }
}

export function BoatFleetSection({ profile: existing, me, create, update, onClose }: BaseProfileSectionProps) {
  const t = useTranslations('common')
  const boatProfile = useQuery(api.boats.mine)
  const compressors = useQuery(api.compressors.mine)
  const venues = useQuery(api.venues.visibleToMe)
  const venueOptions = (venues ?? []).map((v) => ({ value: v._id, label: v.name }))
  const createCompressor = useMutation(api.compressors.create)
  const updateCompressor = useMutation(api.compressors.update)
  const removeCompressor = useMutation(api.compressors.remove)

  const newBoatIdRef = useRef<Id<'boats'> | null>(null)
  const hydratedRef = useRef(false)

  const createOverride = async (payload: Record<string, unknown>) => {
    const id = await create({ ...buildParentContactDefaults(me), ...payload })
    if (typeof id === 'string') newBoatIdRef.current = id as Id<'boats'>
    return id
  }

  const { form, setForm, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit, resetToBaseline } =
    useProfileForm({
      profile: existing,
      schema: boatFleetSchema,
      defaults: INITIAL_BOAT_FLEET_FORM,
      fromProfile: boatFleetFromProfile,
      toPayload: boatFleetToPayload,
      create: createOverride,
      update,
      afterSuccessfulSave: async (latestForm) => {
        const boatId = boatProfile?.[0]?._id ?? newBoatIdRef.current
        if (!boatId) return
        await reconcileCompressors({
          boatId,
          vessels: latestForm.fleet,
          existing: (compressors ?? []).filter((c) => c.location === 'boat' && c.boatId === boatId),
          createCompressor,
          updateCompressor,
          removeCompressor,
          me,
          formatMultipleCompressorsError: (name) => t('multipleCompressorsLinkedVessel', { name }),
        })
      },
    })

  useEffect(() => {
    if (hydratedRef.current) return
    if (compressors === undefined) return
    if (!existing) {
      hydratedRef.current = true
      return
    }
    const onboard = compressors.filter((c) => c.location === 'boat')
    if (onboard.length === 0) {
      hydratedRef.current = true
      return
    }
    setForm((prev) => {
      const nextFleet = prev.fleet.map((vessel) => {
        const match = onboard.filter(
          (c) => c.name.trim().toLowerCase() === vessel.boatName.trim().toLowerCase(),
        )
        if (match.length !== 1) return vessel
        const c = match[0]!
        return {
          ...vessel,
          hasCompressor: true,
          compressorGasMixes: (c.gasMixes ?? []) as GasMix[],
          compressorNitroxMin: c.nitroxMin,
          compressorNitroxMax: c.nitroxMax,
        }
      })
      return { ...prev, fleet: nextFleet }
    })
    hydratedRef.current = true
  }, [compressors, existing, setForm])

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
      <EntityCardList<FleetState>
        label="Fleet"
        addLabel="Add Vessel"
        items={form.fleet}
        emptyItem={emptyFleet}
        onChange={(next) => setField('fleet', next)}
        layout="stack"
        minItems={1}
        removeAriaLabel={(_v, fi) => `Remove vessel ${fi + 1}`}
        renderCard={(vessel, update, fi) => (
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
      <div className="mb-4">
        <span className="text-body font-medium text-primary">
          Vessel {fi + 1}{vessel.boatName ? ` — ${vessel.boatName}` : ''}
        </span>
      </div>

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
          onChange={(v) => onUpdate({ boatType: v as BoatType })}
          options={BOAT_TYPE_OPTIONS}
          error={errors[`fleet.${fi}.boatType`]}
        />
        <NumberPicker
          className="field-md"
          label="Max Passengers"
          required
          min={1}
          max={100}
          value={vessel.maxPax || undefined}
          onChange={(v) => onUpdate({ maxPax: v ?? 0 })}
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

      <div className="mb-5">
        <CompressorGasMixFields
          checkboxLabel="Has compressor onboard"
          value={{
            hasCompressor: vessel.hasCompressor ?? false,
            gasMixes: (vessel.compressorGasMixes ?? []) as GasMix[],
            nitroxMin: vessel.compressorNitroxMin,
            nitroxMax: vessel.compressorNitroxMax,
          }}
          onChange={(next) =>
            onUpdate({
              hasCompressor: next.hasCompressor,
              compressorGasMixes: next.gasMixes,
              compressorNitroxMin: next.nitroxMin,
              compressorNitroxMax: next.nitroxMax,
            })
          }
        />
      </div>

      <EntityCardList<RouteState>
        label="Routes"
        addLabel="Add Route"
        items={vessel.routes}
        emptyItem={emptyRoute}
        onChange={onUpdateRoutes}
        layout="stack"
        emptyMessage="No routes added. Routes define which dive sites this vessel visits and on which days."
        removeAriaLabel={() => 'Remove route'}
        renderCard={(route, _update, ri) => (
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

