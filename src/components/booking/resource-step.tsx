'use client'

import { Card, FieldRow } from '@/components/ui'
import { CardTitle } from '@/components/ui/card-title'
import { ResourceOrExternalField } from './resource-or-external-field'
import { useDirectoryByRoleKey } from '@/lib/hooks/use-directory-by-role-key'
import type { WizardState, WizardAction } from '@/lib/booking/wizard-state'
import type { Dispatch } from 'react'

interface ResourceStepProps {
  state: WizardState
  dispatch: Dispatch<WizardAction>
}

export function ResourceStep({ state, dispatch }: ResourceStepProps) {
  const equipmentManagersRaw = useDirectoryByRoleKey('equipment')
  const compressorsRaw = useDirectoryByRoleKey('compressor')
  const equipmentLoading = equipmentManagersRaw === undefined
  const compressorLoading = compressorsRaw === undefined

  const equipmentOptions = (equipmentManagersRaw ?? []).map((r) => ({ id: r.slug, label: r.name }))
  const compressorOptions = (compressorsRaw ?? []).map((r) => ({ id: r.slug, label: r.name }))

  return (
    <div className="flex flex-col gap-6">
      <Card padding="md">
        <CardTitle as="h3" size="sm" className="mb-3">Equipment</CardTitle>
        <FieldRow>
          <ResourceOrExternalField
            className="field-md"
            label="Equipment Manager"
            resources={equipmentOptions}
            selectedId={state.equipment}
            isExternal={state.equipmentIsExternal}
            externalName={state.externalEquipmentName}
            onSelectResource={(v) => dispatch({ type: 'SET_EQUIPMENT', value: v })}
            onSetExternal={(v) => dispatch({ type: 'SET_EQUIPMENT_EXTERNAL', value: v })}
            onExternalNameChange={(v) => dispatch({ type: 'SET_EXTERNAL_EQUIPMENT_NAME', value: v })}
            placeholder="Equipment manager…"
            loading={equipmentLoading}
          />
          <ResourceOrExternalField
            className="field-md"
            label="Compressor"
            resources={compressorOptions}
            selectedId={state.compressor}
            isExternal={state.compressorIsExternal}
            externalName={state.externalCompressorName}
            onSelectResource={(v) => dispatch({ type: 'SET_COMPRESSOR', value: v })}
            onSetExternal={(v) => dispatch({ type: 'SET_COMPRESSOR_EXTERNAL', value: v })}
            onExternalNameChange={(v) => dispatch({ type: 'SET_EXTERNAL_COMPRESSOR_NAME', value: v })}
            placeholder="Compressor…"
            loading={compressorLoading}
          />
        </FieldRow>
      </Card>
    </div>
  )
}
