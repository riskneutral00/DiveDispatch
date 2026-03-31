import { GlassSimpleSelect } from '@/components/ui/glass-simple-select'

interface DayPickerProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

export function DayPicker({ label, value, min, max, onChange }: DayPickerProps) {
  const options: { value: string; label: string }[] = []
  for (let i = min; i <= max; i++) options.push({ value: String(i), label: String(i) })

  return (
    <div className="flex flex-col items-center gap-1">
      <GlassSimpleSelect
        label={label}
        value={String(value)}
        onChange={(v) => onChange(Number(v))}
        options={options}
      />
    </div>
  )
}
