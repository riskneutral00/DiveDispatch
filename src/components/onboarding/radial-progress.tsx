'use client'

import { useState, useRef, useEffect } from 'react'
import { GlassCard } from '@/components/glass'

interface RadialProgressProps {
  percentage: number
  incomplete: string[]
  size?: number
}

export function RadialProgress({ percentage, incomplete, size = 40 }: RadialProgressProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const isComplete = percentage >= 100

  return (
    <div ref={ref} className="relative" style={{ display: 'inline-block' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Profile ${percentage}% complete`}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-glass-border)"
            strokeWidth={3}
          />
          {/* Fill */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isComplete ? 'var(--color-success)' : 'var(--color-primary)'}
            strokeWidth={3}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s ease' }}
          />
        </svg>
        {/* Percentage label in center */}
        <span
          style={{
            position: 'absolute',
            fontSize: '10px',
            fontWeight: 600,
            color: isComplete ? 'var(--color-success)' : 'var(--color-text-secondary)',
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          {percentage}%
        </span>
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: size + 8, zIndex: 50, minWidth: 200 }}>
          <GlassCard padding="sm">
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-text-secondary)',
                marginBottom: 8,
              }}
            >
              Profile completion
            </p>
            {isComplete ? (
              <p style={{ fontSize: 13, color: 'var(--color-success)' }}>All done! ✓</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {incomplete.map((item) => (
                  <li
                    key={item}
                    style={{
                      fontSize: 13,
                      color: 'var(--color-text-primary)',
                      padding: '3px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{ color: 'var(--color-warning)', fontSize: 10 }}>●</span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  )
}
