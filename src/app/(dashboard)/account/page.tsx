'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../convex/_generated/api'
import {
  ORGANIZER_ROLES,
  RESOURCE_ROLES,
  ROLE_BY_CLERK_ROLE,
  type ClerkRole,
  type RoleConfig,
} from '@/lib/constants/roles'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassInput } from '@/components/glass/glass-input'

// Roles where a personal name is used instead of a business name
const PERSONAL_ROLE_KEYS = new Set(['instructor', 'dive-master'])

type WizardStep = 'role' | 'profile'

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
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

// ── Role tile ─────────────────────────────────────────────────────────────────

function RoleTile({
  role,
  selected,
  onToggle,
}: {
  role: RoleConfig
  selected: boolean
  onToggle: (role: RoleConfig) => void
}) {
  const Icon = role.icon
  return (
    <button
      type="button"
      onClick={() => onToggle(role)}
      className="glass relative w-full rounded-[var(--border-radius)] p-4 text-left transition-all focus-visible:outline-2"
      style={{
        borderColor: selected ? 'var(--color-primary)' : 'var(--color-glass-border)',
        background: selected ? 'var(--color-primary-glow)' : 'var(--color-glass-bg)',
        color: 'var(--color-text-primary)',
        outlineColor: 'var(--color-accent)',
      }}
      aria-pressed={selected}
    >
      <div className="flex items-center gap-3">
        <Icon
          size={20}
          style={{ color: selected ? 'var(--color-primary)' : 'var(--color-text-secondary)', flexShrink: 0 }}
        />
        <span className="font-medium text-sm leading-tight">{role.label}</span>
      </div>
    </button>
  )
}

// ── Step 1: Role selection ─────────────────────────────────────────────────────

function StepRoleSelection({
  selectedRoles,
  onToggle,
  onContinue,
}: {
  selectedRoles: RoleConfig[]
  onToggle: (role: RoleConfig) => void
  onContinue: () => void
}) {
  const selectedSet = new Set(selectedRoles.map((r) => r.key))
  const canContinue = selectedRoles.length > 0

  // Compute min-height: fits 4 role chips; expands for more
  const chipsAbove4 = Math.max(0, selectedRoles.length - 4)

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8 text-center">
        <h1
          className="text-2xl font-semibold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          What&apos;s your role?
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Select all that apply — you can manage multiple roles from one account.
        </p>
      </div>

      <div style={{ minHeight: `${140 + chipsAbove4 * 40}px` }}>
      <GlassCard
        elevated
        className="transition-all"
      >
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Organizers */}
          <div className="col-span-2 mb-1">
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
              Organizers
            </p>
          </div>
          {ORGANIZER_ROLES.map((role) => (
            <RoleTile
              key={role.key}
              role={role}
              selected={selectedSet.has(role.key)}
              onToggle={onToggle}
            />
          ))}

          {/* Resources */}
          <div className="col-span-2 mt-4 mb-1">
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
              Resources
            </p>
          </div>
          {RESOURCE_ROLES.map((role) => (
            <RoleTile
              key={role.key}
              role={role}
              selected={selectedSet.has(role.key)}
              onToggle={onToggle}
            />
          ))}
        </div>

        <GlassButton
          variant="primary"
          fullWidth
          disabled={!canContinue}
          onClick={onContinue}
        >
          Continue
        </GlassButton>

        {/* Role descriptions below button */}
        {selectedRoles.length > 0 && (
          <div className="mt-4 flex flex-col gap-1.5">
            {selectedRoles.map((role) => (
              <p key={role.key} className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {role.label}:
                </span>{' '}
                {role.description}
              </p>
            ))}
          </div>
        )}
      </GlassCard>
      </div>
    </div>
  )
}

// ── Step 2: Profile form ───────────────────────────────────────────────────────

interface ProfileFormValues {
  firstName: string
  lastName: string
  businessName: string
  city: string
  country: string
  contactEmail: string
  contactPhone: string
}

function StepProfileSetup({
  selectedRoles,
  initialValues,
  onBack,
  onSubmit,
  submitting,
  error,
}: {
  selectedRoles: RoleConfig[]
  initialValues: ProfileFormValues
  onBack: () => void
  onSubmit: (values: ProfileFormValues) => void
  submitting: boolean
  error: string
}) {
  const [values, setValues] = useState<ProfileFormValues>(initialValues)

  const hasOrganizerRole = selectedRoles.some((r) => r.isOrganizer)
  const hasPersonalOnlyRoles =
    !hasOrganizerRole && selectedRoles.every((r) => PERSONAL_ROLE_KEYS.has(r.key))
  const showBusinessName = !hasPersonalOnlyRoles

  function set(field: keyof ProfileFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
  }

  const isComplete =
    values.firstName.trim() &&
    values.lastName.trim() &&
    values.city.trim() &&
    values.country.trim() &&
    values.contactEmail.trim() &&
    values.contactPhone.trim() &&
    (!showBusinessName || values.businessName.trim())

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8 text-center">
        <h1
          className="text-2xl font-semibold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Set up your profile
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {selectedRoles.map((r) => r.label).join(' · ')}
        </p>
      </div>

      <GlassCard elevated>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (isComplete) onSubmit(values)
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

          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="City"
              value={values.city}
              onChange={(e) => set('city', e.target.value)}
              autoComplete="address-level2"
              required
            />
            <GlassInput
              label="Country"
              value={values.country}
              onChange={(e) => set('country', e.target.value)}
              autoComplete="country-name"
              required
            />
          </div>

          <GlassInput
            label="Contact email"
            type="email"
            value={values.contactEmail}
            onChange={(e) => set('contactEmail', e.target.value)}
            autoComplete="email"
            required
          />

          <GlassInput
            label="Contact phone"
            type="tel"
            value={values.contactPhone}
            onChange={(e) => set('contactPhone', e.target.value)}
            autoComplete="tel"
            required
          />

          {error && (
            <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
              {error}
            </p>
          )}

          <div className="flex gap-3 mt-2">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={onBack}
              disabled={submitting}
            >
              Back
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              fullWidth
              disabled={!isComplete || submitting}
              loading={submitting}
            >
              Complete Setup
            </GlassButton>
          </div>
        </form>
      </GlassCard>
    </div>
  )
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
    city: '',
    country: '',
    contactEmail: user.email,
    contactPhone: '',
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

  const [step, setStep] = useState<WizardStep>('role')
  const [selectedRoles, setSelectedRoles] = useState<RoleConfig[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [redirectPending, setRedirectPending] = useState(false)
  const [error, setError] = useState('')

  // After setup submit: redirect once the user record appears reactively
  useEffect(() => {
    if (!redirectPending || !user) return
    const roleConfig = ROLE_BY_CLERK_ROLE[user.role as ClerkRole]
    if (roleConfig) {
      router.replace(`/${roleConfig.key}/${user.slug}/dashboard`)
    }
  }, [redirectPending, user, router])

  function toggleRole(role: RoleConfig) {
    setSelectedRoles((prev) =>
      prev.some((r) => r.key === role.key)
        ? prev.filter((r) => r.key !== role.key)
        : [...prev, role],
    )
  }

  async function handleSetupSubmit(values: ProfileFormValues) {
    if (!selectedRoles.length) return
    const primaryRole = selectedRoles[0]
    const businessName = values.businessName.trim() || `${values.firstName} ${values.lastName}`

    setSubmitting(true)
    setError('')

    try {
      await createUser({
        role: primaryRole.clerkRole,
        businessName,
      })
      setRedirectPending(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      )
      setSubmitting(false)
    }
  }

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

  // Loading state: query still resolving
  if (user === undefined) {
    return <Spinner />
  }

  // Edit mode: user exists
  if (user !== null) {
    return (
      <EditProfileForm
        user={user}
        onSave={handleEditSave}
        submitting={submitting}
        error={error}
      />
    )
  }

  // Setup mode: no Convex user yet
  const emptyProfile: ProfileFormValues = {
    firstName: '',
    lastName: '',
    businessName: '',
    city: '',
    country: '',
    contactEmail: '',
    contactPhone: '',
  }

  return step === 'role' ? (
    <StepRoleSelection
      selectedRoles={selectedRoles}
      onToggle={toggleRole}
      onContinue={() => setStep('profile')}
    />
  ) : (
    <StepProfileSetup
      selectedRoles={selectedRoles}
      initialValues={emptyProfile}
      onBack={() => setStep('role')}
      onSubmit={handleSetupSubmit}
      submitting={submitting || redirectPending}
      error={error}
    />
  )
}
