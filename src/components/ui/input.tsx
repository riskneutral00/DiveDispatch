'use client'

import React, { useId } from 'react'
import { FieldError, FieldLabel } from '@/components/ui/field-shell'
import { cn } from '@/lib/utils/cn'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
}

export function Input({
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
  style: externalStyle,
  ...props
}: InputProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const isDateLike = type === "date" || type === "datetime-local" || type === "time";

  return (
    <div className={cn("flex flex-col gap-1.5", className?.includes('field-') || className?.includes('w-') ? '' : 'w-full', className)}>
      {label && (
        <FieldLabel htmlFor={id} required={props.required}>
          {label}
        </FieldLabel>
      )}

      <div className="relative flex items-center">
        {leadingIcon && (
          <span
            className="absolute left-3 flex items-center pointer-events-none text-secondary"
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
          className={cn(
            'glass glass-field w-full text-body text-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'placeholder:opacity-50',
            leadingIcon ? 'pl-9' : 'pl-3',
            trailingIcon ? 'pr-9' : 'pr-3',
            'py-2.5',
            isDateLike && 'cursor-pointer',
          )}
          style={{ ...externalStyle, caretColor: 'var(--color-accent)',
            ...(error ? {
              borderColor: "var(--color-destructive)",
              boxShadow: `0 0 0 3px var(--color-destructive-glow)`,
            } : {}) }}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${id}-error` : helperText ? `${id}-helper` : undefined
          }
        />

        {trailingIcon && (
          <span
            className="absolute right-3 flex items-center pointer-events-none text-secondary"
          >
            {trailingIcon}
          </span>
        )}
      </div>

      {error || !helperText ? (
        <FieldError id={`${id}-error`} message={error} />
      ) : (
        <p id={`${id}-helper`} className="h-4 text-body text-secondary truncate">
          {helperText}
        </p>
      )}
    </div>
  );
}
