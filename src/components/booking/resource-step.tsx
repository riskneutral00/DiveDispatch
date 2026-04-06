'use client'

import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { Card } from '@/components/ui'
import { ResourceOrExternalField } from './resource-or-external-field'
import type { WizardState, WizardAction } from '@/lib/booking/wizard-state'
import type { Dispatch } from 'react'

interface ResourceStepProps {
  state: WizardState
  dispatch: Dispatch<WizardAction>
}

export function ResourceStep({ state, dispatch }: ResourceStepProps) {
  const equipmentManagers = useQuery(api.directory.listByRole, { role: 'Equipment' }) ?? []
  const compressors = useQuery(api.directory.listByRole, { role: 'Compressor' }) ?? []

  const equipmentOptions = equipmentManagers.map((r) => ({ id: r.slug, label: r.name }))
  const compressorOptions = compressors.map((r) => ({ id: r.slug, label: r.name }))

  return (
    <div className="flex flex-col gap-6">
      <Card padding="md">
        <h3
          className="text-sm font-semibold mb-3 text-primary font-heading"
        >
          Equipment
        </h3>
        <div className="flex flex-wrap gap-3">
          <ResourceOrExternalField
            label="Equipment Manager"
            resources={equipmentOptions}
            selectedId={state.equipment}
            isExternal={state.equipmentIsExternal}
            externalName={state.externalEquipmentName}
            onSelectResource={(v) => dispatch({ type: 'SET_EQUIPMENT', value: v })}
            onSetExternal={(v) => dispatch({ type: 'SET_EQUIPMENT_EXTERNAL', value: v })}
            onExternalNameChange={(v) => dispatch({ type: 'SET_EXTERNAL_EQUIPMENT_NAME', value: v })}
            placeholder="Equipment manager…"
          />
          <ResourceOrExternalField
            label="Compressor"
            resources={compressorOptions}
            selectedId={state.compressor}
            isExternal={state.compressorIsExternal}
            externalName={state.externalCompressorName}
            onSelectResource={(v) => dispatch({ type: 'SET_COMPRESSOR', value: v })}
            onSetExternal={(v) => dispatch({ type: 'SET_COMPRESSOR_EXTERNAL', value: v })}
            onExternalNameChange={(v) => dispatch({ type: 'SET_EXTERNAL_COMPRESSOR_NAME', value: v })}
            placeholder="Compressor…"
          />
        </div>
      </Card>
    </div>
  )
}
