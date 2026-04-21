'use client'

import { useId, useState, type ComponentType } from 'react'
import PhoneInputWithCountrySelect from 'react-phone-number-input/core'
import enLabels from 'react-phone-number-input/locale/en.json'
import metadata from 'libphonenumber-js/metadata.min.json'
import { getCountryCallingCode } from 'libphonenumber-js/min'
import { FieldError } from '@/components/ui/field-shell'
import { RequiredAsterisk } from '@/components/ui/required-asterisk'
import { FlagEmoji, countryCodeToEmoji } from '@/components/ui/flag-emoji'
import { useFloatingLabel } from '@/lib/hooks/use-floating-label'
import { detectDefaultCountryFromLocale } from '@/lib/constants/i18n'
import { cn } from '@/lib/utils/cn'

type CountryCode = string

interface PhoneFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  error?: string
  helperText?: string
  disabled?: boolean
  className?: string
  id?: string
  defaultCountry?: CountryCode
}

export function PhoneField({
  label,
  value,
  onChange,
  required,
  error,
  helperText,
  disabled,
  className,
  id: externalId,
  defaultCountry,
}: PhoneFieldProps) {
  const generatedId = useId()
  const id = externalId ?? generatedId
  const [focused, setFocused] = useState(false)
  const { floated: baseFloated } = useFloatingLabel({ value, focused, required })
  const floated = baseFloated || focused

  const resolvedDefaultCountry = defaultCountry || detectDefaultCountry()
  const normalizedValue = normalizeE164(value)

  return (
    <div
      className={cn(
        'relative',
        className?.includes('field-') ||
          className?.includes('w-') ||
          className?.includes('col-span')
          ? ''
          : 'w-full',
        className,
      )}
    >
      <PhoneInputWithCountrySelect
        id={id}
        value={normalizedValue as string}
        onChange={(v) => onChange((v as string) ?? '')}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        defaultCountry={resolvedDefaultCountry as never}
        displayInitialValueAsLocalNumber
        metadata={metadata as never}
        labels={enLabels}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${id}-error` : helperText ? `${id}-helper` : undefined
        }
        flagComponent={FlagComponent}
        countrySelectComponent={PhoneCountrySelect}
        className={cn(
          'field-underline flex items-center gap-2 w-full text-body text-primary',
          label ? 'pt-4 pb-1.5' : 'py-2.5',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
        style={{
          /* design-ok */
          caretColor: 'var(--color-accent)',
          ...(error ? { borderBottomColor: 'var(--color-destructive)' } : {}),
          ...(focused && !error
            ? {
                borderBottomColor: 'var(--color-primary)',
                borderBottomWidth: '2px',
              }
            : {}),
        }}
        numberInputProps={{
          className:
            'flex-1 min-w-0 bg-transparent border-0 outline-none text-body text-primary',
          autoComplete: 'tel',
          inputMode: 'tel',
        }}
      />

      {label && (
        <label
          htmlFor={id}
          className={cn(
            'absolute pointer-events-none transition-all duration-theme',
            floated
              ? cn(
                  'top-0 left-0 text-[10px] font-medium label-float-in',
                  focused ? 'text-primary' : 'text-secondary',
                )
              : 'top-3 left-[5.5rem] text-body text-secondary',
          )}
        >
          {label}
          {required && <RequiredAsterisk />}
        </label>
      )}

      {error && <FieldError id={`${id}-error`} message={error} />}
      {!error && helperText && (
        <p
          id={`${id}-helper`}
          className="text-body text-secondary truncate"
        >
          {helperText}
        </p>
      )}
    </div>
  )
}

type CountryOption = {
  value?: string
  label: string
  divider?: boolean
}

interface PhoneCountrySelectProps {
  value?: string
  onChange: (value: string | undefined) => void
  options: readonly CountryOption[]
  onFocus?: (event: React.FocusEvent<HTMLElement>) => void
  onBlur?: (event: React.FocusEvent<HTMLElement>) => void
  disabled?: boolean
  readOnly?: boolean
  name?: string
  'aria-label'?: string
  iconComponent?: ComponentType<{ country?: string; label?: string }>
}

function PhoneCountrySelect({
  value,
  onChange,
  options,
  onFocus,
  onBlur,
  disabled,
  readOnly,
  name,
  'aria-label': ariaLabel,
  iconComponent: Icon,
}: PhoneCountrySelectProps) {
  const dialCode = safeCallingCode(value)
  const selectedLabel = value
    ? options.find((opt) => opt.value === value)?.label ?? value
    : enLabels.country

  return (
    <div className="relative flex items-center gap-1 shrink-0 w-[4.5rem]">
      <span className="text-base leading-none" aria-hidden>
        {value ? (
          <FlagEmoji countryCode={value} label={selectedLabel} />
        ) : Icon ? (
          <Icon country={value} label={selectedLabel} />
        ) : (
          <span>🌐</span>
        )}
      </span>
      <span className="text-body text-primary tabular-nums">
        {dialCode ? `+${dialCode}` : ''}
      </span>
      <svg
        aria-hidden
        width="10"
        height="10"
        viewBox="0 0 12 12"
        className="text-secondary shrink-0"
      >
        <path
          d="M3 4.5L6 7.5L9 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <select
        /* design-ok */
        name={name}
        value={value || 'ZZ'}
        onChange={(e) => {
          const next = e.target.value
          onChange(next === 'ZZ' ? undefined : next)
        }}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={disabled || readOnly}
        aria-label={ariaLabel ?? enLabels.country}
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        {options.map((opt) => {
          if (opt.divider) {
            return (
              <option key="|" disabled>
                —
              </option>
            )
          }
          const code = opt.value
          const emoji = code ? countryCodeToEmoji(code) : '🌐'
          const dial = code ? safeCallingCode(code) : ''
          const dialSuffix = dial ? ` +${dial}` : ''
          return (
            <option key={code || 'ZZ'} value={code || 'ZZ'}>
              {`${emoji} ${opt.label}${dialSuffix}`}
            </option>
          )
        })}
      </select>
    </div>
  )
}

function FlagComponent({
  country,
  countryName,
}: {
  country: string
  countryName: string
}) {
  return (
    <FlagEmoji
      countryCode={country}
      label={countryName}
      className="text-base leading-none"
    />
  )
}

function normalizeE164(raw: string | undefined): string {
  if (!raw) return ''
  const cleaned = raw.replace(/[^\d+]/g, '')
  if (!cleaned) return ''
  const digitsOnly = cleaned.replace(/\++/g, '').replace(/^\+?/, '')
  if (!digitsOnly) return ''
  return `+${digitsOnly}`
}

function safeCallingCode(country: string | undefined): string {
  if (!country) return ''
  try {
    return getCountryCallingCode(country as never) as string
  } catch {
    return ''
  }
}

function detectDefaultCountry(): string {
  if (typeof navigator === 'undefined') return 'TH'
  return detectDefaultCountryFromLocale(navigator.language)
}
