'use client'

import { useQuery } from 'convex/react'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/convex-generated'
import { ProfileAgencyInfo } from '@/components/profiles/profile-agency-info'
import { SectionDivider } from '@/components/ui/section-divider'
import { LanguageField } from '@/components/ui/language-field'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { BusinessContactSection } from '@/components/profiles/business-contact-section'
import {
  INITIAL_CUSTOMER_LANGUAGES,
  buildParentContactDefaults,
  customerLanguagesBlock,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import {
  agentContactMergedSchema,
  agentAssociationsSchema,
  associationSchema,
} from '@/lib/schemas/profile-shared'
import type { Language } from '@/lib/types/language'
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
        defaults: customerLanguagesBlock.defaults,
        fromProfile: (p) => customerLanguagesBlock.fromProfile(p),
        toPayload: (f) => customerLanguagesBlock.toPayload(f as { customerLanguages: Language[] }),
        divider: 'default',
        render: ({ form, setField }) => (
          <>
            <div>
              <FormSectionHeader label="Default Referral" />
              <p className="text-label mt-2 text-secondary">
                {preferredOperatorSlug
                  ? 'Bookings cascade from your preferred operator. Change in Preferences → Resources → Operator.'
                  : 'You create and manage bookings independently.'}
              </p>
            </div>
            <SectionDivider variant="soft" />
            <LanguageField
              label={tCommon('customerLanguages')}
              value={(form.customerLanguages as Language[]) ?? []}
              onChange={(langs) => setField('customerLanguages', langs)}
            />
          </>
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
