/**
 * Single checkbox with glass styling. For boolean toggles in forms.
 *
 * For multi-select checkbox groups, use GlassCheckboxGroup instead.
 */

interface GlassCheckboxProps {
  label: string | React.ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function GlassCheckbox({
  label,
  checked,
  onChange,
  disabled,
  className,
}: GlassCheckboxProps) {
  return (
    <label
      className={`flex items-center gap-2 cursor-pointer select-none text-sm text-primary${disabled ? ' opacity-50 cursor-not-allowed' : ''}${className ? ` ${className}` : ''}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="rounded"
        style={{ accentColor: 'var(--color-primary)' }}
      />
      <span>{label}</span>
    </label>
  )
}
