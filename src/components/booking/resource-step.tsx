'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { GlassCard, GlassInput } from '@/components/glass'
import type { WizardState, WizardAction } from '@/lib/booking/wizard-state'
import type { Dispatch } from 'react'
import { ChevronDown } from 'lucide-react'

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

// ── Main Component ──────────────────────────────────────────────────────────

export function ResourceStep({ state, dispatch }: ResourceStepProps) {
  // Load equipment and compressor resources (instructor/boat/pool moved to inline day-row pickers)
  const equipmentManagers = useQuery(api.directory.listByRole, { role: 'Equipment' }) ?? []
  const compressors = useQuery(api.directory.listByRole, { role: 'Compressor' }) ?? []

  const equipmentOptions: ResourceOption[] = equipmentManagers.map((r) => ({ id: r.slug, label: r.name }))
  const compressorOptions: ResourceOption[] = compressors.map((r) => ({ id: r.slug, label: r.name }))

  return (
    <div className="flex flex-col gap-5">
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
                  options={equipmentOptions}
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
                  options={compressorOptions}
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
