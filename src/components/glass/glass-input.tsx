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
  type,
  onClick,
  ...props
}: GlassInputProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const isDateLike = type === "date" || type === "datetime-local" || type === "time";

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {label}
          {props.required && <span style={{ color: 'var(--color-destructive)' }}> *</span>}
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
          type={type}
          id={id}
          disabled={disabled}
          onClick={(e) => {
            if (isDateLike && !disabled) {
              e.currentTarget.showPicker();
            }
            onClick?.(e);
          }}
          className={[
            "glass glass-field w-full text-sm",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "placeholder:opacity-50",
            leadingIcon ? "pl-9" : "pl-3",
            trailingIcon ? "pr-9" : "pr-3",
            "py-2.5",
            isDateLike ? "cursor-pointer" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            color: "var(--color-text-primary)",
            caretColor: "var(--color-accent)",
            ...(error ? {
              borderColor: "var(--color-destructive)",
              boxShadow: `0 0 0 3px var(--color-destructive-glow)`,
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
