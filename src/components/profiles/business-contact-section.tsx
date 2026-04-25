'use client'

import type { ReactNode } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { type LocationValue } from '@/components/profiles/location-picker'
import { ProfileBasicInfo } from '@/components/profiles/profile-basic-info'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { SectionDivider } from '@/components/ui/section-divider'
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

type BusinessContactForm = ContactFormState & { access: AccessControlState } & Record<string, unknown>

const INITIAL_BUSINESS_CONTACT: ContactFormState & { access: AccessControlState } = {
  ...INITIAL_CONTACT_FORM,
  access: INITIAL_ACCESS_CONTROL,
}

export interface BusinessContactExtras {
  defaults: Record<string, unknown>
  fromProfile: (p: Record<string, unknown>) => Record<string, unknown>
  toPayload: (f: Record<string, unknown>) => Record<string, unknown>
  render: (args: {
    form: Record<string, unknown>
    setField: (key: string, value: unknown) => void
    errors: Record<string, string>
  }) => ReactNode
  divider?: 'soft' | 'default' | 'none'
}

interface BusinessContactSectionProps extends BaseProfileSectionProps {
  nameLabel?: string
  schema: ZodType
  fromMe?: (user: Record<string, unknown>, defaults: ContactFormState) => ContactFormState
  createOverride?: (payload: Record<string, unknown>) => Promise<unknown>
  inheritFromOtherRoles?: ClerkRole
  extras?: BusinessContactExtras
  afterSuccessfulSave?: (form: Record<string, unknown>) => Promise<void>
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
  extras,
  afterSuccessfulSave,
}: BusinessContactSectionProps) {
  const showName = nameLabel !== undefined

  const inheritance = useQuery(
    api.users.inheritedContactDefaults,
    inheritFromOtherRoles ? { excludeRole: inheritFromOtherRoles } : 'skip',
  )

  const mergedDefaults: BusinessContactForm = {
    ...INITIAL_BUSINESS_CONTACT,
    ...(extras?.defaults ?? {}),
  }

  const inheritedDefaults: BusinessContactForm = inheritance
    ? {
        ...mergedDefaults,
        ...contactFromProfile(inheritance as unknown as Record<string, unknown>),
      }
    : mergedDefaults

  const waitingForInheritance = inheritFromOtherRoles !== undefined && inheritance === undefined

  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit, resetToBaseline } =
    useProfileForm<BusinessContactForm>({
      profile: waitingForInheritance ? undefined : existing,
      me,
      schema,
      defaults: inheritedDefaults,
      fromProfile: (p) => ({
        ...contactFromProfile(p),
        access: accessFromProfile(p),
        ...(extras?.fromProfile(p) ?? {}),
      }),
      fromMe: (u, defaults) => {
        const base = (fromMeOverride ?? defaultFromMe)(u, defaults as ContactFormState)
        return {
          ...defaults,
          ...base,
          name: (defaults.name as string) || base.name,
          location: defaults.location ?? base.location,
          email: (defaults.email as string) || base.email,
          phone: (defaults.phone as string) || base.phone,
          access: defaults.access,
        } as BusinessContactForm
      },
      toPayload: (f) => {
        const payload: Record<string, unknown> = {
          ...contactToPayload(f),
          ...accessToPayload(f.access),
          ...(extras?.toPayload(f) ?? {}),
        }
        if (!showName) delete payload.name
        return payload
      },
      create: createOverride ?? create,
      update,
      onSaved,
      afterSuccessfulSave,
    })

  const onLocationChange = (loc: LocationValue | null) => setField('location', loc)
  const extrasSetField = (key: string, value: unknown) =>
    setField(key as keyof BusinessContactForm, value as BusinessContactForm[keyof BusinessContactForm])

  const dividerVariant = extras?.divider ?? 'soft'

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
          {...(showName
            ? {
                nameValue: form.name,
                onNameChange: (val: string) => setField('name', val),
                nameError: errors.name,
                nameLabel,
                nameRequired: true,
              }
            : {})}
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
        {extras && dividerVariant !== 'none' && <SectionDivider variant={dividerVariant} />}
        {extras?.render({ form, setField: extrasSetField, errors })}
      </div>
    </ProfileFormShell>
  )
}
