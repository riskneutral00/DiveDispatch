'use client'

import { useMutation, useQuery } from 'convex/react'
import { Anchor, Plus, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { api } from '../../../convex/_generated/api'
import { GlassButton } from '../glass/glass-button'
import { GlassCard } from '../glass/glass-card'
import { GlassInput } from '../glass/glass-input'
import { PROFILE_LANGUAGE_OPTIONS as LANGUAGE_OPTIONS } from '@/lib/constants/dive-languages'
import { LocationPicker, type LocationValue } from '@/components/common/location-picker'
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
  contactEmail: string
  contactPhone: string
  focusedLanguages: string[]
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

const locationSchema = z.object({
  placeName: z.string().min(1),
  country: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().optional(),
})

const profileZod = z.object({
  name: z.string().min(1, 'Business name required'),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location required' }),
  contactEmail: z.string().email('Valid email required'),
  contactPhone: z.string().min(1, 'Phone required'),
  focusedLanguages: z.array(z.string()).min(1, 'Select at least one language'),
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
  contactEmail: '',
  contactPhone: '',
  focusedLanguages: [],
  fleet: [emptyFleet()],
}

// ── Main component ───────────────────────────────────────────────────

export function BoatProfileForm() {
  const profile = useQuery(api.boats.mine)
  const create = useMutation(api.boats.create)
  const update = useMutation(api.boats.update)

  const { form, setField, errors, serverError, saving, saved, loading, isUpdate, handleSubmit } = useProfileForm<FormState>({
    profile,
    schema: profileZod,
    defaults: INITIAL_FORM,
    fromProfile: (p) => ({
      name: p.name,
      location: {
        placeName: p.placeName,
        country: p.country,
        lat: p.lat,
        lng: p.lng,
        placeId: p.placeId ?? undefined,
      } as LocationValue,
      contactEmail: p.contactEmail,
      contactPhone: p.contactPhone,
      focusedLanguages: p.focusedLanguages,
      fleet:
        p.fleet.length > 0
          ? p.fleet.map((f: Record<string, unknown>) => ({
              boatName: f.boatName as string,
              maxPax: String(f.maxPax),
              minPax: f.minPax != null ? String(f.minPax) : '',
              boatType: f.boatType as BoatType,
              routes: (f.routes as RouteState[] | undefined) ?? [],
              cutoffHours: f.cutoffHours != null ? String(f.cutoffHours) : '',
            }))
          : [emptyFleet()],
    }),
    toPayload: (f) => {
      const loc = f.location!
      const fleetParsed = f.fleet.map((v) => ({
        boatName: v.boatName,
        maxPax: parseOptionalInt(v.maxPax) ?? 0,
        minPax: parseOptionalInt(v.minPax),
        boatType: v.boatType,
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
        contactEmail: f.contactEmail,
        contactPhone: f.contactPhone,
        focusedLanguages: f.focusedLanguages,
        fleet: fleetParsed,
      }
    },
    create,
    update,
  })

  function toggleLanguage(lang: string) {
    setField(
      'focusedLanguages',
      form.focusedLanguages.includes(lang)
        ? form.focusedLanguages.filter((l) => l !== lang)
        : [...form.focusedLanguages, lang],
    )
  }

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

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span style={{ color: 'var(--color-text-secondary)' }}>Loading…</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Anchor size={26} style={{ color: 'var(--color-primary)' }} />
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          {isUpdate ? 'Edit Profile' : 'Complete Your Profile'}
        </h1>
      </div>

      {/* Contact info */}
      <GlassCard>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Contact Information
        </h2>
        <div className="space-y-4">
          <GlassInput
            label="Business Name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            error={errors['name']}
            placeholder="Phuket Boat Co."
          />
          <LocationPicker
            label="Location"
            value={form.location}
            onChange={(loc) => setField('location', loc)}
            error={errors['location']}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput
              label="Contact Email"
              type="email"
              value={form.contactEmail}
              onChange={(e) => setField('contactEmail', e.target.value)}
              error={errors['contactEmail']}
              placeholder="info@phuketboat.com"
            />
            <GlassInput
              label="Contact Phone"
              type="tel"
              value={form.contactPhone}
              onChange={(e) => setField('contactPhone', e.target.value)}
              error={errors['contactPhone']}
              placeholder="+66 81 234 5678"
            />
          </div>
        </div>
      </GlassCard>

      {/* Languages */}
      <GlassCard>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-3"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Languages
        </h2>
        {errors['focusedLanguages'] && (
          <p className="text-sm mb-2" style={{ color: 'var(--color-destructive)' }}>
            {errors['focusedLanguages']}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map(({ code, label }) => {
            const active = form.focusedLanguages.includes(code)
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggleLanguage(code)}
                className="px-3 py-1.5 text-sm rounded-full border transition-all"
                style={{
                  background: active ? 'var(--color-primary)' : 'var(--color-glass-bg)',
                  color: active ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
                  borderColor: active ? 'var(--color-primary)' : 'var(--color-glass-border)',
                  transitionDuration: 'var(--transition-speed)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </GlassCard>

      {/* Fleet */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Fleet
          </h2>
          <GlassButton type="button" size="sm" variant="secondary" onClick={addFleet}>
            <Plus size={14} />
            Add Vessel
          </GlassButton>
        </div>
        <div className="space-y-4">
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

      <GlassButton type="submit" loading={saving} fullWidth>
        {isUpdate ? 'Save Changes' : 'Create Profile'}
      </GlassButton>
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
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          Vessel {fi + 1}{vessel.boatName ? ` — ${vessel.boatName}` : ''}
        </span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="flex items-center gap-1 text-sm px-2 py-1 rounded transition-opacity hover:opacity-80" style={{ color: 'var(--color-destructive)' }} aria-label={`Remove vessel ${fi + 1}`}>
            <Trash2 size={13} />
            Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <GlassInput label="Boat Name" value={vessel.boatName} onChange={(e) => onUpdate({ boatName: e.target.value })} error={errors[`fleet.${fi}.boatName`]} placeholder="Sea Breeze" />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Boat Type</label>
          <select
            value={vessel.boatType}
            onChange={(e) => onUpdate({ boatType: e.target.value as BoatType })}
            className="glass w-full text-sm px-3 py-2.5 focus:outline-none rounded-[var(--border-radius)]"
            style={{ color: vessel.boatType ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
          >
            <option value="">Select type…</option>
            {BOAT_TYPE_OPTIONS.map((bt) => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
          </select>
          {errors[`fleet.${fi}.boatType`] && <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{errors[`fleet.${fi}.boatType`]}</p>}
        </div>
        <GlassInput label="Max Passengers" type="number" min={1} value={vessel.maxPax} onChange={(e) => onUpdate({ maxPax: e.target.value })} error={errors[`fleet.${fi}.maxPax`]} placeholder="20" />
        <GlassInput label="Min Passengers (optional)" type="number" min={1} value={vessel.minPax} onChange={(e) => onUpdate({ minPax: e.target.value })} error={errors[`fleet.${fi}.minPax`]} placeholder="4" />
        <div className="sm:col-span-2">
          <GlassInput label="Cutoff Hours (optional)" type="number" min={0} value={vessel.cutoffHours} onChange={(e) => onUpdate({ cutoffHours: e.target.value })} error={errors[`fleet.${fi}.cutoffHours`]} helperText="Hours before departure when bookings close" placeholder="24" />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Routes</span>
          <button type="button" onClick={onAddRoute} className="flex items-center gap-1 text-xs px-2 py-1 rounded border transition-opacity hover:opacity-80" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-glass-border)', background: 'var(--color-glass-bg)' }}>
            <Plus size={11} />
            Add Route
          </button>
        </div>
        {vessel.routes.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            No routes added. Routes define which dive sites this vessel visits and on which days.
          </p>
        )}
        <div className="space-y-3 mt-2">
          {vessel.routes.map((route, ri) => (
            <RouteRow key={ri} route={route} fleetIdx={fi} routeIdx={ri} errors={errors} onUpdate={(patch) => onUpdateRoute(ri, patch)} onRemove={() => onRemoveRoute(ri)} onToggleDay={(day) => onToggleDay(ri, day)} />
          ))}
        </div>
      </div>
    </GlassCard>
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
    <div className="p-3 rounded-[var(--border-radius)] space-y-2" style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-glass-border)' }}>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <GlassInput value={route.diveSite} onChange={(e) => onUpdate({ diveSite: e.target.value })} error={errors[`fleet.${fi}.routes.${ri}.diveSite`]} placeholder="Dive site name (e.g. Shark Point)" />
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove route" className="mt-2 flex-shrink-0 transition-opacity hover:opacity-80" style={{ color: 'var(--color-destructive)' }}>
          <Trash2 size={14} />
        </button>
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
    </div>
  )
}
