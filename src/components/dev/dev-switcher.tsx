'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { Bug, Loader2, ArrowRight, Check } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { useDevSwitching } from './dev-switch-context'
import {
  ROLES,
  ROLE_BY_CLERK_ROLE,
  type RoleKey,
} from '@/lib/constants/roles'

/** Hide organizer seeds that are rarely used for dev switching; show resource roles instead. */
const DEV_SWITCHER_EXCLUDED_ROLE_KEYS = new Set<RoleKey>([
  'liveaboard',
  'dive-resort',
])
import { ALL_STAKEHOLDERS, type SeedUser, type SeedStakeholder } from '../../../convex/seedData'
import { ALL_INSTRUCTORS } from '../../../convex/seedInstructorData'
import { GlassCard } from '@/components/ui/glass-card'
import { parseConvexError } from '@/lib/utils/convex-error'

// Guard: dev-only component
export function DevSwitcher() {
  if (process.env.NODE_ENV !== 'development') return null
  return <DevSwitcherInner />
}

// All seed stakeholders
const ALL_SEED: SeedStakeholder[] = [
  ...ALL_STAKEHOLDERS,
  ...ALL_INSTRUCTORS,
]

function groupByRole(): Map<RoleKey, SeedUser[]> {
  const groups = new Map<RoleKey, SeedUser[]>()
  const seen = new Map<RoleKey, Set<string>>()

  for (const s of ALL_SEED) {
    if (!s.roles?.length) continue
    for (const { role } of s.roles) {
      const config = ROLE_BY_CLERK_ROLE[role]
      if (!config) continue
      const key = config.key
      let slugs = seen.get(key)
      if (!slugs) {
        slugs = new Set()
        seen.set(key, slugs)
      }
      if (slugs.has(s.user.slug)) continue
      slugs.add(s.user.slug)
      const list = groups.get(key) ?? []
      list.push(s.user)
      groups.set(key, list)
    }
  }
  return groups
}

const GROUPED = groupByRole()

function DevSwitcherInner() {
  const { user } = useCurrentUser()
  const switchUser = useMutation(api.devSwitcher.devSwitchUser)
  const { setSwitching: setContextSwitching } = useDevSwitching()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape key or click outside panel
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const [selections, setSelections] = useState<Map<RoleKey, string>>(() => {
    const m = new Map<RoleKey, string>()
    for (const config of ROLES) {
      const users = GROUPED.get(config.key)
      if (users?.length) m.set(config.key, users[0].slug)
    }
    return m
  })

  function setSelected(roleKey: RoleKey, slug: string) {
    setSelections((prev) => new Map(prev).set(roleKey, slug))
  }

  async function handleSwitch(slug: string | undefined) {
    if (!slug || switching) return
    // Signal context FIRST so sibling components skip their queries
    setContextSwitching(true)
    setSwitching(slug)
    setError(null)
    try {
      const result = await switchUser({ targetSlug: slug })
      const config = ROLE_BY_CLERK_ROLE[result.role as keyof typeof ROLE_BY_CLERK_ROLE]
      if (!config) {
        setError(`Unknown role: ${result.role}`)
        return
      }
      // Brief delay lets Convex propagate the tokenIdentifier patch before
      // the new page's queries fire — prevents a transient FORBIDDEN error.
      await new Promise((r) => setTimeout(r, 150))
      window.location.href = `/${result.slug}/${config.key}`
    } catch (err) {
      setError(parseConvexError(err, 'Switch failed — check console'))
    } finally {
      setSwitching(null)
    }
  }

  return (
    <>
      {/* Full-screen overlay masks transitional query state during switch */}
      {switching && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'var(--body-bg, #0f172a)' }}
        >
          <Loader2 className="h-6 w-6 animate-spin text-secondary" />
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg border text-primary"
        style={{ background: 'var(--color-glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          borderColor: 'var(--color-glass-border)',
          transition: 'opacity var(--transition-speed)' }}
      >
        <Bug className="h-3.5 w-3.5" />
        <span>{user?.firstName ?? 'Dev'}</span>
      </button>

      {/* Panel */}
      {open && (
        <div ref={panelRef} className="fixed bottom-12 right-4 z-50 w-80">
          <GlassCard padding="none" className="overflow-hidden">
            <div
              className="px-4 py-2 text-xs font-semibold border-b text-secondary"
              style={{ borderColor: 'var(--color-glass-border)' }}
            >
              Dev Switcher
            </div>
            {error && (
              <div
                className="px-3 py-1.5 text-[11px] border-b"
                style={{
                  color: 'var(--color-destructive, #dc2626)',
                  borderColor: 'var(--color-glass-border)',
                }}
              >
                {error}
              </div>
            )}
            <div className="max-h-96 overflow-y-auto">
              {ROLES.filter((c) => !DEV_SWITCHER_EXCLUDED_ROLE_KEYS.has(c.key)).map((config) => {
                const users = GROUPED.get(config.key)
                if (!users?.length) return null
                const Icon = config.icon
                const selectedSlug = selections.get(config.key) ?? users[0].slug
                const isCurrentUser = user?.slug === selectedSlug
                const isLoading = switching === selectedSlug

                return (
                  <div
                    key={config.key}
                    className="flex items-center gap-2 px-3 py-1.5 border-b last:border-0"
                    style={{ borderColor: 'var(--color-glass-border)' }}
                  >
                    <Icon
                      className="h-3.5 w-3.5 shrink-0 text-secondary"
                    />
                    <span
                      className="text-[11px] w-20 shrink-0 truncate text-secondary"
                    >
                      {config.label}
                    </span>
                    <select
                      value={selectedSlug}
                      onChange={(e) => setSelected(config.key, e.target.value)}
                      disabled={!!switching}
                      className="flex-1 min-w-0 text-[11px] rounded px-1 py-0.5 border text-primary"
                      style={{ background: 'var(--color-surface)',
                        borderColor: 'var(--color-glass-border)' }}
                    >
                      {users.map((u) => (
                        <option key={u.slug} value={u.slug}>
                          {u.firstName}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleSwitch(selectedSlug)}
                      disabled={!!switching}
                      className="shrink-0 h-6 w-6 flex items-center justify-center rounded disabled:opacity-40 text-primary"
                      aria-label={`Switch to ${selectedSlug}`}
                    >
                      {isLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isCurrentUser ? (
                        <Check
                          className="h-3 w-3"
                          style={{ color: 'var(--color-primary)' }}
                        />
                      ) : (
                        <ArrowRight className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </GlassCard>
        </div>
      )}
    </>
  )
}
