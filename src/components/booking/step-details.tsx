'use client'

import { useState, useCallback } from 'react'
import { Calendar, Check } from 'lucide-react'
import { GlassCard, GlassInput } from '@/components/glass'
import { COURSE_CATALOG, type CourseCode } from '@/lib/constants/course-catalog'
import type { DetailsState, WizardAction } from '@/lib/booking/wizard-state'
import type { Dispatch } from 'react'

// ── AOW specialty data (per DOMAIN_KNOWLEDGE § 4) ─────────────────────────────

const AOW_REQUIRED = ['Navigation', 'Deep'] as const
const AOW_ELECTIVES = [
  'Peak Performance Buoyancy',
  'Night Dive',
  'Search & Recovery',
  'Dry Suit',
  'Boat Dive',
  'Altitude',
  'Drift',
  'Multilevel',
  'Digital Underwater Photography',
  'Underwater Naturalist',
  'Wreck Dive',
] as const

type AOWElective = (typeof AOW_ELECTIVES)[number]

// ── Course display list (deduplicated by code) ────────────────────────────────

interface CourseDisplay {
  code: CourseCode
  label: string
  agencyLabel: string
  minDays: number
}

function buildDisplayList(): CourseDisplay[] {
  const seen = new Set<CourseCode>()
  const result: CourseDisplay[] = []
  for (const entry of COURSE_CATALOG) {
    if (seen.has(entry.code)) continue
    seen.add(entry.code)
    const siblings = COURSE_CATALOG.filter(
      (c) => c.code === entry.code && c.agency !== 'Universal',
    )
    const agencyLabel =
      entry.agency === 'Universal'
        ? 'Agency-Free'
        : siblings.length > 1
          ? 'PADI / SSI'
          : entry.agency
    result.push({ code: entry.code, label: entry.name, agencyLabel, minDays: entry.minDays })
  }
  return result
}

const COURSE_DISPLAY_LIST = buildDisplayList()

// ── Helpers ───────────────────────────────────────────────────────────────────

function maxMinDaysFor(codes: CourseCode[]): number {
  if (codes.length === 0) return 1
  return Math.max(
    ...codes.map((code) => COURSE_CATALOG.find((c) => c.code === code)?.minDays ?? 1),
  )
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return dt.toISOString().split('T')[0]
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DetailsStepProps {
  details: DetailsState
  dispatch: Dispatch<WizardAction>
}

export function StepDetails({ details, dispatch }: DetailsStepProps) {
  const { activityType, startDate, endDate, portalContact, portalMedical, portalWaiver } = details

  // AOW specialties live in local state — not persisted to wizard state
  // (DetailsState has no aowSpecialties field; downstream steps can derive from activityType)
  const [aowElectives, setAowElectives] = useState<Set<AOWElective>>(new Set())

  const toggleCourse = useCallback(
    (code: CourseCode) => {
      const next = activityType.includes(code)
        ? activityType.filter((c) => c !== code)
        : [...activityType, code]

      // Auto-extend endDate when selected courses require more days
      const minDays = maxMinDaysFor(next)
      const minEnd = addDays(startDate, minDays - 1)
      const newEnd = endDate < minEnd ? minEnd : endDate

      dispatch({ type: 'UPDATE_FIELD', payload: { activityType: next, endDate: newEnd } })
    },
    [activityType, startDate, endDate, dispatch],
  )

  const handleStartDate = useCallback(
    (newStart: string) => {
      const minDays = maxMinDaysFor(activityType)
      const minEnd = addDays(newStart, minDays - 1)
      const newEnd = endDate < minEnd ? minEnd : endDate
      dispatch({ type: 'UPDATE_FIELD', payload: { startDate: newStart, endDate: newEnd } })
    },
    [activityType, endDate, dispatch],
  )

  const handleEndDate = useCallback(
    (newEnd: string) => {
      const minDays = maxMinDaysFor(activityType)
      const minEnd = addDays(startDate, minDays - 1)
      // Silently enforce minimum — user sees the min attr on the input
      if (newEnd >= minEnd) {
        dispatch({ type: 'UPDATE_FIELD', payload: { endDate: newEnd } })
      }
    },
    [activityType, startDate, dispatch],
  )

  const toggleElective = useCallback((name: AOWElective) => {
    setAowElectives((prev) => {
      const next = new Set(prev)
      if (next.has(name)) { next.delete(name) } else { next.add(name) }
      return next
    })
  }, [])

  const isAOWSelected = activityType.includes('AOW')
  const minDays = maxMinDaysFor(activityType)
  const minEndDate = addDays(startDate, minDays - 1)

  const sectionHeadingStyle: React.CSSProperties = {
    color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-body)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Activity Type ── */}
      <section>
        <h3 className="text-xs font-semibold mb-3" style={sectionHeadingStyle}>
          Activity Type
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {COURSE_DISPLAY_LIST.map(({ code, label, agencyLabel, minDays: cMin }) => {
            const selected = activityType.includes(code)
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggleCourse(code)}
                aria-pressed={selected}
                className="relative text-left rounded-lg border px-3 py-2.5 transition-all focus:outline-none focus-visible:ring-2"
                style={{
                  backgroundColor: selected ? 'var(--color-primary)' : 'var(--color-glass-bg)',
                  borderColor: selected ? 'var(--color-primary)' : 'var(--color-glass-border)',
                  backdropFilter: 'blur(var(--glass-blur))',
                  WebkitBackdropFilter: 'blur(var(--glass-blur))',
                  color: selected ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
                  outlineColor: 'var(--color-accent)',
                  transitionDuration: 'var(--transition-speed)',
                }}
              >
                {selected && (
                  <span className="absolute top-2 right-2">
                    <Check size={12} />
                  </span>
                )}
                <span className="block text-sm font-medium leading-snug pr-4">{label}</span>
                <span className="block text-xs mt-0.5 opacity-70">{agencyLabel}</span>
                <span className="block text-xs opacity-60">
                  {cMin}+ day{cMin !== 1 ? 's' : ''}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── AOW Specialties ── */}
      {isAOWSelected && (
        <section>
          <h3 className="text-xs font-semibold mb-1" style={sectionHeadingStyle}>
            AOW Specialties
          </h3>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Navigation + Deep are required. Select 3 electives.
          </p>
          <GlassCard padding="sm">
            <div className="flex flex-col gap-2.5">
              {AOW_REQUIRED.map((name) => (
                <label key={name} className="flex items-center gap-2.5 cursor-not-allowed">
                  <input
                    type="checkbox"
                    checked
                    disabled
                    readOnly
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <span className="text-sm flex-1" style={{ color: 'var(--color-text-primary)' }}>
                    {name}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Required
                  </span>
                </label>
              ))}
              {AOW_ELECTIVES.map((name) => (
                <label key={name} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aowElectives.has(name)}
                    onChange={() => toggleElective(name)}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    {name}
                  </span>
                </label>
              ))}
            </div>
          </GlassCard>
        </section>
      )}

      {/* ── Date Range ── */}
      <section>
        <h3 className="text-xs font-semibold mb-3" style={sectionHeadingStyle}>
          Date Range
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            type="date"
            label="Start Date"
            value={startDate}
            onChange={(e) => handleStartDate(e.target.value)}
            leadingIcon={<Calendar size={15} />}
          />
          <GlassInput
            type="date"
            label="End Date"
            value={endDate}
            min={minEndDate}
            onChange={(e) => handleEndDate(e.target.value)}
            leadingIcon={<Calendar size={15} />}
          />
        </div>
        {activityType.length > 0 && (
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            {minDays} day{minDays !== 1 ? 's' : ''} minimum for selected course
            {activityType.length !== 1 ? 's' : ''}
          </p>
        )}
      </section>

      {/* ── Portal Settings ── */}
      <section>
        <h3 className="text-xs font-semibold mb-3" style={sectionHeadingStyle}>
          Customer Portal Forms
        </h3>
        <GlassCard padding="sm">
          <div className="flex flex-col gap-2.5">
            {(
              [
                { key: 'portalContact', label: 'Contact & Certification', value: portalContact },
                { key: 'portalMedical', label: 'Medical Questionnaire', value: portalMedical },
                { key: 'portalWaiver', label: 'Liability Waiver', value: portalWaiver },
              ] as const
            ).map(({ key, label, value }) => (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) =>
                    dispatch({ type: 'UPDATE_FIELD', payload: { [key]: e.target.checked } })
                  }
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  {label}
                </span>
              </label>
            ))}
          </div>
        </GlassCard>
      </section>
    </div>
  )
}
