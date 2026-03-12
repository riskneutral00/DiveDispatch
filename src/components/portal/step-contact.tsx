'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { AlertTriangle } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassInput } from '@/components/glass/glass-input'
import { GlassButton } from '@/components/glass/glass-button'

// ── Constants ────────────────────────────────────────────────────────────────

// Activity types that require a dive certification
const CERTIFIED_ACTIVITY_TYPES = new Set(['FD', 'AOW', 'RESCUE', 'DM', 'REFRESH', 'SPECIALTY'])

const CERT_AGENCIES = ['PADI', 'SSI', 'NAUI', 'BSAC', 'CMAS'] as const

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria',
  'Bahrain', 'Bangladesh', 'Belgium', 'Bolivia', 'Brazil', 'Cambodia',
  'Canada', 'Chile', 'China', 'Colombia', 'Croatia', 'Czech Republic',
  'Denmark', 'Ecuador', 'Egypt', 'Ethiopia', 'Finland', 'France',
  'Germany', 'Ghana', 'Greece', 'Hong Kong', 'Hungary', 'India',
  'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Malaysia',
  'Mexico', 'Morocco', 'Myanmar', 'Netherlands', 'New Zealand', 'Nigeria',
  'Norway', 'Oman', 'Pakistan', 'Peru', 'Philippines', 'Poland',
  'Portugal', 'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Singapore',
  'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden',
  'Switzerland', 'Taiwan', 'Thailand', 'Turkey', 'Ukraine',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Vietnam',
] as const

// ── Zod Schema ───────────────────────────────────────────────────────────────

const contactSchema = z.object({
  legalFirstName: z.string().min(1, 'Required'),
  legalLastName: z.string().min(1, 'Required'),
  preferredName: z.string().optional(),
  email: z.string().email('Invalid email address'),
  phone: z
    .string()
    .min(1, 'Required')
    .regex(/^\+?[\d\s\-().]{7,}$/, 'Use international format: +1 555 000 0000'),
  dateOfBirth: z.string().min(1, 'Required'),
  gender: z.enum(['M', 'F', 'Other']),
  nationality: z.string().min(1, 'Required'),
  passportNumber: z.string().min(1, 'Required'),
  passportIssuingCountry: z.string().min(1, 'Required'),
  passportExpirationDate: z.string().min(1, 'Required'),
  emergencyContactName: z.string().min(1, 'Required'),
  emergencyContactPhone: z
    .string()
    .min(1, 'Required')
    .regex(/^\+?[\d\s\-().]{7,}$/, 'Use international format: +1 555 000 0000'),
  emergencyContactRelation: z.string().min(1, 'Required'),
  agency: z.string().optional(),
  agencyID: z.string().optional(),
  allergies: z.string().optional(),
})

type ContactFormData = z.infer<typeof contactSchema>
type FormErrors = Partial<Record<keyof ContactFormData, string>>

const defaultForm = (): ContactFormData => ({
  legalFirstName: '',
  legalLastName: '',
  preferredName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: 'M',
  nationality: '',
  passportNumber: '',
  passportIssuingCountry: '',
  passportExpirationDate: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
  agency: '',
  agencyID: '',
  allergies: '',
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function isPassportExpiringSoon(dateStr: string): boolean {
  if (!dateStr) return false
  const expiry = new Date(dateStr)
  const sixMonthsFromNow = new Date()
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6)
  return expiry <= sixMonthsFromNow
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface GlassSelectProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly string[]
  error?: string
  placeholder?: string
  required?: boolean
}

function GlassSelect({
  label,
  value,
  onChange,
  options,
  error,
  placeholder,
  required,
}: GlassSelectProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
        {required && <span style={{ color: 'var(--color-destructive)' }}> *</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="glass w-full text-sm px-3 py-2.5 focus:outline-none focus:ring-2 rounded-[var(--border-radius)]"
        style={{
          color: value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          outlineColor: error ? 'var(--color-destructive)' : 'var(--color-accent)',
          ...(error ? { boxShadow: '0 0 0 2px var(--color-destructive)' } : {}),
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

interface SectionHeadingProps {
  children: React.ReactNode
}

function SectionHeading({ children }: SectionHeadingProps) {
  return (
    <h2
      className="text-sm font-semibold uppercase tracking-wider mb-4"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      {children}
    </h2>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface StepContactProps {
  token: string
  onComplete: () => void
}

export function StepContact({ token, onComplete }: StepContactProps) {
  const context = useQuery(api.customers.getPortalContext, { token })
  const save = useMutation(api.customers.savePortalContact)

  const [form, setForm] = useState<ContactFormData>(defaultForm())
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Pre-fill from existing customer data and booking link hints
  useEffect(() => {
    if (!context) return
    if (context.customer) {
      const c = context.customer
      setForm({
        legalFirstName: c.legalFirstName,
        legalLastName: c.legalLastName,
        preferredName: c.preferredName ?? '',
        email: c.email,
        phone: c.phone,
        dateOfBirth: c.dateOfBirth,
        gender: c.gender,
        nationality: c.nationality,
        passportNumber: c.passportNumber,
        passportIssuingCountry: c.passportIssuingCountry,
        passportExpirationDate: c.passportExpirationDate,
        emergencyContactName: c.emergencyContactName,
        emergencyContactPhone: c.emergencyContactPhone,
        emergencyContactRelation: c.emergencyContactRelation,
        agency: c.agency ?? '',
        agencyID: c.agencyID ?? '',
        allergies: c.allergies ?? '',
      })
    } else {
      // Pre-fill name/email from bookingLink hints if no saved record
      const nameParts = context.prefillName.split(' ')
      setForm((prev) => ({
        ...prev,
        legalFirstName: nameParts[0] ?? '',
        legalLastName: nameParts.slice(1).join(' '),
        email: context.prefillEmail,
      }))
    }
  }, [context])

  const requiresCert =
    context !== undefined &&
    context !== null &&
    context.activityType.some((t) => CERTIFIED_ACTIVITY_TYPES.has(t))

  const setField = <K extends keyof ContactFormData>(key: K, value: ContactFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)

    // Build schema with conditional cert validation
    const schema =
      requiresCert
        ? contactSchema.extend({
            agency: z.string().min(1, 'Certification agency is required'),
            agencyID: z.string().min(1, 'Agency ID is required'),
          })
        : contactSchema

    const result = schema.safeParse(form)
    if (!result.success) {
      const fieldErrors: FormErrors = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof ContactFormData
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setSubmitting(true)
    try {
      await save({
        token,
        legalFirstName: result.data.legalFirstName,
        legalLastName: result.data.legalLastName,
        preferredName: result.data.preferredName || undefined,
        email: result.data.email,
        phone: result.data.phone,
        dateOfBirth: result.data.dateOfBirth,
        gender: result.data.gender,
        nationality: result.data.nationality,
        passportNumber: result.data.passportNumber,
        passportIssuingCountry: result.data.passportIssuingCountry,
        passportExpirationDate: result.data.passportExpirationDate,
        emergencyContactName: result.data.emergencyContactName,
        emergencyContactPhone: result.data.emergencyContactPhone,
        emergencyContactRelation: result.data.emergencyContactRelation,
        agency: result.data.agency || undefined,
        agencyID: result.data.agencyID || undefined,
        allergies: result.data.allergies || undefined,
      })
      onComplete()
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { code?: string; reason?: string }
        if (data.code === 'TOKEN_EXPIRED') {
          setServerError('This link has expired. Please contact your dive center for a new link.')
        } else if (data.code === 'BOOKING_CLOSED') {
          setServerError('This booking is no longer accepting submissions.')
        } else {
          setServerError(data.reason ?? data.code ?? 'An error occurred. Please try again.')
        }
      } else {
        setServerError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (context === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"
          style={{ color: 'var(--color-primary)' }}
        />
      </div>
    )
  }

  if (context === null) {
    return (
      <GlassCard padding="lg">
        <p className="text-center" style={{ color: 'var(--color-destructive)' }}>
          This link has expired or is invalid. Please contact your dive center for a new link.
        </p>
      </GlassCard>
    )
  }

  const passportExpiringSoon = isPassportExpiringSoon(form.passportExpirationDate)

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Personal Information */}
      <GlassCard padding="md" elevated>
        <SectionHeading>Personal Information</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Legal First Name *"
            placeholder="As on passport"
            value={form.legalFirstName}
            onChange={(e) => setField('legalFirstName', e.target.value)}
            error={errors.legalFirstName}
            autoComplete="given-name"
          />
          <GlassInput
            label="Legal Last Name *"
            placeholder="As on passport"
            value={form.legalLastName}
            onChange={(e) => setField('legalLastName', e.target.value)}
            error={errors.legalLastName}
            autoComplete="family-name"
          />
          <GlassInput
            label="Preferred Name"
            placeholder="Nickname or preferred name"
            value={form.preferredName ?? ''}
            onChange={(e) => setField('preferredName', e.target.value)}
            error={errors.preferredName}
            className="sm:col-span-2"
            autoComplete="nickname"
          />
          <GlassInput
            label="Email *"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            error={errors.email}
            autoComplete="email"
          />
          <GlassInput
            label="Phone *"
            type="tel"
            placeholder="+1 555 000 0000"
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            error={errors.phone}
            helperText="International format with country code"
            autoComplete="tel"
          />
          <GlassInput
            label="Date of Birth *"
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => setField('dateOfBirth', e.target.value)}
            error={errors.dateOfBirth}
            autoComplete="bday"
          />
          <GlassSelect
            label="Gender"
            value={form.gender}
            onChange={(v) => setField('gender', v as ContactFormData['gender'])}
            options={['M', 'F', 'Other']}
            error={errors.gender}
            required
          />
          <GlassSelect
            label="Nationality"
            value={form.nationality}
            onChange={(v) => setField('nationality', v)}
            options={COUNTRIES}
            placeholder="Select country…"
            error={errors.nationality}
            required
          />
        </div>
      </GlassCard>

      {/* Passport / ID */}
      <GlassCard padding="md" elevated>
        <SectionHeading>Passport / ID</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Passport Number *"
            placeholder="e.g. AB1234567"
            value={form.passportNumber}
            onChange={(e) => setField('passportNumber', e.target.value)}
            error={errors.passportNumber}
          />
          <GlassSelect
            label="Issuing Country"
            value={form.passportIssuingCountry}
            onChange={(v) => setField('passportIssuingCountry', v)}
            options={COUNTRIES}
            placeholder="Select country…"
            error={errors.passportIssuingCountry}
            required
          />
          <div className="sm:col-span-2">
            <GlassInput
              label="Expiration Date *"
              type="date"
              value={form.passportExpirationDate}
              onChange={(e) => setField('passportExpirationDate', e.target.value)}
              error={errors.passportExpirationDate}
            />
            {passportExpiringSoon && !errors.passportExpirationDate && (
              <div
                className="flex items-center gap-2 mt-2 p-3 rounded-[var(--border-radius)] text-sm"
                style={{
                  background: 'color-mix(in srgb, var(--color-warning) 15%, transparent)',
                  color: 'var(--color-warning)',
                  border: '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)',
                }}
              >
                <AlertTriangle size={16} aria-hidden />
                <span>
                  Your passport expires within 6 months. Some destinations require at least 6 months
                  validity. Please check requirements or renew before your dive trip.
                </span>
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Emergency Contact */}
      <GlassCard padding="md" elevated>
        <SectionHeading>Emergency Contact</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Full Name *"
            placeholder="Emergency contact's full name"
            value={form.emergencyContactName}
            onChange={(e) => setField('emergencyContactName', e.target.value)}
            error={errors.emergencyContactName}
            className="sm:col-span-2"
            autoComplete="off"
          />
          <GlassInput
            label="Phone *"
            type="tel"
            placeholder="+1 555 000 0000"
            value={form.emergencyContactPhone}
            onChange={(e) => setField('emergencyContactPhone', e.target.value)}
            error={errors.emergencyContactPhone}
            helperText="International format with country code"
          />
          <GlassInput
            label="Relationship *"
            placeholder="e.g. Spouse, Parent, Friend"
            value={form.emergencyContactRelation}
            onChange={(e) => setField('emergencyContactRelation', e.target.value)}
            error={errors.emergencyContactRelation}
          />
        </div>
      </GlassCard>

      {/* Diving Certification (conditional) */}
      {requiresCert && (
        <GlassCard padding="md" elevated>
          <SectionHeading>Diving Certification</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassSelect
              label="Certifying Agency"
              value={form.agency ?? ''}
              onChange={(v) => setField('agency', v)}
              options={CERT_AGENCIES}
              placeholder="Select agency…"
              error={errors.agency}
              required
            />
            <GlassInput
              label="Agency Diver ID *"
              placeholder="e.g. 12345678"
              value={form.agencyID ?? ''}
              onChange={(e) => setField('agencyID', e.target.value)}
              error={errors.agencyID}
            />
          </div>
        </GlassCard>
      )}

      {/* Health Information */}
      <GlassCard padding="md" elevated>
        <SectionHeading>Health Information</SectionHeading>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="allergies"
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Known Allergies
          </label>
          <textarea
            id="allergies"
            rows={3}
            placeholder='Food, medication, or environmental allergies. Enter "None" if none.'
            value={form.allergies ?? ''}
            onChange={(e) => setField('allergies', e.target.value)}
            className="glass w-full text-sm px-3 py-2.5 focus:outline-none focus:ring-2 resize-none rounded-[var(--border-radius)]"
            style={{
              color: 'var(--color-text-primary)',
              caretColor: 'var(--color-accent)',
              outlineColor: 'var(--color-accent)',
            }}
          />
        </div>
      </GlassCard>

      {/* Server error */}
      {serverError && (
        <p className="text-sm text-center" style={{ color: 'var(--color-destructive)' }}>
          {serverError}
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
          Continue
        </GlassButton>
      </div>
    </form>
  )
}
