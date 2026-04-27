"use client";

import { LanguagePicker } from "@/components/profiles/language-picker";
import { FieldShell } from "@/components/ui/field-shell";
import { cn } from "@/lib/utils/cn";
import type { Language } from "@/lib/types/language";

interface LanguageFieldProps {
  label: string;
  value: Language[];
  onChange: (languages: Language[]) => void;
  onBlur?: () => void;
  id?: string;
  max?: number;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function LanguageField({
  label,
  value,
  onChange,
  onBlur,
  id = "language-field",
  max = 4,
  required = true,
  error,
  disabled = false,
  className,
}: LanguageFieldProps) {
  return (
    <div
      onBlur={
        onBlur
          ? (e) => {
              const next = e.relatedTarget as Node | null;
              if (next && e.currentTarget.contains(next)) return;
              onBlur();
            }
          : undefined
      }
    >
      <FieldShell
        id={id}
        label={label}
        required={required}
        error={error}
        className={cn("flex flex-col items-center gap-1.5 w-full", className)}
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
    </div>
  );
}
