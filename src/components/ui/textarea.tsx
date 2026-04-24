import React, { useId, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { FieldError } from "@/components/ui/field-shell";
import { RequiredAsterisk } from "@/components/ui/required-asterisk";
import { useFloatingLabel } from "@/lib/hooks/use-floating-label";
import { resolveFieldWidth } from "@/lib/utils/field-width";

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
  const [focused, setFocused] = useState(false);
  const { floated } = useFloatingLabel({ value: props.value as string | undefined, focused, required });

  return (
    <div className={cn("relative", resolveFieldWidth('field-xl', className))}>
      <textarea
        {...props}
        id={id}
        rows={rows}
        disabled={disabled}
        required={required}
        placeholder={label && !floated ? undefined : (props.placeholder as string | undefined)}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        className={cn(
          "field-underline w-full text-body text-primary px-0 resize-none",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "placeholder:opacity-60",
          label ? "pt-4 pb-1.5" : "py-2.5",
        )}
        style={{
          caretColor: "var(--color-accent)",
          ...(error ? { borderBottomColor: "var(--color-destructive)" } : {}),
          ...(focused && !error ? { borderBottomColor: "var(--color-primary)", borderBottomWidth: "2px" } : {}),
        }}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${id}-error` : helperText ? `${id}-helper` : undefined
        }
      />

      {label && (
        <label
          htmlFor={id}
          className={cn(
            "absolute left-0 pointer-events-none transition-all duration-theme",
            floated
              ? cn("top-0 text-[10px] font-medium label-float-in", focused ? "text-primary" : "text-secondary")
              : "top-3 text-body text-secondary",
          )}
          /* design-ok */
        >
          {label}
          {required && <RequiredAsterisk />}
        </label>
      )}

      {error && <FieldError id={`${id}-error`} message={error} />}
      {!error && helperText && (
        <p id={`${id}-helper`} className="text-body text-secondary truncate">
          {helperText}
        </p>
      )}
    </div>
  );
}
