'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { AlertCircle, X } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import type { RoleKey } from '@/lib/constants/roles'
import { PROFILE_BANNER_WINDOW_MS } from '@/lib/constants/ui-timings'

// ── localStorage helpers ──────────────────────────────────────────────

function dismissalKey(slug: string): string {
  return `profile-banner-dismissed-${slug}`
}

// ── Shared banner renderer ────────────────────────────────────────────

function BannerDisplay({
  missingFields,
  onOpen,
  slug,
}: {
  missingFields: string[]
  onOpen: () => void
  slug: string
}) {
  // Lazy initializer reads localStorage once on mount (client-only).
  // Returns true (hidden) on SSR since window is unavailable.
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem(dismissalKey(slug))
    return !!(stored && Date.now() - parseInt(stored, 10) < PROFILE_BANNER_WINDOW_MS)
  })

  // No useEffect needed — initial dismissed state is computed by the lazy initializer.

  if (dismissed || missingFields.length === 0) return null

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation()
    localStorage.setItem(dismissalKey(slug), Date.now().toString())
    setDismissed(true)
  }

  return (
    <div
      role="alert"
      className="glass-container flex items-start gap-3 px-4 py-3 cursor-pointer"
      style={{ border: '1px solid var(--color-warning)' }}
      onClick={onOpen}
    >
      <AlertCircle
        size={18}
        aria-hidden
        style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 1 }}
      />
      <p className="flex-1 text-sm text-primary">
        <span className="font-semibold">Complete your profile: </span>
        <span className="text-secondary">{missingFields.join(', ')}</span>
      </p>
      <button
        aria-label="Dismiss"
        onClick={handleDismiss}
        className="flex-shrink-0 p-0.5 text-secondary"
      >
        <X size={16} />
      </button>
    </div>
  )
}

// ── Role-specific sub-components ──────────────────────────────────────
// Each calls its own Convex query to avoid conditional hook calls.

function InstructorBanner({ slug, onOpen }: { slug: string; onOpen: () => void }) {
  const profile = useQuery(api.instructors.mine)
  if (profile === undefined) return null

  const missing: string[] = []
  if (!profile) {
    missing.push('full name', 'phone', 'certifications')
  } else {
    if (!profile.name) missing.push('full name')
    if (!profile.phone) missing.push('phone')
    if (!profile.credential?.length) missing.push('certifications')
  }

  return (
    <BannerDisplay missingFields={missing} onOpen={onOpen} slug={slug} />
  )
}

function DiveMasterBanner({ slug, onOpen }: { slug: string; onOpen: () => void }) {
  const profile = useQuery(api.diveMasters.mine)
  if (profile === undefined) return null

  const missing: string[] = []
  if (!profile) {
    missing.push('full name', 'phone', 'certifications')
  } else {
    if (!profile.name) missing.push('full name')
    if (!profile.phone) missing.push('phone')
    if (!profile.credential?.length) missing.push('certifications')
  }

  return (
    <BannerDisplay missingFields={missing} onOpen={onOpen} slug={slug} />
  )
}

function DiveCenterBanner({ slug, onOpen }: { slug: string; onOpen: () => void }) {
  const profile = useQuery(api.diveCenters.mine)
  if (profile === undefined) return null

  const missing: string[] = []
  if (!profile) {
    missing.push('business name', 'phone', 'affiliations')
  } else {
    if (!profile.name) missing.push('business name')
    if (!profile.phone) missing.push('phone')
    if (!profile.associations?.length) missing.push('affiliations')
  }

  return (
    <BannerDisplay missingFields={missing} onOpen={onOpen} slug={slug} />
  )
}

function AgentBanner({ slug, onOpen }: { slug: string; onOpen: () => void }) {
  const profile = useQuery(api.agents.mine)
  if (profile === undefined) return null

  const missing: string[] = []
  if (!profile) {
    missing.push('business name', 'phone', 'location')
  } else {
    if (!profile.name) missing.push('business name')
    if (!profile.phone) missing.push('phone')
    if (!profile.placeName) missing.push('location')
  }

  return (
    <BannerDisplay missingFields={missing} onOpen={onOpen} slug={slug} />
  )
}

function BoatBanner({ slug, onOpen }: { slug: string; onOpen: () => void }) {
  const profile = useQuery(api.boats.mine)
  if (profile === undefined) return null

  const missing: string[] = []
  if (!profile) {
    missing.push('business name', 'phone', 'vessel')
  } else {
    if (!profile.name) missing.push('business name')
    if (!profile.phone) missing.push('phone')
    if (!profile.fleet?.length) missing.push('vessel')
  }

  return (
    <BannerDisplay missingFields={missing} onOpen={onOpen} slug={slug} />
  )
}

function EquipmentBanner({ slug, onOpen }: { slug: string; onOpen: () => void }) {
  const profile = useQuery(api.equipment.mine)
  if (profile === undefined) return null

  const missing: string[] = []
  if (!profile) {
    missing.push('business name', 'phone')
  } else {
    if (!profile.name) missing.push('business name')
    if (!profile.phone) missing.push('phone')
  }

  return (
    <BannerDisplay missingFields={missing} onOpen={onOpen} slug={slug} />
  )
}

function PoolBanner({ slug, onOpen }: { slug: string; onOpen: () => void }) {
  const profile = useQuery(api.venues.mine)
  if (profile === undefined) return null

  const missing: string[] = []
  if (!profile) {
    missing.push('name', 'phone', 'pool depth', 'pool capacity')
  } else {
    if (!profile.name) missing.push('name')
    if (!profile.phone) missing.push('phone')
    if (!profile.maxDepth) missing.push('pool depth')
    if (!profile.maxCapacity) missing.push('pool capacity')
  }

  return (
    <BannerDisplay missingFields={missing} onOpen={onOpen} slug={slug} />
  )
}

function CompressorBanner({ slug, onOpen }: { slug: string; onOpen: () => void }) {
  const profile = useQuery(api.compressors.mine)
  if (profile === undefined) return null

  const missing: string[] = []
  if (!profile) {
    missing.push('name', 'phone', 'gas mixes')
  } else {
    if (!profile.name) missing.push('name')
    if (!profile.phone) missing.push('phone')
    if (!profile.gasMixes?.length) missing.push('gas mixes')
  }

  return (
    <BannerDisplay missingFields={missing} onOpen={onOpen} slug={slug} />
  )
}

// ── Public export ─────────────────────────────────────────────────────

export interface ProfileCompletionBannerProps {
  roleSlug: RoleKey
  slug: string
  onOpen: () => void
}

export function ProfileCompletionBanner({ roleSlug, slug, onOpen }: ProfileCompletionBannerProps) {
  switch (roleSlug) {
    case 'instructor':
      return <InstructorBanner slug={slug} onOpen={onOpen} />
    case 'dive-master':
      return <DiveMasterBanner slug={slug} onOpen={onOpen} />
    case 'dive-center':
      return <DiveCenterBanner slug={slug} onOpen={onOpen} />
    case 'agent':
      return <AgentBanner slug={slug} onOpen={onOpen} />
    case 'boat':
      return <BoatBanner slug={slug} onOpen={onOpen} />
    case 'equipment':
      return <EquipmentBanner slug={slug} onOpen={onOpen} />
    case 'pool':
      return <PoolBanner slug={slug} onOpen={onOpen} />
    case 'compressor':
      return <CompressorBanner slug={slug} onOpen={onOpen} />
    default:
      return null
  }
}
