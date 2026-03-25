'use client'

import { Palette } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SKINS } from '@/themes/skins'
import { useTheme } from '@/themes/theme-provider'

const STORAGE_KEY = 'divedispatch-bg-pref'

export function BgSwitcher() {
  const { setTheme } = useTheme()
  const [index, setIndex] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    const stored = localStorage.getItem(STORAGE_KEY)
    const idx = SKINS.findIndex(s => s.id === stored)
    return idx >= 0 ? idx : 0
  })

  useEffect(() => {
    setTheme(SKINS[index])
  }, [index, setTheme])

  function cycle() {
    const next = (index + 1) % SKINS.length
    setIndex(next)
    localStorage.setItem(STORAGE_KEY, SKINS[next].id)
    setTheme(SKINS[next])
  }

  return (
    <button
      aria-label={`Switch skin (current: ${SKINS[index].name})`}
      onClick={cycle}
      className="flex items-center justify-center w-11 h-11 rounded-full transition-all"
      style={{
        background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
        color: 'var(--color-text-secondary)',
        transitionDuration: 'var(--transition-speed)',
      }}
    >
      <Palette size={15} />
    </button>
  )
}
