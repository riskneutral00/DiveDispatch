'use client'

import { Lock } from 'lucide-react'
import { PillToggleGroup } from '@/components/common/pill-toggle'
import { AGENCIES, getMandatorySpecialties } from '@/lib/constants/agencies'

interface SpecialtyFieldProps {
  agencyCode: string
  value: string[]
  onChange: (specialties: string[]) => void
  disabled?: boolean
}

export function SpecialtyField({
  agencyCode,
  value,
  onChange,
  disabled,
}: SpecialtyFieldProps) {
  const agency = AGENCIES[agencyCode]
  const specialties = agency?.specialties ?? AGENCIES.PADI.specialties
  const mandatory = getMandatorySpecialties(agencyCode || 'PADI')
  const requiredCount = agency?.specialtyCount ?? 5
  const atMax = value.length >= requiredCount

  function toggle(code: string) {
    if (mandatory.has(code)) return
    if (value.includes(code)) {
      onChange(value.filter((s) => s !== code))
    } else {
      if (atMax) return
      onChange([...value, code])
    }
  }

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      <p
        className="text-sm font-medium"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Default Specialties<span style={{ color: 'var(--color-destructive)' }}> *</span>
        <span className="ml-2 text-[10px] opacity-70">{value.length} / {requiredCount}</span>
      </p>
      <PillToggleGroup
        overflowItems={specialties.length > 6 ? (
          <>
            {specialties.slice(6).map(({ code, label, mandatory: isMandatory }) => (
              <SpecialtyPill
                key={code}
                label={label}
                checked={value.includes(code)}
                locked={isMandatory || mandatory.has(code)}
                disabled={disabled || (!value.includes(code) && atMax)}
                onToggle={() => toggle(code)}
              />
            ))}
          </>
        ) : undefined}
      >
        {specialties.slice(0, 6).map(({ code, label, mandatory: isMandatory }) => (
          <SpecialtyPill
            key={code}
            label={label}
            checked={value.includes(code)}
            locked={isMandatory || mandatory.has(code)}
            disabled={disabled || (!value.includes(code) && atMax)}
            onToggle={() => toggle(code)}
          />
        ))}
      </PillToggleGroup>
    </div>
  )
}

interface SpecialtyPillProps {
  label: string
  checked: boolean
  locked?: boolean
  disabled?: boolean
  onToggle: () => void
}

function SpecialtyPill({ label, checked, locked, disabled, onToggle }: SpecialtyPillProps) {
  return (
    <label
      className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium transition-all ${locked ? 'cursor-default' : disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      style={{
        background: checked ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
        color: checked ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
        border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-glass-border)'}`,
        opacity: disabled && !checked ? 0.4 : 1,
        transitionDuration: 'var(--transition-speed)',
      }}
      aria-disabled={locked || disabled || undefined}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={locked || disabled}
        onChange={onToggle}
      />
      {label}
      {locked && <Lock size={10} style={{ opacity: 0.7 }} />}
    </label>
  )
}
