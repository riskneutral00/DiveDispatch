'use client'

import { useTranslations } from 'next-intl'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { GasMixFields } from '@/components/capabilities/gas-mix-fields'
import { compressorGasMixesSchema } from '@/lib/schemas/profile-shared'
import { type BaseProfileSectionProps } from '@/lib/profile-form'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

import {
  type GasMix,
} from '@/lib/constants/gas-mixes'

export type CompressorProfileSection = 'gas-mixes'

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

export function CompressorGasMixesSection({
  profile,
  create,
  update,
  onClose,
}: BaseProfileSectionProps) {
  const t = useTranslations('common')

  const {
    form,
    setField,
    errors,
    footerErrorMessage,
    saving,
    saved,
    isDirty,
    isValid,
    loading,
    isUpdate,
    handleSubmit,
    resetToBaseline,
  } = useProfileForm({
    profile,
    schema: compressorGasMixesSchema,
    defaults: INITIAL_COMPRESSOR_GAS_MIXES_FORM,
    fromProfile: compressorGasMixesFromProfile,
    toPayload: compressorGasMixesToPayload,
    create,
    update,
  })

  return (
    <ProfileFormShell
      loading={loading}
      onSubmit={handleSubmit}
      onCancel={() => {
        resetToBaseline()
        onClose?.()
      }}
      footerErrorMessage={footerErrorMessage}
      saving={saving}
      saved={saved}
      isDirty={isDirty}
      isUpdate={isUpdate}
      disableSaveWhenInvalid
      isValid={isValid}
      className="space-y-4"
    >
      <GasMixFields
        alwaysOn
        required
        groupLabel={t('gasMixes')}
        error={errors.gasMixes}
        value={{
          hasCompressor: true,
          gasMixes: form.gasMixes,
          nitroxMin: form.nitroxMin,
          nitroxMax: form.nitroxMax,
        }}
        onChange={(next) => {
          setField('gasMixes', next.gasMixes as GasMix[])
          setField('nitroxMin', next.nitroxMin)
          setField('nitroxMax', next.nitroxMax)
        }}
      />
    </ProfileFormShell>
  )
}
