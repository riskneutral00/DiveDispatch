'use client'

import { useState, useEffect, useRef, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { TOUCH_TOOLTIP_MS } from '@/lib/constants/ui-timings'

interface TooltipProps {
  label: string
  children: ReactNode
  className?: string
}

export function Tooltip({ label, children, className }: TooltipProps) {
  const tooltipId = useId()
  const [showTouch, setShowTouch] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLSpanElement>(null)

  const visible = showTouch || hovered

  useEffect(() => {
    if (!visible || !ref.current) {
      setPos(null)
      return
    }
    const rect = ref.current.getBoundingClientRect()
    setPos({
      top: rect.top + window.scrollY - 8,
      left: rect.left + window.scrollX + rect.width / 2,
    })
  }, [visible])

  useEffect(() => {
    if (!showTouch) return
    const timer = setTimeout(() => setShowTouch(false), TOUCH_TOOLTIP_MS)
    return () => clearTimeout(timer)
  }, [showTouch])

  useEffect(() => {
    if (!showTouch) return
    function handleOutside(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowTouch(false)
      }
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [showTouch])

  function handleClick(e: React.MouseEvent) {
    if (!window.matchMedia('(hover: none)').matches) return
    if (!showTouch) {
      e.preventDefault()
      e.stopPropagation()
      setShowTouch(true)
    } else {
      setShowTouch(false)
    }
  }

  return (
    <span
      ref={ref}
      className={`relative inline-flex ${className ?? ''}`}
      aria-describedby={visible ? tooltipId : undefined}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      {visible && pos && createPortal(
        <span
          id={tooltipId}
          className="pointer-events-none fixed px-3 py-1.5 rounded-[var(--border-radius-button)] text-body font-semibold whitespace-nowrap shadow-lg"
          style={{
            top: pos.top,
            left: pos.left,
            transform: 'translate(-50%, -100%)',
            zIndex: 'var(--z-tooltip)',
            background: 'var(--color-tooltip-bg)',
            color: 'var(--color-tooltip-text)',
          }}
          role="tooltip"
        >
          {label}
        </span>,
        document.body,
      )}
    </span>
  )
}
