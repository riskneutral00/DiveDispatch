'use client'

import { Plus } from 'lucide-react'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormSectionDivider } from '@/components/profiles/profile-form-section-divider'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { Button } from '@/components/ui/button'
import { FormGrid, FormField } from '@/components/ui/form-grid'
import { Input } from '@/components/ui/input'
import { SimpleSelect } from '@/components/ui/simple-select'
import { ItemCard } from '@/components/ui/item-card'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import {
  boatContactSchema,
  boatFleetSchema,
} from '@/lib/schemas/profile-shared'
import {
  contactFieldsFromProfile,
  locationToPayload,
  defaultFromMe,
} from '@/lib/profile-form/location'
import type { BaseProfileSectionProps } from '@/lib/profile-form/types'
import { BoatType, BOAT_TYPE_OPTIONS } from '@/lib/constants/boat-types'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BoatProfileSection = 'contact' | 'fleet'

export type BoatSectionProps = BaseProfileSectionProps

interface RouteState {
  diveSite: string
  daysOfWeek: number[]
}

interface FleetState {
  boatName: string
  maxPax: string
  minPax: string
  boatType: BoatType | ''
  routes: RouteState[]
  cutoffHours: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// BOAT_TYPE_OPTIONS imported from @/lib/constants/boat-types

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function emptyFleet(): FleetState {
  return { boatName: '', maxPax: '', minPax: '', boatType: '', routes: [], cutoffHours: '' }
}

export function emptyRoute(): RouteState {
  return { diveSite: '', daysOfWeek: [] }
}

function parseOptionalInt(s: string): number | undefined {
  const n = parseInt(s, 10)
  return isNaN(n) ? undefined : n
}

// ---------------------------------------------------------------------------
// Contact section
// ---------------------------------------------------------------------------

export type BoatContactFormState = {
  name: string
  location: LocationValue | null
  email: string
  phone: string
}

export const INITIAL_BOAT_CONTACT_FORM: BoatContactFormState = {
  name: '',
  location: null,
  email: '',
  phone: '',
}

export function boatContactFromProfile(p: Record<string, unknown>): BoatContactFormState {
  const c = contactFieldsFromProfile(p)
  return {
    name: c.name,
    location: c.location as LocationValue,
    email: c.email,
    phone: c.phone,
  }
}

export function boatContactToPayload(f: BoatContactFormState): Record<string, unknown> {
  return {
    name: f.name,
    ...locationToPayload(f.location!),
    email: f.email,
    phone: f.phone,
  }
}

export function BoatContactSection({ profile: existing, me, create, update, onSaved }: BoatSectionProps) {
  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } =
    useProfileForm({
      profile: existing,
      me,
      schema: boatContactSchema,
      defaults: INITIAL_BOAT_CONTACT_FORM,
      fromProfile: boatContactFromProfile,
      fromMe: defaultFromMe,
      toPayload: boatContactToPayload,
      create,
      update,
      onSaved,
    })

  const onLocationChange = (loc: LocationValue | null) => setField('location', loc)

  return (
    <ProfileFormShell
      loading={loading}
      onSubmit={handleSubmit}
      footerErrorMessage={footerErrorMessage}
      saving={saving}
      saved={saved}
      isDirty={isDirty}
      isUpdate={isUpdate}
      disableSaveWhenInvalid
      isValid={isValid}
      className="space-y-6"
    >
      <div className="space-y-4">
        <ProfileBasicInfo
          nameValue={form.name}
          onNameChange={(val) => setField('name', val)}
          nameError={errors.name}
          nameLabel="Business Name"
          namePlaceholder="Phuket Boat Co."
          nameRequired
          locationValue={form.location}
          onLocationChange={onLocationChange}
          locationError={errors.location}
          locationRequired
          emailValue={form.email}
          onEmailChange={(val) => setField('email', val)}
          emailError={errors.email}
          emailRequired
          phoneValue={form.phone}
          onPhoneChange={(val) => setField('phone', val)}
          phoneError={errors.phone}
          phoneRequired
        />
      </div>
    </ProfileFormShell>
  )
}

// ---------------------------------------------------------------------------
// Fleet section
// ---------------------------------------------------------------------------

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
            maxPax: String(f.maxPax),
            minPax: f.minPax != null ? String(f.minPax) : '',
            boatType: f.boatType as BoatType,
            routes: (f.routes as RouteState[] | undefined) ?? [],
            cutoffHours: f.cutoffHours != null ? String(f.cutoffHours) : '',
          }))
        : [emptyFleet()],
  }
}

export function boatFleetToPayload(f: BoatFleetFormState): Record<string, unknown> {
  return {
    fleet: f.fleet.map((v) => ({
      boatName: v.boatName,
      maxPax: parseOptionalInt(v.maxPax) ?? 0,
      minPax: parseOptionalInt(v.minPax),
      boatType: v.boatType as BoatType,
      routes: v.routes.length > 0 ? v.routes : undefined,
      cutoffHours: parseOptionalInt(v.cutoffHours),
    })),
  }
}

export function BoatFleetSection({ profile: existing, create, update }: BoatSectionProps) {
  if (!existing) {
    return (
      <p className="text-sm text-secondary">
        Complete contact info first before setting up the fleet.
      </p>
    )
  }

  return <BoatFleetSectionForm profile={existing} create={create} update={update} />
}

function BoatFleetSectionForm({
  profile: existing,
  create,
  update,
}: {
  profile: Record<string, unknown>
  create: (payload: Record<string, unknown>) => Promise<unknown>
  update: (payload: Record<string, unknown>) => Promise<unknown>
}) {
  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } =
    useProfileForm({
      profile: existing,
      schema: boatFleetSchema,
      defaults: INITIAL_BOAT_FLEET_FORM,
      fromProfile: boatFleetFromProfile,
      toPayload: boatFleetToPayload,
      create,
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
    updateRoute(fi, ri, { daysOfWeek: days.includes(day) ? days.filter((d) => d !== day) : [...days, day] })
  }

  return (
    <ProfileFormShell
      loading={loading}
      onSubmit={handleSubmit}
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

// ---------------------------------------------------------------------------
// FleetEntryCard (Do Not Touch — internal sub-component)
// ---------------------------------------------------------------------------

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
        <span className="text-sm font-medium text-primary">
          Vessel {fi + 1}{vessel.boatName ? ` — ${vessel.boatName}` : ''}
        </span>
      </div>

      <FormGrid className="mb-5">
        <FormField size="lg">
          <Input label="Boat Name" value={vessel.boatName} onChange={(e) => onUpdate({ boatName: e.target.value })} error={errors[`fleet.${fi}.boatName`]} placeholder="Sea Breeze" />
        </FormField>
        <FormField size="lg">
          <SimpleSelect
            label="Boat Type"
            value={vessel.boatType}
            onChange={(v) => onUpdate({ boatType: v as BoatType })}
            options={BOAT_TYPE_OPTIONS}
            placeholder="Select type…"
            error={errors[`fleet.${fi}.boatType`]}
          />
        </FormField>
        <FormField size="lg">
          <Input label="Max Passengers" type="number" min={1} value={vessel.maxPax} onChange={(e) => onUpdate({ maxPax: e.target.value })} error={errors[`fleet.${fi}.maxPax`]} placeholder="20" />
        </FormField>
        <FormField size="lg">
          <Input label="Min Passengers (optional)" type="number" min={1} value={vessel.minPax} onChange={(e) => onUpdate({ minPax: e.target.value })} error={errors[`fleet.${fi}.minPax`]} placeholder="4" />
        </FormField>
        <FormField size="full">
          <Input label="Cutoff Hours (optional)" type="number" min={0} value={vessel.cutoffHours} onChange={(e) => onUpdate({ cutoffHours: e.target.value })} error={errors[`fleet.${fi}.cutoffHours`]} helperText="Hours before departure when bookings close" placeholder="24" />
        </FormField>
      </FormGrid>

      <div>
        <FormSectionHeader
          label="Routes"
          action={
            <button type="button" onClick={onAddRoute} className="flex items-center gap-1 text-xs px-2 py-1 rounded border transition-opacity hover:opacity-80 text-primary" style={{ borderColor: 'var(--color-glass-border)', background: 'var(--color-glass-bg)' }}>
              <Plus size={11} />
              Add Route
            </button>
          }
        />
        {vessel.routes.length === 0 && (
          <p className="text-xs text-secondary">
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
      <div className="flex-1">
        <Input value={route.diveSite} onChange={(e) => onUpdate({ diveSite: e.target.value })} error={errors[`fleet.${fi}.routes.${ri}.diveSite`]} placeholder="Dive site name (e.g. Shark Point)" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DAYS.map((d) => {
          const active = route.daysOfWeek.includes(d.value)
          return (
            <button key={d.value} type="button" onClick={() => onToggleDay(d.value)} className="px-2.5 py-1 text-xs rounded border transition-all"
              style={{ background: active ? 'var(--color-primary)' : 'var(--color-glass-bg)', color: active ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)', borderColor: active ? 'var(--color-primary)' : 'var(--color-glass-border)', transitionDuration: 'var(--transition-speed)' }}>
              {d.label}
            </button>
          )
        })}
      </div>
      {errors[`fleet.${fi}.routes.${ri}.daysOfWeek`] && (
        <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{errors[`fleet.${fi}.routes.${ri}.daysOfWeek`]}</p>
      )}
    </ItemCard>
  )
}

// ---------------------------------------------------------------------------
// Compat alias
// ---------------------------------------------------------------------------

/**
 * Dispatches to the appropriate section component based on the `section` prop.
 * The app-layer ConnectedBoatForm short-circuits before this is reached
 * at runtime; this export exists so that the lib-layer registry in
 * connected-role-forms.tsx continues to type-check without modification.
 */
export function BoatProfileForm({
  section,
  profile,
  me,
  create,
  update,
  onSaved,
}: BoatSectionProps & { section?: BoatProfileSection }) {
  if (section === 'fleet')
    return <BoatFleetSection profile={profile} create={create} update={update} />
  return <BoatContactSection profile={profile} me={me} create={create} update={update} onSaved={onSaved} />
}
