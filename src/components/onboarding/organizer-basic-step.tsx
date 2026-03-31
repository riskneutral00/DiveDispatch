'use client'

import { useMutation, useQuery } from 'convex/react'
import { useState, useEffect } from 'react'
import { api } from '../../../convex/_generated/api'
import { GlassButton, GlassCard } from '@/components/ui'
import { LoadingCard } from '@/components/ui/loading-card'
import { LocationPicker, type LocationValue } from '@/components/profiles/location-picker-lazy'
import { GlassInput } from '@/components/ui/glass-input'
import { parseConvexError } from '@/lib/utils/convex-error'
import type { ClerkRole } from '@/lib/constants/roles'
import { getOrganizerRoleFlags } from '@/lib/constants/organizer-wizard-config'

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
    default:
      return null
  }
}

export function OrganizerBasicStep({ role, onSaved, onBack }: OrganizerBasicStepProps) {
  const mutations = useRoleMutations(role)

  // Roles without Convex modules get a placeholder
  if (!mutations) {
    return (
      <GlassCard padding="lg">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-1 text-primary">Basic Information</h2>
          <p className="text-sm text-secondary">
            Profile setup for this role is coming soon.
          </p>
        </div>
        <div className="flex gap-3 mt-2">
          {onBack && (
            <GlassButton variant="secondary" fullWidth onClick={onBack}>Back</GlassButton>
          )}
          <GlassButton variant="primary" fullWidth onClick={onSaved}>Next</GlassButton>
        </div>
      </GlassCard>
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
        // DiveCenters: top-level placeName/country/lat/lng
        // Agents: locations[] array
        if ('lat' in existing && existing.lat !== undefined) {
          setLocation({
            placeName: existing.placeName,
            country: existing.country,
            lat: existing.lat,
            lng: existing.lng,
            placeId: existing.placeId ?? undefined,
          })
        } else if ('locations' in existing && Array.isArray(existing.locations) && existing.locations.length > 0) {
          const loc = existing.locations[0]
          setLocation({
            placeName: loc.placeName,
            country: loc.country,
            lat: loc.lat,
            lng: loc.lng,
            placeId: loc.placeId ?? undefined,
          })
        }
        setContactEmail(existing.email)
        setContactPhone(existing.phone)
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

      const { locationModel } = getOrganizerRoleFlags(role)

      if (existing) {
        await update(basePayload)
      } else if (locationModel === 'single') {
        await create({ ...basePayload, associations: [] })
      } else if (locationModel === 'multi') {
        await create({
          ...basePayload,
          locations: [{ placeName: location.placeName, country: location.country, lat: location.lat, lng: location.lng, placeId: location.placeId }],
          associations: [],
          defaultReferralMode: 'independent' as const,
        })
      } else {
        throw new Error(`Unexpected locationModel for role: ${role}`)
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
    <GlassCard padding="lg">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1 text-primary">
          Basic Information
        </h2>
        <p className="text-sm text-secondary">
          Tell us about your {roleLabel}.
        </p>
      </div>

      <div className="flex flex-col gap-4" data-testid="wizard-content">
        <GlassInput
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
        <GlassInput
          label="Contact Email"
          type="email"
          value={email}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="dive@example.com"
          required
        />
        <GlassInput
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

        <div className="flex gap-3 mt-2" data-testid="wizard-nav">
          {onBack && (
            <GlassButton
              variant="secondary"
              fullWidth
              onClick={onBack}
            >
              Back
            </GlassButton>
          )}
          <GlassButton
            variant="primary"
            fullWidth
            disabled={!isComplete || saving}
            loading={saving}
            onClick={handleNext}
          >
            Next
          </GlassButton>
        </div>
      </div>
    </GlassCard>
  )
}
