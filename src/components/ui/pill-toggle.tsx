'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Lock } from 'lucide-react'

interface PillToggleProps {
  label: string
  checked: boolean
  onChange: () => void
  locked?: boolean
  disabled?: boolean
}

export function PillToggle({ label, checked, onChange, locked, disabled }: PillToggleProps) {
  return (
    <label
      className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-full text-label font-medium transition-all duration-theme ${locked ? 'cursor-default' : 'cursor-pointer'}`}
      style={{
        background: checked ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
        color: checked ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
        border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-glass-border)'}`,
        transitionDuration: 'var(--transition-speed)',
      }}
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
      {locked && <Lock size={10} style={{ opacity: 0.7 }} />}
    </label>
  )
}

interface PillToggleGroupProps {
  children: ReactNode
  overflowItems?: ReactNode
  className?: string
}

export function PillToggleGroup({ children, overflowItems, className }: PillToggleGroupProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className={className ?? "flex flex-wrap gap-1.5"}>
      {children}
      {overflowItems && (
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="inline-flex items-center justify-center px-2 py-1.5 rounded-full text-label font-medium cursor-pointer"
            style={{
              background: open ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
              color: open ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
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
