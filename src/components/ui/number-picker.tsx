'use client'

import { useMemo } from 'react'
import { SimpleSelect } from '@/components/ui/simple-select'
import { resolveFieldWidth } from '@/lib/utils/field-width'
import { parseOptionalNumber } from '@/lib/utils/numbers'

interface NumberPickerProps {
  label?: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  onBlur?: () => void
  min: number
  max: number
  step?: number
  decimals?: number
  suffix?: string
  required?: boolean
  error?: string
  disabled?: boolean
  placeholder?: string
  className?: string
  'aria-label'?: string
  'data-testid'?: string
}

export function NumberPicker({
  label,
  value,
  onChange,
  onBlur,
  min,
  max,
  step = 1,
  decimals = 0,
  suffix = '',
  required,
  error,
  disabled,
  placeholder,
  className,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: NumberPickerProps) {
  const options = useMemo(() => {
    const out: { value: string; label: string }[] = []
    const totalSteps = Math.round((max - min) / step)
    for (let i = 0; i <= totalSteps; i++) {
      const n = Number((min + i * step).toFixed(decimals))
      const formatted = decimals > 0 ? n.toFixed(decimals) : String(n)
      out.push({
        value: String(n),
        label: suffix ? `${formatted}${suffix}` : formatted,
      })
    }
    return out
  }, [min, max, step, decimals, suffix])

  return (
    <SimpleSelect
      label={label}
      value={value !== undefined ? String(value) : ''}
      onChange={(v) => onChange(parseOptionalNumber(v))}
      onBlur={onBlur}
      options={options}
      required={required}
      error={error}
      disabled={disabled}
      placeholder={placeholder}
      className={resolveFieldWidth('field-xs', className)}
      aria-label={ariaLabel}
      data-testid={testId}
    />
  )
}
