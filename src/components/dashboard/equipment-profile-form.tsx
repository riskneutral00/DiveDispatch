'use client'

import { useMutation, useQuery } from 'convex/react'
import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { api } from '../../../convex/_generated/api'
import { GlassButton, GlassCard, GlassInput } from '@/components/glass'

const GEAR_TYPES = ['bcd', 'wetsuit', 'fins', 'regulator', 'mask'] as const
type GearType = (typeof GEAR_TYPES)[number]

const GEAR_TYPE_LABELS: Record<GearType, string> = {
  bcd: 'BCD',
  wetsuit: 'Wetsuit',
  fins: 'Fins',
  regulator: 'Regulator',
  mask: 'Mask',
}

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  city: z.string().min(1, 'City is required').max(100),
  country: z.string().min(1, 'Country is required').max(100),
  contactEmail: z.string().email('Valid email required'),
  contactPhone: z.string().min(1, 'Phone is required').max(30),
  focusedLanguages: z.array(z.string()).min(1, 'At least one language is required'),
})

type FormErrors = Partial<Record<keyof z.infer<typeof profileSchema> | '_root', string>>

export function EquipmentProfileForm() {
  const profile = useQuery(api.equipment.mine)
  const create = useMutation(api.equipment.create)
  const update = useMutation(api.equipment.update)

  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [focusedLanguages, setFocusedLanguages] = useState<string[]>([])
  const [manufacturersByGearType, setManufacturersByGearType] = useState<
    Partial<Record<GearType, string[]>>
  >({})

  const [langInput, setLangInput] = useState('')
  const [mfrInputs, setMfrInputs] = useState<Partial<Record<GearType, string>>>({})

  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!profile) return
    setName(profile.name)
    setCity(profile.city)
    setCountry(profile.country)
    setContactEmail(profile.contactEmail)
    setContactPhone(profile.contactPhone)
    setFocusedLanguages(profile.focusedLanguages)
    if (profile.manufacturersByGearType) {
      const parsed: Partial<Record<GearType, string[]>> = {}
      for (const gt of GEAR_TYPES) {
        const mfrs = profile.manufacturersByGearType[gt]
        if (mfrs && mfrs.length > 0) parsed[gt] = mfrs
      }
      setManufacturersByGearType(parsed)
    }
  }, [profile])

  function addLanguage() {
    const lang = langInput.trim()
    if (!lang || focusedLanguages.includes(lang)) return
    setFocusedLanguages((prev) => [...prev, lang])
    setLangInput('')
  }

  function removeLanguage(lang: string) {
    setFocusedLanguages((prev) => prev.filter((l) => l !== lang))
  }

  function toggleGearType(gt: GearType) {
    setManufacturersByGearType((prev) => {
      if (gt in prev) {
        const next = { ...prev }
        delete next[gt]
        return next
      }
      return { ...prev, [gt]: [] }
    })
  }

  function addManufacturer(gt: GearType) {
    const mfr = (mfrInputs[gt] ?? '').trim()
    if (!mfr) return
    const existing = manufacturersByGearType[gt] ?? []
    if (existing.includes(mfr)) return
    setManufacturersByGearType((prev) => ({ ...prev, [gt]: [...(prev[gt] ?? []), mfr] }))
    setMfrInputs((prev) => ({ ...prev, [gt]: '' }))
  }

  function removeManufacturer(gt: GearType, mfr: string) {
    setManufacturersByGearType((prev) => ({
      ...prev,
      [gt]: (prev[gt] ?? []).filter((m) => m !== mfr),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setSaved(false)

    const result = profileSchema.safeParse({
      name,
      city,
      country,
      contactEmail,
      contactPhone,
      focusedLanguages,
    })

    if (!result.success) {
      const errs: FormErrors = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FormErrors
        if (key && !errs[key]) errs[key] = issue.message
      }
      setErrors(errs)
      return
    }

    // Build manufacturersByGearType — only include gear types that have at least one manufacturer
    const mbt: Record<string, string[]> = {}
    for (const gt of GEAR_TYPES) {
      const mfrs = manufacturersByGearType[gt]
      if (mfrs && mfrs.length > 0) mbt[gt] = mfrs
    }

    const payload = {
      ...result.data,
      manufacturersByGearType: Object.keys(mbt).length > 0 ? mbt : undefined,
    }

    setSaving(true)
    try {
      if (profile) {
        await update(payload)
      } else {
        await create(payload)
      }
      setSaved(true)
    } catch (err) {
      setErrors({ _root: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  if (profile === undefined) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Loading…
      </p>
    )
  }

  const activeGearTypes = GEAR_TYPES.filter((gt) => gt in manufacturersByGearType)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Business Details */}
      <GlassCard elevated padding="lg">
        <h2
          className="text-base font-semibold mb-4"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Business Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <GlassInput
              label="Business Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Phuket Gear Rental"
              error={errors.name}
            />
          </div>
          <GlassInput
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Phuket"
            error={errors.city}
          />
          <GlassInput
            label="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. Thailand"
            error={errors.country}
          />
          <GlassInput
            label="Contact Email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="you@example.com"
            error={errors.contactEmail}
          />
          <GlassInput
            label="Contact Phone"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+66 81 234 5678"
            error={errors.contactPhone}
          />
        </div>
      </GlassCard>

      {/* Languages */}
      <GlassCard elevated padding="lg">
        <h2
          className="text-base font-semibold mb-1"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Languages
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          Languages your team communicates in with dive centers and instructors.
        </p>
        <div className="flex gap-2 mb-3">
          <GlassInput
            value={langInput}
            onChange={(e) => setLangInput(e.target.value)}
            placeholder="e.g. English, Thai, Chinese"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addLanguage()
              }
            }}
          />
          <GlassButton type="button" variant="secondary" size="sm" onClick={addLanguage}>
            <Plus size={14} />
          </GlassButton>
        </div>
        {focusedLanguages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {focusedLanguages.map((lang) => (
              <span
                key={lang}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-full border"
                style={{
                  background: 'var(--color-glass-bg)',
                  color: 'var(--color-text-primary)',
                  borderColor: 'var(--color-glass-border)',
                }}
              >
                {lang}
                <button
                  type="button"
                  aria-label={`Remove ${lang}`}
                  onClick={() => removeLanguage(lang)}
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        {errors.focusedLanguages && (
          <p className="mt-2 text-sm" style={{ color: 'var(--color-destructive)' }}>
            {errors.focusedLanguages}
          </p>
        )}
      </GlassCard>

      {/* Gear Catalog */}
      <GlassCard elevated padding="lg">
        <h2
          className="text-base font-semibold mb-1"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Gear Catalog
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          Select the gear types you stock and add manufacturer brands per type. Used for automatic
          sizing when customers rent gear.
        </p>

        {/* Gear type toggle chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {GEAR_TYPES.map((gt) => {
            const active = gt in manufacturersByGearType
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

        {/* Manufacturer entry per active gear type */}
        {activeGearTypes.length > 0 && (
          <div className="space-y-3">
            {activeGearTypes.map((gt) => (
              <div
                key={gt}
                className="p-3 rounded-[var(--border-radius)]"
                style={{
                  background: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-glass-border)',
                }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {GEAR_TYPE_LABELS[gt]}
                </p>
                <div className="flex gap-2 mb-2">
                  <GlassInput
                    value={mfrInputs[gt] ?? ''}
                    onChange={(e) =>
                      setMfrInputs((prev) => ({ ...prev, [gt]: e.target.value }))
                    }
                    placeholder="e.g. ScubaPro, Mares, Aqualung"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addManufacturer(gt)
                      }
                    }}
                  />
                  <GlassButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => addManufacturer(gt)}
                  >
                    <Plus size={14} />
                  </GlassButton>
                </div>
                {(manufacturersByGearType[gt] ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(manufacturersByGearType[gt] ?? []).map((mfr) => (
                      <span
                        key={mfr}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border"
                        style={{
                          background: 'var(--color-glass-bg)',
                          color: 'var(--color-text-primary)',
                          borderColor: 'var(--color-glass-border)',
                        }}
                      >
                        {mfr}
                        <button
                          type="button"
                          aria-label={`Remove ${mfr}`}
                          onClick={() => removeManufacturer(gt, mfr)}
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
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

      {/* Submit */}
      {errors._root && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
          {errors._root}
        </p>
      )}
      {saved && (
        <p className="text-sm" style={{ color: 'var(--color-success)' }}>
          Profile saved.
        </p>
      )}
      <GlassButton type="submit" loading={saving} fullWidth>
        {profile ? 'Save Changes' : 'Create Profile'}
      </GlassButton>
    </form>
  )
}
