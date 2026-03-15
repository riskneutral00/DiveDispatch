'use client'

import { useCallback, useEffect } from 'react'
import { Calendar } from 'lucide-react'
import { GlassInput } from '@/components/glass'
import { COURSE_CATALOG, type CourseCode } from '@/lib/constants/course-catalog'
import type { DetailsState, WizardAction } from '@/lib/booking/wizard-state'
import type { Dispatch } from 'react'

// ── Course display list (deduplicated by code) ────────────────────────────────

interface CourseDisplay {
  code: CourseCode
  label: string
}

function buildDisplayList(): CourseDisplay[] {
  const seen = new Set<CourseCode>()
  const result: CourseDisplay[] = []
  for (const entry of COURSE_CATALOG) {
    if (seen.has(entry.code)) continue
    seen.add(entry.code)
    result.push({ code: entry.code, label: entry.name })
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
  onValidityChange?: (valid: boolean) => void
}

export function StepDetails({ details, dispatch, onValidityChange }: DetailsStepProps) {
  const { activityType, startDate, endDate, portalContact, portalMedical, portalWaiver } = details

  // Validity: dates only — activityType is derived from divers (step 2)
  useEffect(() => {
    if (!onValidityChange) return
    const hasValidDates =
      !!startDate && !!endDate && endDate >= startDate
    onValidityChange(hasValidDates)
  }, [startDate, endDate, onValidityChange])

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
      {/* ── Activity Types (derived from divers) ── */}
      <section>
        <h3 className="text-xs font-semibold mb-3" style={sectionHeadingStyle}>
          Activity Types
        </h3>
        {activityType.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Courses will appear here after divers are added in the next step.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activityType.map((code) => {
              const course = COURSE_DISPLAY_LIST.find((c) => c.code === code)
              return (
                <span
                  key={code}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{
                    background: 'var(--color-primary)',
                    color: 'var(--color-text-on-primary)',
                  }}
                >
                  {course?.label ?? code}
                </span>
              )
            })}
          </div>
        )}
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
          Each diver selects their own activity type in the next step. This is the combined set.
        </p>
      </section>

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
        <div
          className="rounded-[var(--border-radius)] p-4"
          style={{ background: 'var(--color-glass-bg)', border: '1px solid var(--color-glass-border)' }}
        >
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
        </div>
      </section>
    </div>
  )
}
