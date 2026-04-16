'use client'

import { Plus } from 'lucide-react'
import { BusinessContactSection } from '@/components/profiles/business-contact-section'

import { FormSectionHeader } from '@/components/ui/form-section-header'
import { DayToggleGroup } from '@/components/ui/day-toggle-group'
import { Button } from '@/components/ui/button'
import { FormGrid, FormField } from '@/components/ui/form-grid'
import { Input } from '@/components/ui/input'
import { NumberPicker } from '@/components/ui/number-picker'
import { SimpleSelect } from '@/components/ui/simple-select'
import { ItemCard } from '@/components/ui/item-card'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import {
  contactSchema,
  boatFleetSchema,
} from '@/lib/schemas/profile-shared'
import {
  buildParentContactDefaults,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { BoatType, BOAT_TYPE_OPTIONS } from '@/lib/constants/boat-types'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

export type BoatProfileSection = 'contact' | 'fleet'

type BoatSectionProps = BaseProfileSectionProps

interface RouteState {
  diveSite: string
  daysOfWeek: number[]
}

interface FleetState {
  boatName: string
  maxPax: number
  minPax: number | undefined
  boatType: BoatType | ''
  routes: RouteState[]
  cutoffHours: number | undefined
}

export function emptyFleet(): FleetState {
  return { boatName: '', maxPax: 0, minPax: undefined, boatType: '', routes: [], cutoffHours: undefined }
}

export function emptyRoute(): RouteState {
  return { diveSite: '', daysOfWeek: [] }
}

export function BoatContactSection(props: BoatSectionProps) {
  return (
    <BusinessContactSection
      {...props}
      nameLabel="Business Name"
      schema={contactSchema}
    />
  )
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
        ? fleet.map((f) => ({
            boatName: f.boatName as string,
            maxPax: (f.maxPax as number) ?? 0,
            minPax: f.minPax != null ? (f.minPax as number) : undefined,
            boatType: f.boatType as BoatType,
            routes: (f.routes as RouteState[] | undefined) ?? [],
            cutoffHours: f.cutoffHours != null ? (f.cutoffHours as number) : undefined,
          }))
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

export function BoatFleetSection({ profile: existing, me, create, update, onClose }: BoatSectionProps) {
  const createOverride = (payload: Record<string, unknown>) =>
    create({ ...buildParentContactDefaults(me), ...payload })

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

  function addFleet() {
    setField('fleet', [...form.fleet, emptyFleet()])
  }
  function removeFleet(i: number) {
    setField('fleet', form.fleet.filter((_, idx) => idx !== i))
  }
  function updateFleet(i: number, patch: Partial<FleetState>) {
    setField('fleet', form.fleet.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }
  function addRoute(fi: number) {
    setField('fleet', form.fleet.map((f, i) => (i === fi ? { ...f, routes: [...f.routes, emptyRoute()] } : f)))
  }
  function removeRoute(fi: number, ri: number) {
    setField('fleet', form.fleet.map((f, i) => i === fi ? { ...f, routes: f.routes.filter((_, idx) => idx !== ri) } : f))
  }
  function updateRoute(fi: number, ri: number, patch: Partial<RouteState>) {
    setField('fleet', form.fleet.map((f, i) => i === fi ? { ...f, routes: f.routes.map((r, idx) => (idx === ri ? { ...r, ...patch } : r)) } : f))
  }
  function toggleDay(fi: number, ri: number, day: number) {
    const days = form.fleet[fi].routes[ri].daysOfWeek
    if (days.includes(day)) {
      updateRoute(fi, ri, { daysOfWeek: days.filter((d) => d !== day) })
    } else {
      setField('fleet', form.fleet.map((f, i) => {
        if (i !== fi) return f
        return {
          ...f,
          routes: f.routes.map((r, idx) => {
            if (idx === ri) return { ...r, daysOfWeek: [...r.daysOfWeek, day] }
            return { ...r, daysOfWeek: r.daysOfWeek.filter((d) => d !== day) }
          }),
        }
      }))
    }
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
      <div>
        <FormSectionHeader
          label="Fleet"
          action={
            <Button type="button" size="sm" variant="secondary" onClick={addFleet}>
              <Plus size={14} />
              Add Vessel
            </Button>
          }
        />
        <div className="space-y-4 mt-3">
          {form.fleet.map((vessel, fi) => (
            <FleetEntryCard
              key={fi}
              vessel={vessel}
              fleetIdx={fi}
              errors={errors}
              canRemove={form.fleet.length > 1}
              onUpdate={(patch) => updateFleet(fi, patch)}
              onRemove={() => removeFleet(fi)}
              onAddRoute={() => addRoute(fi)}
              onRemoveRoute={(ri) => removeRoute(fi, ri)}
              onUpdateRoute={(ri, patch) => updateRoute(fi, ri, patch)}
              onToggleDay={(ri, day) => toggleDay(fi, ri, day)}
            />
          ))}
        </div>
      </div>
    </ProfileFormShell>
  )
}

interface FleetEntryCardProps {
  vessel: FleetState
  fleetIdx: number
  errors: Record<string, string>
  canRemove: boolean
  onUpdate: (patch: Partial<FleetState>) => void
  onRemove: () => void
  onAddRoute: () => void
  onRemoveRoute: (ri: number) => void
  onUpdateRoute: (ri: number, patch: Partial<RouteState>) => void
  onToggleDay: (ri: number, day: number) => void
}

function FleetEntryCard({ vessel, fleetIdx: fi, errors, canRemove, onUpdate, onRemove, onAddRoute, onRemoveRoute, onUpdateRoute, onToggleDay }: FleetEntryCardProps) {
  return (
    <ItemCard onRemove={onRemove} canRemove={canRemove} aria-label={`Remove vessel ${fi + 1}`}>
      <div className="mb-4">
        <span className="text-body font-medium text-primary">
          Vessel {fi + 1}{vessel.boatName ? ` — ${vessel.boatName}` : ''}
        </span>
      </div>

      <FormGrid className="mb-5">
        <FormField size="lg">
          <Input label="Boat Name" required value={vessel.boatName} onChange={(e) => onUpdate({ boatName: e.target.value })} error={errors[`fleet.${fi}.boatName`]} />
        </FormField>
        <FormField size="lg">
          <SimpleSelect
            label="Boat Type"
            required
            value={vessel.boatType}
            onChange={(v) => onUpdate({ boatType: v as BoatType })}
            options={BOAT_TYPE_OPTIONS}
            placeholder="Select type…"
            error={errors[`fleet.${fi}.boatType`]}
          />
        </FormField>
        <FormField size="lg">
          <NumberPicker
            label="Max Passengers"
            required
            min={1}
            max={100}
            value={vessel.maxPax || undefined}
            onChange={(v) => onUpdate({ maxPax: v ?? 0 })}
            error={errors[`fleet.${fi}.maxPax`]}
          />
        </FormField>
        <FormField size="lg">
          <NumberPicker
            label="Min Passengers"
            min={1}
            max={100}
            value={vessel.minPax}
            onChange={(v) => onUpdate({ minPax: v })}
            error={errors[`fleet.${fi}.minPax`]}
          />
        </FormField>
        <FormField size="full">
          <NumberPicker
            label="Cutoff Hours"
            min={0}
            max={168}
            value={vessel.cutoffHours}
            onChange={(v) => onUpdate({ cutoffHours: v })}
            error={errors[`fleet.${fi}.cutoffHours`]}
          />
        </FormField>
      </FormGrid>

      <div>
        <FormSectionHeader
          label="Routes"
          action={
            <Button type="button" size="sm" variant="secondary" onClick={onAddRoute}>
              <Plus size={14} />
              Add Route
            </Button>
          }
        />
        {vessel.routes.length === 0 && (
          <p className="text-label text-secondary">
            No routes added. Routes define which dive sites this vessel visits and on which days.
          </p>
        )}
        <div className="space-y-3 mt-2">
          {vessel.routes.map((route, ri) => (
            <RouteRow key={ri} route={route} fleetIdx={fi} routeIdx={ri} errors={errors} onUpdate={(patch) => onUpdateRoute(ri, patch)} onRemove={() => onRemoveRoute(ri)} onToggleDay={(day) => onToggleDay(ri, day)} />
          ))}
        </div>
      </div>
    </ItemCard>
  )
}

interface RouteRowProps {
  route: RouteState
  fleetIdx: number
  routeIdx: number
  errors: Record<string, string>
  onUpdate: (patch: Partial<RouteState>) => void
  onRemove: () => void
  onToggleDay: (day: number) => void
}

function RouteRow({ route, fleetIdx: fi, routeIdx: ri, errors, onUpdate, onRemove, onToggleDay }: RouteRowProps) {
  return (
    <ItemCard onRemove={onRemove} canRemove={true} aria-label="Remove route">
      <Input value={route.diveSite} onChange={(e) => onUpdate({ diveSite: e.target.value })} error={errors[`fleet.${fi}.routes.${ri}.diveSite`]} placeholder="Dive site name" />
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
    </ItemCard>
  )
}

export function BoatProfileForm({
  section,
  profile,
  me,
  create,
  update,
  onSaved,
}: BoatSectionProps & { section?: BoatProfileSection }) {
  if (section === 'fleet')
    return <BoatFleetSection profile={profile} me={me} create={create} update={update} />
  return <BoatContactSection profile={profile} me={me} create={create} update={update} onSaved={onSaved} />
}
