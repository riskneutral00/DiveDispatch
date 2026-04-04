import type { CSSProperties, ReactNode } from 'react'

interface FieldLabelProps {
  htmlFor?: string
  children: ReactNode
  /** When true, shows a required asterisk */
  required?: boolean
  className?: string
  style?: CSSProperties
}

/** Shared label row for glass form fields */
export function FieldLabel({ htmlFor, children, required, className, style }: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={className ?? 'text-sm font-medium text-secondary'}
      style={style}
    >
      {children}
      {required && <span style={{ color: 'var(--color-destructive)' }}> *</span>}
    </label>
  )
}

interface FieldErrorProps {
  id: string
  message?: string
}

export function FieldError({ id, message }: FieldErrorProps) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-sm" style={{ color: 'var(--color-destructive)' }}>
      {message}
    </p>
  )
}

interface FieldShellProps {
  id: string
  label?: ReactNode
  required?: boolean
  error?: string
  helperText?: string
  children: ReactNode
  className?: string
}

/**
 * Shared wrapper for label + control + error/helper text stack.
 * Use this for composite controls that cannot directly use Input/Textarea.
 */
export function FieldShell({
  id,
  label,
  required,
  error,
  helperText,
  children,
  className,
}: FieldShellProps) {
  const errorId = `${id}-error`
  const helperId = `${id}-help`

  return (
    <div className={className ?? 'flex flex-col gap-1.5 w-full'}>
      {label && (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      )}
      {children}
      <FieldError id={errorId} message={error} />
      {!error && helperText && (
        <p id={helperId} className="text-xs text-secondary">
          {helperText}
        </p>
      )}
    </div>
  )
}
