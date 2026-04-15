'use client'

import { useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { CheckboxGroup } from '@/components/ui/checkbox-group'
import { PillToggle, PillToggleGroup } from '@/components/ui/pill-toggle'

export type AccessMode = 'open' | 'block' | 'only'

export type AccessControlState = {
  mode: AccessMode
  isAllowed: string[]
  notAllowed: string[]
}

export function accessFromProfile(p: Record<string, unknown>): AccessControlState {
  const isAllowed = (p.isAllowed as string[] | undefined) ?? []
  const notAllowed = (p.notAllowed as string[] | undefined) ?? []
  if (isAllowed.length > 0) return { mode: 'only', isAllowed, notAllowed: [] }
  if (notAllowed.length > 0) return { mode: 'block', isAllowed: [], notAllowed }
  return { mode: 'open', isAllowed: [], notAllowed: [] }
}

export function accessToPayload(state: AccessControlState): { isAllowed: string[]; notAllowed: string[] } {
  if (state.mode === 'only') return { isAllowed: state.isAllowed, notAllowed: [] }
  if (state.mode === 'block') return { isAllowed: [], notAllowed: state.notAllowed }
  return { isAllowed: [], notAllowed: [] }
}

export const INITIAL_ACCESS_CONTROL: AccessControlState = {
  mode: 'open',
  isAllowed: [],
  notAllowed: [],
}

interface AccessControlSectionProps {
  value: AccessControlState
  onChange: (next: AccessControlState) => void
}

export function AccessControlSection({ value, onChange }: AccessControlSectionProps) {
  const operators = useQuery(api.directory.listOperators)

  const items = useMemo(
    () =>
      (operators ?? []).map((op) => ({
        value: op.slug,
        label: op.role === 'Agent' ? `${op.name} (Agent)` : op.name,
      })),
    [operators],
  )

  const setMode = (mode: AccessMode) => {
    onChange({ mode, isAllowed: mode === 'only' ? value.isAllowed : [], notAllowed: mode === 'block' ? value.notAllowed : [] })
  }

  return (
    <div className="space-y-3">
      <FormSectionHeader label="Who can book you" />
      <p className="text-label text-secondary">
        Restrict which operators can send you bookings. Defaults to open.
      </p>
      <PillToggleGroup>
        <PillToggle label="Open to all" checked={value.mode === 'open'} onChange={() => setMode('open')} />
        <PillToggle label="Block specific" checked={value.mode === 'block'} onChange={() => setMode('block')} />
        <PillToggle label="Only these" checked={value.mode === 'only'} onChange={() => setMode('only')} />
      </PillToggleGroup>
      {value.mode === 'block' && (
        <CheckboxGroup
          label="Blocked operators"
          items={items}
          selected={value.notAllowed}
          onChange={(next) => onChange({ ...value, notAllowed: next })}
        />
      )}
      {value.mode === 'only' && (
        <CheckboxGroup
          label="Allowed operators"
          items={items}
          selected={value.isAllowed}
          onChange={(next) => onChange({ ...value, isAllowed: next })}
        />
      )}
    </div>
  )
}
