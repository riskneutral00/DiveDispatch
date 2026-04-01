import React, { useId } from "react";
import { GlassFieldError, GlassFieldLabel } from "@/components/ui/field-shell";

interface GlassTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function GlassTextarea({
  label,
  error,
  helperText,
  disabled,
  className = "",
  id: externalId,
  rows = 3,
  required,
  ...props
}: GlassTextareaProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <GlassFieldLabel htmlFor={id} required={required}>
          {label}
        </GlassFieldLabel>
      )}

      <textarea
        {...props}
        id={id}
        rows={rows}
        disabled={disabled}
        required={required}
        className={[
          "glass glass-field w-full text-sm text-primary px-3 py-2.5 resize-none",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "placeholder:opacity-50",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ caretColor: "var(--color-accent)",
          ...(error
            ? {
                borderColor: "var(--color-destructive)",
                boxShadow: "0 0 0 3px var(--color-destructive-glow)",
              }
            : {}) }}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${id}-error` : helperText ? `${id}-helper` : undefined
        }
      />

      <GlassFieldError id={`${id}-error`} message={error} />
      {!error && helperText && (
        <p
          id={`${id}-helper`}
          className="text-sm text-secondary"
        >
          {helperText}
        </p>
      )}
    </div>
  );
}
