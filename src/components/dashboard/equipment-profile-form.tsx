'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Plus, X } from 'lucide-react'
import { z } from 'zod'
import { api } from '../../../convex/_generated/api'
import { GlassButton, GlassCard, GlassInput } from '@/components/glass'
import { LocationPicker, type LocationValue } from '@/components/common/location-picker'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

const GEAR_TYPES = ['bcd', 'wetsuit', 'fins', 'regulator', 'mask'] as const
type GearType = (typeof GEAR_TYPES)[number]

const GEAR_TYPE_LABELS: Record<GearType, string> = {
  bcd: 'BCD',
  wetsuit: 'Wetsuit',
  fins: 'Fins',
  regulator: 'Regulator',
  mask: 'Mask',
}

const locationSchema = z.object({
  placeName: z.string().min(1),
  country: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().optional(),
})

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  contactEmail: z.string().email('Valid email required'),
  contactPhone: z.string().min(1, 'Phone is required').max(30),
})

type FormState = {
  name: string
  location: LocationValue | null
  contactEmail: string
  contactPhone: string
  manufacturersByGearType: Partial<Record<GearType, string[]>>
}

const INITIAL_FORM: FormState = {
  name: '',
  location: null,
  contactEmail: '',
  contactPhone: '',
  manufacturersByGearType: {},
}

export function EquipmentProfileForm() {
  const profile = useQuery(api.equipment.mine)
  const me = useQuery(api.users.getAccountDefaults)
  const create = useMutation(api.equipment.create)
  const update = useMutation(api.equipment.update)

  const { form, setForm, setField, errors, serverError, saving, saved, isDirty, loading, isUpdate, handleSubmit } = useProfileForm<FormState>({
    profile,
    me: me ?? undefined,
    schema: profileSchema,
    defaults: INITIAL_FORM,
    fromProfile: (p) => {
      const parsed: Partial<Record<GearType, string[]>> = {}
      if (p.manufacturersByGearType) {
        for (const gt of GEAR_TYPES) {
          const mfrs = p.manufacturersByGearType[gt]
          if (mfrs && mfrs.length > 0) parsed[gt] = mfrs
        }
      }
      return {
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
        manufacturersByGearType: parsed,
      }
    },
    fromMe: (defaults, initial) => ({
      ...initial,
      contactEmail: defaults.defaultContactEmail ?? '',
      contactPhone: defaults.defaultContactPhone ?? '',
    }),
    toPayload: (f) => {
      const loc = f.location!
      const mbt: Record<string, string[]> = {}
      for (const gt of GEAR_TYPES) {
        const mfrs = f.manufacturersByGearType[gt]
        if (mfrs && mfrs.length > 0) mbt[gt] = mfrs
      }
      return {
        name: f.name,
        placeName: loc.placeName,
        country: loc.country,
        lat: loc.lat,
        lng: loc.lng,
        placeId: loc.placeId,
        contactEmail: f.contactEmail,
        contactPhone: f.contactPhone,
        manufacturersByGearType: Object.keys(mbt).length > 0 ? mbt : undefined,
      }
    },
    create,
    update,
  })

  // Local UI state for tag inputs (not part of form/schema)
  const [mfrInputs, setMfrInputs] = useState<Partial<Record<GearType, string>>>({})

  function toggleGearType(gt: GearType) {
    setForm((prev) => {
      const next = { ...prev.manufacturersByGearType }
      if (gt in next) {
        delete next[gt]
      } else {
        next[gt] = []
      }
      return { ...prev, manufacturersByGearType: next }
    })
  }

  function addManufacturer(gt: GearType) {
    const mfr = (mfrInputs[gt] ?? '').trim()
    if (!mfr) return
    const existing = form.manufacturersByGearType[gt] ?? []
    if (existing.includes(mfr)) return
    setForm((prev) => ({
      ...prev,
      manufacturersByGearType: { ...prev.manufacturersByGearType, [gt]: [...(prev.manufacturersByGearType[gt] ?? []), mfr] },
    }))
    setMfrInputs((prev) => ({ ...prev, [gt]: '' }))
  }

  function removeManufacturer(gt: GearType, mfr: string) {
    setForm((prev) => ({
      ...prev,
      manufacturersByGearType: {
        ...prev.manufacturersByGearType,
        [gt]: (prev.manufacturersByGearType[gt] ?? []).filter((m) => m !== mfr),
      },
    }))
  }

  if (loading) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>
    )
  }

  const activeGearTypes = GEAR_TYPES.filter((gt) => gt in form.manufacturersByGearType)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Business Details */}
      <GlassCard padding="lg">
        <h2
          className="text-base font-semibold mb-4"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Business Details
        </h2>
        <div className="space-y-4">
          <GlassInput
            label="Business Name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="e.g. Phuket Gear Rental"
            error={errors.name}
          />
          <LocationPicker
            label="Location"
            value={form.location}
            onChange={(loc) => setField('location', loc)}
            error={errors.location}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput
              label="Contact Email"
              type="email"
              value={form.contactEmail}
              onChange={(e) => setField('contactEmail', e.target.value)}
              placeholder="you@example.com"
              error={errors.contactEmail}
            />
            <GlassInput
              label="Contact Phone"
              type="tel"
              value={form.contactPhone}
              onChange={(e) => setField('contactPhone', e.target.value)}
              placeholder="+66 81 234 5678"
              error={errors.contactPhone}
            />
          </div>
        </div>
      </GlassCard>

      {/* Gear Catalog */}
      <GlassCard padding="lg">
        <h2
          className="text-base font-semibold mb-1"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Gear Catalog
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          Select the gear types you stock and add manufacturer brands per type.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {GEAR_TYPES.map((gt) => {
            const active = gt in form.manufacturersByGearType
            return (
              <button
                key={gt}
                type="button"
                onClick={() => toggleGearType(gt)}
                className="px-3 py-1.5 text-sm font-medium rounded-full border transition-all"
                style={{
                  background: active ? 'var(--color-primary)' : 'var(--color-glass-bg)',
                  color: active ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
                  borderColor: active ? 'var(--color-primary)' : 'var(--color-glass-border)',
                  transitionDuration: 'var(--transition-speed)',
                }}
              >
                {GEAR_TYPE_LABELS[gt]}
              </button>
            )
          })}
        </div>
        {activeGearTypes.length > 0 && (
          <div className="space-y-3">
            {activeGearTypes.map((gt) => (
              <div key={gt} className="p-3 rounded-[var(--border-radius)]" style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-glass-border)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  {GEAR_TYPE_LABELS[gt]}
                </p>
                <div className="flex gap-2 mb-2">
                  <GlassInput
                    value={mfrInputs[gt] ?? ''}
                    onChange={(e) => setMfrInputs((prev) => ({ ...prev, [gt]: e.target.value }))}
                    placeholder="e.g. ScubaPro, Mares, Aqualung"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManufacturer(gt) } }}
                  />
                  <GlassButton type="button" variant="secondary" size="sm" onClick={() => addManufacturer(gt)}>
                    <Plus size={14} />
                  </GlassButton>
                </div>
                {(form.manufacturersByGearType[gt] ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(form.manufacturersByGearType[gt] ?? []).map((mfr) => (
                      <span key={mfr} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border" style={{ background: 'var(--color-glass-bg)', color: 'var(--color-text-primary)', borderColor: 'var(--color-glass-border)' }}>
                        {mfr}
                        <button type="button" aria-label={`Remove ${mfr}`} onClick={() => removeManufacturer(gt, mfr)} style={{ color: 'var(--color-text-secondary)' }}>
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {serverError && <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{serverError}</p>}
      {saved && <p className="text-sm" style={{ color: 'var(--color-success)' }}>Profile saved.</p>}
      <GlassButton type="submit" loading={saving} disabled={isUpdate ? (!isDirty || saving) : saving} fullWidth>
        {isUpdate ? 'Save Changes' : 'Create Profile'}
      </GlassButton>
    </form>
  )
}
