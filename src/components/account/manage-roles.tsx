'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { Card, Button, Badge } from '@/components/ui'
import { RoleIcon } from '@/components/ui/role-icon'
import { deriveDefaultRole } from '@/lib/utils/role'
import type { Id } from '../../../convex/_generated/dataModel'

interface RoleEntry {
  _id: Id<'userRoles'>
  role: ClerkRole
  profileComplete: boolean
  createdAt: number
}

interface RoleCompletionEntry {
  role: ClerkRole
  percentage: number
}

interface ManageRolesProps {
  roles: RoleEntry[]
  roleCompletions: RoleCompletionEntry[]
  onAddRole: () => void
  onNavigateToOnboarding: (role: ClerkRole) => void
  onDeleteRole: (roleId: Id<'userRoles'>) => Promise<void>
  bookingCounts: Record<string, number>
}

export function ManageRoles({
  roles,
  roleCompletions,
  onAddRole,
  onNavigateToOnboarding,
  onDeleteRole,
  bookingCounts,
}: ManageRolesProps) {
  const primaryRoleStr = roles.length > 0
    ? deriveDefaultRole(roles.map((r) => r.role))
    : null

  const [confirmingId, setConfirmingId] = useState<Id<'userRoles'> | null>(null)
  const [deletingId, setDeletingId] = useState<Id<'userRoles'> | null>(null)

  const canDelete = roles.length > 1
  const completionByRole = new Map(roleCompletions.map((entry) => [entry.role, entry.percentage]))

  async function handleDeleteConfirm(roleId: Id<'userRoles'>) {
    setDeletingId(roleId)
    try {
      await onDeleteRole(roleId)
      setConfirmingId(null)
    } catch {
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-card-title font-heading font-semibold text-primary">
          Manage Roles
        </h2>
        <Button variant="primary" onClick={onAddRole}>
          Add Role
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {roles.map((entry) => {
          const config = ROLE_BY_CLERK_ROLE[entry.role]
          if (!config) return null

          const blockingCount = bookingCounts[entry._id] ?? 0
          const isBlocked = blockingCount > 0
          const isConfirming = confirmingId === entry._id
          const isDeleting = deletingId === entry._id
          const isPrimary = entry.role === primaryRoleStr && roles.length > 1
          const percentage = completionByRole.get(entry.role) ?? 0

          return (
            <Card key={entry._id} padding="md">
              <div className="flex items-center gap-3">
                <RoleIcon role={entry.role} size={20} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-body font-medium text-primary">
                      {config.label}
                    </span>
                    {isPrimary && (
                      <Badge variant="info" size="sm">
                        Primary
                      </Badge>
                    )}
                  </div>
                </div>
                <Badge
                  variant={percentage === 100 ? 'success' : 'warning'}
                  size="sm"
                >
                  {percentage}%
                </Badge>
                {!entry.profileComplete && (
                  <Button
                    variant="secondary"
                    onClick={() => onNavigateToOnboarding(entry.role)}
                  >
                    Set up
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="destructive-ghost"
                    size="icon"
                    aria-label={`Delete ${config.label} role`}
                    disabled={isBlocked}
                    onClick={() => setConfirmingId(isConfirming ? null : entry._id)}
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>

              {canDelete && (
                <div
                  className="text-label text-secondary pl-8 overflow-hidden transition-opacity duration-theme"
                  aria-hidden={!isBlocked}
                  data-blocked={isBlocked}
                  style={{
                    height: isBlocked ? 'auto' : 0,
                    marginTop: isBlocked ? 6 : 0,
                    opacity: isBlocked ? 1 : 0,
                    transitionDuration: 'var(--transition-speed)',
                  }}
                >
                  {`Cannot delete — ${blockingCount} active ${blockingCount === 1 ? 'booking' : 'bookings'} use this role's resources.`}
                </div>
              )}

              {canDelete && (
                <div
                  aria-hidden={!(isConfirming && !isBlocked)}
                  data-confirming={isConfirming && !isBlocked}
                  className="flex items-center justify-between gap-3 overflow-hidden"
                  style={{
                    visibility: isConfirming && !isBlocked ? 'visible' : 'hidden',
                    height: isConfirming && !isBlocked ? 'auto' : 0,
                    marginTop: isConfirming && !isBlocked ? 10 : 0,
                    paddingTop: isConfirming && !isBlocked ? 10 : 0,
                    borderTop: isConfirming && !isBlocked ? '1px solid var(--color-glass-border)' : 'none',
                  }}
                >
                  <span className="text-label text-secondary">
                    {`Delete ${config.label} and all its data? This cannot be undone.`}
                  </span>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmingId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      loading={isDeleting}
                      onClick={() => handleDeleteConfirm(entry._id)}
                    >
                      Delete permanently
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
