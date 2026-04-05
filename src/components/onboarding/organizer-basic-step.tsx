'use client'

import { useMutation, useQuery } from 'convex/react'
import { useState, useEffect } from 'react'
import { api } from '@/lib/convex-generated'
import { LoadingCard } from '@/components/ui/loading-card'
import { LocationPicker, type LocationValue } from '@/components/profiles/location-picker-lazy'
import { Input } from '@/components/ui/input'
import { parseConvexError } from '@/lib/utils/convex-error'
import type { ClerkRole } from '@/lib/constants/roles'
import { getOrganizerRoleFlags } from '@/lib/constants/organizer-wizard-config'
import { OrganizerStepCard } from './organizer-step-card'

interface OrganizerBasicStepProps {
  role: ClerkRole
  onSaved: () => void
  onBack?: () => void
}

/**
 * Resolves the Convex API module (create/update/mine) for a given organizer role.
 * Roles without a dedicated Convex module yet (Liveaboard, DiveResort, DiveHostel, DiveSite)
 * return null — the step renders a placeholder.
 */
function useRoleMutations(role: ClerkRole) {
  switch (role) {
    case 'DiveCenter':
      return {
        mine: api.diveCenters.mine,
        create: api.diveCenters.create,
        update: api.diveCenters.update,
      } as const
    case 'Agent':
      return {
        mine: api.agents.mine,
        create: api.agents.create,
        update: api.agents.update,
      } as const
    case 'DiveSite':
      return {
        mine: api.venues.mine,
        create: api.venues.create,
        update: api.venues.update,
      } as const
    default:
      return null
  }
}

export function OrganizerBasicStep({ role, onSaved, onBack }: OrganizerBasicStepProps) {
  const mutations = useRoleMutations(role)

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
  mutations: NonNullable<ReturnType<typeof useRoleMutations>>
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
            placeId: existing.placeId ?? undefined,
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
        placeId: location.placeId,
        email,
        phone,
      }



      if (existing) {
        await update(basePayload)
      } else if (role === 'DiveSite') {
        await create({
          ...basePayload,
          venueType: 'Shore',
          isPublic: false,
          confinedCapable: false,
          hasCompressor: false,
        })
      } else {
        await create({
          ...basePayload,
          associations: [],
          ...(role === 'Agent' ? { defaultReferralMode: 'independent' as const } : {}),
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

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{error}</p>
        )}
      </div>
    </OrganizerStepCard>
  )
}
