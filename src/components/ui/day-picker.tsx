import { SimpleSelect } from "@/components/ui/simple-select";

interface DayPickerProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** When false, plain select without field-underline (gray fill + bottom line). */
  underline?: boolean;
}

export function DayPicker({
  label,
  value,
  min,
  max,
  onChange,
  underline = true,
}: DayPickerProps) {
  const options: { value: string; label: string }[] = [];
  for (let i = min; i <= max; i++)
    options.push({ value: String(i), label: String(i) });

  return (
    <div className="flex flex-col items-center gap-1">
      <SimpleSelect
        label={label}
        value={String(value)}
        onChange={(v) => onChange(Number(v))}
        options={options}
        underline={underline}
      />
    </div>
  );
}
