'use client'

import { VenueCapabilitiesSection } from '@/components/profiles/venue-capabilities-section'
import { VenueContactSection } from '@/components/profiles/venue-contact-section'
import { type BaseProfileSectionProps } from '@/lib/profile-form'

export type VenueProfileSection = 'contact' | 'capabilities'

type VenueSectionProps = BaseProfileSectionProps

export function VenueProfileForm({
  section,
  profile,
  me,
  create,
  update,
  onSaved,
  onClose,
}: VenueSectionProps & { section?: VenueProfileSection }) {
  if (section === 'capabilities')
    return (
      <VenueCapabilitiesSection
        profile={profile}
        me={me}
        create={create}
        update={update}
        onClose={onClose}
      />
    )
  return <VenueContactSection onSaved={onSaved} onClose={onClose} />
}

export { VenueContactSection } from '@/components/profiles/venue-contact-section'
