'use client'

import { useQuery } from 'convex/react'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/convex-generated'
import { ProfileAgencyInfo } from '@/components/profiles/profile-agency-info'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { BusinessContactSection } from '@/components/profiles/business-contact-section'
import {
  INITIAL_CUSTOMER_LANGUAGES,
  buildParentContactDefaults,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import {
  agentContactMergedSchema,
  agentAssociationsSchema,
  associationSchema,
} from '@/lib/schemas/profile-shared'
import { z } from 'zod'

export type AgentProfileSection = 'contact' | 'associations'

type AssociationData = z.infer<typeof associationSchema>

export type AgentAssociationsFormState = {
  associations: AssociationData[]
}

export const INITIAL_ASSOCIATIONS_FORM: AgentAssociationsFormState = {
  associations: [],
}

export const INITIAL_LANGUAGES_FORM = INITIAL_CUSTOMER_LANGUAGES

export function associationsFromProfile(
  p: Record<string, unknown>,
): AgentAssociationsFormState {
  return {
    associations: (
      (p.associations as Array<Record<string, unknown>>) ?? []
    ).map((a) => ({
      agency: String(a.agency ?? ''),
      number: String(a.number ?? ''),
    })),
  }
}

export function associationsToPayload(
  f: AgentAssociationsFormState,
): Record<string, unknown> {
  return {
    associations: f.associations.map(({ agency, number }) => ({
      agency,
      number,
    })),
  }
}

export function AgentContactSection(props: BaseProfileSectionProps) {
  const tCommon = useTranslations('common')
  const prefs = useQuery(api.stakeholderPreferences.mine)
  const preferredOperatorSlug = prefs?.preferredOperatorSlug ?? null

  return (
    <BusinessContactSection
      {...props}
      nameLabel={tCommon('businessName')}
      schema={agentContactMergedSchema}
      languageKey="customerLanguages"
      createOverride={(payload) => props.create({ ...payload, associations: [] })}
      extras={{
        defaults: {},
        fromProfile: () => ({}),
        toPayload: () => ({}),
        divider: 'default',
        render: () => (
          <div>
            <FormSectionHeader label={tCommon('agentReferralHeader')} />
            <p className="text-label mt-2 text-secondary">
              {preferredOperatorSlug
                ? tCommon('agentReferralCascade')
                : tCommon('agentReferralIndependent')}
            </p>
          </div>
        ),
      }}
    />
  )
}

export function AgentAssociationsSection({
  profile,
  me,
  create,
  update,
  onClose,
}: BaseProfileSectionProps) {
  const createOverride = (payload: Record<string, unknown>) =>
    create({ ...buildParentContactDefaults(me), ...payload })

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
    schema: agentAssociationsSchema,
    defaults: INITIAL_ASSOCIATIONS_FORM,
    fromProfile: associationsFromProfile,
    toPayload: associationsToPayload,
    create: createOverride,
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
      className="space-y-6"
    >
      <ProfileAgencyInfo
        variant="agent"
        items={form.associations}
        onChange={(items) => setField('associations', items)}
        errors={errors as Record<string, string>}
      />
    </ProfileFormShell>
  )
}
