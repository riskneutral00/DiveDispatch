'use client'

import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import {
  type ContactFormState,
  INITIAL_CONTACT_FORM,
  contactFromProfile,
  contactToPayload,
  defaultFromMe,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import type { ZodType } from 'zod'

interface BusinessContactSectionProps extends BaseProfileSectionProps {
  nameLabel: string
  namePlaceholder: string
  schema: ZodType
  fromMe?: (user: Record<string, unknown>, defaults: ContactFormState) => ContactFormState
  createOverride?: (payload: Record<string, unknown>) => Promise<unknown>
}

export function BusinessContactSection({
  profile: existing,
  me,
  create,
  update,
  onSaved,
  nameLabel,
  namePlaceholder,
  schema,
  fromMe: fromMeOverride,
  createOverride,
}: BusinessContactSectionProps) {
  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } =
    useProfileForm({
      profile: existing,
      me,
      schema,
      defaults: INITIAL_CONTACT_FORM,
      fromProfile: contactFromProfile,
      fromMe: fromMeOverride ?? defaultFromMe,
      toPayload: contactToPayload,
      create: createOverride ?? create,
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
          nameLabel={nameLabel}
          namePlaceholder={namePlaceholder}
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
