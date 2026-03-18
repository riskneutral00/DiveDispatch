'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { GlassCard, GlassInput } from '@/components/glass'
import type { WizardState, WizardAction, DayConfig } from '@/lib/booking/wizard-state'
import type { Dispatch } from 'react'
import { ChevronDown, ExternalLink } from 'lucide-react'

interface ResourceStepProps {
  state: WizardState
  dispatch: Dispatch<WizardAction>
}

// ── ResourceOption ──────────────────────────────────────────────────────────

interface ResourceOption {
  id: string
  label: string
}

// ── SelectField ─────────────────────────────────────────────────────────────

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: ResourceOption[]
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-xs font-medium"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
      >
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="glass glass-field w-full text-sm py-2 pl-3 pr-8 appearance-none"
          style={{ color: value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
        >
          <option value="">{placeholder}</option>
          <option value="__external__">External (not in system)</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }} />
      </div>
    </div>
  )
}

// ── PerDayInstructorRow ─────────────────────────────────────────────────────

function PerDayInstructorRow({
  day,
  dayIndex,
  dayNumber,
  instructorOptions,
  dispatch,
  totalDays,
}: {
  day: DayConfig
  dayIndex: number
  dayNumber: number
  instructorOptions: ResourceOption[]
  dispatch: Dispatch<WizardAction>
  totalDays: number
}) {
  const isExternal = day.instructorSlug === '__external__'

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-[var(--border-radius)] border"
      style={{ borderColor: 'var(--color-glass-border)', background: 'var(--color-glass-bg)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-heading)' }}
        >
          Day {dayNumber}
        </span>
        <span className="text-xs capitalize" style={{ color: 'var(--color-text-secondary)' }}>
          {day.venueType} · {day.date}
        </span>
        <span className="text-xs ml-auto" style={{ color: 'var(--color-text-secondary)' }}>
          {day.dives.length} dive{day.dives.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isExternal ? (
        <div className="flex flex-col gap-1">
          <GlassInput
            label="Instructor (external)"
            value={day.externalInstructorName ?? ''}
            onChange={(e) =>
              dispatch({ type: 'UPDATE_DAY', dayIndex, patch: { externalInstructorName: e.target.value } })
            }
            placeholder="Instructor name"
          />
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'SET_DAY_INSTRUCTOR', dayIndex, slug: '' })
              dispatch({ type: 'UPDATE_DAY', dayIndex, patch: { externalInstructorName: '' } })
            }}
            className="text-xs underline underline-offset-2 text-left"
            style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}
          >
            Switch to system instructor
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <SelectField
            label="Instructor"
            value={day.instructorSlug ?? ''}
            onChange={(v) => dispatch({ type: 'SET_DAY_INSTRUCTOR', dayIndex, slug: v })}
            options={instructorOptions}
            placeholder="Select instructor…"
          />
          {day.instructorSlug && dayIndex < totalDays - 1 && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'APPLY_INSTRUCTOR_TO_REMAINING', fromDayIndex: dayIndex, slug: day.instructorSlug! })}
              className="text-xs text-left"
              style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
            >
              → Use for remaining days
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export function ResourceStep({ state, dispatch }: ResourceStepProps) {
  const { days } = state

  // Load resources
  const instructors = useQuery(api.directory.listByRole, { role: 'Instructor' }) ?? []
  const boats = useQuery(api.directory.listByRole, { role: 'Boat' }) ?? []
  const pools = useQuery(api.directory.listByRole, { role: 'Pool' }) ?? []

  const instructorOptions: ResourceOption[] = instructors.map((r) => ({ id: r.slug, label: r.name }))
  const boatOptions: ResourceOption[] = boats.map((r) => ({ id: r.slug, label: r.name }))
  const poolOptions: ResourceOption[] = pools.map((r) => ({ id: r.slug, label: r.name }))

  // Derive which venue types need resources
  const hasBoatDays = days.some((d) => d.venueType === 'boat')
  const hasPoolDays = days.some((d) => d.venueType === 'pool')

  return (
    <div className="flex flex-col gap-5">
      {/* Per-day instructors */}
      <div className="flex flex-col gap-3">
        <h3
          className="text-sm font-semibold"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
        >
          Instructors (per day)
        </h3>
        {days.map((day, idx) => (
          <PerDayInstructorRow
            key={day.date + idx}
            day={day}
            dayIndex={idx}
            dayNumber={idx + 1}
            instructorOptions={instructorOptions}
            dispatch={dispatch}
            totalDays={days.length}
          />
        ))}
      </div>

      {/* Per-booking venue resources */}
      <GlassCard padding="md" elevated>
        <h3
          className="text-sm font-semibold mb-3"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
        >
          Venue Resources
        </h3>
        <div className="flex flex-col gap-3">
          {hasBoatDays && (
            <VenueResourceRow
              label="Boat"
              venueType="boat"
              days={days}
              options={boatOptions}
              dispatch={dispatch}
            />
          )}
          {hasPoolDays && (
            <VenueResourceRow
              label="Pool"
              venueType="pool"
              days={days}
              options={poolOptions}
              dispatch={dispatch}
            />
          )}
          {!hasBoatDays && !hasPoolDays && (
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Shore days don't require venue resources.
            </p>
          )}
        </div>
      </GlassCard>

      {/* Equipment & Compressor */}
      <GlassCard padding="md" elevated>
        <h3
          className="text-sm font-semibold mb-3"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
        >
          Equipment & Compressor
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Equipment Manager */}
          <div className="flex flex-col gap-1.5">
            {state.equipmentIsExternal ? (
              <div className="flex flex-col gap-1">
                <GlassInput
                  label="Equipment Manager (external)"
                  value={state.externalEquipmentName}
                  onChange={(e) => dispatch({ type: 'SET_EXTERNAL_EQUIPMENT_NAME', value: e.target.value })}
                  placeholder="Equipment manager name"
                />
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_EQUIPMENT_EXTERNAL', value: false })}
                  className="text-xs underline underline-offset-2 text-left"
                  style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}
                >
                  Switch to system
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <SelectField
                  label="Equipment Manager"
                  value={state.equipment}
                  onChange={(v) => {
                    if (v === '__external__') {
                      dispatch({ type: 'SET_EQUIPMENT_EXTERNAL', value: true })
                      dispatch({ type: 'SET_EQUIPMENT', value: '' })
                    } else {
                      dispatch({ type: 'SET_EQUIPMENT', value: v })
                    }
                  }}
                  options={[]}
                  placeholder="Select equipment manager…"
                />
              </div>
            )}
          </div>

          {/* Compressor */}
          <div className="flex flex-col gap-1.5">
            {state.compressorIsExternal ? (
              <div className="flex flex-col gap-1">
                <GlassInput
                  label="Compressor (external)"
                  value={state.externalCompressorName}
                  onChange={(e) => dispatch({ type: 'SET_EXTERNAL_COMPRESSOR_NAME', value: e.target.value })}
                  placeholder="Compressor name"
                />
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_COMPRESSOR_EXTERNAL', value: false })}
                  className="text-xs underline underline-offset-2 text-left"
                  style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}
                >
                  Switch to system
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <SelectField
                  label="Compressor"
                  value={state.compressor}
                  onChange={(v) => {
                    if (v === '__external__') {
                      dispatch({ type: 'SET_COMPRESSOR_EXTERNAL', value: true })
                      dispatch({ type: 'SET_COMPRESSOR', value: '' })
                    } else {
                      dispatch({ type: 'SET_COMPRESSOR', value: v })
                    }
                  }}
                  options={[]}
                  placeholder="Select compressor…"
                />
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

// ── VenueResourceRow ────────────────────────────────────────────────────────

function VenueResourceRow({
  label,
  venueType,
  days,
  options,
  dispatch,
}: {
  label: string
  venueType: 'boat' | 'pool'
  days: DayConfig[]
  options: ResourceOption[]
  dispatch: Dispatch<WizardAction>
}) {
  // Find first day of this venue type to get/set the value
  const firstDayIdx = days.findIndex((d) => d.venueType === venueType)
  if (firstDayIdx < 0) return null

  const day = days[firstDayIdx]
  const currentId = venueType === 'pool' ? (day.poolInventoryUnitId ?? '') : (day.inventoryUnitId ?? '')
  const externalName = venueType === 'pool' ? (day.externalPoolName ?? '') : (day.externalVenueName ?? '')
  const isExternal = currentId === '__external__'

  function handleChange(v: string) {
    // Apply to all days of same venue type
    for (let i = 0; i < days.length; i++) {
      if (days[i].venueType !== venueType) continue
      if (venueType === 'pool') {
        dispatch({ type: 'UPDATE_DAY', dayIndex: i, patch: { poolInventoryUnitId: v, externalPoolName: '' } })
      } else {
        dispatch({ type: 'UPDATE_DAY', dayIndex: i, patch: { inventoryUnitId: v, externalVenueName: '' } })
      }
    }
  }

  function handleExternalNameChange(name: string) {
    for (let i = 0; i < days.length; i++) {
      if (days[i].venueType !== venueType) continue
      if (venueType === 'pool') {
        dispatch({ type: 'UPDATE_DAY', dayIndex: i, patch: { externalPoolName: name } })
      } else {
        dispatch({ type: 'UPDATE_DAY', dayIndex: i, patch: { externalVenueName: name } })
      }
    }
  }

  function switchToSystem() {
    for (let i = 0; i < days.length; i++) {
      if (days[i].venueType !== venueType) continue
      if (venueType === 'pool') {
        dispatch({ type: 'UPDATE_DAY', dayIndex: i, patch: { poolInventoryUnitId: '', externalPoolName: '' } })
      } else {
        dispatch({ type: 'UPDATE_DAY', dayIndex: i, patch: { inventoryUnitId: '', externalVenueName: '' } })
      }
    }
  }

  if (isExternal) {
    return (
      <div className="flex flex-col gap-1">
        <GlassInput
          label={`${label} (external)`}
          value={externalName}
          onChange={(e) => handleExternalNameChange(e.target.value)}
          placeholder={`${label} name`}
        />
        <button
          type="button"
          onClick={switchToSystem}
          className="text-xs underline underline-offset-2 text-left"
          style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}
        >
          Switch to system {label.toLowerCase()}
        </button>
      </div>
    )
  }

  return (
    <SelectField
      label={label}
      value={currentId}
      onChange={handleChange}
      options={options}
      placeholder={`Select ${label.toLowerCase()}…`}
    />
  )
}
