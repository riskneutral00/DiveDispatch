import React from 'react'
import { cn } from '@/lib/utils/cn'
import { Spinner } from '@/components/ui/spinner'
import { INTERACTION_DEFAULTS, type ButtonHoverEffect } from '@/lib/constants/interaction-config'
import { BUTTON_SIZE_MAP, type ButtonSize } from '@/lib/constants/button-sizes'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'destructive-ghost'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
  hoverEffect?: ButtonHoverEffect
  children: React.ReactNode
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
  hoverEffect = INTERACTION_DEFAULTS.buttonHover,
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
        'transition-all duration-theme',
        hoverEffect !== 'none' && 'glass-btn',
        hoverEffect !== 'none' && `glass-btn-${variant}`,
        'disabled:opacity-50 disabled:cursor-not-allowed',
        BUTTON_SIZE_MAP[size],
        fullWidth && 'w-full',
        className,
      )}
      style={{
        ...variantStyles[variant],
        outlineColor: 'var(--color-accent)',
        ...style,
      }}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}
