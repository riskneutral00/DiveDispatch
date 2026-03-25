'use client'

import { z } from 'zod'
import { useMutation, useQuery } from 'convex/react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassInput } from '@/components/glass/glass-input'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassSimpleSelect } from '@/components/glass/glass-simple-select'
import { DIVE_AGENCIES } from '@/lib/constants/agencies'
import { Spinner } from '@/components/common/spinner'
import { LocationPicker, type LocationValue } from '@/components/common/location-picker'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

// ── Zod Schemas ───────────────────────────────────────────────────────

const locationSchema = z.object({
  placeName: z.string().min(1, 'Location name is required'),
  country: z.string().min(1, 'Country is required'),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().optional(),
})

const associationSchema = z.object({
  agency: z.string().min(1, 'Agency is required'),
  number: z.string().min(1, 'Number is required'),
})

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  locations: z.array(locationSchema).min(1, 'Add at least one location'),
  contactEmail: z.string().email('Invalid email address'),
  contactPhone: z.string().min(1, 'Phone number is required'),
  associations: z.array(associationSchema),
  defaultReferralMode: z.enum(['independent', 'referral']),
})

type AssociationData = z.infer<typeof associationSchema>

type ProfileFormData = {
  name: string
  locations: (LocationValue | null)[]
  contactEmail: string
  contactPhone: string
  associations: AssociationData[]
  defaultReferralMode: 'independent' | 'referral'
}

const emptyAssociation = (): AssociationData => ({ agency: '', number: '' })

const INITIAL_FORM: ProfileFormData = {
  name: '',
  locations: [null],
  contactEmail: '',
  contactPhone: '',
  associations: [],
  defaultReferralMode: 'independent',
}

// ── Sub-components ────────────────────────────────────────────────────


// ── Location Row (uses LocationPicker) ────────────────────────────────

interface LocationRowProps {
  index: number
  location: LocationValue | null
  error?: string
  onChange: (index: number, updated: LocationValue | null) => void
  onRemove: (index: number) => void
  canRemove: boolean
}

function LocationRow({ index, location, error, onChange, onRemove, canRemove }: LocationRowProps) {
  return (
    <GlassCard padding="md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
          Location {index + 1}
        </h3>
        {canRemove && (
          <GlassButton variant="destructive" size="sm" type="button" onClick={() => onRemove(index)} aria-label={`Remove location ${index + 1}`}>
            <Trash2 size={14} />
            Remove
          </GlassButton>
        )}
      </div>
      <LocationPicker
        value={location}
        onChange={(loc) => onChange(index, loc)}
        error={error}
      />
    </GlassCard>
  )
}

// ── Association Row ───────────────────────────────────────────────────

interface AssociationRowProps {
  index: number
  association: AssociationData
  errors: Record<string, string>
  onChange: (index: number, updated: AssociationData) => void
  onRemove: (index: number) => void
}

function AssociationRow({ index, association, errors, onChange, onRemove }: AssociationRowProps) {
  const update = (field: keyof AssociationData, value: string) => {
    onChange(index, { ...association, [field]: value })
  }
  return (
    <GlassCard padding="md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
          Membership {index + 1}
        </h3>
        <GlassButton variant="destructive" size="sm" type="button" onClick={() => onRemove(index)} aria-label={`Remove membership ${index + 1}`}>
          <Trash2 size={14} />
          Remove
        </GlassButton>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlassSimpleSelect label="Agency" value={association.agency} onChange={(v) => update('agency', v)} options={DIVE_AGENCIES} placeholder="Select agency…" error={errors[`associations.${index}.agency`]} />
        <GlassInput label="Membership Number" placeholder="e.g. PADI-12345" value={association.number} onChange={(e) => update('number', e.target.value)} error={errors[`associations.${index}.number`]} />
      </div>
    </GlassCard>
  )
}

// ── Main Form ─────────────────────────────────────────────────────────

export type AgentProfileSection = 'contact' | 'associations'

export function AgentProfileForm({ section }: { section?: AgentProfileSection } = {}) {
  const profile = useQuery(api.agents.mine)
  const create = useMutation(api.agents.create)
  const update = useMutation(api.agents.update)

  const { form, setForm, setField, errors, serverError, saving, saved, loading, isUpdate, handleSubmit } = useProfileForm<ProfileFormData>({
    profile,
    schema: profileSchema,
    defaults: INITIAL_FORM,
    fromProfile: (p: Record<string, unknown>) => {
      const prof = p as { name: string; locations: { placeName: string; country: string; lat: number; lng: number; placeId?: string }[]; contactEmail: string; contactPhone: string; associations: AssociationData[]; defaultReferralMode: 'independent' | 'referral' }
      return {
        name: prof.name,
        locations: prof.locations.length > 0
          ? prof.locations.map((loc) => ({
              placeName: loc.placeName,
              country: loc.country,
              lat: loc.lat,
              lng: loc.lng,
              placeId: loc.placeId ?? undefined,
            }))
          : [null],
        contactEmail: prof.contactEmail,
        contactPhone: prof.contactPhone,
        associations: prof.associations,
        defaultReferralMode: prof.defaultReferralMode,
      } as ProfileFormData
    },
    toPayload: (f) => {
      const validLocations = f.locations.filter((l): l is LocationValue => l !== null)
      return {
        name: f.name,
        locations: validLocations,
        contactEmail: f.contactEmail,
        contactPhone: f.contactPhone,
        associations: f.associations,
        defaultReferralMode: f.defaultReferralMode,
      }
    },
    create: create as unknown as (payload: Record<string, unknown>) => Promise<unknown>,
    update: update as unknown as (payload: Record<string, unknown>) => Promise<unknown>,
  })

  const updateLocation = (index: number, updated: LocationValue | null) => {
    setForm((prev) => {
      const locations = [...prev.locations]
      locations[index] = updated
      return { ...prev, locations }
    })
  }

  const addLocation = () => setForm((prev) => ({ ...prev, locations: [...prev.locations, null] }))

  const removeLocation = (index: number) => {
    setForm((prev) => ({ ...prev, locations: prev.locations.filter((_, i) => i !== index) }))
  }

  const updateAssociation = (index: number, updated: AssociationData) => {
    setForm((prev) => { const associations = [...prev.associations]; associations[index] = updated; return { ...prev, associations } })
  }

  const addAssociation = () => setForm((prev) => ({ ...prev, associations: [...prev.associations, emptyAssociation()] }))

  const removeAssociation = (index: number) => {
    setForm((prev) => ({ ...prev, associations: prev.associations.filter((_, i) => i !== index) }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" style={{ color: 'var(--color-primary)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {!section && (
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}>
            {isUpdate ? 'Update Profile' : 'Complete Your Profile'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {isUpdate ? 'Keep your profile current so dive operators can find you.' : 'Set up your agent profile to start creating and referring bookings.'}
          </p>
        </div>
      )}

      {/* Contact info */}
      {(!section || section === 'contact') && (
        <>
          <GlassCard padding="md">
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Contact Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <GlassInput label="Agent / Business Name" placeholder="Your name or agency" value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} className="sm:col-span-2" />
              <GlassInput label="Contact Email" type="email" placeholder="you@example.com" value={form.contactEmail} onChange={(e) => setField('contactEmail', e.target.value)} error={errors.contactEmail} />
              <GlassInput label="Contact Phone" type="tel" placeholder="+66 81 234 5678" value={form.contactPhone} onChange={(e) => setField('contactPhone', e.target.value)} error={errors.contactPhone} />
            </div>
          </GlassCard>

          {/* Locations */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                Locations
              </h2>
              <GlassButton variant="secondary" size="sm" type="button" onClick={addLocation}>
                <Plus size={14} />
                Add Location
              </GlassButton>
            </div>
            {errors.locations && <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{errors.locations}</p>}
            {form.locations.map((loc, index) => (
              <LocationRow
                key={index}
                index={index}
                location={loc}
                error={errors[`locations.${index}`]}
                onChange={updateLocation}
                onRemove={removeLocation}
                canRemove={form.locations.length > 1}
              />
            ))}
          </div>

          {/* Referral mode */}
          <GlassCard padding="md">
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Default Booking Mode
            </h2>
            <div className="flex gap-3">
              {(['independent', 'referral'] as const).map((mode) => {
                const active = form.defaultReferralMode === mode
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setField('defaultReferralMode', mode)}
                    className="flex-1 py-2.5 px-4 rounded-[var(--border-radius)] text-sm font-medium border transition-all"
                    style={{
                      background: active ? 'var(--color-primary)' : 'var(--color-glass-bg)',
                      borderColor: active ? 'var(--color-primary)' : 'var(--color-glass-border)',
                      color: active ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
                      backdropFilter: active ? undefined : 'blur(var(--glass-blur))',
                      transitionDuration: 'var(--transition-speed)',
                    }}
                  >
                    {mode === 'independent' ? 'Independent' : 'Referral Only'}
                  </button>
                )
              })}
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
              {form.defaultReferralMode === 'independent'
                ? 'You create and manage bookings directly.'
                : 'You refer customers to operators who manage the booking.'}
            </p>
            {errors.defaultReferralMode && <p className="text-sm mt-1" style={{ color: 'var(--color-destructive)' }}>{errors.defaultReferralMode}</p>}
          </GlassCard>
        </>
      )}

      {/* Agency associations */}
      {(!section || section === 'associations') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
              Agency Memberships
              <span className="ml-2 font-normal normal-case" style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }}>(optional)</span>
            </h2>
            <GlassButton variant="secondary" size="sm" type="button" onClick={addAssociation}>
              <Plus size={14} />
              Add Membership
            </GlassButton>
          </div>
          {form.associations.map((assoc, index) => (
            <AssociationRow key={index} index={index} association={assoc} errors={errors} onChange={updateAssociation} onRemove={removeAssociation} />
          ))}
        </div>
      )}

      {serverError && <p className="text-sm text-center" style={{ color: 'var(--color-destructive)' }}>{serverError}</p>}
      {saved && <p className="text-sm text-center" style={{ color: 'var(--color-success)' }}>Profile saved successfully.</p>}

      <div className="flex justify-end">
        <GlassButton type="submit" variant="primary" size="md" loading={saving} disabled={saving}>
          {isUpdate ? 'Save Changes' : 'Create Profile'}
        </GlassButton>
      </div>
    </form>
  )
}
