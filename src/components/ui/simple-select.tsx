"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { FieldMessage } from "@/components/ui/field-shell";
import { RequiredAsterisk } from "@/components/ui/required-asterisk";
import { useFloatingLabel } from "@/lib/hooks/use-floating-label";

interface OptionItem {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectValue =
  | { kind: "empty" }
  | { kind: "set"; value: string }
  | { kind: "stale"; value: string; label?: string }
  | { kind: "loading" };

export function fromOptional(v: string | undefined | SelectValue): SelectValue {
  if (v && typeof v === "object" && "kind" in v) return v;
  if (v === undefined || v === "") return { kind: "empty" };
  return { kind: "set", value: v };
}

interface SimpleSelectProps {
  label?: string;
  value: SelectValue | string | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: readonly string[] | readonly OptionItem[];
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  underline?: boolean;
  className?: string;
  suppressMessageSlot?: boolean;
  loading?: boolean;
  getStaleLabel?: (value: string) => string;
  "aria-label"?: string;
  "data-testid"?: string;
}

export function SimpleSelect({
  label,
  value,
  onChange,
  onBlur,
  options,
  error,
  placeholder,
  required,
  disabled,
  underline = true,
  className,
  suppressMessageSlot,
  loading,
  getStaleLabel,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: SimpleSelectProps) {
  const generatedId = useId();
  const id = generatedId;
  const [focused, setFocused] = useState(false);
  const t = useTranslations("common");

  const normalized: SelectValue = loading
    ? { kind: "loading" }
    : fromOptional(value);

  const hasExplicitEmptyOption = options.some((opt) =>
    typeof opt === "string" ? opt === "" : opt.value === "",
  );

  // Detect stale: a "set" value not in options means stale.
  let effective: SelectValue = normalized;
  if (normalized.kind === "set") {
    const found = options.some((opt) =>
      typeof opt === "string"
        ? opt === normalized.value
        : opt.value === normalized.value,
    );
    if (!found) {
      effective = { kind: "stale", value: normalized.value };
    }
  }

  const isLoading = effective.kind === "loading";
  const isEmpty = effective.kind === "empty";
  const staleValue = effective.kind === "stale" ? effective.value : null;

  const selectValue =
    effective.kind === "set"
      ? effective.value
      : effective.kind === "stale"
        ? effective.value
        : "";

  const showLeadingPlaceholder =
    (isEmpty || isLoading) && !hasExplicitEmptyOption;

  const placeholderText = isLoading
    ? t("loading")
    : (placeholder ?? t("select"));

  const staleLabelText = staleValue !== null
    ? (getStaleLabel
        ? getStaleLabel(staleValue)
        : t("deprecatedValue", { value: staleValue }))
    : "";

  const stringForFloat: string =
    effective.kind === "set"
      ? effective.value
      : effective.kind === "stale"
        ? effective.value
        : "";
  const { floated: baseFloated } = useFloatingLabel({
    value: stringForFloat,
    focused,
    required,
  });
  const floated = baseFloated || hasExplicitEmptyOption;

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
        value={selectValue}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onBlur?.(); }}
        required={required}
        disabled={disabled || isLoading}
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
                "focus-visible:ring-2",
                error
                  ? "focus-visible:ring-destructive"
                  : "focus-visible:ring-[var(--color-primary)]",
              ),
        )}
        style={{
          /* design-ok */
          color: selectValue
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
        {showLeadingPlaceholder && (
          <option value="" disabled>
            {placeholderText}
          </option>
        )}
        {staleValue !== null && (
          <option
            key={`__stale__${staleValue}`}
            value={staleValue}
            disabled
            aria-disabled="true"
          >
            {staleLabelText}
          </option>
        )}
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
          {required && <RequiredAsterisk />}
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

      {!suppressMessageSlot && <FieldMessage id={`${id}-error`} error={error} />}
    </div>
  );
}
