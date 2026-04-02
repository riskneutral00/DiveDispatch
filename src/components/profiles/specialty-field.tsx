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

const PILL_GAP = 6 // gap-1.5 = 6px
const MORE_BTN_WIDTH = 58 // "More…" button measured width

interface OverflowResult {
  containerRef: React.RefObject<HTMLDivElement | null>
  registerPill: (idx: number, el: HTMLElement | null) => void
  registerMandatory: (idx: number, el: HTMLElement | null) => void
  row1Count: number
  row2Count: number
  measured: boolean
}

function useTwoRowOverflow(toggleableCount: number, mandatoryCount: number): OverflowResult {
  const containerRef = useRef<HTMLDivElement>(null)
  const pillEls = useRef<Map<number, HTMLElement>>(new Map())
  const mandatoryEls = useRef<Map<number, HTMLElement>>(new Map())
  const [row1Count, setRow1Count] = useState(toggleableCount)
  const [row2Count, setRow2Count] = useState(0)
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

    // Row 2: mandatory pills are always present.
    // Calculate reserved space = mandatory + More button (if there will be overflow)
    // Fill remaining space from the left with toggleable overflow pills.
    const remaining = toggleableCount - r1
    let r2 = 0

    if (remaining > 0) {
      // We'll always show More... since we need to figure out how many fit first
      // Reserved = mandatory pills + gap + More button
      const reservedBase = mandatoryWidth + (mandatoryWidth > 0 ? PILL_GAP : 0) + MORE_BTN_WIDTH
      let used = 0

      for (let i = r1; i < toggleableCount; i++) {
        const el = pillEls.current.get(i)
        if (!el) continue
        const pillW = el.offsetWidth
        const needed = used === 0 ? pillW : PILL_GAP + pillW
        // Check if adding this pill + reserved still fits
        const totalNeeded = used + needed + (used === 0 && reservedBase > 0 ? PILL_GAP : 0) + reservedBase
        // Actually: used + needed is the toggleable portion, then gap + reserved
        const afterAdd = used + needed
        const withReserved = afterAdd + PILL_GAP + reservedBase
        if (withReserved > containerWidth && used > 0) break
        if (afterAdd + PILL_GAP + reservedBase > containerWidth && used === 0) break
        used += needed
        r2++
      }

      // If all remaining fit on row 2, no More... button needed — reclaim that space
      if (r2 === remaining) {
        // Verify they fit without More button
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

    setRow1Count(r1)
    setRow2Count(r2)
    setMeasured(true)
  }, [toggleableCount, mandatoryCount])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const raf = requestAnimationFrame(() => measure())
    const ro = new ResizeObserver(() => measure())
    ro.observe(container)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [measure])

  return { containerRef, registerPill, registerMandatory, row1Count, row2Count, measured }
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

  const { containerRef, registerPill, registerMandatory, row1Count, row2Count, measured } =
    useTwoRowOverflow(toggleable.length, mandatorySpecs.length)

  const row1Pills = toggleable.slice(0, row1Count)
  const row2Pills = toggleable.slice(row1Count, row1Count + row2Count)
  const overflowPills = toggleable.slice(row1Count + row2Count)

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
        <span className="ml-2 text-[10px] opacity-70">{value.length} / {requiredCount}</span>
      </p>

      {/* Hidden measurement layer */}
      <div
        ref={containerRef}
        aria-hidden
        className="flex flex-wrap gap-1.5"
        style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', width: '100%' }}
      >
        {toggleable.map(({ code, label }, i) => (
          <span
            key={code}
            ref={(el) => registerPill(i, el)}
            className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium border border-transparent"
          >
            {label}
          </span>
        ))}
        {mandatorySpecs.map(({ code, label }, i) => (
          <span
            key={code}
            ref={(el) => registerMandatory(i, el)}
            className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium border border-transparent"
          >
            {label}
          </span>
        ))}
      </div>

      {/* Visible layout */}
      <div className="flex flex-col gap-1.5" style={{ opacity: measured ? 1 : 0 }}>
        {/* Row 1: toggleable specialties */}
        {row1Pills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {row1Pills.map(({ code, label }) => (
              <SpecialtyPill
                key={code}
                label={label}
                checked={value.includes(code)}
                disabled={disabled || (!value.includes(code) && atMax)}
                onToggle={() => toggle(code)}
              />
            ))}
          </div>
        )}

        {/* Row 2: [overflow toggleable] ... Nav, Deep, More... */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {row2Pills.map(({ code, label }) => (
            <SpecialtyPill
              key={code}
              label={label}
              checked={value.includes(code)}
              disabled={disabled || (!value.includes(code) && atMax)}
              onToggle={() => toggle(code)}
            />
          ))}
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
      className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium transition-all ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
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
      className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium cursor-not-allowed"
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
