'use client'

import { Layers, Layers2 } from 'lucide-react'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'divedispatch-hover-effect'

export function OpacityToggle() {
  const [hoverOn, setHoverOn] = useState(true)

  // Initialize from localStorage + set data attribute
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    const initial = stored === null ? true : stored === 'on'
    setHoverOn(initial)
    document.documentElement.setAttribute('data-hover-effect', initial ? 'on' : 'off')
  }, [])

  function toggle() {
    const next = !hoverOn
    setHoverOn(next)
    document.documentElement.setAttribute('data-hover-effect', next ? 'on' : 'off')
    localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
  }

  return (
    <button
      aria-label={hoverOn ? 'Disable border glow on hover' : 'Enable border glow on hover'}
      onClick={toggle}
      className="flex items-center justify-center w-8 h-8 rounded-full transition-all cursor-pointer text-secondary"
      style={{ background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
        transitionDuration: 'var(--transition-speed)' }}
    >
      {hoverOn ? <Layers size={15} /> : <Layers2 size={15} />}
    </button>
  )
}
