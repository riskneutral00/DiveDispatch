'use client'

import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { type LocationValue } from '@/components/profiles/location-picker-lazy'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import {
  INITIAL_ACCESS_CONTROL,
  accessFromProfile,
  accessToPayload,
  type AccessControlState,
} from '@/components/profiles/access-control-section'
import {
  type ContactFormState,
  INITIAL_CONTACT_FORM,
  contactFromProfile,
  contactToPayload,
  defaultFromMe,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import type { ClerkRole } from '@/lib/constants/roles'
import type { ZodType } from 'zod'

type BusinessContactWithAccess = ContactFormState & { access: AccessControlState } // dry-ok

const INITIAL_BUSINESS_CONTACT: BusinessContactWithAccess = {
  ...INITIAL_CONTACT_FORM,
  access: INITIAL_ACCESS_CONTROL,
}

interface BusinessContactSectionProps extends BaseProfileSectionProps {
  nameLabel: string
  schema: ZodType
  fromMe?: (user: Record<string, unknown>, defaults: ContactFormState) => ContactFormState
  createOverride?: (payload: Record<string, unknown>) => Promise<unknown>
  inheritFromOtherRoles?: ClerkRole
}

export function BusinessContactSection({
  profile: existing,
  me,
  create,
  update,
  onSaved,
  onClose,
  nameLabel,
  schema,
  fromMe: fromMeOverride,
  createOverride,
  inheritFromOtherRoles,
}: BusinessContactSectionProps) {
  const inheritance = useQuery(
    api.users.inheritedContactDefaults,
    inheritFromOtherRoles ? { excludeRole: inheritFromOtherRoles } : 'skip',
  )

  const inheritedDefaults: BusinessContactWithAccess = inheritance
    ? {
        ...INITIAL_BUSINESS_CONTACT,
        ...contactFromProfile(inheritance as unknown as Record<string, unknown>),
      }
    : INITIAL_BUSINESS_CONTACT

  const waitingForInheritance = inheritFromOtherRoles !== undefined && inheritance === undefined

  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit, resetToBaseline } =
    useProfileForm({
      profile: waitingForInheritance ? undefined : existing,
      me,
      schema,
      defaults: inheritedDefaults,
      fromProfile: (p) => ({ ...contactFromProfile(p), access: accessFromProfile(p) }),
      fromMe: (u, defaults) => {
        const base = (fromMeOverride ?? defaultFromMe)(u, defaults)
        return {
          ...base,
          name: defaults.name || base.name,
          location: defaults.location ?? base.location,
          email: defaults.email || base.email,
          phone: defaults.phone || base.phone,
          access: defaults.access,
        }
      },
      toPayload: (f) => ({ ...contactToPayload(f), ...accessToPayload(f.access) }),
      create: createOverride ?? create,
      update,
      onSaved,
    })

  const onLocationChange = (loc: LocationValue | null) => setField('location', loc)

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
        <ProfileBasicInfo
          nameValue={form.name}
          onNameChange={(val) => setField('name', val)}
          nameError={errors.name}
          nameLabel={nameLabel}
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
