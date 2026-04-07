'use client'

import { BusinessContactSection } from '@/components/profiles/business-contact-section'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { ProfileIncompleteGuard } from '@/components/profiles/profile-incomplete-guard'
import { Card } from '@/components/ui/card'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { CheckboxGroup } from '@/components/ui/checkbox-group'
import {
  contactSchema,
  compressorGasMixesSchema,
} from '@/lib/schemas/profile-shared'
import {
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

import { GAS_MIX_OPTIONS, type GasMix } from '@/lib/constants/gas-mixes'

export type CompressorProfileSection = 'contact' | 'gas-mixes'

type CompressorSectionProps = BaseProfileSectionProps

export function CompressorContactSection(props: CompressorSectionProps) {
  return (
    <BusinessContactSection
      {...props}
      nameLabel="Business Name"
      namePlaceholder="e.g. Phuket Gas Services"
      schema={contactSchema}
    />
  )
}

export type CompressorGasMixesFormState = {
  gasMixes: GasMix[]
}

export const INITIAL_COMPRESSOR_GAS_MIXES_FORM: CompressorGasMixesFormState = {
  gasMixes: [],
}

export function compressorGasMixesFromProfile(p: Record<string, unknown>): CompressorGasMixesFormState {
  return {
    gasMixes: (p.gasMixes ?? []) as GasMix[],
  }
}

export function compressorGasMixesToPayload(f: CompressorGasMixesFormState): Record<string, unknown> {
  return {
    gasMixes: f.gasMixes,
  }
}

export function CompressorGasMixesSection({ profile: existing, create, update }: CompressorSectionProps) {
  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } =
    useProfileForm({
      profile: existing,
      schema: compressorGasMixesSchema,
      defaults: INITIAL_COMPRESSOR_GAS_MIXES_FORM,
      fromProfile: compressorGasMixesFromProfile,
      toPayload: compressorGasMixesToPayload,
      create,
      update,
    })

  if (!existing) return <ProfileIncompleteGuard />

  return (
    <ProfileFormShell
      loading={loading}
      onSubmit={handleSubmit}
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
        <FormSectionHeader label="Gas Mixes Available" />
        <CheckboxGroup
          label="Select the gas mixes you supply"
          items={GAS_MIX_OPTIONS.map(({ value, label }) => ({ value, label }))}
          selected={form.gasMixes}
          onChange={(values) => setField('gasMixes', values as GasMix[])}
          error={errors.gasMixes}
          columns={2}
        />
      </Card>
    </ProfileFormShell>
  )
}

export function CompressorProfileForm({
  section,
  profile,
  me,
  create,
  update,
  onSaved,
}: CompressorSectionProps & { section?: CompressorProfileSection }) {
  if (section === 'gas-mixes')
    return <CompressorGasMixesSection profile={profile} create={create} update={update} />
  return <CompressorContactSection profile={profile} me={me} create={create} update={update} onSaved={onSaved} />
}
