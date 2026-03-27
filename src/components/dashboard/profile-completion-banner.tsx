'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { AlertCircle, X } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { RoleKey } from '@/lib/constants/roles'

// ── localStorage helpers ──────────────────────────────────────────────

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function dismissalKey(slug: string): string {
  return `profile-banner-dismissed-${slug}`
}

// ── Shared banner renderer ────────────────────────────────────────────

function BannerDisplay({
  missingFields,
  settingsHref,
  slug,
}: {
  missingFields: string[]
  settingsHref: string
  slug: string
}) {
  // Lazy initializer reads localStorage once on mount (client-only).
  // Returns true (hidden) on SSR since window is unavailable.
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem(dismissalKey(slug))
    return !!(stored && Date.now() - parseInt(stored, 10) < SEVEN_DAYS_MS)
  })
  const router = useRouter()

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
      onClick={() => router.push(settingsHref)}
    >
      <AlertCircle
        size={18}
        aria-hidden
        style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 1 }}
      />
      <p className="flex-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>
        <span className="font-semibold">Complete your profile: </span>
        <span style={{ color: 'var(--color-text-secondary)' }}>{missingFields.join(', ')}</span>
      </p>
      <button
        aria-label="Dismiss"
        onClick={handleDismiss}
        className="flex-shrink-0 p-0.5"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <X size={16} />
      </button>
    </div>
  )
}

// ── Role-specific sub-components ──────────────────────────────────────
// Each calls its own Convex query to avoid conditional hook calls.

function InstructorBanner({ slug }: { slug: string }) {
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
    <BannerDisplay missingFields={missing} settingsHref={`/${slug}/instructor/profile`} slug={slug} />
  )
}

function DiveMasterBanner({ slug }: { slug: string }) {
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
    <BannerDisplay missingFields={missing} settingsHref={`/${slug}/dive-master/profile`} slug={slug} />
  )
}

function DiveCenterBanner({ slug }: { slug: string }) {
  const profile = useQuery(api.diveCenters.mine)
  if (profile === undefined) return null

  const missing: string[] = []
  if (!profile) {
    missing.push('business name', 'phone')
  } else {
    if (!profile.name) missing.push('business name')
    if (!profile.phone) missing.push('phone')
  }

  return (
    <BannerDisplay missingFields={missing} settingsHref={`/${slug}/dive-center/profile`} slug={slug} />
  )
}

function AgentBanner({ slug }: { slug: string }) {
  const profile = useQuery(api.agents.mine)
  if (profile === undefined) return null

  const missing: string[] = []
  if (!profile) {
    missing.push('business name', 'phone', 'location')
  } else {
    if (!profile.name) missing.push('business name')
    if (!profile.phone) missing.push('phone')
    if (!profile.locations?.length) missing.push('location')
  }

  return (
    <BannerDisplay missingFields={missing} settingsHref={`/${slug}/agent/profile`} slug={slug} />
  )
}

function BoatBanner({ slug }: { slug: string }) {
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
    <BannerDisplay missingFields={missing} settingsHref={`/${slug}/boat/settings`} slug={slug} />
  )
}

function EquipmentBanner({ slug }: { slug: string }) {
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
    <BannerDisplay missingFields={missing} settingsHref={`/${slug}/equipment/settings`} slug={slug} />
  )
}

function PoolBanner({ slug }: { slug: string }) {
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
    <BannerDisplay missingFields={missing} settingsHref={`/${slug}/pool/settings`} slug={slug} />
  )
}

function CompressorBanner({ slug }: { slug: string }) {
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
    <BannerDisplay missingFields={missing} settingsHref={`/${slug}/compressor/settings`} slug={slug} />
  )
}

// ── Public export ─────────────────────────────────────────────────────

export interface ProfileCompletionBannerProps {
  roleSlug: RoleKey
  slug: string
}

export function ProfileCompletionBanner({ roleSlug, slug }: ProfileCompletionBannerProps) {
  switch (roleSlug) {
    case 'instructor':
      return <InstructorBanner slug={slug} />
    case 'dive-master':
      return <DiveMasterBanner slug={slug} />
    case 'dive-center':
      return <DiveCenterBanner slug={slug} />
    case 'agent':
      return <AgentBanner slug={slug} />
    case 'boat':
      return <BoatBanner slug={slug} />
    case 'equipment':
      return <EquipmentBanner slug={slug} />
    case 'pool':
      return <PoolBanner slug={slug} />
    case 'compressor':
      return <CompressorBanner slug={slug} />
    default:
      return null
  }
}
