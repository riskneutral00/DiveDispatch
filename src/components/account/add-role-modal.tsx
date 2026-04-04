'use client'

import { Dialog } from '@/components/ui'
import { getAvailableRoles } from '@/lib/utils/available-roles'
import type { ClerkRole, RoleConfig } from '@/lib/constants/roles'

interface AddRoleModalProps {
  open: boolean
  onClose: () => void
  heldRoles: ClerkRole[]
  onSelectRole: (role: ClerkRole) => void
  loading: boolean
  error: string | null
}

function RoleTileButton({
  role,
  disabled,
  onClick,
}: {
  role: RoleConfig
  disabled: boolean
  onClick: () => void
}) {
  const Icon = role.icon
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={role.label}
      className="glass-container relative w-full rounded-[var(--border-radius)] p-4 text-left transition-all focus-visible:outline-2 disabled:opacity-50 disabled:cursor-not-allowed text-primary"
      style={{ borderColor: 'var(--color-glass-border)',
        background: 'var(--color-glass-bg)',
        outlineColor: 'var(--color-primary-glow)',
        cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <div className="flex items-center gap-3">
        <Icon className="text-secondary"
          size={20}
          style={{ flexShrink: 0 }}
        />
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-sm leading-tight">{role.label}</span>
          <span
            className="text-xs leading-snug text-secondary"
          >
            {role.description}
          </span>
        </div>
      </div>
    </button>
  )
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
          style={{
            padding: '8px 12px',
            marginBottom: 12,
            borderRadius: 'var(--border-radius, 8px)',
            background: 'color-mix(in srgb, var(--color-destructive) 15%, transparent)',
            color: 'var(--color-destructive)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {availableRoles.length === 0 ? (
        <p className="text-secondary"
          style={{ textAlign: 'center',
            fontSize: 14,
            padding: '24px 0' }}
        >
          You already hold all roles.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {availableRoles.map((role) => (
            <RoleTileButton
              key={role.key}
              role={role}
              disabled={loading}
              onClick={() => onSelectRole(role.clerkRole)}
            />
          ))}
        </div>
      )}
    </Dialog>
  )
}
