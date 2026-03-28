'use client'

import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTheme } from '@/themes/theme-provider'
import type { ThemeMode } from '@/themes/theme-types'

const STORAGE_KEY = 'divedispatch-theme-pref'

export function ThemeSwitcher() {
  const { setMode } = useTheme()
  const [mode, setLocalMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark'
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    setMode(mode)
  }, [mode, setMode])

  function toggle() {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark'
    setLocalMode(next)
    localStorage.setItem(STORAGE_KEY, next)
    setMode(next)
  }

  const Icon = mode === 'light' ? Sun : Moon

  return (
    <button
      aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      onClick={toggle}
      className="flex items-center justify-center w-11 h-11 rounded-full transition-all text-secondary"
      style={{ background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
        transitionDuration: 'var(--transition-speed)' }}
    >
      <Icon size={15} />
    </button>
  )
}
