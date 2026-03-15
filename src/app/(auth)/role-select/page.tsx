'use client'

import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import {
  ORGANIZER_ROLES,
  RESOURCE_ROLES,
  ROLE_BY_CLERK_ROLE,
  type ClerkRole,
  type RoleConfig,
} from '@/lib/constants/roles'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassInput } from '@/components/glass/glass-input'

const PERSONAL_ROLE_KEYS = new Set(['instructor', 'dive-master'])

export default function RoleSelectPage() {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()
  const { user: clerkUser } = useUser()
  const user = useQuery(api.users.me)
  const createUser = useMutation(api.users.createUser)
  const router = useRouter()

  const [selectedRole, setSelectedRole] = useState<RoleConfig | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Derived
  const isPersonal = selectedRole ? PERSONAL_ROLE_KEYS.has(selectedRole.key) : false
  const emailPrefix = clerkUser?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? ''
  const effectiveBusinessName = isPersonal ? emailPrefix : businessName.trim()
  const canSubmit = selectedRole !== null && (isPersonal || businessName.trim() !== '') && !isSubmitting

  // Redirect: not authenticated → sign-in
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/sign-in')
    }
  }, [authLoading, isAuthenticated, router])

  // Redirect: has Convex user → their dashboard
  useEffect(() => {
    if (user === undefined || user === null) return
    const roleConfig = ROLE_BY_CLERK_ROLE[user.role as ClerkRole]
    if (roleConfig) {
      router.replace(`/${roleConfig.key}/${user.slug}/dashboard`)
    }
  }, [user, router])

  // Still loading auth or Convex query
  if (authLoading || user === undefined) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--color-surface)' }}
      >
        <div className="flex items-center gap-3" style={{ color: 'var(--color-text-secondary)' }}>
          <span
            className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
            aria-hidden
          />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  // Authenticated but no Convex user — show role selection
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRole) return

    setIsSubmitting(true)
    setError(null)

    try {
      await createUser({
        role: selectedRole.clerkRole,
        businessName: effectiveBusinessName,
      })
      router.push('/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--color-surface)' }}
    >
      <div
        className="w-full max-w-2xl p-8 rounded-[var(--border-radius)]"
        style={{
          background: 'var(--color-glass-bg)',
          backdropFilter: 'blur(var(--color-glass-blur))',
          border: '1px solid var(--color-glass-border)',
        }}
      >
        <form onSubmit={handleSubmit} noValidate>
          <h1
            className="text-2xl font-bold mb-1"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
          >
            Choose your role
          </h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Select what you do in the dive industry to set up your dashboard.
          </p>

          {/* Organizer roles */}
          <fieldset className="mb-4">
            <legend
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Organizers — create &amp; manage bookings
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {ORGANIZER_ROLES.map((role) => (
                <RoleTile
                  key={role.key}
                  role={role}
                  selected={selectedRole?.key === role.key}
                  onSelect={() => setSelectedRole(role)}
                />
              ))}
            </div>
          </fieldset>

          {/* Resource roles */}
          <fieldset className="mb-6">
            <legend
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Resources — confirm participation in bookings
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {RESOURCE_ROLES.map((role) => (
                <RoleTile
                  key={role.key}
                  role={role}
                  selected={selectedRole?.key === role.key}
                  onSelect={() => setSelectedRole(role)}
                />
              ))}
            </div>
          </fieldset>

          {/* Business name — shown only for non-personal roles */}
          {selectedRole && !isPersonal && (
            <div className="mb-6">
              <GlassInput
                label="Business / display name"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Phuket Dive Center"
                required
              />
            </div>
          )}

          {/* Selected role description */}
          {selectedRole && (
            <p
              className="mb-6 text-sm text-center"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {selectedRole.description}
            </p>
          )}

          {error && (
            <p className="mb-4 text-sm" style={{ color: 'var(--color-destructive)' }}>
              {error}
            </p>
          )}

          <GlassButton
            type="submit"
            variant="primary"
            fullWidth
            loading={isSubmitting}
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Setting up…' : 'Continue'}
          </GlassButton>
        </form>
      </div>
    </div>
  )
}

function RoleTile({
  role,
  selected,
  onSelect,
}: {
  role: RoleConfig
  selected: boolean
  onSelect: () => void
}) {
  const Icon = role.icon
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center gap-3 p-3 rounded-[var(--border-radius)] text-left transition-all"
      style={{
        background: selected ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
        color: selected ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-glass-border)'}`,
      }}
    >
      <Icon size={18} strokeWidth={1.75} />
      <span className="text-sm font-medium">{role.label}</span>
    </button>
  )
}
