"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { FieldError } from "@/components/ui/field-shell";
import { useFloatingLabel } from "@/lib/hooks/use-floating-label";

interface OptionItem {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SimpleSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[] | readonly OptionItem[];
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** When false, skips field-underline (gray fill + bottom border); use for one-off plain selects. */
  underline?: boolean;
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

export function SimpleSelect({
  label,
  value,
  onChange,
  options,
  error,
  placeholder,
  required,
  disabled,
  underline = true,
  className,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: SimpleSelectProps) {
  const generatedId = useId();
  const id = generatedId;
  const [focused, setFocused] = useState(false);
  const { floated } = useFloatingLabel({ value, focused });

  const hasExplicitEmptyOption = options.some((opt) =>
    typeof opt === "string" ? opt === "" : opt.value === "",
  );
  const showLeadingPlaceholder =
    value === "" && !hasExplicitEmptyOption;

  return (
    <div
      className={cn(
        "relative",
        className?.includes("field-") ||
          className?.includes("w-") ||
          className?.includes("col-span")
          ? ""
          : "w-full",
        className,
      )}
    >
      <select /* design-ok */
        id={label ? id : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        data-testid={testId}
        className={cn(
          "w-full text-body appearance-none",
          label ? "pt-4 pb-1.5" : "py-2.5",
          "pl-0 pr-4",
          underline
            ? "field-underline"
            : cn(
                "bg-transparent border-0 border-b-0 outline-none",
                "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]",
                error
                  ? "focus-visible:ring-[var(--color-destructive)]"
                  : "focus-visible:ring-[var(--color-primary)]",
              ),
        )}
        style={{
          /* design-ok */
          color: value
            ? "var(--color-text-primary)"
            : "var(--color-text-secondary)",
          ...(underline && error
            ? { borderBottomColor: "var(--color-destructive)" }
            : {}),
          ...(underline && focused && !error
            ? {
                borderBottomColor: "var(--color-primary)",
                borderBottomWidth: "2px",
              }
            : {}),
        }}
      >
        {showLeadingPlaceholder && <option value="" disabled />}
        {options.map((opt) => {
          const optValue = typeof opt === "string" ? opt : opt.value;
          const optLabel = typeof opt === "string" ? opt : opt.label;
          const optDisabled = typeof opt === "string" ? false : opt.disabled;
          return (
            <option key={optValue} value={optValue} disabled={optDisabled}>
              {optLabel}
            </option>
          );
        })}
      </select>

      {label && (
        <label
          htmlFor={id}
          className={cn(
            "absolute left-0 pointer-events-none transition-all duration-theme",
            floated
              ? cn(
                  "top-0 text-[10px] font-medium label-float-in",
                  focused ? "text-primary" : "text-secondary",
                )
              : "top-3 text-body text-secondary",
          )} /* design-ok */
        >
          {label}
          {required && <span className="text-destructive"> *</span>}
        </label>
      )}

      <span className="absolute right-0 top-3.5 pointer-events-none text-secondary">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {error && <FieldError id={`${id}-error`} message={error} />}
    </div>
  );
}
