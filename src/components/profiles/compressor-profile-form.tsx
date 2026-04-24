'use client'

import { BusinessContactSection } from '@/components/profiles/business-contact-section'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { Card } from '@/components/ui/card'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { CheckboxGroup } from '@/components/ui/checkbox-group'
import { NumberPicker } from '@/components/ui/number-picker'
import { FieldRow } from '@/components/ui/field-row'
import {
  contactSchema,
  compressorGasMixesSchema,
} from '@/lib/schemas/profile-shared'
import {
  buildParentContactDefaults,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

import {
  GAS_MIX_OPTIONS,
  NITROX_MIN_PERCENT,
  NITROX_MAX_PERCENT,
  NITROX_DEFAULT_MIN,
  NITROX_DEFAULT_MAX,
  type GasMix,
} from '@/lib/constants/gas-mixes'

export type CompressorProfileSection = 'contact' | 'gas-mixes'

export function CompressorContactSection(props: BaseProfileSectionProps) {
  return (
    <BusinessContactSection
      {...props}
      nameLabel="Business Name"
      schema={contactSchema}
      inheritFromOtherRoles="Compressor"
    />
  )
}

export type CompressorGasMixesFormState = {
  gasMixes: GasMix[]
  nitroxMin: number | undefined
  nitroxMax: number | undefined
}

export const INITIAL_COMPRESSOR_GAS_MIXES_FORM: CompressorGasMixesFormState = {
  gasMixes: [],
  nitroxMin: undefined,
  nitroxMax: undefined,
}

export function compressorGasMixesFromProfile(p: Record<string, unknown>): CompressorGasMixesFormState {
  return {
    gasMixes: (p.gasMixes ?? []) as GasMix[],
    nitroxMin: typeof p.nitroxMin === 'number' ? p.nitroxMin : undefined,
    nitroxMax: typeof p.nitroxMax === 'number' ? p.nitroxMax : undefined,
  }
}

export function compressorGasMixesToPayload(f: CompressorGasMixesFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = { gasMixes: f.gasMixes }
  if (f.gasMixes.includes('nitrox')) {
    payload.nitroxMin = f.nitroxMin
    payload.nitroxMax = f.nitroxMax
  }
  return payload
}

export function CompressorGasMixesSection({ profile: existing, me, create, update, onClose }: BaseProfileSectionProps) {
  const createOverride = (payload: Record<string, unknown>) =>
    create({ ...buildParentContactDefaults(me), ...payload })

  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit, resetToBaseline } =
    useProfileForm({
      profile: existing,
      schema: compressorGasMixesSchema,
      defaults: INITIAL_COMPRESSOR_GAS_MIXES_FORM,
      fromProfile: compressorGasMixesFromProfile,
      toPayload: compressorGasMixesToPayload,
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
      <Card padding="md">
        <FormSectionHeader label="Gas Mixes Available" required />
        <CheckboxGroup
          label="Select the gas mixes you supply"
          hideLabel
          items={GAS_MIX_OPTIONS.map(({ value, label }) => ({ value, label }))}
          selected={form.gasMixes}
          onChange={(values) => {
            const next = values as GasMix[]
            setField('gasMixes', next)
            if (next.includes('nitrox')) {
              if (form.nitroxMin === undefined) setField('nitroxMin', NITROX_DEFAULT_MIN)
              if (form.nitroxMax === undefined) setField('nitroxMax', NITROX_DEFAULT_MAX)
            }
          }}
          error={errors.gasMixes}
          required
          columns={2}
        />

        <div
          className={`mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 transition-opacity ${
            form.gasMixes.includes('nitrox') ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden={!form.gasMixes.includes('nitrox')}
        >
          <div className="hidden sm:block" aria-hidden />
          <div className="flex flex-col gap-1.5">
            <span className="text-label text-secondary">O2% range</span>
            <FieldRow density="compact">
              <NumberPicker
                className="field-sm"
                label="Min"
                value={form.nitroxMin}
                onChange={(v) => setField('nitroxMin', v)}
                min={NITROX_MIN_PERCENT}
                max={NITROX_MAX_PERCENT}
                suffix="%"
                error={errors.nitroxMin}
              />
              <NumberPicker
                className="field-sm"
                label="Max"
                value={form.nitroxMax}
                onChange={(v) => setField('nitroxMax', v)}
                min={NITROX_MIN_PERCENT}
                max={NITROX_MAX_PERCENT}
                suffix="%"
                error={errors.nitroxMax}
              />
            </FieldRow>
          </div>
        </div>
      </Card>
    </ProfileFormShell>
  )
}

