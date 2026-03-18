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
import { COURSE_CODES } from '@/lib/constants/course-catalog'
import { DIVE_AGENCIES } from '@/lib/constants/agencies'
import { LANGUAGE_OPTIONS } from '@/lib/constants/languages'

const COURSE_LABELS: Record<string, string> = {
  DSD: 'Discover Scuba Diving',
  TRY_DIVE: 'Try Dive',
  OW: 'Open Water',
  AOW: 'Advanced Open Water',
  RESCUE: 'Rescue Diver',
  DM: 'Divemaster',
  FD: 'Fun Dive',
  REFRESH: 'Refresher / ReActivate',
  SPECIALTY: 'Specialty',
}

// ── Zod Schemas ───────────────────────────────────────────────────────

const credentialSchema = z.object({
  agency: z.string().min(1, 'Agency is required'),
  level: z.string().min(1, 'Level is required'),
  agencyID: z.string().min(1, 'Agency ID is required'),
  courses: z.array(z.string()).min(1, 'Select at least one course'),
})

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
  contactEmail: z.string().email('Invalid email address'),
  contactPhone: z.string().min(1, 'Phone number is required'),
  credential: z.array(credentialSchema).min(1, 'Add at least one credential'),
  languages: z.array(z.string()).min(1, 'Select at least one language'),
})

type ProfileFormData = z.infer<typeof profileSchema>
type CredentialData = z.infer<typeof credentialSchema>
type CredentialErrors = Partial<Record<keyof CredentialData, string>>
type FormErrors = Partial<
  Record<keyof Omit<ProfileFormData, 'credential'>, string> & {
    credential: string
    credentials: CredentialErrors[]
  }
>

const emptyCredential = (): CredentialData => ({
  agency: '',
  level: '',
  agencyID: '',
  courses: [],
})

const defaultFormData = (): ProfileFormData => ({
  name: '',
  city: '',
  country: '',
  contactEmail: '',
  contactPhone: '',
  credential: [emptyCredential()],
  languages: [],
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
        className="glass w-full text-sm px-3 py-2.5 focus:outline-none focus:ring-2 rounded-[var(--border-radius)]"
        style={{
          color: value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          outlineColor: error ? 'var(--color-destructive)' : 'var(--color-accent)',
          ...(error
            ? { boxShadow: `0 0 0 2px var(--color-destructive)` }
            : {}),
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

interface CheckboxGroupProps {
  label: string
  items: { value: string; label: string }[]
  selected: string[]
  onChange: (values: string[]) => void
  error?: string
  columns?: 2 | 3
}

function CheckboxGroup({ label, items, selected, onChange, error, columns = 2 }: CheckboxGroupProps) {
  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    )
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <div className={`grid gap-2 ${columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
        {items.map(({ value, label: itemLabel }) => {
          const checked = selected.includes(value)
          return (
            <label
              key={value}
              className="flex items-center gap-2 cursor-pointer select-none text-sm"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(value)}
                className="rounded"
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <span>{itemLabel}</span>
            </label>
          )
        })}
      </div>
      {error && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

// ── Credential Row ────────────────────────────────────────────────────

interface CredentialRowProps {
  index: number
  credential: CredentialData
  errors?: CredentialErrors
  onChange: (index: number, updated: CredentialData) => void
  onRemove: (index: number) => void
  canRemove: boolean
}

function CredentialRow({ index, credential, errors, onChange, onRemove, canRemove }: CredentialRowProps) {
  const update = (field: keyof CredentialData, value: string | string[]) => {
    onChange(index, { ...credential, [field]: value })
  }

  const courseItems = COURSE_CODES.map((code) => ({
    value: code,
    label: COURSE_LABELS[code] ?? code,
  }))

  return (
    <GlassCard padding="md" elevated>
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Credential {index + 1}
        </h3>
        {canRemove && (
          <GlassButton
            variant="destructive"
            size="sm"
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Remove credential ${index + 1}`}
          >
            <Trash2 size={14} />
            Remove
          </GlassButton>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <GlassSelect
          label="Agency"
          value={credential.agency}
          onChange={(v) => update('agency', v)}
          options={DIVE_AGENCIES}
          placeholder="Select agency…"
          error={errors?.agency}
        />
        <GlassInput
          label="Certification Level"
          placeholder="e.g. Open Water Instructor"
          value={credential.level}
          onChange={(e) => update('level', e.target.value)}
          error={errors?.level}
        />
        <GlassInput
          label="Agency Instructor ID"
          placeholder="e.g. 12345678"
          value={credential.agencyID}
          onChange={(e) => update('agencyID', e.target.value)}
          error={errors?.agencyID}
          className="sm:col-span-1"
        />
      </div>

      <CheckboxGroup
        label="Courses Taught"
        items={courseItems}
        selected={credential.courses}
        onChange={(values) => update('courses', values)}
        error={errors?.courses}
        columns={3}
      />
    </GlassCard>
  )
}

// ── Main Form ─────────────────────────────────────────────────────────

export function InstructorProfileForm() {
  const profile = useQuery(api.instructors.mine)
  const create = useMutation(api.instructors.create)
  const update = useMutation(api.instructors.update)

  const [form, setForm] = useState<ProfileFormData>(defaultFormData())
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)

  // Populate form once profile loads
  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name,
        city: profile.city,
        country: profile.country,
        contactEmail: profile.contactEmail,
        contactPhone: profile.contactPhone,
        credential: profile.credential.length > 0 ? profile.credential : [emptyCredential()],
        languages: profile.languages,
      })
    }
  }, [profile])

  // ── Field helpers ──────────────────────────────────────────────────

  const setField = <K extends keyof ProfileFormData>(key: K, value: ProfileFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setSaved(false)
  }

  const updateCredential = (index: number, updated: CredentialData) => {
    setForm((prev) => {
      const credential = [...prev.credential]
      credential[index] = updated
      return { ...prev, credential }
    })
    setSaved(false)
  }

  const addCredential = () => {
    setForm((prev) => ({
      ...prev,
      credential: [...prev.credential, emptyCredential()],
    }))
  }

  const removeCredential = (index: number) => {
    setForm((prev) => ({
      ...prev,
      credential: prev.credential.filter((_, i) => i !== index),
    }))
    setErrors((prev) => {
      const credentials = prev.credentials ? [...prev.credentials] : []
      credentials.splice(index, 1)
      return { ...prev, credentials }
    })
  }

  // ── Submit ─────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    setSaved(false)

    const result = profileSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: FormErrors = {}
      const credErrors: CredentialErrors[] = []

      for (const issue of result.error.issues) {
        const path = issue.path
        if (path[0] === 'credential' && typeof path[1] === 'number' && path[2]) {
          if (!credErrors[path[1]]) credErrors[path[1]] = {}
          credErrors[path[1]][path[2] as keyof CredentialData] = issue.message
        } else if (path[0] === 'credential' && path.length === 1) {
          fieldErrors.credential = issue.message
        } else if (typeof path[0] === 'string') {
          (fieldErrors as Record<string, string>)[path[0]] = issue.message
        }
      }

      if (credErrors.length > 0) fieldErrors.credentials = credErrors
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
      <div className="flex items-center justify-center py-16">
        <div
          className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"
          style={{ color: 'var(--color-primary)' }}
        />
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────

  const langItems = LANGUAGE_OPTIONS.map(({ code, label }) => ({ value: code, label }))

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
            ? 'Keep your profile current so dive centers can find you.'
            : 'Set up your instructor profile to start receiving booking requests.'}
        </p>
      </div>

      {/* Basic info */}
      <GlassCard padding="md" elevated>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Contact Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Full Name"
            placeholder="Your name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            error={errors.name}
            className="sm:col-span-2"
          />
          <GlassInput
            label="City"
            placeholder="e.g. Phuket"
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
            error={errors.city}
          />
          <GlassInput
            label="Country"
            placeholder="e.g. Thailand"
            value={form.country}
            onChange={(e) => setField('country', e.target.value)}
            error={errors.country}
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

      {/* Languages */}
      <GlassCard padding="md" elevated>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Teaching Languages
        </h2>
        <CheckboxGroup
          label="Languages you teach in"
          items={langItems}
          selected={form.languages}
          onChange={(values) => setField('languages', values)}
          error={errors.languages}
          columns={3}
        />
      </GlassCard>

      {/* Credentials */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Dive Credentials
          </h2>
          <GlassButton
            variant="secondary"
            size="sm"
            type="button"
            onClick={addCredential}
          >
            <Plus size={14} />
            Add Credential
          </GlassButton>
        </div>

        {errors.credential && (
          <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
            {errors.credential}
          </p>
        )}

        {form.credential.map((cred, index) => (
          <CredentialRow
            key={index}
            index={index}
            credential={cred}
            errors={errors.credentials?.[index]}
            onChange={updateCredential}
            onRemove={removeCredential}
            canRemove={form.credential.length > 1}
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
