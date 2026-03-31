'use client'

import { useMutation, useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { z } from 'zod'

import { api } from '../../../convex/_generated/api'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormLoading } from '@/components/profiles/profile-form-loading'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { GlassButton } from '@/components/ui/glass-button'
import { GlassInput } from '@/components/ui/glass-input'
import { GlassSimpleSelect } from '@/components/ui/glass-simple-select'
import { ItemCard } from '@/components/ui/item-card'
import { SaveButton } from '@/components/ui/save-button'
import {
  createOptimisticLocationOnChange,
  locationFromProfileDoc,
  nullableProfileLocation,
} from '@/lib/profile-form/location'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

// ── Types ────────────────────────────────────────────────────────────

type BoatType = 'day_boat' | 'speedboat' | 'longtail' | 'liveaboard' | 'catamaran' | 'rib'

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

type FormState = {
  name: string
  location: LocationValue | null
  email: string
  phone: string
  fleet: FleetState[]
}

// ── Constants ────────────────────────────────────────────────────────

const BOAT_TYPE_OPTIONS: { value: BoatType; label: string }[] = [
  { value: 'day_boat', label: 'Day Boat' },
  { value: 'speedboat', label: 'Speedboat' },
  { value: 'longtail', label: 'Longtail' },
  { value: 'liveaboard', label: 'Liveaboard' },
  { value: 'catamaran', label: 'Catamaran' },
  { value: 'rib', label: 'RIB' },
]

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

// ── Zod schema ───────────────────────────────────────────────────────

const BOAT_TYPES = ['day_boat', 'speedboat', 'longtail', 'liveaboard', 'catamaran', 'rib'] as const

const routeZod = z.object({
  diveSite: z.string().min(1, 'Dive site required'),
  daysOfWeek: z.array(z.number()).min(1, 'Select at least one day'),
})

const fleetZod = z.object({
  boatName: z.string().min(1, 'Boat name required'),
  maxPax: z.number().int().min(1, 'At least 1 passenger'),
  minPax: z.number().int().min(1).optional(),
  boatType: z.enum(BOAT_TYPES),
  routes: z.array(routeZod).optional(),
  cutoffHours: z.number().min(0).optional(),
})

const profileZod = z.object({
  name: z.string().min(1, 'Business name required'),
  location: nullableProfileLocation('Location required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(1, 'Phone required'),
  fleet: z.array(fleetZod),
})

// ── Helpers ──────────────────────────────────────────────────────────

function emptyFleet(): FleetState {
  return { boatName: '', maxPax: '', minPax: '', boatType: '', routes: [], cutoffHours: '' }
}

function emptyRoute(): RouteState {
  return { diveSite: '', daysOfWeek: [] }
}

function parseOptionalInt(s: string): number | undefined {
  const n = parseInt(s, 10)
  return isNaN(n) ? undefined : n
}

const INITIAL_FORM: FormState = {
  name: '',
  location: null,
  email: '',
  phone: '',
  fleet: [emptyFleet()],
}

// ── Main component ───────────────────────────────────────────────────

export function BoatProfileForm() {
  const profile = useQuery(api.boats.mine)
  const me = useQuery(api.users.getAccountDefaults)
  const create = useMutation(api.boats.create)
  const update = useMutation(api.boats.update)

  const { form, setField, errors, serverError, saving, saved, isDirty, loading, isUpdate, handleSubmit } = useProfileForm({
    profile,
    me: me ?? undefined,
    schema: profileZod,
    defaults: INITIAL_FORM,
    fromProfile: (p) => {
      const fleet = p.fleet as Record<string, unknown>[]
      return {
        name: p.name as string,
        location: locationFromProfileDoc({
          placeName: p.placeName as string,
          country: p.country as string,
          lat: p.lat as number,
          lng: p.lng as number,
          placeId: p.placeId as string | null | undefined,
        }) as LocationValue,
        email: p.email as string,
        phone: p.phone as string,
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
    },
    fromMe: (u, initial) => ({
      ...initial,
      email: u.email ?? '',
      phone: u.phone ?? '',
    }),
    toPayload: (f) => {
      const loc = f.location!
      const fleetParsed = f.fleet.map((v) => ({
        boatName: v.boatName,
        maxPax: parseOptionalInt(v.maxPax) ?? 0,
        minPax: parseOptionalInt(v.minPax),
        boatType: v.boatType as BoatType,
        routes: v.routes.length > 0 ? v.routes : undefined,
        cutoffHours: parseOptionalInt(v.cutoffHours),
      }))
      return {
        name: f.name,
        placeName: loc.placeName,
        country: loc.country,
        lat: loc.lat,
        lng: loc.lng,
        placeId: loc.placeId,
        email: f.email,
        phone: f.phone,
        fleet: fleetParsed,
      }
    },
    create,
    update,
  })

  function addFleet() { setField('fleet', [...form.fleet, emptyFleet()]) }
  function removeFleet(i: number) { setField('fleet', form.fleet.filter((_, idx) => idx !== i)) }
  function updateFleet(i: number, patch: Partial<FleetState>) { setField('fleet', form.fleet.map((f, idx) => (idx === i ? { ...f, ...patch } : f))) }
  function addRoute(fi: number) { setField('fleet', form.fleet.map((f, i) => (i === fi ? { ...f, routes: [...f.routes, emptyRoute()] } : f))) }
  function removeRoute(fi: number, ri: number) { setField('fleet', form.fleet.map((f, i) => i === fi ? { ...f, routes: f.routes.filter((_, idx) => idx !== ri) } : f)) }
  function updateRoute(fi: number, ri: number, patch: Partial<RouteState>) { setField('fleet', form.fleet.map((f, i) => i === fi ? { ...f, routes: f.routes.map((r, idx) => (idx === ri ? { ...r, ...patch } : r)) } : f)) }
  function toggleDay(fi: number, ri: number, day: number) {
    const days = form.fleet[fi].routes[ri].daysOfWeek
    updateRoute(fi, ri, { daysOfWeek: days.includes(day) ? days.filter((d) => d !== day) : [...days, day] })
  }

  const onLocationChange = createOptimisticLocationOnChange({
    setField,
    update,
    isUpdate,
  })

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <ProfileFormLoading variant="plain" message="Loading…" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
      {/* Contact info */}
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
      

      <hr className="form-divider" />

      {/* Fleet */}
      <div>
        <FormSectionHeader
          label="Fleet"
          action={
            <GlassButton type="button" size="sm" variant="secondary" onClick={addFleet}>
              <Plus size={14} />
              Add Vessel
            </GlassButton>
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

      {(serverError || errors['_form']) && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
          {serverError || errors['_form']}
        </p>
      )}
      {saved && (
        <p className="text-sm font-medium" style={{ color: 'var(--color-success)' }}>
          Profile saved successfully.
        </p>
      )}

      <SaveButton saving={saving} saved={saved} isDirty={isDirty} isUpdate={isUpdate} />
    </form>
  )
}

// ── Fleet entry card ─────────────────────────────────────────────────

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <GlassInput label="Boat Name" value={vessel.boatName} onChange={(e) => onUpdate({ boatName: e.target.value })} error={errors[`fleet.${fi}.boatName`]} placeholder="Sea Breeze" />
        <GlassSimpleSelect
          label="Boat Type"
          value={vessel.boatType}
          onChange={(v) => onUpdate({ boatType: v as BoatType })}
          options={BOAT_TYPE_OPTIONS}
          placeholder="Select type…"
          error={errors[`fleet.${fi}.boatType`]}
        />
        <GlassInput label="Max Passengers" type="number" min={1} value={vessel.maxPax} onChange={(e) => onUpdate({ maxPax: e.target.value })} error={errors[`fleet.${fi}.maxPax`]} placeholder="20" />
        <GlassInput label="Min Passengers (optional)" type="number" min={1} value={vessel.minPax} onChange={(e) => onUpdate({ minPax: e.target.value })} error={errors[`fleet.${fi}.minPax`]} placeholder="4" />
        <div className="sm:col-span-2">
          <GlassInput label="Cutoff Hours (optional)" type="number" min={0} value={vessel.cutoffHours} onChange={(e) => onUpdate({ cutoffHours: e.target.value })} error={errors[`fleet.${fi}.cutoffHours`]} helperText="Hours before departure when bookings close" placeholder="24" />
        </div>
      </div>

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
        <GlassInput value={route.diveSite} onChange={(e) => onUpdate({ diveSite: e.target.value })} error={errors[`fleet.${fi}.routes.${ri}.diveSite`]} placeholder="Dive site name (e.g. Shark Point)" />
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
