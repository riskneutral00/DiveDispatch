import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface FieldLabelProps {
  htmlFor?: string
  children: ReactNode
  required?: boolean
  className?: string
  style?: CSSProperties
}

export function FieldLabel({ htmlFor, children, required, className, style }: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('text-label font-medium text-secondary', className)}
      style={style}
    >
      {children}
      {required && <span className="text-destructive"> *</span>}
    </label>
  )
}

interface FieldErrorProps {
  id: string
  message?: string
}

export function FieldError({ id, message }: FieldErrorProps) {
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        'h-4 text-body text-destructive truncate transition-opacity duration-theme',
        message ? 'opacity-100' : 'opacity-0',
      )}
    >
      {message ?? '\u00A0'}
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
    <div className={cn('flex flex-col gap-1.5 w-full', className)}>
      {label && (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      )}
      {children}
      {error || !helperText ? (
        <FieldError id={errorId} message={error} />
      ) : (
        <p id={helperId} className="h-4 text-body text-secondary truncate">
          {helperText}
        </p>
      )}
    </div>
  )
}
