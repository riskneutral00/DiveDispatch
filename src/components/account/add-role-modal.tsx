'use client'

import { Dialog } from '@/components/ui'
import { RoleTile } from '@/components/ui/role-tile'
import { getAvailableRoles } from '@/lib/utils/available-roles'
import type { ClerkRole } from '@/lib/constants/roles'

interface AddRoleModalProps {
  open: boolean
  onClose: () => void
  heldRoles: ClerkRole[]
  onSelectRole: (role: ClerkRole) => void
  loading: boolean
  error: string | null
}

export function AddRoleModal({
  open,
  onClose,
  heldRoles,
  onSelectRole,
  loading,
  error,
}: AddRoleModalProps) {
  const availableRoles = getAvailableRoles(heldRoles)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a Role"
      description="Select a new role to add to your account."
      size="lg"
    >
      {error && (
        <div
          className="px-3 py-2 mb-3 rounded-theme text-sm text-destructive"
          style={{
            background: 'color-mix(in srgb, var(--color-destructive) 15%, transparent)',
          }}
        >
          {error}
        </div>
      )}

      {availableRoles.length === 0 ? (
        <p className="text-secondary text-center text-sm py-6">
          You already hold all roles.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {availableRoles.map((role) => (
            <RoleTile
              key={role.key}
              role={role}
              disabled={loading}
              showDescription
              onClick={() => onSelectRole(role.clerkRole)}
            />
          ))}
        </div>
      )}
    </Dialog>
  )
}
