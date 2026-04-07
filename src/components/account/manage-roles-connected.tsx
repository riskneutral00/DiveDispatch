'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { getConvexErrorCode, parseConvexErrorI18n } from '@/lib/utils/convex-error'
import { api } from '@/lib/convex-generated'
import type { Id } from '../../../convex/_generated/dataModel'
import { ManageRoles } from './manage-roles'
import { AddRoleModal } from './add-role-modal'
import { RoleOnboarding } from './role-onboarding'
import { Spinner } from '@/components/ui/spinner'
import type { ClerkRole } from '@/lib/constants/roles'
import { ROLE_BY_CLERK_ROLE } from '@/lib/constants/roles'
import { ErrorCode } from '@/lib/errors'

export function ManageRolesConnected() {
  const tErr = useTranslations('errors')
  const tCommon = useTranslations('common')
  const tBooking = useTranslations('booking')
  const roles = useQuery(api.userRoles.myRoles)
  const bookingCounts = useQuery(api.userRoles.bookingCountsForMyRoles)
  const roleCompleteness = useQuery(api.users.getAllRolesCompleteness)
  const addRole = useMutation(api.userRoles.addRole)
  const deleteRole = useMutation(api.userRoles.deleteRole)

  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onboardingRole, setOnboardingRole] = useState<ClerkRole | null>(null)

  const heldRoles = (roles ?? []).map((r) => r.role as ClerkRole)
  const roleCompletions = (roleCompleteness?.roles ?? []).map((entry) => ({
    role: entry.role as ClerkRole,
    percentage: entry.percentage,
  }))

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
          setError(tErr('duplicateRole'))
        } else {
          setError(tCommon('actionFailed', { action: 'Add role' }))
        }
      } finally {
        setLoading(false)
      }
    },
    [addRole],
  )

  const handleDeleteRole = useCallback(
    async (roleId: Id<'userRoles'>) => {
      const roleEntry = (roles ?? []).find((r) => r._id === roleId)
      const roleLabel = roleEntry
        ? (ROLE_BY_CLERK_ROLE[roleEntry.role as ClerkRole]?.label ?? roleEntry.role)
        : 'Role'

      try {
        const result = await deleteRole({ roleId })
        if (result && 'blocked' in result && result.blocked) {
          return
        }
        toast.success(tBooking('roleDeleted', { role: roleLabel }))
      } catch (e: unknown) {
        const code = getConvexErrorCode(e)
        if (code === ErrorCode.LAST_ROLE) {
          toast.error(tErr('lastRole'))
        } else {
          toast.error(tCommon('actionFailed', { action: 'Delete role' }))
        }
      }
    },
    [deleteRole, roles],
  )

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingRole(null)
  }, [])

  if (roles === undefined || bookingCounts === undefined || roleCompleteness === undefined) {
    return (
      <div className="flex justify-center p-6">
        <Spinner />
      </div>
    )
  }

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
        roleCompletions={roleCompletions}
        onAddRole={() => {
          setError(null)
          setModalOpen(true)
        }}
        onNavigateToOnboarding={(role) => setOnboardingRole(role)}
        onDeleteRole={handleDeleteRole}
        bookingCounts={bookingCounts}
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
