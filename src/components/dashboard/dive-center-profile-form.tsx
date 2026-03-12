'use client'

import { useMutation, useQuery } from 'convex/react'
import { Minus, Plus, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { api } from '../../../convex/_generated/api'
import { GlassButton, GlassCard, GlassInput } from '@/components/glass'

const DIVE_AGENCIES = ['PADI', 'SSI', 'NAUI', 'CMAS', 'TDI', 'SDI', 'RAID', 'BSAC', 'GUE', 'IANTD']

const FOCUSED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'th', label: 'Thai' },
  { code: 'zh', label: 'Mandarin' },
  { code: 'yue', label: 'Cantonese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ru', label: 'Russian' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'he', label: 'Hebrew' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
]

const AOW_SPECIALTIES = [
  'Peak Performance Buoyancy',
  'Underwater Navigation',
  'Wreck Diver',
  'Deep Diver',
  'Night Diver',
  'Underwater Photography',
  'Boat Diver',
  'Drift Diver',
  'Dry Suit Diver',
  'Fish Identification',
  'Search and Recovery',
  'Digital Underwater Photography',
]

const formSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
  contactEmail: z.string().email('Invalid email address'),
  contactPhone: z.string().min(1, 'Contact phone is required'),
  associations: z.array(
    z.object({
      agency: z.string().min(1, 'Agency is required'),
      number: z.string().min(1, 'Member number is required'),
    }),
  ),
  focusedLanguages: z.array(z.string()),
})

type FormState = {
  name: string
  city: string
  country: string
  contactEmail: string
  contactPhone: string
  associations: { agency: string; number: string }[]
  focusedLanguages: string[]
  owDays: string
  aowDays: string
  oaDays: string
  aowSpecialties: string[]
}

const INITIAL_FORM: FormState = {
  name: '',
  city: '',
  country: '',
  contactEmail: '',
  contactPhone: '',
  associations: [],
  focusedLanguages: [],
  owDays: '',
  aowDays: '',
  oaDays: '',
  aowSpecialties: [],
}

export function DiveCenterProfileForm() {
  const existing = useQuery(api.diveCenters.mine)
  const create = useMutation(api.diveCenters.create)
  const update = useMutation(api.diveCenters.update)

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (existing !== undefined && !initialized) {
      if (existing) {
        setForm({
          name: existing.name,
          city: existing.city,
          country: existing.country,
          contactEmail: existing.contactEmail,
          contactPhone: existing.contactPhone,
          associations: existing.associations,
          focusedLanguages: existing.focusedLanguages,
          owDays: existing.bookingPreferences?.owDays?.toString() ?? '',
          aowDays: existing.bookingPreferences?.aowDays?.toString() ?? '',
          oaDays: existing.bookingPreferences?.oaDays?.toString() ?? '',
          aowSpecialties: existing.bookingPreferences?.aowSpecialties ?? [],
        })
      }
      setInitialized(true)
    }
  }, [existing, initialized])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => { const next = { ...prev }; delete next[key]; return next })
  }

  function addAssociation() {
    setField('associations', [...form.associations, { agency: '', number: '' }])
  }

  function removeAssociation(idx: number) {
    setField('associations', form.associations.filter((_, i) => i !== idx))
  }

  function updateAssociation(idx: number, field: 'agency' | 'number', value: string) {
    setField('associations', form.associations.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  function toggleLanguage(code: string) {
    setField(
      'focusedLanguages',
      form.focusedLanguages.includes(code)
        ? form.focusedLanguages.filter((l) => l !== code)
        : [...form.focusedLanguages, code],
    )
  }

  function toggleSpecialty(s: string) {
    setField(
      'aowSpecialties',
      form.aowSpecialties.includes(s)
        ? form.aowSpecialties.filter((x) => x !== s)
        : [...form.aowSpecialties, s],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaved(false)
    setServerError(null)

    const result = formSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const path = issue.path.join('.')
        if (!fieldErrors[path]) fieldErrors[path] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    const owDays = form.owDays ? parseInt(form.owDays, 10) : undefined
    const aowDays = form.aowDays ? parseInt(form.aowDays, 10) : undefined
    const oaDays = form.oaDays ? parseInt(form.oaDays, 10) : undefined
    const aowSpecialties = form.aowSpecialties.length > 0 ? form.aowSpecialties : undefined
    const hasPrefs = owDays !== undefined || aowDays !== undefined || oaDays !== undefined || aowSpecialties !== undefined

    const payload = {
      name: form.name,
      city: form.city,
      country: form.country,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      associations: form.associations,
      focusedLanguages: form.focusedLanguages,
      bookingPreferences: hasPrefs ? { owDays, aowDays, oaDays, aowSpecialties } : undefined,
    }

    setSaving(true)
    try {
      if (existing) {
        await update(payload)
      } else {
        await create(payload)
      }
      setSaved(true)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (existing === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm animate-pulse" style={{ color: 'var(--color-text-secondary)' }}>
          Loading profile…
        </span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          {existing ? 'Profile Settings' : 'Complete Your Profile'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {existing
            ? 'Update your dive center information.'
            : 'Tell us about your dive center to get started.'}
        </p>
      </div>

      {/* Basic Information */}
      <GlassCard>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Basic Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <GlassInput
              label="Business Name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Ocean Explorer Dive Center"
              error={errors.name}
            />
          </div>
          <GlassInput
            label="City"
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
            placeholder="e.g. Phuket"
            error={errors.city}
          />
          <GlassInput
            label="Country"
            value={form.country}
            onChange={(e) => setField('country', e.target.value)}
            placeholder="e.g. Thailand"
            error={errors.country}
          />
          <GlassInput
            label="Contact Email"
            type="email"
            value={form.contactEmail}
            onChange={(e) => setField('contactEmail', e.target.value)}
            placeholder="dive@example.com"
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
      </GlassCard>

      {/* Agency Affiliations */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Agency Affiliations
          </h2>
          <GlassButton type="button" variant="secondary" size="sm" onClick={addAssociation}>
            <Plus size={14} />
            Add
          </GlassButton>
        </div>

        {form.associations.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No affiliations added. Click Add to register your agency membership.
          </p>
        ) : (
          <div className="space-y-3">
            {form.associations.map((assoc, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1.5">
                    <label
                      className="text-sm font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Agency
                    </label>
                    <select
                      value={assoc.agency}
                      onChange={(e) => updateAssociation(idx, 'agency', e.target.value)}
                      className="glass w-full text-sm px-3 py-2.5 focus:outline-none"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <option value="">Select agency…</option>
                      {DIVE_AGENCIES.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                    {errors[`associations.${idx}.agency`] && (
                      <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
                        {errors[`associations.${idx}.agency`]}
                      </p>
                    )}
                  </div>
                  <GlassInput
                    label="Member Number"
                    value={assoc.number}
                    onChange={(e) => updateAssociation(idx, 'number', e.target.value)}
                    placeholder="e.g. TH-0012345"
                    error={errors[`associations.${idx}.number`]}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeAssociation(idx)}
                  className="mt-7 flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 transition-colors"
                  style={{ color: 'var(--color-destructive)' }}
                  aria-label="Remove affiliation"
                >
                  <Minus size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Languages */}
      <GlassCard>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Languages Offered
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {FOCUSED_LANGUAGES.map(({ code, label }) => {
            const checked = form.focusedLanguages.includes(code)
            return (
              <label
                key={code}
                className="flex items-center gap-2 px-3 py-2 rounded-[var(--border-radius)] cursor-pointer transition-all"
                style={{
                  background: checked ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
                  color: checked ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
                  border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-glass-border)'}`,
                  transitionDuration: 'var(--transition-speed)',
                }}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggleLanguage(code)}
                />
                <span className="text-sm">{label}</span>
              </label>
            )
          })}
        </div>
      </GlassCard>

      {/* Booking Preferences */}
      <GlassCard>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-1"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Booking Preferences
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          Default course durations used when creating bookings.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <GlassInput
            label="Open Water Days"
            type="number"
            min={1}
            max={14}
            value={form.owDays}
            onChange={(e) => setField('owDays', e.target.value)}
            placeholder="4"
          />
          <GlassInput
            label="Advanced OW Days"
            type="number"
            min={1}
            max={14}
            value={form.aowDays}
            onChange={(e) => setField('aowDays', e.target.value)}
            placeholder="2"
          />
          <GlassInput
            label="Open Adventure Days"
            type="number"
            min={1}
            max={14}
            value={form.oaDays}
            onChange={(e) => setField('oaDays', e.target.value)}
            placeholder="1"
          />
        </div>
        <div>
          <p
            className="text-sm font-medium mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            AOW Specialties Offered
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AOW_SPECIALTIES.map((s) => {
              const checked = form.aowSpecialties.includes(s)
              return (
                <label
                  key={s}
                  className="flex items-center gap-2 px-3 py-2 rounded-[var(--border-radius)] cursor-pointer transition-all"
                  style={{
                    background: checked ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
                    color: checked ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
                    border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-glass-border)'}`,
                    transitionDuration: 'var(--transition-speed)',
                  }}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleSpecialty(s)}
                  />
                  <span className="text-sm">{s}</span>
                </label>
              )
            })}
          </div>
        </div>
      </GlassCard>

      {serverError && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{serverError}</p>
      )}
      {saved && (
        <p className="text-sm" style={{ color: 'var(--color-success)' }}>
          Profile saved successfully.
        </p>
      )}

      <div className="flex justify-end">
        <GlassButton type="submit" loading={saving}>
          <Save size={16} />
          {existing ? 'Save Changes' : 'Create Profile'}
        </GlassButton>
      </div>
    </form>
  )
}
