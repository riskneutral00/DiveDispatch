'use client'

import { useMutation, useQuery } from 'convex/react'
import { useState, useEffect } from 'react'
import { api } from '@/lib/convex-generated'
import { InlineError } from '@/components/ui/inline-error'
import { LoadingCard } from '@/components/ui/loading-card'
import { LocationPicker, type LocationValue } from '@/components/profiles/location-picker-lazy'
import { Input } from '@/components/ui/input'
import { parseConvexError } from '@/lib/utils/convex-error'
import type { ClerkRole } from '@/lib/constants/roles'
import { useOrganizerRoleApi } from '@/lib/hooks/use-organizer-role-api'
import { getOrganizerRoleFlags } from '@/lib/constants/organizer-wizard-config'
import { OrganizerStepCard } from './organizer-step-card'

interface OrganizerBasicStepProps {
  role: ClerkRole
  onSaved: () => void
  onBack?: () => void
}

export function OrganizerBasicStep({ role, onSaved, onBack }: OrganizerBasicStepProps) {
  const mutations = useOrganizerRoleApi(role)

  // Roles without Convex modules get a placeholder
  if (!mutations) {
    return (
      <OrganizerStepCard
        title="Basic Information"
        subtitle="Coming soon."
        onBack={onBack}
        onNext={onSaved}
      >
        <div />
      </OrganizerStepCard>
    )
  }

  return <BasicStepInner role={role} mutations={mutations} onSaved={onSaved} onBack={onBack} />
}

interface BasicStepInnerProps {
  role: ClerkRole
  mutations: NonNullable<ReturnType<typeof useOrganizerRoleApi>>
  onSaved: () => void
  onBack?: () => void
}

function BasicStepInner({ role, mutations, onSaved, onBack }: BasicStepInnerProps) {
  const existing = useQuery(mutations.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(mutations.create)
  const update = useMutation(mutations.update)

  const [name, setName] = useState('')
  const [location, setLocation] = useState<LocationValue | null>(null)
  const [email, setContactEmail] = useState('')
  const [phone, setContactPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (existing !== undefined && me !== undefined && !initialized) {
      if (existing) {
        setName(existing.name)
        // All roles now use flat placeName/country/lat/lng
        if ('lat' in existing && existing.lat !== undefined) {
          setLocation({
            placeName: existing.placeName,
            country: existing.country,
            lat: existing.lat,
            lng: existing.lng,
          })
        }
        setContactEmail(existing.email ?? '')
        setContactPhone(existing.phone ?? '')
      } else {
        setName(me?.businessName ?? '')
        setContactEmail(me?.email ?? '')
      }
      setInitialized(true)
    }
  }, [existing, me, initialized])

  const isComplete =
    name.trim() && location && email.trim() && phone.trim()

  async function handleNext() {
    if (!isComplete || !location) return
    setSaving(true)
    setError(null)
    try {
      const basePayload = {
        name,
        placeName: location.placeName,
        country: location.country,
        lat: location.lat,
        lng: location.lng,
        email,
        phone,
      }



      if (existing) {
        await update(basePayload)
      } else if (role === 'DiveSite') {
        await create({
          ...basePayload,
          venueType: 'Shore',
          confinedCapable: false,
          hasCompressor: false,
        })
      } else {
        await create({
          ...basePayload,
          associations: [],
        })
      }
      onSaved()
    } catch (err) {
      setError(parseConvexError(err, 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  if (existing === undefined || me === undefined) {
    return <LoadingCard />
  }

  const { displayLabel: roleLabel } = getOrganizerRoleFlags(role)

  return (
    <OrganizerStepCard
      title="Basic Information"
      subtitle={`Tell us about your ${roleLabel}.`}
      onBack={onBack}
      onNext={handleNext}
      loading={saving}
      disabled={!isComplete}
    >
      <div className="flex flex-col gap-4" data-testid="wizard-content">
        <Input
          label="Business Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ocean Explorer Dive Center"
          required
        />
        <LocationPicker
          label="Location"
          value={location}
          onChange={setLocation}
        />
        <Input
          label="Contact Email"
          type="email"
          value={email}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="dive@example.com"
          required
        />
        <Input
          label="Contact Phone"
          type="tel"
          value={phone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="+66 81 234 5678"
          required
        />

        {error && <InlineError>{error}</InlineError>}
      </div>
    </OrganizerStepCard>
  )
}
