'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { GlassCard, GlassButton, GlassBadge } from '@/components/ui'
import { RoleIcon } from '@/components/ui/role-icon'
import { deriveDefaultRole } from '@/lib/utils/role'
import type { Id } from '../../../convex/_generated/dataModel'

interface RoleEntry {
  _id: Id<'userRoles'>
  role: ClerkRole
  profileComplete: boolean
  createdAt: number
}

interface ManageRolesProps {
  roles: RoleEntry[]
  onAddRole: () => void
  onNavigateToOnboarding: (role: ClerkRole) => void
  onDeleteRole: (roleId: Id<'userRoles'>) => Promise<void>
  bookingCounts: Record<string, number>
}

export function ManageRoles({
  roles,
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

  async function handleDeleteConfirm(roleId: Id<'userRoles'>) {
    setDeletingId(roleId)
    try {
      await onDeleteRole(roleId)
      setConfirmingId(null)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2
          className="text-primary"
          style={{ fontSize: 18, fontWeight: 600, margin: 0 }}
        >
          Manage Roles
        </h2>
        <GlassButton variant="primary" onClick={onAddRole}>
          Add Role
        </GlassButton>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {roles.map((entry) => {
          const config = ROLE_BY_CLERK_ROLE[entry.role]
          if (!config) return null

          const blockingCount = bookingCounts[entry._id] ?? 0
          const isBlocked = blockingCount > 0
          const isConfirming = confirmingId === entry._id
          const isDeleting = deletingId === entry._id
          const isPrimary = entry.role === primaryRoleStr && roles.length > 1

          return (
            <GlassCard key={entry._id} padding="md">
              {/* Main row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <RoleIcon role={entry.role} size={20} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      className="text-primary"
                      style={{ fontSize: 14, fontWeight: 500 }}
                    >
                      {config.label}
                    </span>
                    {isPrimary && (
                      <GlassBadge variant="info" size="sm">
                        Primary
                      </GlassBadge>
                    )}
                  </div>
                </div>
                <GlassBadge
                  variant={entry.profileComplete ? 'success' : 'warning'}
                  size="sm"
                >
                  {entry.profileComplete ? 'Complete' : 'Incomplete'}
                </GlassBadge>
                {!entry.profileComplete && (
                  <GlassButton
                    variant="secondary"
                    onClick={() => onNavigateToOnboarding(entry.role)}
                  >
                    Set up
                  </GlassButton>
                )}
                {canDelete && (
                  <button
                    type="button"
                    aria-label={`Delete ${config.label} role`}
                    disabled={isBlocked}
                    onClick={() => setConfirmingId(isConfirming ? null : entry._id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: isBlocked ? 'not-allowed' : 'pointer',
                      opacity: isBlocked ? 0.3 : 1,
                      padding: 4,
                      color: 'var(--color-destructive)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Booking-blocked hint */}
              {canDelete && isBlocked && (
                <div
                  className="text-secondary"
                  style={{ fontSize: 12, marginTop: 6, paddingLeft: 32 }}
                >
                  {`Cannot delete — ${blockingCount} active ${blockingCount === 1 ? 'booking' : 'bookings'} use this role's resources.`}
                </div>
              )}

              {/* Inline confirmation */}
              {isConfirming && !isBlocked && (
                <div
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: '1px solid var(--color-glass-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <span
                    className="text-secondary"
                    style={{ fontSize: 13 }}
                  >
                    {`Delete ${config.label} and all its data? This cannot be undone.`}
                  </span>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <GlassButton
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmingId(null)}
                    >
                      Cancel
                    </GlassButton>
                    <GlassButton
                      variant="destructive"
                      size="sm"
                      loading={isDeleting}
                      onClick={() => handleDeleteConfirm(entry._id)}
                    >
                      Delete permanently
                    </GlassButton>
                  </div>
                </div>
              )}
            </GlassCard>
          )
        })}
      </div>
    </div>
  )
}
