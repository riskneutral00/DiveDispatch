'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassInput } from '@/components/glass/glass-input'
import { GlassButton } from '@/components/glass/glass-button'
import { DIVE_AGENCIES } from '@/lib/constants/agencies'
import { LANGUAGE_OPTIONS } from '@/lib/constants/languages'
import { Spinner } from '@/components/common/spinner'

// ── Zod Schemas ───────────────────────────────────────────────────────

const locationSchema = z.object({
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
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
  focusedLanguages: z.array(z.string()).min(1, 'Select at least one language'),
  defaultReferralMode: z.enum(['independent', 'referral']),
})

type ProfileFormData = z.infer<typeof profileSchema>
type LocationData = z.infer<typeof locationSchema>
type AssociationData = z.infer<typeof associationSchema>
type LocationErrors = Partial<Record<keyof LocationData, string>>
type AssociationErrors = Partial<Record<keyof AssociationData, string>>
type FormErrors = Partial<
  Record<keyof Omit<ProfileFormData, 'locations' | 'associations'>, string> & {
    locations: string
    locationRows: LocationErrors[]
    associations: string
    associationRows: AssociationErrors[]
  }
>

const emptyLocation = (): LocationData => ({ city: '', country: '' })
const emptyAssociation = (): AssociationData => ({ agency: '', number: '' })

const defaultFormData = (): ProfileFormData => ({
  name: '',
  locations: [emptyLocation()],
  contactEmail: '',
  contactPhone: '',
  associations: [],
  focusedLanguages: [],
  defaultReferralMode: 'independent',
})

// ── Sub-components ────────────────────────────────────────────────────

interface SelectProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly string[]
  error?: string
  placeholder?: string
}

function GlassSelect({ label, value, onChange, options, error, placeholder }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass w-full text-sm px-3 py-2.5 focus:outline-none rounded-[var(--border-radius)]"
        style={{
          color: value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          ...(error ? { boxShadow: `0 0 0 2px var(--color-destructive)` } : {}),
        }}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

// ── Location Row ──────────────────────────────────────────────────────

interface LocationRowProps {
  index: number
  location: LocationData
  errors?: LocationErrors
  onChange: (index: number, updated: LocationData) => void
  onRemove: (index: number) => void
  canRemove: boolean
}

function LocationRow({ index, location, errors, onChange, onRemove, canRemove }: LocationRowProps) {
  const update = (field: keyof LocationData, value: string) => {
    onChange(index, { ...location, [field]: value })
  }

  return (
    <GlassCard padding="md" elevated>
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Location {index + 1}
        </h3>
        {canRemove && (
          <GlassButton
            variant="destructive"
            size="sm"
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Remove location ${index + 1}`}
          >
            <Trash2 size={14} />
            Remove
          </GlassButton>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlassInput
          label="City"
          placeholder="e.g. Phuket"
          value={location.city}
          onChange={(e) => update('city', e.target.value)}
          error={errors?.city}
        />
        <GlassInput
          label="Country"
          placeholder="e.g. Thailand"
          value={location.country}
          onChange={(e) => update('country', e.target.value)}
          error={errors?.country}
        />
      </div>
    </GlassCard>
  )
}

// ── Association Row ───────────────────────────────────────────────────

interface AssociationRowProps {
  index: number
  association: AssociationData
  errors?: AssociationErrors
  onChange: (index: number, updated: AssociationData) => void
  onRemove: (index: number) => void
}

function AssociationRow({ index, association, errors, onChange, onRemove }: AssociationRowProps) {
  const update = (field: keyof AssociationData, value: string) => {
    onChange(index, { ...association, [field]: value })
  }

  return (
    <GlassCard padding="md" elevated>
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Membership {index + 1}
        </h3>
        <GlassButton
          variant="destructive"
          size="sm"
          type="button"
          onClick={() => onRemove(index)}
          aria-label={`Remove membership ${index + 1}`}
        >
          <Trash2 size={14} />
          Remove
        </GlassButton>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlassSelect
          label="Agency"
          value={association.agency}
          onChange={(v) => update('agency', v)}
          options={DIVE_AGENCIES}
          placeholder="Select agency…"
          error={errors?.agency}
        />
        <GlassInput
          label="Membership Number"
          placeholder="e.g. PADI-12345"
          value={association.number}
          onChange={(e) => update('number', e.target.value)}
          error={errors?.number}
        />
      </div>
    </GlassCard>
  )
}

// ── Main Form ─────────────────────────────────────────────────────────

export function AgentProfileForm() {
  const profile = useQuery(api.agents.mine)
  const create = useMutation(api.agents.create)
  const update = useMutation(api.agents.update)

  const [form, setForm] = useState<ProfileFormData>(defaultFormData())
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name,
        locations: profile.locations.length > 0 ? profile.locations : [emptyLocation()],
        contactEmail: profile.contactEmail,
        contactPhone: profile.contactPhone,
        associations: profile.associations,
        focusedLanguages: profile.focusedLanguages,
        defaultReferralMode: profile.defaultReferralMode,
      })
    }
  }, [profile])

  // ── Field helpers ──────────────────────────────────────────────────

  const setField = <K extends keyof ProfileFormData>(key: K, value: ProfileFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setSaved(false)
  }

  const updateLocation = (index: number, updated: LocationData) => {
    setForm((prev) => {
      const locations = [...prev.locations]
      locations[index] = updated
      return { ...prev, locations }
    })
    setSaved(false)
  }

  const addLocation = () => {
    setForm((prev) => ({ ...prev, locations: [...prev.locations, emptyLocation()] }))
  }

  const removeLocation = (index: number) => {
    setForm((prev) => ({
      ...prev,
      locations: prev.locations.filter((_, i) => i !== index),
    }))
    setErrors((prev) => {
      const locationRows = prev.locationRows ? [...prev.locationRows] : []
      locationRows.splice(index, 1)
      return { ...prev, locationRows }
    })
  }

  const updateAssociation = (index: number, updated: AssociationData) => {
    setForm((prev) => {
      const associations = [...prev.associations]
      associations[index] = updated
      return { ...prev, associations }
    })
    setSaved(false)
  }

  const addAssociation = () => {
    setForm((prev) => ({
      ...prev,
      associations: [...prev.associations, emptyAssociation()],
    }))
  }

  const removeAssociation = (index: number) => {
    setForm((prev) => ({
      ...prev,
      associations: prev.associations.filter((_, i) => i !== index),
    }))
    setErrors((prev) => {
      const associationRows = prev.associationRows ? [...prev.associationRows] : []
      associationRows.splice(index, 1)
      return { ...prev, associationRows }
    })
  }

  const toggleLanguage = (code: string) => {
    setField(
      'focusedLanguages',
      form.focusedLanguages.includes(code)
        ? form.focusedLanguages.filter((l) => l !== code)
        : [...form.focusedLanguages, code],
    )
  }

  // ── Submit ─────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    setSaved(false)

    const result = profileSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: FormErrors = {}
      const locationRows: LocationErrors[] = []
      const associationRows: AssociationErrors[] = []

      for (const issue of result.error.issues) {
        const path = issue.path
        if (path[0] === 'locations' && typeof path[1] === 'number' && path[2]) {
          if (!locationRows[path[1]]) locationRows[path[1]] = {}
          locationRows[path[1]][path[2] as keyof LocationData] = issue.message
        } else if (path[0] === 'locations' && path.length === 1) {
          fieldErrors.locations = issue.message
        } else if (path[0] === 'associations' && typeof path[1] === 'number' && path[2]) {
          if (!associationRows[path[1]]) associationRows[path[1]] = {}
          associationRows[path[1]][path[2] as keyof AssociationData] = issue.message
        } else if (typeof path[0] === 'string') {
          ;(fieldErrors as Record<string, string>)[path[0]] = issue.message
        }
      }

      if (locationRows.length > 0) fieldErrors.locationRows = locationRows
      if (associationRows.length > 0) fieldErrors.associationRows = associationRows
      setErrors(fieldErrors)
      return
    }

    setSubmitting(true)
    try {
      if (profile) {
        await update(result.data)
      } else {
        await create(result.data)
      }
      setSaved(true)
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { code?: string; reason?: string }
        setServerError(data.reason ?? data.code ?? 'An error occurred')
      } else {
        setServerError('An unexpected error occurred')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading state ──────────────────────────────────────────────────

  if (profile === undefined) {
    return (
      <div className="flex items-center justify-center py-16" style={{ color: 'var(--color-primary)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          {profile ? 'Update Profile' : 'Complete Your Profile'}
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {profile
            ? 'Keep your profile current so dive operators can find you.'
            : 'Set up your agent profile to start creating and referring bookings.'}
        </p>
      </div>

      {/* Contact info */}
      <GlassCard padding="md" elevated>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Contact Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Agent / Business Name"
            placeholder="Your name or agency"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            error={errors.name}
            className="sm:col-span-2"
          />
          <GlassInput
            label="Contact Email"
            type="email"
            placeholder="you@example.com"
            value={form.contactEmail}
            onChange={(e) => setField('contactEmail', e.target.value)}
            error={errors.contactEmail}
          />
          <GlassInput
            label="Contact Phone"
            type="tel"
            placeholder="+66 81 234 5678"
            value={form.contactPhone}
            onChange={(e) => setField('contactPhone', e.target.value)}
            error={errors.contactPhone}
          />
        </div>
      </GlassCard>

      {/* Locations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Locations
          </h2>
          <GlassButton variant="secondary" size="sm" type="button" onClick={addLocation}>
            <Plus size={14} />
            Add Location
          </GlassButton>
        </div>

        {errors.locations && (
          <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
            {errors.locations}
          </p>
        )}

        {form.locations.map((loc, index) => (
          <LocationRow
            key={index}
            index={index}
            location={loc}
            errors={errors.locationRows?.[index]}
            onChange={updateLocation}
            onRemove={removeLocation}
            canRemove={form.locations.length > 1}
          />
        ))}
      </div>

      {/* Referral mode */}
      <GlassCard padding="md" elevated>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
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
        {errors.defaultReferralMode && (
          <p className="text-sm mt-1" style={{ color: 'var(--color-destructive)' }}>
            {errors.defaultReferralMode}
          </p>
        )}
      </GlassCard>

      {/* Languages */}
      <GlassCard padding="md" elevated>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Languages
        </h2>
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map(({ code, label }) => {
            const selected = form.focusedLanguages.includes(code)
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggleLanguage(code)}
                className="px-3 py-1.5 text-sm rounded-[var(--border-radius)] border transition-all"
                style={{
                  background: selected ? 'var(--color-primary)' : 'var(--color-glass-bg)',
                  borderColor: selected ? 'var(--color-primary)' : 'var(--color-glass-border)',
                  color: selected
                    ? 'var(--color-text-on-primary)'
                    : 'var(--color-text-secondary)',
                  backdropFilter: selected ? undefined : 'blur(var(--glass-blur))',
                  transitionDuration: 'var(--transition-speed)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
        {errors.focusedLanguages && (
          <p className="text-sm mt-2" style={{ color: 'var(--color-destructive)' }}>
            {errors.focusedLanguages}
          </p>
        )}
      </GlassCard>

      {/* Agency associations (optional) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Agency Memberships
            <span
              className="ml-2 font-normal normal-case"
              style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }}
            >
              (optional)
            </span>
          </h2>
          <GlassButton variant="secondary" size="sm" type="button" onClick={addAssociation}>
            <Plus size={14} />
            Add Membership
          </GlassButton>
        </div>

        {form.associations.map((assoc, index) => (
          <AssociationRow
            key={index}
            index={index}
            association={assoc}
            errors={errors.associationRows?.[index]}
            onChange={updateAssociation}
            onRemove={removeAssociation}
          />
        ))}
      </div>

      {/* Server error */}
      {serverError && (
        <p className="text-sm text-center" style={{ color: 'var(--color-destructive)' }}>
          {serverError}
        </p>
      )}

      {/* Success */}
      {saved && (
        <p className="text-sm text-center" style={{ color: 'var(--color-success)' }}>
          Profile saved successfully.
        </p>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <GlassButton
          type="submit"
          variant="primary"
          size="md"
          loading={submitting}
          disabled={submitting}
        >
          {profile ? 'Save Changes' : 'Create Profile'}
        </GlassButton>
      </div>
    </form>
  )
}
