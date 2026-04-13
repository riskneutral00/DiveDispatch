"use client";

import { LanguagePicker } from "@/components/profiles/language-picker";
import { FieldShell } from "@/components/ui/field-shell";
import type { Language } from "@/lib/types/language";

type LanguageVariant = "app" | "customer" | "teaching";

const VARIANT_CONFIG: Record<LanguageVariant, { label: string; max: number }> =
  {
    app: { label: "App Language", max: 1 },
    customer: { label: "Customer Languages", max: 4 },
    teaching: { label: "Teaching Languages", max: 4 },
  };

interface LanguageFieldProps {
  variant: LanguageVariant;
  value: Language[];
  onChange: (languages: Language[]) => void;
  disabled?: boolean;
}

export function LanguageField({
  variant,
  value,
  onChange,
  disabled = false,
}: LanguageFieldProps) {
  const { label, max } = VARIANT_CONFIG[variant];

  return (
    <FieldShell
      id={`language-${variant}`}
      label={label}
      required
      className="flex flex-col items-center gap-1.5 w-full"
    >
      <div className="reading-plane rounded-theme p-2 w-auto">
        <LanguagePicker
          value={value}
          onChange={onChange}
          max={max}
          disabled={disabled}
        />
      </div>
    </FieldShell>
  );
}
