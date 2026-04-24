'use client'

import { useMemo } from 'react'
import { useLocale } from 'next-intl'
import { SimpleSelect } from '@/components/ui/simple-select'
import { listCountries } from '@/lib/utils/countries'
import { resolveFieldWidth } from '@/lib/utils/field-width'

interface CountryFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  error?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  locale?: string
}

export function CountryField({
  label,
  value,
  onChange,
  required,
  error,
  placeholder,
  disabled,
  className,
  locale,
}: CountryFieldProps) {
  const activeLocale = useLocale()
  const resolvedLocale = locale || activeLocale

  const options = useMemo(() => {
    const list = listCountries(resolvedLocale)
    return list.map((c) => ({
      value: c.code,
      label: `${c.flag} ${c.name}`,
    }))
  }, [resolvedLocale])

  return (
    <SimpleSelect
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      required={required}
      error={error}
      placeholder={placeholder}
      disabled={disabled}
      className={resolveFieldWidth('field-md', className)}
    />
  )
}
