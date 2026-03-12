'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTheme } from '@/themes/theme-provider'
import type { ThemeMode } from '@/themes/theme-types'

type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'divedispatch-theme-pref'

function resolveMode(pref: ThemePreference): ThemeMode {
  if (pref === 'system') {
    if (typeof window === 'undefined') return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

const OPTIONS: { value: ThemePreference; Icon: typeof Sun; label: string }[] = [
  { value: 'light', Icon: Sun, label: 'Light' },
  { value: 'system', Icon: Monitor, label: 'System' },
  { value: 'dark', Icon: Moon, label: 'Dark' },
]

export function ThemeSwitcher() {
  const { setMode } = useTheme()
  const [open, setOpen] = useState(false)
  // Lazy init from localStorage avoids setState-in-effect anti-pattern
  const [pref, setPref] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return 'dark'
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null
    return stored && ['light', 'dark', 'system'].includes(stored) ? stored : 'dark'
  })

  // Sync ThemeProvider mode whenever pref changes (including initial mount)
  useEffect(() => {
    setMode(resolveMode(pref))
  }, [pref, setMode])

  // Track system color-scheme changes when pref === 'system'
  useEffect(() => {
    if (pref !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setMode(resolveMode('system'))
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [pref, setMode])

  function applyPref(next: ThemePreference) {
    setPref(next)
    localStorage.setItem(STORAGE_KEY, next)
    setMode(resolveMode(next))
    setOpen(false)
  }

  const ActiveIcon =
    pref === 'light' ? Sun : pref === 'dark' ? Moon : Monitor

  return (
    <div className="relative">
      <button
        aria-label="Theme settings"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center w-8 h-8 rounded-full transition-all"
        style={{
          background: 'var(--color-glass-bg)',
          border: '1px solid var(--color-glass-border)',
          color: 'var(--color-text-secondary)',
          transitionDuration: 'var(--transition-speed)',
        }}
      >
        <ActiveIcon size={15} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-10 z-50 p-1.5 shadow-xl"
            style={{
              background: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-glass-border)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              borderRadius: 'var(--border-radius)',
              minWidth: '120px',
            }}
          >
            {/* Pill segmented control */}
            <div
              className="flex items-center gap-1 p-1 rounded-full"
              style={{ background: 'var(--color-glass-bg)' }}
            >
              {OPTIONS.map(({ value, Icon, label }) => (
                <button
                  key={value}
                  role="menuitem"
                  aria-label={label}
                  title={label}
                  onClick={() => applyPref(value)}
                  className="flex items-center justify-center w-8 h-8 rounded-full transition-all"
                  style={{
                    background: pref === value ? 'var(--color-primary)' : 'transparent',
                    color:
                      pref === value
                        ? 'var(--color-text-on-primary)'
                        : 'var(--color-text-secondary)',
                    transitionDuration: 'var(--transition-speed)',
                  }}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
