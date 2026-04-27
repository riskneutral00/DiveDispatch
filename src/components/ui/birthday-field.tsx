'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { SimpleSelect } from '@/components/ui/simple-select'
import { FieldError } from '@/components/ui/field-shell'
import { RequiredAsterisk } from '@/components/ui/required-asterisk'
import { MIN_AGE_YEARS, MIN_BIRTH_YEAR } from '@/lib/constants/age'
import { isValidISODate } from '@/lib/utils/date'
import { resolveFieldWidth } from '@/lib/utils/field-width'

interface BirthdayFieldProps {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  onBlur?: () => void
  required?: boolean
  error?: string
  helperText?: string
  disabled?: boolean
  className?: string
  id?: string
  minAge?: number
}

function daysInMonth(year: number, month: number): number {
  if (!year || !month) return 31
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function parts(value: string | null): { year: string; month: string; day: string } {
  if (!value || !isValidISODate(value)) {
    return { year: '', month: '', day: '' }
  }
  const [y, m, d] = value.split('-')
  return { year: y, month: m, day: d }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function BirthdayField({
  label,
  value,
  onChange,
  onBlur,
  required,
  error,
  helperText,
  disabled,
  className,
  id,
  minAge = MIN_AGE_YEARS,
}: BirthdayFieldProps) {
  const locale = useLocale()
  const tCommon = useTranslations('common')
  const generatedId = useId()
  const fieldsetId = id ?? generatedId

  const initial = parts(value)
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [day, setDay] = useState(initial.day)
  const lastEmittedRef = useRef<string | null>(value)

  useEffect(() => {
    if (value === lastEmittedRef.current) return
    const p = parts(value)
    setYear(p.year)
    setMonth(p.month)
    setDay(p.day)
    lastEmittedRef.current = value
  }, [value])

  const now = useMemo(() => new Date(), [])
  const maxYear = now.getUTCFullYear() - minAge

  const yearOptions = useMemo(() => {
    const out: string[] = []
    for (let y = maxYear; y >= MIN_BIRTH_YEAR; y--) out.push(String(y))
    return out
  }, [maxYear])

  const monthOptions = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }) // dry-ok: localized short month names not covered by canonical date helpers
    return Array.from({ length: 12 }, (_, i) => ({
      value: pad2(i + 1),
      label: fmt.format(new Date(Date.UTC(2000, i, 1))),
    }))
  }, [locale])

  const dayOptions = useMemo(() => {
    const count = daysInMonth(Number(year), Number(month))
    return Array.from({ length: count }, (_, i) => pad2(i + 1))
  }, [year, month])

  function pick(nextYear: string, nextMonth: string, nextDay: string) {
    const maxDay = daysInMonth(Number(nextYear), Number(nextMonth))
    const clampedDayNum = nextDay ? Math.min(Number(nextDay), maxDay) : 0
    const clampedDay = clampedDayNum ? pad2(clampedDayNum) : ''
    setYear(nextYear)
    setMonth(nextMonth)
    setDay(clampedDay)
    const iso =
      nextYear && nextMonth && clampedDay
        ? `${nextYear}-${nextMonth}-${clampedDay}`
        : null
    lastEmittedRef.current = iso
    onChange(iso)
  }

  return (
    <fieldset
      id={fieldsetId}
      className={resolveFieldWidth('field-md', className)}
      disabled={disabled}
      aria-invalid={!!error}
      onBlur={(e) => {
        if (!onBlur) return
        const next = e.relatedTarget as Node | null
        if (next && e.currentTarget.contains(next)) return
        onBlur()
      }}
    >
      <legend className="text-label text-secondary mb-1">
        {label}
        {required && <RequiredAsterisk />}
      </legend>
      <div className="flex gap-2 items-end">
        <div className="flex-1 min-w-0 basis-[96px]">
          <SimpleSelect
            label={tCommon('year')}
            value={year}
            onChange={(v) => pick(v, month, day)}
            options={yearOptions}
            disabled={disabled}
            aria-label={tCommon('year')}
            className="w-full"
          />
        </div>
        <div className="flex-1 min-w-0 basis-[72px]">
          <SimpleSelect
            label={tCommon('month')}
            value={month}
            onChange={(v) => pick(year, v, day)}
            options={monthOptions}
            disabled={disabled}
            aria-label={tCommon('month')}
            className="w-full"
          />
        </div>
        <div className="flex-1 min-w-0 basis-[56px]">
          <SimpleSelect
            label={tCommon('day')}
            value={day}
            onChange={(v) => pick(year, month, v)}
            options={dayOptions}
            disabled={disabled}
            aria-label={tCommon('day')}
            className="w-full"
          />
        </div>
      </div>
      {error && <FieldError id={`${fieldsetId}-error`} message={error} />}
      {!error && helperText && (
        <p id={`${fieldsetId}-helper`} className="text-body text-secondary truncate">
          {helperText}
        </p>
      )}
    </fieldset>
  )
}
