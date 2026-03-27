'use client'

import { useMutation, useQuery } from 'convex/react'
import { useState, useEffect } from 'react'
import { api } from '../../../convex/_generated/api'
import { GlassButton, GlassCard } from '@/components/glass'
import { LoadingCard } from '@/components/glass/loading-card'
import { LocationPicker, type LocationValue } from '@/components/common/location-picker'
import { GlassInput } from '@/components/glass/glass-input'

interface DcBasicStepProps {
  onSaved: () => void
  onBack?: () => void
}

export function DcBasicStep({ onSaved, onBack }: DcBasicStepProps) {
  const existing = useQuery(api.diveCenters.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.diveCenters.create)
  const update = useMutation(api.diveCenters.update)

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
        setLocation({
          placeName: existing.placeName,
          country: existing.country,
          lat: existing.lat,
          lng: existing.lng,
          placeId: existing.placeId ?? undefined,
        })
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
      if (existing) {
        await update({
          name,
          placeName: location.placeName,
          country: location.country,
          lat: location.lat,
          lng: location.lng,
          placeId: location.placeId,
          email,
          phone,
        })
      } else {
        await create({
          name,
          placeName: location.placeName,
          country: location.country,
          lat: location.lat,
          lng: location.lng,
          placeId: location.placeId,
          email,
          phone,
          associations: [],
        })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (existing === undefined || me === undefined) {
    return <LoadingCard />
  }

  return (
    <GlassCard padding="lg">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          Basic Information
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Tell us about your dive center.
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
