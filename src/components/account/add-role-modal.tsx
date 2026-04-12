'use client'

import { useTranslations } from 'next-intl'
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
  const tNav = useTranslations('nav')
  const tErrors = useTranslations('errors')
  const availableRoles = getAvailableRoles(heldRoles)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={tNav('addRoleTitle')}
      description={tNav('addRoleDescription')}
      fullScreen
    >
      {error && (
        <div
          className="px-3 py-2 mb-3 rounded-theme text-body text-destructive"
          style={{
            background: 'var(--color-destructive-muted)',
          }}
        >
          {error}
        </div>
      )}

      {availableRoles.length === 0 ? (
        <p className="text-secondary text-center text-body py-6">
          {tErrors('duplicateRole')}
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
