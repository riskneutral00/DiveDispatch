interface DayPickerProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

export function DayPicker({ label, value, min, max, onChange }: DayPickerProps) {
  const options: number[] = []
  for (let i = min; i <= max; i++) options.push(i)

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="glass glass-field text-sm text-center px-3 py-2.5 w-16 focus:outline-none"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {options.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  )
}
