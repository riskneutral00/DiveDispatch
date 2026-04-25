'use client'

import { Moon, Sun } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { useTheme } from '@/themes/theme-provider'
import type { ThemeMode } from '@/themes/theme-types'

export function ThemeSwitcher() {
  const { mode, setMode } = useTheme()

  function toggle() {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark'
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
