'use client'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { ProfileIncompleteGuard } from '@/components/profiles/profile-incomplete-guard'
import { Card } from '@/components/ui/card'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { CheckboxGroup } from '@/components/ui/checkbox-group'
import {
  compressorContactSchema,
  compressorGasMixesSchema,
} from '@/lib/schemas/profile-shared'
import {
  INITIAL_CONTACT_FORM,
  contactFromProfile,
  contactToPayload,
  defaultFromMe,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

import { GAS_MIX_OPTIONS, type GasMix } from '@/lib/constants/gas-mixes'

// ── Types ────────────────────────────────────────────────────────────

export type CompressorProfileSection = 'contact' | 'gas-mixes'

type CompressorSectionProps = BaseProfileSectionProps

// ── Contact section ──────────────────────────────────────────────────


export function CompressorContactSection({ profile: existing, me, create, update, onSaved }: CompressorSectionProps) {
  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } =
    useProfileForm({
      profile: existing,
      me,
      schema: compressorContactSchema,
      defaults: INITIAL_CONTACT_FORM,
      fromProfile: contactFromProfile,
      fromMe: defaultFromMe,
      toPayload: contactToPayload,
      create,
      update,
      onSaved,
    })

  const onLocationChange = (loc: LocationValue | null) => setField('location', loc)

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
      <div className="space-y-4">
        <ProfileBasicInfo
          nameValue={form.name}
          onNameChange={(val) => setField('name', val)}
          nameError={errors.name}
          nameLabel="Business Name"
          namePlaceholder="e.g. Phuket Gas Services"
          nameRequired
          locationValue={form.location}
          onLocationChange={onLocationChange}
          locationError={errors.location}
          locationRequired
          emailValue={form.email}
          onEmailChange={(val) => setField('email', val)}
          emailError={errors.email}
          emailRequired
          phoneValue={form.phone}
          onPhoneChange={(val) => setField('phone', val)}
          phoneError={errors.phone}
          phoneRequired
        />
      </div>
    </ProfileFormShell>
  )
}

// ── Gas Mixes section ────────────────────────────────────────────────

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

// ── Compat alias ─────────────────────────────────────────────────────

/**
 * Dispatches to the appropriate section component based on the `section` prop.
 * The app-layer ConnectedCompressorForm short-circuits before this is reached
 * at runtime; this export exists so that the lib-layer registry in
 * connected-role-forms.tsx continues to type-check without modification.
 */
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
