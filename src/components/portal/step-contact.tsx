'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ErrorAlert } from '@/components/ui/error-alert'
import { InlineError } from '@/components/ui/inline-error'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NameField } from '@/components/ui/name-field'
import { EmailField } from '@/components/ui/email-field'
import { PhoneField } from '@/components/ui/phone-field'
import { DateField } from '@/components/ui/date-field'
import { BirthdayField } from '@/components/ui/birthday-field'
import { CountryField } from '@/components/ui/country-field'
import { DEFAULT_TEXTAREA_ROWS } from '@/lib/constants/form-config'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Textarea } from '@/components/ui/textarea'
import { LanguageField } from '@/components/ui/language-field'
import { FieldRow } from '@/components/ui/field-row'
import { toISODateString } from '@/lib/utils/date'
import { makeCustomerContactSchema, useFormValidation } from '@/lib/validation'
import type { CustomerContactData } from '@/lib/validation'
import { languageToCode, findLanguageByCode } from '@/lib/constants/dive-languages'
import type { Language } from '@/lib/types/language'
import { CERT_REQUIRED_ACTIVITIES, getMinAge, calcAgeAtDate, isPassportExpiringSoon } from '@/lib/constants/activity-rules'
import { usePortalContact } from '@/lib/hooks/use-portal-contact'
import { usePortalStep } from '@/lib/hooks/use-portal-step'
import { useReturningCustomer } from '@/lib/hooks/use-returning-customer'
import type { CourseCode } from '@/lib/constants/course-catalog'
import { DIVE_AGENCIES } from '@/lib/constants/agencies'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'
import { PortalStepShell } from '@/components/portal/portal-step-shell'
import { FormSectionHeader } from '@/components/ui/form-section-header'

function defaultLanguageFromBrowser(): Language[] {
  const raw =
    typeof navigator !== 'undefined' && navigator.language
      ? navigator.language
      : 'en'
  const code = languageToCode(raw) || 'en-GB'
  const match = findLanguageByCode(code)
  if (!match) return []
  return [{ code: match.code, label: match.label }]
}

function languagesFromCodes(codes: string[] | undefined): Language[] {
  if (!codes) return []
  return codes
    .map((c) => findLanguageByCode(c))
    .filter((l): l is NonNullable<typeof l> => Boolean(l))
    .map((l) => ({ code: l.code, label: l.label }))
}

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
  languages: defaultLanguageFromBrowser(),
})

interface StepContactProps {
  token: string
  onComplete: () => void
  bookingStartDate?: string
}

export function StepContact({ token, onComplete, bookingStartDate }: StepContactProps) {
  const t = useTranslations('portal')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const [form, setFormState] = useState<CustomerContactData>(defaultForm())
  const [ageError, setAgeError] = useState<string | null>(null)
  const {
    serverError,
    clearServerError,
    handleMutationError,
    submitting,
    setSubmitting,
  } = usePortalStep(tErrors)

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
      languages:
        data.languages && data.languages.length > 0
          ? languagesFromCodes(data.languages)
          : prev.languages,
    }))
  })

  const activityTypeKey = (context?.activityType ?? []).join(',')
  const schema = useMemo(
    () => makeCustomerContactSchema(context?.activityType ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- comments-ok keyed on joined activityType
    [activityTypeKey],
  )
  const { validate, errors, clearError } = useFormValidation(schema)

  useEffect(() => {
    if (!context) return
    if (context.customer) {
      const c = context.customer
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- comments-ok loads async portal context into form state on first arrival */
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
        languages:
          c.languages && c.languages.length > 0
            ? languagesFromCodes(c.languages)
            : defaultLanguageFromBrowser(),
      })
    } else {
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
        languages: validated.languages.map((l) => l.code),
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
    return <ErrorAlert>{t('tokenExpired')}</ErrorAlert>
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
                {t('thatsMe')}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={dismissReturningCustomer}>
                {t('notMe')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {returningConfirmed && (
        <p className="text-body px-1 text-success">
          {t('returnLoaded')}
        </p>
      )}

      <Card padding="md">
        <FormSectionHeader label={t('sectionPersonalDetails')} />
        <FieldRow>
          <NameField
            scope="given"
            label={t('legalFirstName')}
            placeholder={t('placeholderPassport')}
            value={form.legalFirstName}
            onChange={(v) => setField('legalFirstName', v)}
            error={errors.legalFirstName}
          />
          <NameField
            scope="family"
            label={t('legalLastName')}
            placeholder={t('placeholderPassport')}
            value={form.legalLastName}
            onChange={(v) => setField('legalLastName', v)}
            error={errors.legalLastName}
          />
          <NameField
            scope="nickname"
            label={t('preferredName')}
            placeholder={t('placeholderNickname')}
            value={form.preferredName ?? ''}
            onChange={(v) => setField('preferredName', v)}
            error={errors.preferredName}
          />
          <PhoneField
            label={t('phone')}
            value={form.phone}
            onChange={(v) => setField('phone', v)}
            error={errors.phone}
            helperText={t('helperCountryCode')}
          />
          <EmailField
            label={t('email')}
            placeholder={t('placeholderEmail')}
            value={form.email}
            onChange={(v) => setField('email', v)}
            error={errors.email}
          />
          <div className="field-md">
            <BirthdayField
              label={t('dateOfBirth')}
              value={form.dateOfBirth || null}
              onChange={(v) => setField('dateOfBirth', v ?? '')}
              error={errors.dateOfBirth}
            />
            <div aria-live="polite">
              {ageError && (
                <ErrorAlert>{ageError}</ErrorAlert>
              )}
            </div>
          </div>
          <SimpleSelect
            label={t('gender')}
            data-testid="portal-gender-select"
            value={form.gender}
            onChange={(v) => setField('gender', v as CustomerContactData['gender'])}
            options={['M', 'F', 'Other']}
            error={errors.gender}
            required
            className="field-sm"
          />
          <CountryField
            label={t('nationality')}
            value={form.nationality}
            onChange={(v) => setField('nationality', v)}
            placeholder={t('placeholderSelect')}
            error={errors.nationality}
            required
          />
        </FieldRow>
      </Card>

      <Card padding="md">
        <FormSectionHeader label={t('sectionLanguages')} />
        <LanguageField
          label={tCommon('customerLanguages')}
          required
          value={form.languages}
          onChange={(v) => setField('languages', v)}
        />
        {errors.languages && (
          <InlineError>{errors.languages}</InlineError>
        )}
      </Card>

      <Card padding="md">
        <FormSectionHeader label={t('sectionPassport')} />
        <FieldRow>
          <Input
            label={t('passportNumber')}
            placeholder={t('placeholderPassportNum')}
            value={form.passportNumber}
            onChange={(e) => setField('passportNumber', e.target.value)}
            error={errors.passportNumber}
            className="field-md"
          />
          <CountryField
            label={t('issuingCountry')}
            value={form.passportIssuingCountry}
            onChange={(v) => setField('passportIssuingCountry', v)}
            placeholder={t('placeholderSelect')}
            error={errors.passportIssuingCountry}
            required
          />
          <div className="field-md">
            <DateField
              label={t('expiryDate')}
              value={form.passportExpirationDate || null}
              onChange={(v) => setField('passportExpirationDate', v ?? '')}
              error={errors.passportExpirationDate}
              required
            />
            {passportExpiringSoon && !errors.passportExpirationDate && (
              <ErrorAlert variant="warning" iconSize={16} className="mt-2">
                {t('passportExpiryWarning')}
              </ErrorAlert>
            )}
          </div>
        </FieldRow>
      </Card>

      <Card padding="md">
        <FormSectionHeader label={t('sectionEmergency')} />
        <FieldRow>
          <NameField
            scope="given"
            label={t('fullName')}
            placeholder={t('placeholderFullName')}
            value={form.emergencyContactName}
            onChange={(v) => setField('emergencyContactName', v)}
            error={errors.emergencyContactName}
          />
          <PhoneField
            label={t('phone')}
            value={form.emergencyContactPhone}
            onChange={(v) => setField('emergencyContactPhone', v)}
            error={errors.emergencyContactPhone}
            helperText={t('helperCountryCode')}
          />
          <Input
            label={t('relationship')}
            placeholder={t('placeholderRelationship')}
            value={form.emergencyContactRelation}
            onChange={(e) => setField('emergencyContactRelation', e.target.value)}
            error={errors.emergencyContactRelation}
            className="field-md"
          />
        </FieldRow>
      </Card>

      {requiresCert && (
        <Card padding="md">
          <FormSectionHeader label={t('sectionCertification')} />
          <FieldRow>
            <SimpleSelect
              label={t('certifyingAgency')}
              value={form.agency ?? ''}
              onChange={(v) => setField('agency', v)}
              options={DIVE_AGENCIES}
              placeholder={t('placeholderSelect')}
              error={errors.agency}
              required
              className="field-sm"
            />
            <Input
              label={t('diverID')}
              className="field-md"
              placeholder={t('placeholderDiverID')}
              value={form.agencyID ?? ''}
              onChange={(e) => setField('agencyID', e.target.value)}
              error={errors.agencyID}
            />
          </FieldRow>
        </Card>
      )}

      <Card padding="md">
        <FormSectionHeader label={t('sectionHealth')} />
        <Textarea
          label={t('knownAllergies')}
          rows={DEFAULT_TEXTAREA_ROWS}
          placeholder={t('placeholderAllergies')}
          value={form.allergies ?? ''}
          onChange={(e) => setField('allergies', e.target.value)}
        />
      </Card>

    </PortalStepShell>
  )
}
