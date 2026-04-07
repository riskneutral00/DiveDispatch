import React, { useId } from "react";
import { cn } from "@/lib/utils/cn";
import { FieldError, FieldLabel } from "@/components/ui/field-shell";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Textarea({
  label,
  error,
  helperText,
  disabled,
  className = "",
  id: externalId,
  rows = 3,
  required,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      )}

      <textarea
        {...props}
        id={id}
        rows={rows}
        disabled={disabled}
        required={required}
        className={cn(
          "field-underline w-full text-body text-primary px-0 py-2.5 resize-none",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "placeholder:opacity-50",
          className,
        )}
        style={{ caretColor: "var(--color-accent)",
          ...(error
            ? {
                borderBottomColor: "var(--color-destructive)",
              }
            : {}) }}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${id}-error` : helperText ? `${id}-helper` : undefined
        }
      />

      {error && <FieldError id={`${id}-error`} message={error} />}
      {!error && helperText && (
        <p id={`${id}-helper`} className="text-body text-secondary truncate">
          {helperText}
        </p>
      )}
    </div>
  );
}
