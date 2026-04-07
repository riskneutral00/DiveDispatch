interface CheckboxProps {
  label: string | React.ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function Checkbox({
  label,
  checked,
  onChange,
  disabled,
  className,
}: CheckboxProps) {
  return (
    <label
      className={`flex items-center gap-2 cursor-pointer select-none text-body text-primary${disabled ? ' opacity-50 cursor-not-allowed' : ''}${className ? ` ${className}` : ''}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="rounded-[var(--border-radius-button)]"
        style={{ accentColor: 'var(--color-primary)' }}
      />
      <span>{label}</span>
    </label>
  )
}
