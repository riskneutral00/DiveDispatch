'use client'

import { Palette } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { IconButton } from '@/components/ui/icon-button'
import { useTheme } from '@/themes/theme-provider'

export function BgSwitcher() {
  const { selectTheme } = useTheme()
  const storeThemes = useQuery(api.themes.listStore)
  const [index, setIndex] = useState(0)

  const isLoaded = storeThemes && storeThemes.length > 0
  const current = isLoaded ? storeThemes[index % storeThemes.length] : null

  function cycle() {
    if (!storeThemes || storeThemes.length === 0) return
    const next = (index + 1) % storeThemes.length
    setIndex(next)
    selectTheme(storeThemes[next]._id as string)
  }

  return (
    <IconButton
      variant="ghost"
      aria-label={current ? `Switch skin (current: ${current.name})` : 'Switch skin'}
      onClick={cycle}
      disabled={!isLoaded}
    >
      <Palette size={15} />
    </IconButton>
  )
}
