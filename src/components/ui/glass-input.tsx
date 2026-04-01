'use client'

import React, { useId } from 'react'
import { GlassFieldError, GlassFieldLabel } from '@/components/ui/field-shell'
import { cn } from '@/lib/utils/cn'

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
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
        <GlassFieldLabel htmlFor={id} required={props.required}>
          {label}
        </GlassFieldLabel>
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
            'glass glass-field w-full text-sm text-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'placeholder:opacity-50',
            leadingIcon ? 'pl-9' : 'pl-3',
            trailingIcon ? 'pr-9' : 'pr-3',
            'py-2.5',
            isDateLike && 'cursor-pointer',
            className,
          )}
          style={{ caretColor: 'var(--color-accent)',
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

      <GlassFieldError id={`${id}-error`} message={error} />
      {!error && helperText && (
        <p id={`${id}-helper`} className="text-sm text-secondary">
          {helperText}
        </p>
      )}
    </div>
  );
}
