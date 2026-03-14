'use client'

import { useSignUp } from '@clerk/nextjs/legacy'
import { useMutation } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '../../../../../convex/_generated/api'
import {
  ORGANIZER_ROLES,
  RESOURCE_ROLES,
  type RoleConfig,
} from '@/lib/constants/roles'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassInput } from '@/components/glass/glass-input'

const PERSONAL_ROLE_KEYS = new Set(['instructor', 'dive-master'])

function extractClerkError(err: unknown): string | null {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (Array.isArray(e.errors) && e.errors.length > 0) {
      const first = e.errors[0] as Record<string, unknown>
      return (first.longMessage as string) ?? (first.message as string) ?? null
    }
    if (typeof e.message === 'string') return e.message
  }
  return null
}

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const router = useRouter()
  const createUser = useMutation(api.users.createUser)

  const [step, setStep] = useState<'credentials' | 'verify'>('credentials')

  // Credential fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Role selection
  const [selectedRoles, setSelectedRoles] = useState<RoleConfig[]>([])
  const [hoveredRole, setHoveredRole] = useState<RoleConfig | null>(null)
  const [businessName, setBusinessName] = useState('')

  // Verification
  const [verificationCode, setVerificationCode] = useState('')

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [credentialError, setCredentialError] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)

  // Derived state
  const allPersonal =
    selectedRoles.length > 0 && selectedRoles.every((r) => PERSONAL_ROLE_KEYS.has(r.key))
  const showBusinessNameField = selectedRoles.length > 0 && !allPersonal
  const emailPrefix = email.split('@')[0] ?? ''
  const effectiveBusinessName = allPersonal ? emailPrefix : businessName.trim()

  const canSubmit =
    email.trim() !== '' &&
    password !== '' &&
    confirmPassword !== '' &&
    selectedRoles.length > 0 &&
    (allPersonal || businessName.trim() !== '') &&
    !isSubmitting

  // Description area: hovered unselected role takes priority, else show selected roles
  let descriptionText: string | null = null
  let descriptionFull = false
  if (hoveredRole && !selectedRoles.some((r) => r.key === hoveredRole.key)) {
    descriptionText = hoveredRole.description
    descriptionFull = true
  } else if (selectedRoles.length > 0) {
    descriptionText = selectedRoles.map((r) => r.description).join('  ·  ')
    descriptionFull = false
  }

  function toggleRole(role: RoleConfig) {
    setSelectedRoles((prev) =>
      prev.some((r) => r.key === role.key)
        ? prev.filter((r) => r.key !== role.key)
        : [...prev, role],
    )
  }

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isLoaded || !signUp) return

    if (password !== confirmPassword) {
      setCredentialError('Passwords do not match')
      return
    }
    if (selectedRoles.length === 0) {
      setCredentialError('Please select at least one role')
      return
    }
    if (!allPersonal && !businessName.trim()) {
      setCredentialError('Please enter your business or display name')
      return
    }

    setIsSubmitting(true)
    setCredentialError(null)

    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
        unsafeMetadata: {
          role: selectedRoles[0].clerkRole,
          additionalRoles: selectedRoles.slice(1).map((r) => r.clerkRole),
          businessName: effectiveBusinessName,
        },
      })
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setStep('verify')
    } catch (err) {
      setCredentialError(extractClerkError(err) ?? 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!isLoaded || !signUp) return

    setIsSubmitting(true)
    setCodeError(null)

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      })

      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId })
        await createUser({
          role: selectedRoles[0].clerkRole,
          businessName: effectiveBusinessName,
        })
        router.push('/dashboard')
      } else {
        setCodeError('Verification incomplete. Please try again.')
      }
    } catch (err) {
      setCodeError(extractClerkError(err) ?? 'Invalid code. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="w-full max-w-2xl mx-auto p-8 rounded-[var(--border-radius)]"
      style={{
        background: 'var(--color-glass-bg)',
        backdropFilter: 'blur(var(--color-glass-blur))',
        border: '1px solid var(--color-glass-border)',
      }}
    >
      {step === 'credentials' ? (
        <form onSubmit={handleCredentialsSubmit} noValidate>
          <h1
            className="text-2xl font-bold mb-1"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
          >
            Create your account
          </h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Enter your details, choose your role, and you&apos;re in.
          </p>

          {/* Credentials */}
          <div className="flex flex-col gap-4 mb-6">
            <GlassInput
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <GlassInput
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              required
            />
            <GlassInput
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              required
              error={
                confirmPassword && password !== confirmPassword
                  ? 'Passwords do not match'
                  : undefined
              }
            />
          </div>

          {/* Role selection */}
          <fieldset className="mb-4">
            <legend
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Organizers — create &amp; manage bookings
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
              {ORGANIZER_ROLES.map((role) => (
                <RoleTile
                  key={role.key}
                  role={role}
                  selected={selectedRoles.some((r) => r.key === role.key)}
                  onSelect={() => toggleRole(role)}
                  onMouseEnter={() => setHoveredRole(role)}
                  onMouseLeave={() => setHoveredRole(null)}
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
              {RESOURCE_ROLES.map((role) => (
                <RoleTile
                  key={role.key}
                  role={role}
                  selected={selectedRoles.some((r) => r.key === role.key)}
                  onSelect={() => toggleRole(role)}
                  onMouseEnter={() => setHoveredRole(role)}
                  onMouseLeave={() => setHoveredRole(null)}
                />
              ))}
            </div>
          </fieldset>

          {/* Business name */}
          {showBusinessNameField && (
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

          {/* Error */}
          {credentialError && (
            <p className="mb-4 text-sm" style={{ color: 'var(--color-destructive)' }}>
              {credentialError}
            </p>
          )}

          {/* Submit */}
          <GlassButton
            type="submit"
            variant="primary"
            fullWidth
            loading={isSubmitting}
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </GlassButton>

          {/* Cancel */}
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Cancel
            </button>
          </div>

          {/* Role description area */}
          {descriptionText && (
            <p
              className="mt-6 text-sm text-center transition-opacity duration-200"
              style={{
                color: 'var(--color-text-secondary)',
                opacity: descriptionFull ? 1 : 0.6,
              }}
            >
              {descriptionText}
            </p>
          )}
        </form>
      ) : (
        <form onSubmit={handleVerify} noValidate>
          <h1
            className="text-2xl font-bold mb-1"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
          >
            Check your email
          </h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            We sent a 6-digit code to <strong style={{ color: 'var(--color-text-primary)' }}>{email}</strong>. Enter it below to verify your account.
          </p>

          <div className="mb-6">
            <GlassInput
              label="Verification code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              required
              error={codeError ?? undefined}
            />
          </div>

          <GlassButton
            type="submit"
            variant="primary"
            fullWidth
            loading={isSubmitting}
            disabled={verificationCode.length < 6 || isSubmitting}
          >
            {isSubmitting ? 'Verifying…' : 'Verify email'}
          </GlassButton>

          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function RoleTile({
  role,
  selected,
  onSelect,
  onMouseEnter,
  onMouseLeave,
}: {
  role: RoleConfig
  selected: boolean
  onSelect: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const Icon = role.icon
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
