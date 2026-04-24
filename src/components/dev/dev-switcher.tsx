'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { Bug, Loader2, ArrowRight, Check } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { useClickOutside } from '@/lib/hooks/use-click-outside'
import { useDevSwitching } from './dev-switch-context'
import {
  ROLES,
  ROLE_BY_CLERK_ROLE,
  type RoleKey,
} from '@/lib/constants/roles'
import { Card } from '@/components/ui/card'
import { parseConvexError } from '@/lib/utils/convex-error'

const DEV_SWITCHER_EXCLUDED_ROLE_KEYS = new Set<RoleKey>([])

type DevUser = {
  slug: string
  firstName: string
  lastName: string
  name: string
  roles: string[]
}

export function DevSwitcher() {
  if (process.env.NODE_ENV !== 'development') return null
  return <DevSwitcherGate />
}

function DevSwitcherGate() {
  const { isAuthenticated } = useConvexAuth()
  if (!isAuthenticated) return null
  return <DevSwitcherInner />
}

function groupByRole(users: DevUser[]): Map<RoleKey, DevUser[]> {
  const groups = new Map<RoleKey, DevUser[]>()
  const seen = new Map<RoleKey, Set<string>>()

  for (const u of users) {
    for (const clerkRole of u.roles) {
      const config = ROLE_BY_CLERK_ROLE[clerkRole as keyof typeof ROLE_BY_CLERK_ROLE]
      if (!config) continue
      const key = config.key
      let slugs = seen.get(key)
      if (!slugs) {
        slugs = new Set()
        seen.set(key, slugs)
      }
      if (slugs.has(u.slug)) continue
      slugs.add(u.slug)
      const list = groups.get(key) ?? []
      list.push(u)
      groups.set(key, list)
    }
  }
  return groups
}

function DevSwitcherInner() {
  const { isAuthenticated } = useConvexAuth()
  const { user } = useCurrentUser()
  const switchUser = useMutation(api.devSwitcher.devSwitchUser)
  const allUsers = useQuery(
    api.devSwitcher.listAllUsers,
    isAuthenticated ? {} : 'skip',
  )
  const { setSwitching: setContextSwitching } = useDevSwitching()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const closePanel = useCallback(() => setOpen(false), [])
  useClickOutside(containerRef, closePanel, open)
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const grouped = useMemo(() => groupByRole(allUsers ?? []), [allUsers])

  const [selections, setSelections] = useState<Map<RoleKey, string>>(new Map())

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- comments-ok auto-defaults per-role selection from async-loaded users */
    setSelections((prev) => {
      const next = new Map(prev)
      for (const config of ROLES) {
        const users = grouped.get(config.key)
        if (users?.length && !next.has(config.key)) {
          next.set(config.key, users[0].slug)
        }
      }
      return next
    })
  }, [grouped])

  function setSelected(roleKey: RoleKey, slug: string) {
    setSelections((prev) => new Map(prev).set(roleKey, slug))
  }

  async function handleSwitch(slug: string | undefined) {
    if (!slug || switching) return
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
      {switching && (
        <div
          className="fixed inset-0 z-[var(--z-dev)] flex items-center justify-center"
          style={{ background: 'var(--body-bg, #0f172a)' }}
        >
          <Loader2 className="h-6 w-6 animate-spin text-secondary" />
        </div>
      )}

      <div
        ref={containerRef}
        className="fixed bottom-4 right-4 z-[var(--z-dropdown)]"
      >
        {open && (
          <div className="absolute bottom-full right-0 z-10 mb-2 w-80"> {/* design-ok: dev-only floating panel, fixed 320px width */}
            <Card padding="none" overflow="hidden">
            <div
              className="px-4 py-2 text-label font-semibold border-b text-secondary border-glass-border"
            >
              Dev Switcher
            </div>
            {error && (
              <div
                className="px-3 py-1.5 text-[11px] border-b border-glass-border" /* design-ok: dev-only error banner, dense font for tight panel */
                style={{
                  color: 'var(--color-destructive, #dc2626)',
                }}
              >
                {error}
              </div>
            )}
            <div className="max-h-96 overflow-y-auto overflow-x-hidden">
              {allUsers === undefined ? (
                <div className="px-3 py-3 text-[11px] text-secondary"> {/* design-ok: dev-only loading state, dense font for tight panel */}
                  Loading…
                </div>
              ) : allUsers.length === 0 ? (
                <div className="px-3 py-3 text-[11px] text-secondary"> {/* design-ok: dev-only empty state, dense font for tight panel */}
                  No users in DB yet.
                </div>
              ) : (
                ROLES.filter((c) => !DEV_SWITCHER_EXCLUDED_ROLE_KEYS.has(c.key)).map((config) => {
                  const users = grouped.get(config.key)
                  if (!users?.length) return null
                  const Icon = config.icon
                  const selectedSlug = selections.get(config.key) ?? users[0].slug
                  const isCurrentUser = user?.slug === selectedSlug
                  const isLoading = switching === selectedSlug

                  return (
                    <div
                      key={config.key}
                      className="flex items-center gap-2 px-3 py-1.5 border-b last:border-0 border-glass-border"
                    >
                      <Icon
                        className="h-3.5 w-3.5 shrink-0 text-secondary"
                      />
                      <span
                        className="text-[11px] w-20 shrink-0 truncate text-secondary" /* design-ok: dev-only role label, dense font + fixed width for tight panel */
                      >
                        {config.label}
                      </span>
                      <select /* design-ok: dev-only tenant switcher */
                        value={selectedSlug}
                        onChange={(e) => setSelected(config.key, e.target.value)}
                        disabled={!!switching}
                        className="flex-1 min-w-0 text-[11px] rounded-[var(--border-radius-button)] px-1 py-0.5 border text-primary bg-surface border-glass-border"
                      >
                        {users.map((u) => (
                          <option key={u.slug} value={u.slug}>
                            {u.firstName || u.slug}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleSwitch(selectedSlug)}
                        disabled={!!switching}
                        className="shrink-0 h-6 w-6 flex items-center justify-center rounded-[var(--border-radius-button)] disabled:opacity-40 text-primary"
                        aria-label={`Switch to ${selectedSlug}`}
                      >
                        {isLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : isCurrentUser ? (
                          <Check className="h-3 w-3 text-primary" />
                        ) : (
                          <ArrowRight className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </Card>
          </div>
        )}

        <button /* design-ok: dev-only debug pill, bespoke glass styling */
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-label font-medium shadow-lg glass text-primary"
          style={{ transition: 'opacity var(--transition-speed)' }}
        >
          <Bug className="h-3.5 w-3.5" />
          <span>{user?.firstName ?? 'Dev'}</span>
        </button>
      </div>
    </>
  )
}
