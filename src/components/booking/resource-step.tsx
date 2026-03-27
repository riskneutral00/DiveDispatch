'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { GlassCard, GlassInput, GlassLink } from '@/components/glass'
import { GlassSimpleSelect } from '@/components/glass/glass-simple-select'
import type { WizardState, WizardAction } from '@/lib/booking/wizard-state'
import type { Dispatch } from 'react'

interface ResourceStepProps {
  state: WizardState
  dispatch: Dispatch<WizardAction>
}

// ── ResourceOption ──────────────────────────────────────────────────────────

interface ResourceOption {
  id: string
  label: string
}

/** Prepend the "External" sentinel option to a list of resource options. */
function withExternalOption(options: ResourceOption[]): { value: string; label: string }[] {
  return [
    { value: '__external__', label: 'External (not in system)' },
    ...options.map((o) => ({ value: o.id, label: o.label })),
  ]
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
      <GlassCard padding="md">
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
                <GlassLink onClick={() => dispatch({ type: 'SET_EQUIPMENT_EXTERNAL', value: false })}>
                  Switch to system
                </GlassLink>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <GlassSimpleSelect
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
                  options={withExternalOption(equipmentOptions)}
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
                <GlassLink onClick={() => dispatch({ type: 'SET_COMPRESSOR_EXTERNAL', value: false })}>
                  Switch to system
                </GlassLink>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <GlassSimpleSelect
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
                  options={withExternalOption(compressorOptions)}
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
