'use client'

import React, { useId, useState } from 'react'
import { FieldError } from '@/components/ui/field-shell'
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
  placeholder: externalPlaceholder,
  ...props
}: InputProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const isDateLike = type === "date" || type === "datetime-local" || type === "time";
  const [focused, setFocused] = useState(false)
  const filled = typeof props.value === 'string' ? props.value.length > 0 : !!props.value
  const hasRealPlaceholder = !!externalPlaceholder && externalPlaceholder.trim() !== ""
  const [mounted, setMounted] = useState(false)
  React.useEffect(() => { requestAnimationFrame(() => setMounted(true)) }, [])
  const floated = mounted || focused || filled || hasRealPlaceholder

  return (
    <div className={cn("relative", className?.includes('field-') || className?.includes('w-') || className?.includes('col-span') ? '' : 'w-full', className)}>
      <input
        {...props}
        type={type}
        id={id}
        disabled={disabled}
        placeholder={externalPlaceholder || " "}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
        onClick={(e) => {
          if (isDateLike && !disabled) {
            e.currentTarget.showPicker();
          }
          onClick?.(e);
        }}
        className={cn(
          'field-underline w-full text-body text-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          label ? 'pt-4 pb-1.5' : 'py-2.5',
          leadingIcon ? 'pl-6' : 'pl-0',
          trailingIcon ? 'pr-6' : 'pr-0',
          isDateLike && 'cursor-pointer',
        )}
        style={{ ...externalStyle, caretColor: 'var(--color-accent)', /* design-ok */
          ...(error ? {
            borderBottomColor: "var(--color-destructive)",
          } : {}),
          ...(focused && !error ? {
            borderBottomColor: "var(--color-primary)",
            borderBottomWidth: "2px",
          } : {}),
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
            'absolute pointer-events-none transition-all',
            leadingIcon ? 'left-6' : 'left-0',
            floated
              ? cn('top-0 text-[10px] font-medium', focused ? 'text-primary' : 'text-secondary')
              : 'top-3 text-body text-secondary',
          )}
          style={{ transitionDuration: 'var(--transition-speed)' }} /* design-ok */
        >
          {label}{props.required && <span className="text-destructive"> *</span>}
        </label>
      )}

      {leadingIcon && (
        <span className="absolute left-0 top-3 flex items-center pointer-events-none text-secondary">
          {leadingIcon}
        </span>
      )}

      {trailingIcon && (
        <span className="absolute right-0 top-3 flex items-center pointer-events-none text-secondary">
          {trailingIcon}
        </span>
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
