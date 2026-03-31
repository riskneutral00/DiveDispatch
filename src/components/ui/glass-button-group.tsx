import React from "react";

export interface GlassButtonGroupOption {
  value: string;
  label: React.ReactNode;
}

interface GlassButtonGroupProps {
  options: GlassButtonGroupOption[];
  value: string;
  onChange: (value: string) => void;
  /** segment = contained pill group | tabs = underline tab bar */
  variant?: "segment" | "tabs";
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

export function GlassButtonGroup({
  options,
  value,
  onChange,
  variant = "segment",
  size = "sm",
  className = "",
  "aria-label": ariaLabel,
}: GlassButtonGroupProps) {
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  if (variant === "tabs") {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={[
          "flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 flex-shrink-0",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ borderBottom: "1px solid var(--color-glass-border)" }}
      >
        {options.map(({ value: v, label }) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={value === v}
            onClick={() => onChange(v)}
            className={[
              "px-3 py-1.5 font-medium rounded-t-md whitespace-nowrap transition-colors",
              textSize,
            ].join(" ")}
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
              fontFamily: "var(--font-body)",
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
      className={[
        "inline-flex rounded-[var(--border-radius)] overflow-hidden border flex-shrink-0",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ borderColor: "var(--color-glass-border)" }}
    >
      {options.map(({ value: v, label }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={[
            "px-2.5 py-2 font-medium capitalize transition-all border-l first:border-l-0",
            textSize,
          ].join(" ")}
          style={{
            background:
              value === v ? "var(--color-accent)" : "var(--color-glass-bg)",
            color:
              value === v
                ? "var(--color-text-on-primary)"
                : "var(--color-text-secondary)",
            borderColor: "var(--color-glass-border)",
            fontFamily: "var(--font-body)",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
