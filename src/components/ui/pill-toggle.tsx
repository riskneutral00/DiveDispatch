'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { TOUCH_TARGET_CLASS } from '@/lib/constants/button-sizes'
import { cn } from '@/lib/utils/cn'

export type PillToggleSize = 'sm' | 'md'
export type PillToggleVariant = 'default' | 'compact'
export type PillToggleAs = 'label' | 'button'

interface PillToggleProps {
  label: string
  checked: boolean
  onChange: () => void
  locked?: boolean
  disabled?: boolean
  size?: PillToggleSize
  variant?: PillToggleVariant
  as?: PillToggleAs
}

const TEXT_BY_SIZE: Record<PillToggleSize, string> = {
  sm: 'text-label',
  md: 'text-body',
}

const PADDING_X: Record<PillToggleVariant, string> = {
  default: 'px-3',
  compact: 'px-2',
}

const PADDING_Y: Record<PillToggleVariant, string> = {
  default: 'py-1.5',
  compact: 'py-1',
}

function toggleStyle(checked: boolean): React.CSSProperties {
  return {
    background: checked
      ? 'var(--color-primary)'
      : 'var(--color-surface-elevated)',
    color: checked
      ? 'var(--color-text-on-primary)'
      : 'var(--color-text-primary)',
    border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-glass-border)'}`,
  }
}

export function PillToggle({
  label,
  checked,
  onChange,
  locked,
  disabled,
  size = 'sm',
  variant = 'default',
  as = 'label',
}: PillToggleProps) {
  const base = cn(
    'inline-flex items-center justify-center gap-1 rounded-full font-medium transition-all duration-theme',
    TOUCH_TARGET_CLASS,
    TEXT_BY_SIZE[size],
    PADDING_X[variant],
    PADDING_Y[variant],
  )

  const interactable = !locked && !disabled

  if (as === 'button') {
    return (
      <button /* design-ok: pill toggle state uses --color-primary which is not wired via @theme inline */
        type="button"
        className={cn(base, interactable ? 'cursor-pointer' : 'cursor-default')}
        style={toggleStyle(checked)}
        aria-pressed={checked}
        disabled={locked || disabled}
        onClick={() => interactable && onChange()}
      >
        {label}
        {locked && <Lock size={10} className="opacity-70" />}
      </button>
    )
  }

  return (
    <label
      className={cn(base, locked ? 'cursor-default' : 'cursor-pointer')}
      style={toggleStyle(checked)}
      aria-disabled={locked || undefined}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={locked || disabled}
        onChange={onChange}
      />
      {label}
      {locked && <Lock size={10} className="opacity-70" />}
    </label>
  )
}

interface PillToggleGroupProps {
  children: ReactNode
  overflowItems?: ReactNode
  className?: string
}

export function PillToggleGroup({
  children,
  overflowItems,
  className,
}: PillToggleGroupProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className={className ?? 'flex flex-wrap gap-1.5'}>
      {children}
      {overflowItems && (
        <div className="relative" ref={dropdownRef}>
          <button /* design-ok: overflow chip state uses --color-primary */
            type="button"
            onClick={() => setOpen(!open)}
            className="inline-flex items-center justify-center px-2 py-1.5 rounded-full text-label font-medium cursor-pointer"
            style={{
              background: open
                ? 'var(--color-primary)'
                : 'var(--color-surface-elevated)',
              color: open
                ? 'var(--color-text-on-primary)'
                : 'var(--color-text-secondary)',
              border: `1px ${open ? 'solid' : 'dashed'} ${open ? 'var(--color-primary)' : 'var(--color-glass-border)'}`,
            }}
          >
            More…
          </button>
          {open && (
            <div
              className="absolute top-full right-0 mt-1 z-[var(--z-dropdown)] rounded-theme p-2 flex flex-wrap gap-1.5"
              style={{
                backgroundColor: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-glass-border)',
                boxShadow: '0 8px 32px var(--color-glass-shadow-elevated)',
                minWidth: '200px',
              }}
            >
              {overflowItems}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
