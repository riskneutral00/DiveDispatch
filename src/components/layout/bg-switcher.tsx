'use client'

import { Palette } from 'lucide-react'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { IconButton } from '@/components/ui/icon-button'
import { useTheme } from '@/themes/theme-provider'

export function BgSwitcher() {
  const { selectTheme, theme, mode } = useTheme()
  const mySkins = useQuery(api.themes.listMySkins)

  // Palette cycles within the current sun/moon bucket only (e.g. five light skins vs four dark).
  // Sun/moon switches buckets so users can reach the other appearance family.
  const availableSkins = mySkins?.filter((t) => t.appearance === mode) || []
  const isLoaded = availableSkins.length > 0

  function cycle() {
    if (!isLoaded) return
    const currentIdx = availableSkins.findIndex((t) => t.slug === theme?.id)
    // If not found in this bucket (shouldn't happen gracefully), start at 0
    const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % availableSkins.length
    selectTheme(availableSkins[nextIdx]._id as string)
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
