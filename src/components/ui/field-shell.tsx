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
      className={cn('text-[10px] font-medium text-secondary label-float-in', className)}
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
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-body text-destructive truncate">
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
      {error && <FieldError id={errorId} message={error} />}
      {!error && helperText && (
        <p id={helperId} className="text-body text-secondary truncate">
          {helperText}
        </p>
      )}
    </div>
  )
}
