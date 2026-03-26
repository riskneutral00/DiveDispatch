'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { getConvexErrorCode, parseConvexError } from '@/lib/utils/convex-error'
import { AlertTriangle } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassInput } from '@/components/glass/glass-input'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassSimpleSelect } from '@/components/glass/glass-simple-select'
import { makeCustomerContactSchema, useFormValidation } from '@/lib/validation'
import type { CustomerContactData } from '@/lib/validation'
import { CERT_REQUIRED_ACTIVITIES, getMinAge, calcAgeAtDate, isPassportExpiringSoon } from '@/lib/constants/activity-rules'
import type { CourseCode } from '@/lib/constants/course-catalog'
import { DIVE_AGENCIES } from '@/lib/constants/agencies'
import { Spinner } from '@/components/common/spinner'

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

const defaultForm = (): CustomerContactData => ({
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

// ── Sub-components ────────────────────────────────────────────────────────────


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
  /** ISO date string (YYYY-MM-DD) for the first dive session.
   * Used for age-minimum checks and passport expiry warnings.
   * Falls back to today when not provided. */
  bookingStartDate?: string
}

export function StepContact({ token, onComplete, bookingStartDate }: StepContactProps) {
  const context = useQuery(api.customers.getPortalContext, { token })
  const save = useMutation(api.customers.savePortalContact)

  const [form, setFormState] = useState<CustomerContactData>(defaultForm())
  const [serverError, setServerError] = useState<string | null>(null)
  const [ageError, setAgeError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Returning customer dedup
  const [returningCustomer, setReturningCustomer] = useState<{
    _id: string
    legalFirstName: string
    legalLastName: string
    email: string
  } | null>(null)
  const [returningConfirmed, setReturningConfirmed] = useState(false)
  const [returningDismissed, setReturningDismissed] = useState(false)
  const checkReturning = useQuery(
    api.customers.checkReturningCustomer,
    form.email && form.email.includes('@') && !returningDismissed
      ? { email: form.email, token }
      : 'skip',
  )

  // Cert-conditional schema: agency + agencyID required if any activity needs it.
  // Memoize on activity types to avoid hook churn.
  const schema = useMemo(
    () => makeCustomerContactSchema(context?.activityType ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [(context?.activityType ?? []).join(',')],
  )
  const { validate, errors, clearError } = useFormValidation(schema)

  // Pre-fill from existing customer data and booking link hints
  useEffect(() => {
    if (!context) return
    if (context.customer) {
      const c = context.customer
      setFormState({
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
      setFormState((prev) => ({
        ...prev,
        legalFirstName: nameParts[0] ?? '',
        legalLastName: nameParts.slice(1).join(' '),
        email: context.prefillEmail,
      }))
    }
  }, [context])

  // Show returning customer banner when match found
  useEffect(() => {
    if (checkReturning && !returningConfirmed && !returningDismissed) {
      setReturningCustomer(checkReturning)
    }
  }, [checkReturning, returningConfirmed, returningDismissed])

  function confirmReturningCustomer() {
    if (!checkReturning) return
    setReturningConfirmed(true)
    setReturningCustomer(null)
    // Pre-fill everything except medical/waiver
    setFormState((prev) => ({
      ...prev,
      legalFirstName: checkReturning.legalFirstName,
      legalLastName: checkReturning.legalLastName,
      preferredName: checkReturning.preferredName ?? '',
      email: checkReturning.email,
      phone: checkReturning.phone,
      dateOfBirth: checkReturning.dateOfBirth,
      gender: checkReturning.gender,
      nationality: checkReturning.nationality,
      passportNumber: checkReturning.passportNumber,
      passportIssuingCountry: checkReturning.passportIssuingCountry,
      passportExpirationDate: checkReturning.passportExpirationDate,
      emergencyContactName: checkReturning.emergencyContactName,
      emergencyContactPhone: checkReturning.emergencyContactPhone,
      emergencyContactRelation: checkReturning.emergencyContactRelation,
      agency: checkReturning.agency ?? '',
      agencyID: checkReturning.agencyID ?? '',
      allergies: checkReturning.allergies ?? '',
    }))
  }

  function dismissReturningCustomer() {
    setReturningDismissed(true)
    setReturningCustomer(null)
  }

  const requiresCert =
    context != null &&
    context.activityType.some((t) =>
      (CERT_REQUIRED_ACTIVITIES as readonly string[]).includes(t),
    )

  const setField = <K extends keyof CustomerContactData>(key: K, value: CustomerContactData[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }))
    clearError(key as string)
    setAgeError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    setAgeError(null)

    const result = validate(form)
    if (!result.success || !result.data) return

    const validated = result.data

    // Age check: diver must meet minimum age for their activity types
    if (validated.dateOfBirth && context?.activityType?.length) {
      const refDate = bookingStartDate ?? new Date().toISOString().slice(0, 10)
      const age = calcAgeAtDate(validated.dateOfBirth, refDate)
      const minAge = getMinAge(context.activityType as CourseCode[])
      if (age < minAge) {
        setAgeError(
          `Diver must be at least ${minAge} years old for this activity. ` +
            `Age at dive start: ${age} year${age === 1 ? '' : 's'}.`,
        )
        return
      }
    }

    setSubmitting(true)
    try {
      await save({
        token,
        ...(returningConfirmed && checkReturning?._id
          ? { existingCustomerId: checkReturning._id }
          : {}),
        legalFirstName: validated.legalFirstName,
        legalLastName: validated.legalLastName,
        preferredName: validated.preferredName || undefined,
        email: validated.email,
        phone: validated.phone,
        dateOfBirth: validated.dateOfBirth,
        gender: validated.gender,
        nationality: validated.nationality,
        passportNumber: validated.passportNumber,
        passportIssuingCountry: validated.passportIssuingCountry,
        passportExpirationDate: validated.passportExpirationDate,
        emergencyContactName: validated.emergencyContactName,
        emergencyContactPhone: validated.emergencyContactPhone,
        emergencyContactRelation: validated.emergencyContactRelation,
        agency: validated.agency || undefined,
        agencyID: validated.agencyID || undefined,
        allergies: validated.allergies || undefined,
      })
      onComplete()
    } catch (err) {
      const code = getConvexErrorCode(err)
      if (code === 'TOKEN_EXPIRED') {
        setServerError('This link has expired. Please contact your dive center for a new link.')
      } else if (code === 'BOOKING_CLOSED') {
        setServerError('This booking is no longer accepting submissions.')
      } else {
        setServerError(parseConvexError(err, 'An unexpected error occurred. Please try again.'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (context === undefined) {
    return (
      <div className="flex items-center justify-center py-16" style={{ color: 'var(--color-primary)' }}>
        <Spinner size="lg" />
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

  const passportExpiringSoon = isPassportExpiringSoon(
    form.passportExpirationDate,
    bookingStartDate,
  )

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Returning customer banner */}
      {returningCustomer && !returningConfirmed && !returningDismissed && (
        <GlassCard padding="md">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Welcome back! We found your info from a previous booking.
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {returningCustomer.legalFirstName} {returningCustomer.legalLastName} ({returningCustomer.email})
            </p>
            <div className="flex gap-2">
              <GlassButton type="button" variant="primary" size="sm" onClick={confirmReturningCustomer}>
                Yes, that&apos;s me
              </GlassButton>
              <GlassButton type="button" variant="secondary" size="sm" onClick={dismissReturningCustomer}>
                Not me
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      )}

      {returningConfirmed && (
        <p className="text-sm px-1" style={{ color: 'var(--color-success)' }}>
          Your previous info has been loaded. Review and update anything that&apos;s changed.
        </p>
      )}

      {/* Personal Information */}
      <GlassCard padding="md">
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
          <div>
            <GlassInput
              label="Date of Birth *"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setField('dateOfBirth', e.target.value)}
              error={errors.dateOfBirth}
              autoComplete="bday"
            />
            {ageError && (
              <p className="mt-1 text-sm" style={{ color: 'var(--color-destructive)' }} role="alert">
                {ageError}
              </p>
            )}
          </div>
          <GlassSimpleSelect
            label="Gender"
            data-testid="portal-gender-select"
            value={form.gender}
            onChange={(v) => setField('gender', v as CustomerContactData['gender'])}
            options={['M', 'F', 'Other']}
            error={errors.gender}
            required
          />
          <GlassSimpleSelect
            label="Nationality"
            data-testid="portal-nationality-select"
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
      <GlassCard padding="md">
        <SectionHeading>Passport / ID</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Passport Number *"
            placeholder="e.g. AB1234567"
            value={form.passportNumber}
            onChange={(e) => setField('passportNumber', e.target.value)}
            error={errors.passportNumber}
          />
          <GlassSimpleSelect
            label="Issuing Country"
            data-testid="portal-issuing-country-select"
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
      <GlassCard padding="md">
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
        <GlassCard padding="md">
          <SectionHeading>Diving Certification</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassSimpleSelect
              label="Certifying Agency"
              value={form.agency ?? ''}
              onChange={(v) => setField('agency', v)}
              options={DIVE_AGENCIES}
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
      <GlassCard padding="md">
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
