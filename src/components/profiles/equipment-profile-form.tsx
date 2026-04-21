'use client'

import { BusinessContactSection } from '@/components/profiles/business-contact-section'
import { contactSchema } from '@/lib/schemas/profile-shared'
import { type BaseProfileSectionProps } from '@/lib/profile-form'

export type EquipmentProfileSection = 'contact'

type EquipmentSectionProps = BaseProfileSectionProps

export function EquipmentContactSection(props: EquipmentSectionProps) {
  return (
    <BusinessContactSection
      {...props}
      nameLabel="Business Name"
      schema={contactSchema}
      inheritFromOtherRoles="Equipment"
    />
  )
}

export function EquipmentProfileForm({
  profile,
  me,
  create,
  update,
  onSaved,
  onClose,
}: EquipmentSectionProps & { section?: EquipmentProfileSection }) {
  return <EquipmentContactSection profile={profile} me={me} create={create} update={update} onSaved={onSaved} onClose={onClose} />
}
