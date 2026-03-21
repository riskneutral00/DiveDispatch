'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../convex/_generated/api'
import {
  ROLE_BY_CLERK_ROLE,
  type ClerkRole,
} from '@/lib/constants/roles'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassInput } from '@/components/glass/glass-input'
import { Spinner } from '@/components/common/spinner'

// Roles where a personal name is used instead of a business name
const PERSONAL_ROLE_KEYS = new Set(['instructor', 'dive-master'])

interface ProfileFormValues {
  firstName: string
  lastName: string
  businessName: string
  contactEmail: string
}

// ── Edit mode profile form ────────────────────────────────────────────────────

function EditProfileForm({
  user,
  onSave,
  submitting,
  error,
}: {
  user: NonNullable<ReturnType<typeof useQuery<typeof api.users.me>>>
  onSave: (values: ProfileFormValues) => void
  submitting: boolean
  error: string
}) {
  const [values, setValues] = useState<ProfileFormValues>({
    firstName: user.firstName,
    lastName: user.lastName,
    businessName: user.businessName,
    contactEmail: user.email,
  })

  const roleConfig = ROLE_BY_CLERK_ROLE[user.role as ClerkRole]
  const hasPersonalOnlyRole = roleConfig && PERSONAL_ROLE_KEYS.has(roleConfig.key)
  const showBusinessName = !hasPersonalOnlyRole

  function set(field: keyof ProfileFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
  }

  const isComplete =
    values.firstName.trim() &&
    values.lastName.trim() &&
    (!showBusinessName || values.businessName.trim())

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8 text-center">
        <h1
          className="text-2xl font-semibold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Edit Profile
        </h1>
        {roleConfig && (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {roleConfig.label}
          </p>
        )}
      </div>

      <GlassCard elevated>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (isComplete) onSave(values)
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="First name"
              value={values.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              autoComplete="given-name"
              required
            />
            <GlassInput
              label="Last name"
              value={values.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              autoComplete="family-name"
              required
            />
          </div>

          {showBusinessName && (
            <GlassInput
              label="Business name"
              value={values.businessName}
              onChange={(e) => set('businessName', e.target.value)}
              autoComplete="organization"
              required
            />
          )}

          <GlassInput
            label="Contact email"
            type="email"
            value={values.contactEmail}
            onChange={(e) => set('contactEmail', e.target.value)}
            autoComplete="email"
          />

          {error && (
            <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
              {error}
            </p>
          )}

          <GlassButton
            type="submit"
            variant="primary"
            fullWidth
            disabled={!isComplete || submitting}
            loading={submitting}
          >
            Save Changes
          </GlassButton>
        </form>
      </GlassCard>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const user = useQuery(api.users.me)
  const router = useRouter()
  const createUser = useMutation(api.users.createUser)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleEditSave(values: ProfileFormValues) {
    if (!user) return
    const businessName = values.businessName.trim() || `${values.firstName} ${values.lastName}`
    const roleConfig = ROLE_BY_CLERK_ROLE[user.role as ClerkRole]

    setSubmitting(true)
    setError('')

    try {
      await createUser({
        role: user.role,
        businessName,
      })
      if (roleConfig) {
        router.push(`/${roleConfig.key}/${user.slug}/dashboard`)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      )
      setSubmitting(false)
    }
  }

  // Loading state
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="Loading…" />
      </div>
    )
  }

  // No Convex user → redirect to sign-up wizard
  if (user === null) {
    router.replace('/sign-up')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="Redirecting…" />
      </div>
    )
  }

  // Edit mode: user exists
  return (
    <EditProfileForm
      user={user}
      onSave={handleEditSave}
      submitting={submitting}
      error={error}
    />
  )
}
