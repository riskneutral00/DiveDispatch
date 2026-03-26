'use client'

import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { GlassCard, GlassButton, GlassBadge } from '@/components/glass'
import { RoleIcon } from '@/components/glass/role-icon'
import { deriveDefaultRole } from '../../../convex/lib/rolePrecedence'

interface RoleEntry {
  _id: string
  role: ClerkRole
  profileComplete: boolean
  createdAt: number
}

interface ManageRolesProps {
  roles: RoleEntry[]
  onAddRole: () => void
  onNavigateToOnboarding: (role: ClerkRole) => void
}

export function ManageRoles({ roles, onAddRole, onNavigateToOnboarding }: ManageRolesProps) {
  const primaryRoleStr = roles.length > 0
    ? deriveDefaultRole(roles.map((r) => r.role))
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            margin: 0,
          }}
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

          return (
            <GlassCard key={entry._id} padding="md">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <RoleIcon role={entry.role} size={20} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {config.label}
                    </span>
                    {entry.role === primaryRoleStr && (
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
              </div>
            </GlassCard>
          )
        })}
      </div>
    </div>
  )
}
