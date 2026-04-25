'use client'

import { Palette } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { useTheme } from '@/themes/theme-provider'

export function BgSwitcher() {
  const { selectTheme, theme, mode, savedSkins } = useTheme()

  const availableSkins = savedSkins.filter((t) => t.appearance === mode)
  const isLoaded = availableSkins.length > 0

  function cycle() {
    if (!isLoaded) return
    const currentIdx = availableSkins.findIndex((t) => t.slug === theme?.id)
    const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % availableSkins.length
    selectTheme(availableSkins[nextIdx]._id)
  }

  return (
    <IconButton
      variant="ghost"
      aria-label={theme ? `Switch skin (current: ${theme.name})` : 'Switch skin'}
      onClick={cycle}
      disabled={!isLoaded}
    >
      <Palette size={15} />
    </IconButton>
  )
}
