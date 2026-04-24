'use client'

import { BusinessContactSection } from '@/components/profiles/business-contact-section'
import { contactSchema } from '@/lib/schemas/profile-shared'
import { type BaseProfileSectionProps } from '@/lib/profile-form'

export type EquipmentProfileSection = 'contact'

export function EquipmentContactSection(props: BaseProfileSectionProps) {
  return (
    <BusinessContactSection
      {...props}
      nameLabel="Business Name"
      schema={contactSchema}
      inheritFromOtherRoles="Equipment"
    />
  )
}

