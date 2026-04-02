'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { getConvexErrorCode, parseConvexError } from '@/lib/utils/convex-error'
import { api } from '@/lib/convex-generated'
import { ManageRoles } from './manage-roles'
import { AddRoleModal } from './add-role-modal'
import { RoleOnboarding } from './role-onboarding'
import { Spinner } from '@/components/ui/spinner'
import type { ClerkRole } from '@/lib/constants/roles'
import { ErrorCode } from '@/lib/errors'

/**
 * Connected wrapper that wires ManageRoles + AddRoleModal + RoleOnboarding
 * to Convex queries and mutations.
 */
export function ManageRolesConnected() {
  const roles = useQuery(api.userRoles.myRoles)
  const addRole = useMutation(api.userRoles.addRole)

  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onboardingRole, setOnboardingRole] = useState<ClerkRole | null>(null)

  const heldRoles = (roles ?? []).map((r) => r.role as ClerkRole)

  const handleSelectRole = useCallback(
    async (role: ClerkRole) => {
      setError(null)
      setLoading(true)
      try {
        await addRole({ role })
        setModalOpen(false)
        setOnboardingRole(role)
      } catch (e: unknown) {
        const code = getConvexErrorCode(e)
        if (code === ErrorCode.DUPLICATE_ROLE) {
          setError('You already hold this role.')
        } else {
          setError(parseConvexError(e, 'Failed to add role.'))
        }
      } finally {
        setLoading(false)
      }
    },
    [addRole],
  )

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingRole(null)
  }, [])

  if (roles === undefined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
        <Spinner />
      </div>
    )
  }

  // If a role was just added, show its mini-onboarding
  if (onboardingRole) {
    return (
      <RoleOnboarding
        role={onboardingRole}
        onComplete={handleOnboardingComplete}
      />
    )
  }

  return (
    <>
      <ManageRoles
        roles={roles}
        onAddRole={() => {
          setError(null)
          setModalOpen(true)
        }}
        onNavigateToOnboarding={(role) => setOnboardingRole(role)}
      />
      <AddRoleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        heldRoles={heldRoles}
        onSelectRole={handleSelectRole}
        loading={loading}
        error={error}
      />
    </>
  )
}
