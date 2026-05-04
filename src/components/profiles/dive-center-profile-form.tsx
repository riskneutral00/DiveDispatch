'use client'

import { Plus } from 'lucide-react'
import { ProfileAgencyInfo } from '@/components/profiles/profile-agency-info'
import { Button } from '@/components/ui/button'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import {
  diveCenterAffiliationsSchema,
  makeDefaultDiveCenterAssociation,
  type DiveCenterAssociationItem as CanonicalDiveCenterAssociationItem,
} from '@/lib/schemas/profile-shared'
import {
  type ContactFormState as DiveCenterContactFormState,
  INITIAL_CONTACT_FORM,
  buildParentContactDefaults,
  contactFromProfile,
  contactToPayload,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

export type DiveCenterProfileSection = 'contact' | 'associations'

type DiveCenterSectionProps = BaseProfileSectionProps

export type { DiveCenterContactFormState }
export { INITIAL_CONTACT_FORM, contactFromProfile, contactToPayload }

export type DiveCenterAssociationItem = CanonicalDiveCenterAssociationItem

export type DiveCenterAffiliationsFormState = {
  associations: DiveCenterAssociationItem[]
}

export const INITIAL_AFFILIATIONS_FORM: DiveCenterAffiliationsFormState = {
  associations: [makeDefaultDiveCenterAssociation()],
}

export function affiliationsFromProfile(p: Record<string, unknown>): DiveCenterAffiliationsFormState {
  const assocs = (p.associations as Array<Record<string, unknown>>) ?? []
  return {
    associations:
      assocs.length > 0
        ? assocs.map((a) =>
            makeDefaultDiveCenterAssociation({
              agency: String(a.agency ?? ''),
              number: String(a.number ?? ''),
              owDays: typeof a.owDays === 'number' ? a.owDays : (undefined as unknown as number),
              aowDays: typeof a.aowDays === 'number' ? a.aowDays : (undefined as unknown as number),
              oaDays: typeof a.oaDays === 'number' ? a.oaDays : (undefined as unknown as number),
              selectedSpecialties: Array.isArray(a.selectedSpecialties)
                ? (a.selectedSpecialties as string[])
                : [],
            }),
          )
        : [makeDefaultDiveCenterAssociation()],
  }
}

export function affiliationsToPayload(f: DiveCenterAffiliationsFormState): Record<string, unknown> {
  return {
    associations: f.associations.map((a) => ({
      agency: a.agency,
      number: a.number,
      owDays: a.owDays,
      aowDays: a.aowDays,
      oaDays: a.oaDays,
      selectedSpecialties: a.selectedSpecialties,
    })),
  }
}

export function DiveCenterAffiliationsSection({ profile: existing, me, create, update, onClose }: DiveCenterSectionProps) {
  const createOverride = (payload: Record<string, unknown>) =>
    create({ ...buildParentContactDefaults(me), ...payload })

  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit, resetToBaseline } =
    useProfileForm({
      profile: existing,
      schema: diveCenterAffiliationsSchema,
      defaults: INITIAL_AFFILIATIONS_FORM,
      fromProfile: affiliationsFromProfile,
      toPayload: affiliationsToPayload,
      create: createOverride,
      update,
    })

  function handleAdd() {
    const first = form.associations[0]
    const newAssoc = makeDefaultDiveCenterAssociation({
      owDays: first?.owDays,
      aowDays: first?.aowDays,
      oaDays: first?.oaDays,
      selectedSpecialties: first?.selectedSpecialties ? [...first.selectedSpecialties] : [],
    })
    setField('associations', [...form.associations, newAssoc])
  }

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
      footerLeftAction={
        <Button type="button" variant="secondary" size="sm" onClick={handleAdd}>
          <Plus size={14} />
          Add
        </Button>
      }
    >
      <ProfileAgencyInfo
        variant="dive-center"
        items={form.associations}
        onChange={(items) => setField('associations', items)}
        errors={errors as Record<string, string>}
      />
    </ProfileFormShell>
  )
}

