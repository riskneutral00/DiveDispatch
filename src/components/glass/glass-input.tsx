import React, { useId } from "react";

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export function GlassInput({
  label,
  error,
  helperText,
  leadingIcon,
  trailingIcon,
  disabled,
  className = "",
  id: externalId,
  ...props
}: GlassInputProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {leadingIcon && (
          <span
            className="absolute left-3 flex items-center pointer-events-none"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {leadingIcon}
          </span>
        )}

        <input
          {...props}
          id={id}
          disabled={disabled}
          className={[
            "glass glass-field w-full text-sm",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "placeholder:opacity-50",
            leadingIcon ? "pl-9" : "pl-3",
            trailingIcon ? "pr-9" : "pr-3",
            "py-2.5",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            color: "var(--color-text-primary)",
            caretColor: "var(--color-accent)",
            ...(error ? {
              borderColor: "var(--color-destructive)",
              boxShadow: `0 0 0 3px rgba(239, 68, 68, 0.3)`,
            } : {}),
          }}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${id}-error` : helperText ? `${id}-helper` : undefined
          }
        />

        {trailingIcon && (
          <span
            className="absolute right-3 flex items-center pointer-events-none"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {trailingIcon}
          </span>
        )}
      </div>

      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${id}-helper`} className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          {helperText}
        </p>
      )}
    </div>
  );
}
