'use client'

import { Sun, Waves } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SKINS } from '@/themes/skins'
import { useTheme } from '@/themes/theme-provider'

const STORAGE_KEY = 'divedispatch-bg-pref'
type BgKey = 'ocean' | 'coral'

export function BgSwitcher() {
  const { setTheme } = useTheme()
  const [bg, setBg] = useState<BgKey>(() => {
    if (typeof window === 'undefined') return 'ocean'
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'coral' ? 'coral' : 'ocean'
  })

  useEffect(() => {
    const skin = SKINS.find(s => s.id === bg) ?? SKINS[0]
    setTheme(skin)
  }, [bg, setTheme])

  function toggle() {
    const next: BgKey = bg === 'ocean' ? 'coral' : 'ocean'
    setBg(next)
    localStorage.setItem(STORAGE_KEY, next)
    const skin = SKINS.find(s => s.id === next) ?? SKINS[0]
    setTheme(skin)
  }

  const Icon = bg === 'ocean' ? Waves : Sun

  return (
    <button
      aria-label={bg === 'ocean' ? 'Switch to coral background' : 'Switch to ocean background'}
      onClick={toggle}
      className="flex items-center justify-center w-8 h-8 rounded-full transition-all"
      style={{
        background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
        color: 'var(--color-text-secondary)',
        transitionDuration: 'var(--transition-speed)',
      }}
    >
      <Icon size={15} />
    </button>
  )
}
