'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PillToggleGroup } from '@/components/ui/pill-toggle'
import { AGENCIES, getMandatorySpecialties, type AgencySpecialty } from '@/lib/constants/agencies'

/* ── Display-layer reorder (presentation only — agencies.ts untouched) ────── */

const PADI_DISPLAY_ORDER = [
  'PPB', 'Night', 'Drift', 'Wreck',
  'Fish ID', 'Boat', 'Dry Suit', 'Photography', 'S&R', 'DUW Photo',
]

function reorderToggleable(specs: AgencySpecialty[], agencyCode: string, mandatoryCodes: Set<string>): AgencySpecialty[] {
  const toggleable = specs.filter((s) => !s.mandatory && !mandatoryCodes.has(s.code))
  if (agencyCode !== 'PADI') return toggleable
  const order = PADI_DISPLAY_ORDER
  return [...toggleable].sort((a, b) => {
    const ai = order.indexOf(a.code)
    const bi = order.indexOf(b.code)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
}

/* ── Two-row overflow hook ────────────────────────────────────────────────── */

const PILL_GAP = 8 // gap-2 = 8px
const MORE_BTN_WIDTH = 58 // "More…" button measured width

interface OverflowResult {
  containerRef: React.RefObject<HTMLDivElement | null>
  registerPill: (idx: number, el: HTMLElement | null) => void
  registerMandatory: (idx: number, el: HTMLElement | null) => void
  /** First toggleable index that doesn't fit in 2 rows */
  overflowStart: number
  measured: boolean
}

function useTwoRowOverflow(toggleableCount: number, mandatoryCount: number): OverflowResult {
  const containerRef = useRef<HTMLDivElement>(null)
  const pillEls = useRef<Map<number, HTMLElement>>(new Map())
  const mandatoryEls = useRef<Map<number, HTMLElement>>(new Map())
  const [overflowStart, setOverflowStart] = useState(toggleableCount)
  const [measured, setMeasured] = useState(false)

  const registerPill = useCallback((idx: number, el: HTMLElement | null) => {
    if (el) pillEls.current.set(idx, el)
    else pillEls.current.delete(idx)
  }, [])

  const registerMandatory = useCallback((idx: number, el: HTMLElement | null) => {
    if (el) mandatoryEls.current.set(idx, el)
    else mandatoryEls.current.delete(idx)
  }, [])

  const measure = useCallback(() => {
    const container = containerRef.current
    if (!container || pillEls.current.size === 0) return

    const containerWidth = container.offsetWidth
    if (containerWidth === 0) return

    // Measure mandatory pills total width
    let mandatoryWidth = 0
    for (let i = 0; i < mandatoryCount; i++) {
      const el = mandatoryEls.current.get(i)
      if (!el) continue
      mandatoryWidth += (mandatoryWidth === 0 ? 0 : PILL_GAP) + el.offsetWidth
    }

    // Row 1: fill with toggleable pills
    let rowUsed = 0
    let r1 = 0
    for (let i = 0; i < toggleableCount; i++) {
      const el = pillEls.current.get(i)
      if (!el) continue
      const needed = rowUsed === 0 ? el.offsetWidth : PILL_GAP + el.offsetWidth
      if (rowUsed + needed > containerWidth && rowUsed > 0) break
      rowUsed += needed
      r1++
    }

    // Row 2: fill remaining toggleable pills alongside mandatory + More button
    const remaining = toggleableCount - r1
    let r2 = 0

    if (remaining > 0) {
      const reservedBase = mandatoryWidth + (mandatoryWidth > 0 ? PILL_GAP : 0) + MORE_BTN_WIDTH
      let used = 0

      for (let i = r1; i < toggleableCount; i++) {
        const el = pillEls.current.get(i)
        if (!el) continue
        const needed = used === 0 ? el.offsetWidth : PILL_GAP + el.offsetWidth
        const afterAdd = used + needed
        if (afterAdd + PILL_GAP + reservedBase > containerWidth && used > 0) break
        if (afterAdd + PILL_GAP + reservedBase > containerWidth && used === 0) break
        used += needed
        r2++
      }

      // If all remaining fit, no More button needed — reclaim that space
      if (r2 === remaining) {
        const reservedNoMore = mandatoryWidth
        let checkUsed = 0
        let fits = 0
        for (let i = r1; i < r1 + remaining; i++) {
          const el = pillEls.current.get(i)
          if (!el) continue
          const needed = checkUsed === 0 ? el.offsetWidth : PILL_GAP + el.offsetWidth
          const withMandatory = checkUsed + needed + (reservedNoMore > 0 ? PILL_GAP + reservedNoMore : 0)
          if (withMandatory > containerWidth && checkUsed > 0) break
          checkUsed += needed
          fits++
        }
        r2 = fits
      }
    }

    setOverflowStart(r1 + r2)
    setMeasured(true)
  }, [toggleableCount, mandatoryCount])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let rafId = requestAnimationFrame(() => measure())
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => measure())
    })
    ro.observe(container)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [measure])

  return { containerRef, registerPill, registerMandatory, overflowStart, measured }
}

/* ── SpecialtyField ───────────────────────────────────────────────────────── */

interface SpecialtyFieldProps {
  agencyCode: string
  value: string[]
  onChange: (specialties: string[]) => void
  disabled?: boolean
}

export function SpecialtyField({
  agencyCode,
  value,
  onChange,
  disabled,
}: SpecialtyFieldProps) {
  const agency = AGENCIES[agencyCode]
  const specialties = agency?.specialties ?? AGENCIES.PADI.specialties
  const mandatoryCodes = getMandatorySpecialties(agencyCode || 'PADI')
  const requiredCount = agency?.specialtyCount ?? 5
  const atMax = value.length >= requiredCount

  const toggleable = reorderToggleable(specialties, agencyCode || 'PADI', mandatoryCodes)
  const mandatorySpecs = specialties.filter((s) => s.mandatory || mandatoryCodes.has(s.code))

  const { containerRef, registerPill, registerMandatory, overflowStart, measured } =
    useTwoRowOverflow(toggleable.length, mandatorySpecs.length)

  const overflowPills = toggleable.slice(overflowStart)

  function toggle(code: string) {
    if (mandatoryCodes.has(code)) return
    if (value.includes(code)) {
      onChange(value.filter((s) => s !== code))
    } else {
      if (atMax) return
      onChange([...value, code])
    }
  }

  return (
    <div className="relative flex flex-col gap-1.5 min-w-0">
      <p className="text-sm font-medium text-secondary">
        Default Specialties<span style={{ color: 'var(--color-destructive)' }}> *</span>
        <span className="ml-2 text-[10px] opacity-70">{value.length} / {requiredCount}</span> {/* design-ok */}
      </p>

      {/* Hidden measurement layer — always in DOM, never conditional */}
      <div
        ref={containerRef}
        aria-hidden
        className="flex flex-wrap gap-2"
        style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', width: '100%' }}
      >
        {toggleable.map(({ code, label }, i) => (
          <span
            key={code}
            ref={(el) => registerPill(i, el)}
            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-transparent"
          >
            {label}
          </span>
        ))}
        {mandatorySpecs.map(({ code, label }, i) => (
          <span
            key={code}
            ref={(el) => registerMandatory(i, el)}
            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-transparent"
          >
            {label}
          </span>
        ))}
      </div>

      {/* Visible layout — ONE container, no row splitting.
          Pills never move between parent elements, preventing insertBefore crashes. */}
      <div className="flex flex-wrap gap-2 items-center" style={{ opacity: measured ? 1 : 0 }}>
        {toggleable.map(({ code, label }, i) => {
          if (i >= overflowStart) return null
          return (
            <SpecialtyPill
              key={code}
              label={label}
              checked={value.includes(code)}
              disabled={disabled || (!value.includes(code) && atMax)}
              onToggle={() => toggle(code)}
            />
          )
        })}
        {mandatorySpecs.map(({ code, label }) => (
          <MandatoryPill key={code} label={label} />
        ))}
        {overflowPills.length > 0 && (
          <PillToggleGroup
            overflowItems={
              <>
                {overflowPills.map(({ code, label }) => (
                  <SpecialtyPill
                    key={code}
                    label={label}
                    checked={value.includes(code)}
                    disabled={disabled || (!value.includes(code) && atMax)}
                    onToggle={() => toggle(code)}
                  />
                ))}
              </>
            }
          >
            <></>
          </PillToggleGroup>
        )}
      </div>
    </div>
  )
}

/* ── SpecialtyPill (toggleable) ───────────────────────────────────────────── */

interface SpecialtyPillProps {
  label: string
  checked: boolean
  disabled?: boolean
  onToggle: () => void
}

function SpecialtyPill({ label, checked, disabled, onToggle }: SpecialtyPillProps) {
  return (
    <label
      className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      style={{
        background: checked ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
        color: checked ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
        border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-glass-border)'}`,
        opacity: disabled && !checked ? 0.4 : 1,
        transitionDuration: 'var(--transition-speed)',
      }}
      aria-disabled={disabled || undefined}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
      />
      {label}
    </label>
  )
}

/* ── MandatoryPill (non-clickable, disabled appearance) ───────────────────── */

function MandatoryPill({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium cursor-not-allowed"
      style={{
        background: 'var(--color-primary)',
        color: 'var(--color-text-on-primary)',
        border: '1px solid var(--color-primary)',
        opacity: 0.5,
      }}
      aria-disabled="true"
    >
      {label}
    </span>
  )
}
