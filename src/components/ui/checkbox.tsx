import { RequiredAsterisk } from '@/components/ui/required-asterisk'

interface CheckboxProps {
  label: string | React.ReactNode
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  required?: boolean
  className?: string
  as?: 'checkbox' | 'radio'
  name?: string
  value?: string
  variant?: 'default' | 'card'
}

export function Checkbox({
  label,
  description,
  checked,
  onChange,
  disabled,
  required,
  className,
  as = 'checkbox',
  name,
  value,
  variant = 'default',
}: CheckboxProps) {
  const inputType = as === 'radio' ? 'radio' : 'checkbox'
  const shape = as === 'radio' ? 'rounded-full' : 'rounded-[var(--border-radius-button)]'

  if (variant === 'card') {
    return (
      <label
        className={`flex items-start gap-3 cursor-pointer select-none p-3 rounded-theme transition-colors duration-theme text-body text-primary${disabled ? ' opacity-50 cursor-not-allowed' : ''}${className ? ` ${className}` : ''}`}
        style={{
          background: checked ? 'var(--color-glass-bg-elevated)' : 'transparent',
          border: `1px solid ${checked ? 'var(--color-primary)' : 'transparent'}`,
        }}
      >
        <input
          type={inputType}
          name={name}
          value={value}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className={`${shape} mt-0.5 focus-visible:ring-2 focus-visible:ring-[var(--color-primary-glow)]`}
          style={{ accentColor: 'var(--color-primary)' }}
        />
        <div className="min-w-0">
          <p className="text-body font-medium text-primary">
            {label}
            {required && <RequiredAsterisk />}
          </p>
          {description && (
            <p className="text-label mt-0.5 text-secondary">{description}</p>
          )}
        </div>
      </label>
    )
  }

  return (
    <label
      className={`flex items-center gap-2 cursor-pointer select-none text-body text-primary reading-plane rounded-theme p-2${disabled ? ' opacity-50 cursor-not-allowed' : ''}${className ? ` ${className}` : ''}`}
    >
      <input
        type={inputType}
        name={name}
        value={value}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        required={required}
        className={`${shape} focus-visible:ring-2 focus-visible:ring-[var(--color-primary-glow)]`}
        style={{ accentColor: 'var(--color-primary)' }}
      />
      <span>
        {label}
        {required && <RequiredAsterisk />}
      </span>
    </label>
  )
}
