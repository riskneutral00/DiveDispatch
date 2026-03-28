'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { deriveDefaultRole } from '../../../convex/lib/rolePrecedence'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassInput } from '@/components/glass/glass-input'
import { toast } from 'sonner'
import { parseConvexError } from '@/lib/utils/convex-error'
import { Spinner } from '@/components/common/spinner'

const PERSONAL_ROLE_KEYS = new Set(['instructor', 'dive-master'])

interface AccountFormValues {
  businessName: string
}

export function AccountForm() {
  const user = useQuery(api.users.me)
  const userRoles = useQuery(api.userRoles.myRoles)
  const createUser = useMutation(api.users.createUser)

  const [values, setValues] = useState<AccountFormValues>({
    businessName: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const baselineRef = useRef<AccountFormValues | null>(null)

  useEffect(() => {
    if (user) {
      const loaded: AccountFormValues = {
        businessName: user.businessName ?? '',
      }
      setValues(loaded)
      baselineRef.current = loaded
    }
  }, [user])

  const isDirty = baselineRef.current !== null && JSON.stringify(values) !== JSON.stringify(baselineRef.current)

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner label="Loading…" />
      </div>
    )
  }

  if (!user) return null

  const defaultRole = userRoles && userRoles.length > 0
    ? deriveDefaultRole(userRoles.map((r) => r.role))
    : null
  const roleConfig = defaultRole ? ROLE_BY_CLERK_ROLE[defaultRole as ClerkRole] : undefined
  const hasPersonalOnlyRole = roleConfig && PERSONAL_ROLE_KEYS.has(roleConfig.key)
  const showBusinessName = !hasPersonalOnlyRole

  function set<K extends keyof AccountFormValues>(field: K, value: AccountFormValues[K]) {
    setValues((v) => ({ ...v, [field]: value }))
    setSaved(false)
  }

  const isComplete = !showBusinessName || values.businessName.trim() !== ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isComplete) return
    setError('')
    setSaved(false)
    setSubmitting(true)
    try {
      await createUser({
        role: (defaultRole ?? 'DiveCenter') as ClerkRole,
        businessName: values.businessName.trim(),
      })
      baselineRef.current = { ...values }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      toast.success('Account saved', { duration: 3000 })
    } catch (err) {
      const message = parseConvexError(err, 'Something went wrong. Please try again.')
      setError(message)
      toast.error('Save failed', { description: message, duration: 5000 })
    } finally {
      setSubmitting(false)
    }
  }

  if (!showBusinessName) {
    return null
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <GlassCard>
        <div className="flex flex-col gap-4">
          <div className="max-w-sm">
            <GlassInput
              label="Business name"
              value={values.businessName}
              onChange={(e) => set('businessName', e.target.value)}
              autoComplete="organization"
              required
            />
          </div>
        </div>
      </GlassCard>

      {error && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <GlassButton
          type="submit"
          variant="primary"
          disabled={!isComplete || !isDirty || submitting}
          loading={submitting}
        >
          {saved ? 'Saved' : 'Save'}
        </GlassButton>
      </div>
    </form>
  )
}
