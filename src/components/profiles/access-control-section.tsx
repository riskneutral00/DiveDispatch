'use client'

import { FormSectionHeader } from '@/components/ui/form-section-header'
import { PillToggle, PillToggleGroup } from '@/components/ui/pill-toggle'

export type AccessMode = 'open' | 'block' | 'only'

export type AccessControlState = {
  mode: AccessMode
  isAllowed: string[]
  notAllowed: string[]
}

export function accessFromProfile(_p: Record<string, unknown>): AccessControlState {
  return { mode: 'open', isAllowed: [], notAllowed: [] }
}

export function accessToPayload(_state: AccessControlState): { isAllowed: string[]; notAllowed: string[] } {
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

export function AccessControlSection(_props: AccessControlSectionProps) {
  const noop = () => {}
  return (
    <div className="space-y-3">
      <FormSectionHeader label="Who can book you" required />
      <p className="text-label text-secondary">
        Restrict which operators can send you bookings. Defaults to open.
      </p>
      <PillToggleGroup>
        <PillToggle label="Open to all" checked locked onChange={noop} />
        <PillToggle label="Block specific" checked={false} locked onChange={noop} />
        <PillToggle label="Only these" checked={false} locked onChange={noop} />
      </PillToggleGroup>
    </div>
  )
}
