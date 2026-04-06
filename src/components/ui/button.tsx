import React from 'react'
import { cn } from '@/lib/utils/cn'
import { Spinner } from '@/components/ui/spinner'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'destructive-ghost'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
  children: React.ReactNode
}

const sizeMap: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5 min-h-[44px] min-w-[44px]',
  md: 'px-4 py-2 text-base gap-2 min-h-[44px] min-w-[44px]',
  lg: 'px-6 py-3 text-lg gap-2 min-h-[44px] min-w-[44px]',
  icon: 'p-2 text-sm min-h-[44px] min-w-[44px]',
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--color-primary)',
    color: 'var(--color-text-on-primary)',
    borderColor: 'var(--color-primary)',
  },
  secondary: {
    background: 'var(--color-glass-bg)',
    color: 'var(--color-text-primary)',
    borderColor: 'var(--color-glass-border)',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-text-primary)',
    borderColor: 'transparent',
  },
  destructive: {
    background: 'var(--color-destructive)',
    color: 'var(--color-text-on-primary)',
    borderColor: 'var(--color-destructive)',
  },
  'destructive-ghost': {
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    borderColor: 'transparent',
  },
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  children,
  disabled,
  className = '',
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center',
        'border font-medium leading-none',
        'rounded-theme',
        'transition-all',
        'glass-btn',
        `glass-btn-${variant}`,
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeMap[size],
        fullWidth && 'w-full',
        className,
      )}
      style={{
        ...variantStyles[variant],
        transitionDuration: 'var(--transition-speed)',
        outlineColor: 'var(--color-accent)',
        ...style,
      }}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}
