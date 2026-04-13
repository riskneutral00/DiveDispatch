'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { ProfileIncompleteGuard } from '@/components/profiles/profile-incomplete-guard'
import { type BaseProfileSectionProps } from '@/lib/profile-form'
import { parseNumber } from '@/lib/utils/numbers'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import type { ZodType } from 'zod'

export type VenueCapabilitiesFormState = {
  confinedCapable?: boolean
  maxDepth: number
  maxCapacity: number
}

interface VenueCapabilitiesSectionProps<T extends VenueCapabilitiesFormState = VenueCapabilitiesFormState> extends BaseProfileSectionProps {
  schema: ZodType
  defaults: T
  fromProfile: (p: Record<string, unknown>) => T
  toPayload: (f: T) => Record<string, unknown>
  venueType: 'pool' | 'diveSite'
  incompleteMessage?: string
  capabilitiesLabel?: string
  depthPlaceholder?: string
  capacityPlaceholder?: string
}

export function VenueCapabilitiesSection<T extends VenueCapabilitiesFormState>({
  profile: existing,
  create,
  update,
  onClose,
  schema,
  defaults,
  fromProfile,
  toPayload,
  venueType,
  incompleteMessage,
  capabilitiesLabel = 'Venue Capabilities',
  depthPlaceholder = '5',
  capacityPlaceholder = '15',
}: VenueCapabilitiesSectionProps<T>) {
  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit, resetToBaseline } =
    useProfileForm({
      profile: existing,
      schema,
      defaults,
      fromProfile,
      toPayload,
      create,
      update,
    })

  if (!existing) return <ProfileIncompleteGuard message={incompleteMessage} />

  return (
    <ProfileFormShell
      loading={loading}
      onSubmit={handleSubmit}
      onCancel={() => { resetToBaseline(); onClose?.() }}
      footerErrorMessage={footerErrorMessage}
      saving={saving}
      saved={saved}
      isDirty={isDirty}
      isUpdate={isUpdate}
      disableSaveWhenInvalid
      isValid={isValid}
      className="space-y-6"
    >
      <div className="space-y-4">
        {venueType === 'diveSite' && (
          <div className="flex flex-col gap-2">
            <span className="text-body font-medium text-secondary">
              {capabilitiesLabel}
            </span>
            <div className="flex flex-wrap gap-3">
              <Checkbox
                label="Confined Water Capable"
                checked={form.confinedCapable ?? false}
                onChange={(v) => setField('confinedCapable', v)}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Input
            label="Max Depth (m)"
            type="number"
            inputMode="decimal"
            min="0.1"
            step="0.1"
            value={form.maxDepth || ''}
            onChange={(e) => setField('maxDepth', parseNumber(e.target.value, false))}
            error={errors.maxDepth}
            placeholder={depthPlaceholder}
            className="field-number"
          />
          <Input
            label="Max Capacity"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={form.maxCapacity || ''}
            onChange={(e) => setField('maxCapacity', parseNumber(e.target.value, true))}
            error={errors.maxCapacity}
            placeholder={capacityPlaceholder}
            required={venueType === 'pool'}
            className="field-number"
          />
        </div>

      </div>
    </ProfileFormShell>
  )
}
