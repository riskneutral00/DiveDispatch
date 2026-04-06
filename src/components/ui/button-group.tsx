import React from "react";
import { cn } from "@/lib/utils/cn";

export interface ButtonGroupOption {
  value: string;
  label: React.ReactNode;
}

interface ButtonGroupProps {
  options: ButtonGroupOption[];
  value: string;
  onChange: (value: string) => void;
  /** segment = contained pill group | tabs = underline tab bar */
  variant?: "segment" | "tabs";
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

export function ButtonGroup({
  options,
  value,
  onChange,
  variant = "segment",
  size = "sm",
  className = "",
  "aria-label": ariaLabel,
}: ButtonGroupProps) {
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  if (variant === "tabs") {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          "flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 flex-shrink-0",
          className,
        )}
        style={{ borderBottom: "1px solid var(--color-glass-border)" }}
      >
        {options.map(({ value: v, label }) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={value === v}
            onClick={() => onChange(v)}
            className={cn(
              "px-3 py-1.5 font-medium rounded-t-[var(--border-radius-button)] whitespace-nowrap transition-colors",
              textSize,
            )}
            style={{
              color:
                value === v
                  ? "var(--color-text-primary)"
                  : "var(--color-text-secondary)",
              background:
                value === v ? "var(--color-glass-bg-elevated)" : "transparent",
              borderBottom:
                value === v
                  ? "2px solid var(--color-accent)"
                  : "2px solid transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  // segment variant — contained pill group
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex rounded-theme overflow-hidden border flex-shrink-0",
        className,
      )}
      style={{ borderColor: "var(--color-glass-border)" }}
    >
      {options.map(({ value: v, label }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "px-2.5 py-2 font-medium capitalize transition-all border-l first:border-l-0",
            textSize,
          )}
          style={{
            background:
              value === v ? "var(--color-accent)" : "var(--color-glass-bg)",
            color:
              value === v
                ? "var(--color-text-on-primary)"
                : "var(--color-text-secondary)",
            borderColor: "var(--color-glass-border)",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
