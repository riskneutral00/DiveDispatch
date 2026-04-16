'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { NumberPicker } from '@/components/ui/number-picker'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import {
  buildParentContactDefaults,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
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
  wrapCreatePayload?: (payload: Record<string, unknown>) => Record<string, unknown>
  capabilitiesLabel?: string
  depthPlaceholder?: string
  capacityPlaceholder?: string
}

export function VenueCapabilitiesSection<T extends VenueCapabilitiesFormState>({
  profile: existing,
  me,
  create,
  update,
  onClose,
  schema,
  defaults,
  fromProfile,
  toPayload,
  venueType,
  wrapCreatePayload,
  capabilitiesLabel = 'Venue Capabilities',
  depthPlaceholder = '5',
  capacityPlaceholder = '15',
}: VenueCapabilitiesSectionProps<T>) {
  const createOverride = (payload: Record<string, unknown>) => {
    const merged = { ...buildParentContactDefaults(me), ...payload }
    return create(wrapCreatePayload ? wrapCreatePayload(merged) : merged)
  }

  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit, resetToBaseline } =
    useProfileForm({
      profile: existing,
      schema,
      defaults,
      fromProfile,
      toPayload,
      create: createOverride,
      update,
    })

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
          <NumberPicker
            label="Max Depth"
            value={form.maxDepth || undefined}
            onChange={(v) => setField('maxDepth', v ?? 0)}
            min={1}
            max={60}
            step={0.5}
            decimals={1}
            suffix="m"
            error={errors.maxDepth}
            className="field-number"
          />
          <NumberPicker
            label="Max Capacity"
            value={form.maxCapacity || undefined}
            onChange={(v) => setField('maxCapacity', v ?? 0)}
            min={1}
            max={100}
            required={venueType === 'pool'}
            error={errors.maxCapacity}
            className="field-number"
          />
        </div>

      </div>
    </ProfileFormShell>
  )
}
