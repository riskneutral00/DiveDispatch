'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ErrorAlert } from '@/components/ui/error-alert'
import { InlineError } from '@/components/ui/inline-error'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DEFAULT_TEXTAREA_ROWS } from '@/lib/constants/form-config'
import { COUNTRY_NAMES } from '@/lib/constants/countries'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Textarea } from '@/components/ui/textarea'
import { toISODateString } from '@/lib/utils/date'
import { makeCustomerContactSchema, useFormValidation } from '@/lib/validation'
import type { CustomerContactData } from '@/lib/validation'
import { CERT_REQUIRED_ACTIVITIES, getMinAge, calcAgeAtDate, isPassportExpiringSoon } from '@/lib/constants/activity-rules'
import { usePortalContact } from '@/lib/hooks/use-portal-contact'
import { usePortalStep } from '@/lib/hooks/use-portal-step'
import { useReturningCustomer } from '@/lib/hooks/use-returning-customer'
import type { CourseCode } from '@/lib/constants/course-catalog'
import { DIVE_AGENCIES } from '@/lib/constants/agencies'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'
import { PortalStepShell } from '@/components/portal/portal-step-shell'

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


import { FormSectionHeader } from '@/components/ui/form-section-header'

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <FormSectionHeader label={children} />
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
  const t = useTranslations('portal')
  const [form, setFormState] = useState<CustomerContactData>(defaultForm())
  const [ageError, setAgeError] = useState<string | null>(null)
  const {
    serverError,
    clearServerError,
    handleMutationError,
    submitting,
    setSubmitting,
  } = usePortalStep()

  // Returning customer dedup
  const [returningDismissedLocal, setReturningDismissedLocal] = useState(false)

  const returningEmail =
    form.email && form.email.includes('@') && !returningDismissedLocal
      ? form.email
      : null

  const { context, save, checkReturning } = usePortalContact({
    token,
    returningEmail,
  })

  const {
    returningCustomer,
    returningConfirmed,
    confirm: confirmReturningCustomer,
    dismiss: dismissReturningCustomerHook,
    showBanner: showReturningBanner,
  } = useReturningCustomer(checkReturning, (data) => {
    // Pre-fill everything except medical/waiver
    setFormState((prev) => ({
      ...prev,
      legalFirstName: data.legalFirstName,
      legalLastName: data.legalLastName,
      preferredName: data.preferredName ?? '',
      email: data.email,
      phone: data.phone,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      nationality: data.nationality,
      passportNumber: data.passportNumber,
      passportIssuingCountry: data.passportIssuingCountry,
      passportExpirationDate: data.passportExpirationDate,
      emergencyContactName: data.emergencyContactName,
      emergencyContactPhone: data.emergencyContactPhone,
      emergencyContactRelation: data.emergencyContactRelation,
      agency: data.agency ?? '',
      agencyID: data.agencyID ?? '',
      allergies: data.allergies ?? '',
    }))
  })

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

  function dismissReturningCustomer() {
    setReturningDismissedLocal(true)
    dismissReturningCustomerHook()
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
    clearServerError()
    setAgeError(null)

    const result = validate(form)
    if (!result.success || !result.data) return

    const validated = result.data

    // Age check: diver must meet minimum age for their activity types
    if (validated.dateOfBirth && context?.activityType?.length) {
      const refDate = bookingStartDate ?? toISODateString(new Date())
      const age = calcAgeAtDate(validated.dateOfBirth, refDate)
      const minAge = getMinAge(context.activityType as CourseCode[])
      if (age < minAge) {
        setAgeError(t('ageError', { minAge, age }))
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
      handleMutationError(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (context === undefined) {
    return <FullPageSpinner />
  }

  if (context === null) {
    return (
      <Card padding="lg">
        <InlineError centered>{t('tokenExpired')}</InlineError>
      </Card>
    )
  }

  const passportExpiringSoon = isPassportExpiringSoon(
    form.passportExpirationDate,
    bookingStartDate,
  )

  return (
    <PortalStepShell
      serverError={serverError}
      onSubmit={handleSubmit}
      continueType="submit"
      submitting={submitting}
    >
      {/* Returning customer banner */}
      {showReturningBanner && returningCustomer && (
        <Card padding="md">
          <div className="flex flex-col gap-3">
            <p className="text-body font-medium text-primary">
              {t('returnBanner')}
            </p>
            <p className="text-body text-secondary">
              {returningCustomer.legalFirstName} {returningCustomer.legalLastName} ({returningCustomer.email})
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="primary" size="sm" onClick={confirmReturningCustomer}>
                {"That's me"}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={dismissReturningCustomer}>
                {"Not me"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {returningConfirmed && (
        <p className="text-body px-1" style={{ color: 'var(--color-success)' }}>
          {t('returnLoaded')}
        </p>
      )}

      {/* Personal Details */}
      <Card padding="md">
        <SectionHeading>{"Personal Details"}</SectionHeading>
        <div className="flex flex-wrap gap-4">
          <Input
            label="Legal First Name"
            placeholder="As on passport"
            value={form.legalFirstName}
            onChange={(e) => setField('legalFirstName', e.target.value)}
            error={errors.legalFirstName}
            autoComplete="given-name"
            className="field-name"
          />
          <Input
            label="Legal Last Name"
            placeholder="As on passport"
            value={form.legalLastName}
            onChange={(e) => setField('legalLastName', e.target.value)}
            error={errors.legalLastName}
            autoComplete="family-name"
            className="field-name"
          />
          <Input
            label="Preferred Name"
            placeholder="Nickname or preferred name"
            value={form.preferredName ?? ''}
            onChange={(e) => setField('preferredName', e.target.value)}
            error={errors.preferredName}
            autoComplete="nickname"
            className="field-text-short"
          />
          <Input
            label="Phone"
            type="tel"
            placeholder="+66 81 234 5678"
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            error={errors.phone}
            helperText="Include country code (+66, +1)"
            autoComplete="tel"
            className="field-phone"
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            error={errors.email}
            autoComplete="email"
            className="field-email"
          />
          <div className="field-date">
            <Input
              label="Date of Birth"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setField('dateOfBirth', e.target.value)}
              error={errors.dateOfBirth}
              autoComplete="bday"
            />
            <div aria-live="polite">
              {ageError && (
                <ErrorAlert>{ageError}</ErrorAlert>
              )}
            </div>
          </div>
          <SimpleSelect
            label="Gender"
            data-testid="portal-gender-select"
            value={form.gender}
            onChange={(v) => setField('gender', v as CustomerContactData['gender'])}
            options={['M', 'F', 'Other']}
            error={errors.gender}
            required
            className="field-select-short"
          />
          <SimpleSelect
            label="Nationality"
            data-testid="portal-nationality-select"
            value={form.nationality}
            onChange={(v) => setField('nationality', v)}
            options={COUNTRY_NAMES}
            placeholder="Select…"
            error={errors.nationality}
            required
            className="field-select-long"
          />
        </div>
      </Card>

      {/* Passport / ID */}
      <Card padding="md">
        <SectionHeading>{"Passport / ID"}</SectionHeading>
        <div className="flex flex-wrap gap-4">
          <Input
            label="Passport Number"
            placeholder="AB1234567"
            value={form.passportNumber}
            onChange={(e) => setField('passportNumber', e.target.value)}
            error={errors.passportNumber}
            className="field-text-short"
          />
          <SimpleSelect
            label="Issuing Country"
            data-testid="portal-issuing-country-select"
            value={form.passportIssuingCountry}
            onChange={(v) => setField('passportIssuingCountry', v)}
            options={COUNTRY_NAMES}
            placeholder="Select…"
            error={errors.passportIssuingCountry}
            required
            className="field-select-long"
          />
          <div className="field-date">
            <Input
              label="Expiry Date"
              type="date"
              value={form.passportExpirationDate}
              onChange={(e) => setField('passportExpirationDate', e.target.value)}
              error={errors.passportExpirationDate}
            />
            {passportExpiringSoon && !errors.passportExpirationDate && (
              <ErrorAlert variant="warning" iconSize={16} className="mt-2">
                {t('passportExpiryWarning')}
              </ErrorAlert>
            )}
          </div>
        </div>
      </Card>

      {/* Emergency Contact */}
      <Card padding="md">
        <SectionHeading>{"Emergency Contact"}</SectionHeading>
        <div className="flex flex-wrap gap-4">
          <Input
            label="Full Name"
            placeholder="Full name"
            value={form.emergencyContactName}
            onChange={(e) => setField('emergencyContactName', e.target.value)}
            error={errors.emergencyContactName}
            autoComplete="off"
            className="field-name"
          />
          <Input
            label="Phone"
            type="tel"
            placeholder="+66 81 234 5678"
            value={form.emergencyContactPhone}
            onChange={(e) => setField('emergencyContactPhone', e.target.value)}
            error={errors.emergencyContactPhone}
            helperText="Include country code (+66, +1)"
            className="field-phone"
          />
          <Input
            label="Relationship"
            placeholder="Spouse, parent, partner"
            value={form.emergencyContactRelation}
            onChange={(e) => setField('emergencyContactRelation', e.target.value)}
            error={errors.emergencyContactRelation}
            className="field-text-short"
          />
        </div>
      </Card>

      {/* Diving Certification (conditional) */}
      {requiresCert && (
        <Card padding="md">
          <SectionHeading>{"Diving Certification"}</SectionHeading>
          <div className="flex flex-wrap gap-4">
            <SimpleSelect
              label="Certifying Agency"
              value={form.agency ?? ''}
              onChange={(v) => setField('agency', v)}
              options={DIVE_AGENCIES}
              placeholder="Select…"
              error={errors.agency}
              required
              className="field-select-short"
            />
            <Input
              label="Diver ID"
              className="field-text-short"
              placeholder="12345678"
              value={form.agencyID ?? ''}
              onChange={(e) => setField('agencyID', e.target.value)}
              error={errors.agencyID}
            />
          </div>
        </Card>
      )}

      {/* Health Information */}
      <Card padding="md">
        <SectionHeading>{"Health Information"}</SectionHeading>
        <Textarea
          label="Known Allergies"
          rows={DEFAULT_TEXTAREA_ROWS}
          placeholder="List allergies, or leave blank"
          value={form.allergies ?? ''}
          onChange={(e) => setField('allergies', e.target.value)}
        />
      </Card>

    </PortalStepShell>
  )
}
