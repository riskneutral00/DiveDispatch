'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { Bug, Loader2, ArrowRight, Check } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { ROLES, ROLE_BY_CLERK_ROLE, type RoleKey } from '@/lib/constants/roles'
import { ALL_STAKEHOLDERS, type SeedUser } from '../../../convex/seedData'
import { ALL_INSTRUCTORS } from '../../../convex/seedInstructorData'
import { GlassCard } from '@/components/glass/glass-card'

// Guard: dev-only component
export function DevSwitcher() {
  if (process.env.NODE_ENV !== 'development') return null
  return <DevSwitcherInner />
}

// Flatten all seed stakeholders into SeedUser[]
const ALL_SEED_USERS: SeedUser[] = [
  ...ALL_STAKEHOLDERS.map((s) => s.user),
  ...ALL_INSTRUCTORS.map((s) => s.user),
]

function groupByRole(): Map<RoleKey, SeedUser[]> {
  const groups = new Map<RoleKey, SeedUser[]>()
  for (const user of ALL_SEED_USERS) {
    const config = ROLE_BY_CLERK_ROLE[user.role]
    if (!config) continue
    const list = groups.get(config.key) ?? []
    list.push(user)
    groups.set(config.key, list)
  }
  return groups
}

const GROUPED = groupByRole()

function DevSwitcherInner() {
  const { user } = useCurrentUser()
  const switchUser = useMutation(api.devSwitcher.devSwitchUser)
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      window.location.href = `${config.route}/${result.slug}/dashboard`
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Switch failed — check console'
      setError(msg)
    } finally {
      setSwitching(null)
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg border"
        style={{
          background: 'var(--color-glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          borderColor: 'var(--color-glass-border)',
          color: 'var(--color-text-primary)',
          transition: 'opacity var(--transition-speed)',
        }}
      >
        <Bug className="h-3.5 w-3.5" />
        <span>{user?.firstName ?? 'Dev'}</span>
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-12 right-4 z-50 w-80">
          <GlassCard padding="none" elevated className="overflow-hidden">
            <div
              className="px-4 py-2 text-xs font-semibold border-b"
              style={{
                color: 'var(--color-text-secondary)',
                borderColor: 'var(--color-glass-border)',
              }}
            >
              Dev Switcher
            </div>
            {error && (
              <div
                className="px-3 py-1.5 text-[11px] border-b"
                style={{
                  color: 'var(--color-destructive, #ef4444)',
                  borderColor: 'var(--color-glass-border)',
                }}
              >
                {error}
              </div>
            )}
            <div className="max-h-96 overflow-y-auto">
              {ROLES.map((config) => {
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
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: 'var(--color-text-secondary)' }}
                    />
                    <span
                      className="text-[11px] w-20 shrink-0 truncate"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {config.label}
                    </span>
                    <select
                      value={selectedSlug}
                      onChange={(e) => setSelected(config.key, e.target.value)}
                      disabled={!!switching}
                      className="flex-1 min-w-0 text-[11px] rounded px-1 py-0.5 border"
                      style={{
                        background: 'var(--color-surface)',
                        color: 'var(--color-text-primary)',
                        borderColor: 'var(--color-glass-border)',
                      }}
                    >
                      {users.map((u) => (
                        <option key={u.slug} value={u.slug}>
                          {u.firstName}
                          {u.additionalRoles?.length ? ` +${u.additionalRoles.length}` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleSwitch(selectedSlug)}
                      disabled={!!switching}
                      className="shrink-0 h-6 w-6 flex items-center justify-center rounded disabled:opacity-40"
                      style={{ color: 'var(--color-text-primary)' }}
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
