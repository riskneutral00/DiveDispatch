'use client'

import { useTranslations } from 'next-intl'
import { BusinessContactSection } from '@/components/profiles/business-contact-section'
import { contactSchema } from '@/lib/schemas/profile-shared'
import { type BaseProfileSectionProps } from '@/lib/profile-form'

export function CompressorContactSection(props: BaseProfileSectionProps) {
  const t = useTranslations('common')
  return (
    <BusinessContactSection
      {...props}
      nameLabel={t('businessName')}
      schema={contactSchema}
      inheritFromOtherRoles="Compressor"
    />
  )
}
