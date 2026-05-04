'use client'

import { useQuery } from 'convex/react'
import { useTranslations } from 'next-intl'
import { useSessionIdentity } from '@/lib/hooks/use-session-identity'
import { useEntityMutation } from '@/lib/hooks/use-entity-mutation'
import { BusinessContactSection } from '@/components/profiles/business-contact-section'
import { composeCreatePayload, needsCreateOverride } from '@/lib/profile-form/composeCreatePayload'

import {
  ROLE_SECTION_REGISTRY,
} from '@/components/profiles/role-section-registry'

import { ROLE_BY_KEY, type RoleKey, type ProfileSectionId } from '@/lib/constants/roles'

function pickEditableRow(
  raw: unknown,
): { row: Record<string, unknown> | null; loading: boolean } {
  if (raw === undefined) return { row: null, loading: true }
  if (raw === null) return { row: null, loading: false }
  if (Array.isArray(raw)) {
    return { row: (raw[0] as Record<string, unknown> | undefined) ?? null, loading: false }
  }
  return { row: raw as Record<string, unknown>, loading: false }
}

function StandardConnectedForm({
  roleSlug,
  sectionId,
  onClose,
}: {
  roleSlug: RoleKey
  sectionId: ProfileSectionId
  onClose?: () => void
}) {
  const config = ROLE_BY_KEY[roleSlug]
  const { create, update, mine, idArg } = useEntityMutation(roleSlug)
  const raw = useQuery(mine)
  const { user: me } = useSessionIdentity()
  const tCommon = useTranslations('common')

  const { row, loading } = pickEditableRow(raw)
  const wrappedUpdate = idArg
    ? (payload: Record<string, unknown>) => {
        const id = row?._id
        if (!id) {
          return Promise.reject(new Error(`Cannot update before row exists for ${idArg}`))
        }
        return update({ [idArg]: id, ...payload })
      }
    : update

  const SectionComponent = ROLE_SECTION_REGISTRY[roleSlug]?.[sectionId]
  if (SectionComponent) {
    return (
      <SectionComponent
        profile={loading ? undefined : row}
        me={me}
        create={create}
        update={wrappedUpdate}
        onClose={onClose}
      />
    )
  }

  if (sectionId === 'contact' && config.contact) {
    const createOverride = needsCreateOverride(config)
      ? (payload: Record<string, unknown>) => create(composeCreatePayload(config, payload))
      : undefined
    return (
      <BusinessContactSection
        profile={loading ? undefined : row}
        me={me}
        create={create}
        update={wrappedUpdate}
        onClose={onClose}
        nameLabel={config.contact.nameLabel ? tCommon(config.contact.nameLabel) : undefined}
        schema={config.contact.schema}
        languageKey={config.contact.languageKey}
        inheritFromOtherRoles={config.contact.inheritFromOtherRoles}
        createOverride={createOverride}
      />
    )
  }

  return null
}

export function hasConnectedForm(roleKey: RoleKey): boolean {
  const config = ROLE_BY_KEY[roleKey]
  if (!config) return false
  const sections = ROLE_SECTION_REGISTRY[roleKey]
  return Boolean(sections && Object.keys(sections).length > 0) || Boolean(config.contact)
}

export function RoleProfileForm({
  roleSlug,
  section,
  onClose,
}: {
  roleSlug: RoleKey
  section?: string
  onClose?: () => void
}) {
  const config = ROLE_BY_KEY[roleSlug]
  if (!config) return null

  const sections = ROLE_SECTION_REGISTRY[roleSlug] ?? {}
  const firstTab = config.profileTabs[0]?.id
  const sectionId = (section ?? firstTab) as ProfileSectionId | undefined
  if (!sectionId) return null

  const hasComponent = sectionId in sections
  const hasContactConfig = sectionId === 'contact' && Boolean(config.contact)
  if (!hasComponent && !hasContactConfig) return null

  return (
    <StandardConnectedForm
      roleSlug={roleSlug}
      sectionId={sectionId}
      onClose={onClose}
    />
  )
}
