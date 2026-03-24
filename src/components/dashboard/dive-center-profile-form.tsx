'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Lock, Plus, Save, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { api } from '../../../convex/_generated/api'
import { GlassButton, GlassInput } from '@/components/glass'
import { DIVE_AGENCIES_EXTENDED } from '@/lib/constants/agencies'
import { ALL_LANGUAGES } from '@/lib/constants/dive-languages'
import { LanguagePicker } from '@/components/common/language-picker'
import { LocationPicker, type LocationValue } from '@/components/common/location-picker'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import { AOW_MAIN, AOW_OVERFLOW, MANDATORY_AOW_SPECIALTIES } from '@/lib/constants/aow-specialties'

const locationSchema = z.object({
  placeName: z.string().min(1),
  country: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().optional(),
})

const formSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
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
  location: LocationValue | null
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
  location: null,
  contactEmail: '',
  contactPhone: '',
  associations: [],
  focusedLanguages: [],
  owDays: '',
  aowDays: '',
  oaDays: '',
  aowSpecialties: [...MANDATORY_AOW_SPECIALTIES],
}

export type DiveCenterProfileSection = 'contact' | 'languages' | 'associations'

export function DiveCenterProfileForm({ onSaved, section }: { onSaved?: () => void; section?: DiveCenterProfileSection } = {}) {
  const existing = useQuery(api.diveCenters.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.diveCenters.create)
  const update = useMutation(api.diveCenters.update)

  const { form, setField, errors, serverError, saving, saved, loading, isUpdate, handleSubmit } = useProfileForm<FormState>({
    profile: existing,
    me,
    schema: formSchema,
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
      associations: p.associations,
      focusedLanguages: p.focusedLanguages,
      owDays: p.bookingPreferences?.owDays?.toString() ?? '',
      aowDays: p.bookingPreferences?.aowDays?.toString() ?? '',
      oaDays: p.bookingPreferences?.oaDays?.toString() ?? '',
      aowSpecialties: [...new Set([...MANDATORY_AOW_SPECIALTIES, ...(p.bookingPreferences?.aowSpecialties ?? [])])],
    }),
    fromMe: (u, defaults) => ({
      ...defaults,
      name: u.businessName ?? '',
      contactEmail: u.email ?? '',
      focusedLanguages: u.customerLanguages ?? [],
    }),
    toPayload: (f) => {
      const loc = f.location!
      const owDays = f.owDays ? parseInt(f.owDays, 10) : undefined
      const aowDays = f.aowDays ? parseInt(f.aowDays, 10) : undefined
      const oaDays = f.oaDays ? parseInt(f.oaDays, 10) : undefined
      const aowSpecialties = f.aowSpecialties.length > 0 ? f.aowSpecialties : undefined
      const hasPrefs = owDays !== undefined || aowDays !== undefined || oaDays !== undefined || aowSpecialties !== undefined
      return {
        name: f.name,
        placeName: loc.placeName,
        country: loc.country,
        lat: loc.lat,
        lng: loc.lng,
        placeId: loc.placeId,
        contactEmail: f.contactEmail,
        contactPhone: f.contactPhone,
        associations: f.associations,
        focusedLanguages: f.focusedLanguages,
        bookingPreferences: hasPrefs ? { owDays, aowDays, oaDays, aowSpecialties } : undefined,
      }
    },
    create,
    update,
    onSaved,
  })

  function addAssociation() {
    setField('associations', [...form.associations, { agency: '', number: '' }])
  }

  function removeAssociation(idx: number) {
    if (form.associations.length <= 1) return
    setField('associations', form.associations.filter((_, i) => i !== idx))
  }

  function updateAssociation(idx: number, field: 'agency' | 'number', value: string) {
    setField('associations', form.associations.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  const [showMore, setShowMore] = useState(false)

  function toggleSpecialty(s: string) {
    if (MANDATORY_AOW_SPECIALTIES.has(s)) return
    setField(
      'aowSpecialties',
      form.aowSpecialties.includes(s)
        ? form.aowSpecialties.filter((x) => x !== s)
        : [...form.aowSpecialties, s],
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm animate-pulse" style={{ color: 'var(--color-text-secondary)' }}>
          Loading profile…
        </span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {!section && (
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            {isUpdate ? 'Profile Settings' : 'Complete Your Profile'}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {isUpdate
              ? 'Update your dive center information.'
              : 'Tell us about your dive center to get started.'}
          </p>
        </div>
      )}

      {/* Basic Information */}
      {(!section || section === 'contact') && (
      <div className="space-y-4">
        <h2
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Basic Information
        </h2>
        <GlassInput
          label="Business Name"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="e.g. Ocean Explorer Dive Center"
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
      </div>
      )}

      {/* Agency Affiliations */}
      {(!section || section === 'associations') && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            className="text-xs font-semibold uppercase tracking-wider"
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
                      {DIVE_AGENCIES_EXTENDED.map((a) => (
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
                {form.associations.length > 1 && (
                  <div className="mt-7 flex-shrink-0">
                    <GlassButton
                      variant="destructive-ghost"
                      size="sm"
                      type="button"
                      onClick={() => removeAssociation(idx)}
                      aria-label="Remove affiliation"
                    >
                      <Trash2 size={16} />
                    </GlassButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Languages */}
      {(!section || section === 'languages') && (
      <div className="space-y-4">
        <h2
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Languages Offered
        </h2>
        <LanguagePicker
          value={form.focusedLanguages
            .map((code) => ALL_LANGUAGES.find((l) => l.code === code))
            .filter((l): l is NonNullable<typeof l> => l !== undefined)
            .map((l) => ({ code: l.code, label: l.label }))}
          onChange={(langs) => setField('focusedLanguages', langs.map((l) => l.code))}
        />
      </div>
      )}

      {/* Booking Preferences */}
      {(!section || section === 'associations') && (
      <div className="space-y-4">
        <div>
          <h2
            className="text-xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Booking Preferences
          </h2>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Default course durations used when creating bookings.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <div className="flex flex-wrap gap-1.5">
            {AOW_MAIN.map(({ value, label }) => {
              const checked = form.aowSpecialties.includes(value)
              const locked = MANDATORY_AOW_SPECIALTIES.has(value)
              return (
                <label
                  key={value}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${locked ? 'cursor-default' : 'cursor-pointer'}`}
                  style={{
                    background: checked ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
                    color: checked ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
                    border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-glass-border)'}`,
                    transitionDuration: 'var(--transition-speed)',
                  }}
                  aria-disabled={locked || undefined}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    disabled={locked}
                    onChange={() => toggleSpecialty(value)}
                  />
                  {label}
                  {locked && <Lock size={10} style={{ opacity: 0.7 }} />}
                </label>
              )
            })}
            {!showMore && (
              <button
                type="button"
                onClick={() => setShowMore(true)}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer"
                style={{
                  background: 'var(--color-surface-elevated)',
                  color: 'var(--color-text-secondary)',
                  border: '1px dashed var(--color-glass-border)',
                }}
              >
                More…
              </button>
            )}
            {showMore && AOW_OVERFLOW.map(({ value, label }) => {
              const checked = form.aowSpecialties.includes(value)
              return (
                <label
                  key={value}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all"
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
                    onChange={() => toggleSpecialty(value)}
                  />
                  {label}
                </label>
              )
            })}
          </div>
        </div>
      </div>
      )}

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
          {isUpdate ? 'Save Changes' : 'Create Profile'}
        </GlassButton>
      </div>
    </form>
  )
}
