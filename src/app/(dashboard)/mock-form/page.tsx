'use client' /* design-ok */

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

function FloatingUnderlineInput({ /* design-ok */
  label,
  value,
  onChange,
  required,
  type = 'text',
  inputMode,
  className,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  type?: string
  inputMode?: 'tel' | 'email' | 'numeric'
  className?: string
  error?: string
}) {
  const [focused, setFocused] = useState(false)
  const filled = value.length > 0
  const floated = focused || filled

  return (
    <div className={cn('relative', className)}>
      <input /* design-ok */
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full text-body text-primary pt-4 pb-1.5 px-0 bg-transparent border-0 border-b outline-none"
        style={{ /* design-ok */
          caretColor: 'var(--color-accent)',
          borderBottomColor: error
            ? 'var(--color-destructive)'
            : focused
              ? 'var(--color-primary)'
              : 'var(--color-field-underline, var(--color-glass-border))',
          borderBottomWidth: focused || error ? '2px' : '1px',
          borderRadius: 0,
        }}
        placeholder=" "
        aria-invalid={!!error}
      />
      <label
        className={cn(
          'absolute left-0 transition-all pointer-events-none',
          floated
            ? cn('top-0 text-[10px] font-medium', focused ? 'text-primary' : 'text-secondary')
            : 'top-3 text-body text-secondary',
        )}
        style={{ transitionDuration: 'var(--transition-speed)' }} /* design-ok */
      >
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
      {error && (
        <p className="mt-1 text-[11px] text-destructive truncate">{error}</p> /* design-ok */
      )}
    </div>
  )
}

function FloatingUnderlineSelect({ /* design-ok */
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  const [focused, setFocused] = useState(false)
  const filled = value.length > 0
  const floated = focused || filled

  return (
    <div className={cn('relative', className)}>
      <select /* design-ok */
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full text-body text-primary appearance-none pt-4 pb-1.5 px-0 bg-transparent border-0 border-b outline-none"
        style={{ /* design-ok */
          borderBottomColor: focused
            ? 'var(--color-primary)'
            : 'var(--color-field-underline, var(--color-glass-border))',
          borderBottomWidth: focused ? '2px' : '1px',
          borderRadius: 0,
        }}
      >
        <option value="" disabled />
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <label
        className={cn(
          'absolute left-0 transition-all pointer-events-none',
          floated
            ? 'top-0 text-[10px] font-medium text-secondary'
            : 'top-3 text-body text-secondary',
        )}
        style={{ transitionDuration: 'var(--transition-speed)' }} /* design-ok */
      >
        {label}
      </label>
      <span className="absolute right-0 top-3.5 pointer-events-none text-secondary">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </span>
    </div>
  )
}

export default function MockFormPage() { /* comments-ok */
  const [form, setForm] = useState({
    firstName: 'Somchai',
    lastName: 'Prasert',
    nickname: '',
    phone: '+66-81-234-5001',
    email: 'hug-ocean+clerk_test@divedispatch.dev',
    dobMonth: '',
    dobDay: '',
    dobYear: '',
  })

  const set = (field: string) => (v: string) =>
    setForm((prev) => ({ ...prev, [field]: v }))

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i).toLocaleString(undefined, { month: 'long' }),
  }))

  const days = Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }))

  const years = Array.from({ length: 80 }, (_, i) => ({
    value: String(2008 - i),
    label: String(2008 - i),
  }))

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-28" /* design-ok */
      style={{ /* design-ok */
        '--color-field-underline': 'var(--color-glass-border)',
      } as React.CSSProperties}
    >
      <h1
        className="text-primary font-bold mb-8"
        style={{ fontSize: 'var(--font-size-page-title)' }} /* design-ok */
      >
        Profile (Mock)
      </h1>

      <div className="space-y-6">
        <section>
          <div className="grid grid-cols-6 gap-x-3 gap-y-4"> {/* design-ok */}
            <FloatingUnderlineInput label="First name" value={form.firstName} onChange={set('firstName')} required className="col-span-3" />
            <FloatingUnderlineInput label="Last name" value={form.lastName} onChange={set('lastName')} required className="col-span-3" />
            <FloatingUnderlineInput label="Nickname" value={form.nickname} onChange={set('nickname')} className="col-span-3" />
            <FloatingUnderlineInput label="Phone" value={form.phone} onChange={set('phone')} type="tel" inputMode="tel" required className="col-span-3" />
            <FloatingUnderlineInput label="Email" value={form.email} onChange={set('email')} type="email" inputMode="email" required className="col-span-6" />
          </div>
        </section>

        <section>
          <p className="text-[10px] font-medium text-secondary mb-1"
            style={{ letterSpacing: '0.02em' }} /* design-ok */
          >Date of birth</p>
          <div className="grid grid-cols-3 gap-3"> {/* design-ok */}
            <FloatingUnderlineSelect label="Month" value={form.dobMonth} onChange={set('dobMonth')} options={months} />
            <FloatingUnderlineSelect label="Day" value={form.dobDay} onChange={set('dobDay')} options={days} />
            <FloatingUnderlineSelect label="Year" value={form.dobYear} onChange={set('dobYear')} options={years} />
          </div>
        </section>

        <section>
          <div className="grid grid-cols-2 gap-3"> {/* design-ok */}
            <button /* design-ok */
              type="button"
              className="py-3 text-body font-medium text-secondary rounded-[var(--border-radius-button)]"
              style={{ /* design-ok */
                background: 'transparent',
                border: '1px solid var(--color-glass-border)',
              }}
            >
              Cancel
            </button>
            <button /* design-ok */
              type="button"
              className="py-3 text-body font-medium rounded-[var(--border-radius-button)]"
              style={{ /* design-ok */
                color: 'var(--color-text-on-primary)',
                background: 'var(--color-primary)',
              }}
            >
              Save
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
