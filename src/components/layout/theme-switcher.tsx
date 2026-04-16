'use client'

import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IconButton } from '@/components/ui/icon-button'
import { useTheme } from '@/themes/theme-provider'
import { THEME_MODE_STORAGE_KEY as STORAGE_KEY } from '@/themes/theme-bootstrap'
import type { ThemeMode } from '@/themes/theme-types'

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
    <IconButton
      variant="ghost"
      aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      onClick={toggle}
    >
      <Icon size={15} />
    </IconButton>
  )
}
