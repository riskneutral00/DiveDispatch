'use client'

import { useUser } from '@clerk/nextjs'
import { useMutation } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import {
  ORGANIZER_ROLES,
  RESOURCE_ROLES,
  type RoleConfig,
} from '../../../lib/constants/roles'

export default function RoleSelectPage() {
  const { user } = useUser()
  const router = useRouter()
  const setRole = useMutation(api.users.setRole)

  const [selected, setSelected] = useState<RoleConfig | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !businessName.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      // Sync role to Clerk public metadata so middleware and server components can read it
      await user?.update({
        unsafeMetadata: {
          role: selected.clerkRole,
          businessName: businessName.trim(),
        },
      })

      await setRole({
        role: selected.clerkRole,
        businessName: businessName.trim(),
      })

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="w-full max-w-2xl mx-auto p-8 rounded-[var(--border-radius)]"
      style={{
        background: 'var(--color-glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--color-glass-border)',
      }}
    >
      <h1
        className="text-2xl font-bold mb-2"
        style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
      >
        Select your role
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Choose how you participate in DiveDispatch. You can add additional roles later.
      </p>

      <form onSubmit={handleSubmit}>
        <fieldset className="mb-6">
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
                selected={selected?.key === role.key}
                onSelect={() => setSelected(role)}
              />
            ))}
          </div>
        </fieldset>

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
                selected={selected?.key === role.key}
                onSelect={() => setSelected(role)}
              />
            ))}
          </div>
        </fieldset>

        {selected && (
          <div className="mb-6">
            <label
              htmlFor="businessName"
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Business / display name
            </label>
            <input
              id="businessName"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={`e.g. Phuket ${selected.label}`}
              required
              className="w-full px-3 py-2 rounded-[var(--border-radius)] text-sm outline-none"
              style={{
                background: 'var(--color-surface-elevated)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-glass-border)',
              }}
            />
          </div>
        )}

        {error && (
          <p className="mb-4 text-sm text-destructive">{error}</p>
        )}

        <button
          type="submit"
          disabled={!selected || !businessName.trim() || submitting}
          className="w-full py-2.5 rounded-[var(--border-radius)] font-semibold text-sm disabled:opacity-50"
          style={{
            background: 'var(--color-primary)',
            color: 'var(--color-text-on-primary)',
          }}
        >
          {submitting ? 'Setting up…' : 'Continue'}
        </button>
      </form>
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
      <Icon size={18} />
      <span className="text-sm font-medium">{role.label}</span>
    </button>
  )
}
