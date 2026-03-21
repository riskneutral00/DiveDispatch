'use client'

import {
  DISPLAY_OPERATOR_ROLES,
  DISPLAY_RESOURCE_ROLES,
  type RoleConfig,
} from '@/lib/constants/roles'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassButton } from '@/components/glass/glass-button'

// ── Role tile ─────────────────────────────────────────────────────────────────

function RoleTile({
  role,
  selected,
  onToggle,
}: {
  role: RoleConfig
  selected: boolean
  onToggle: (role: RoleConfig) => void
}) {
  const Icon = role.icon
  return (
    <button
      type="button"
      onClick={() => onToggle(role)}
      className="glass relative w-full rounded-[var(--border-radius)] p-4 text-left transition-all focus-visible:outline-2"
      style={{
        borderColor: selected ? 'var(--color-primary)' : 'var(--color-glass-border)',
        background: selected ? 'var(--color-primary-glow)' : 'var(--color-glass-bg)',
        color: 'var(--color-text-primary)',
        outlineColor: 'var(--color-accent)',
      }}
      aria-pressed={selected}
    >
      <div className="flex items-center gap-3">
        <Icon
          size={20}
          style={{ color: selected ? 'var(--color-primary)' : 'var(--color-text-secondary)', flexShrink: 0 }}
        />
        <span className="font-medium text-sm leading-tight">{role.label}</span>
      </div>
    </button>
  )
}

// ── Step: Role selection ──────────────────────────────────────────────────────

interface StepRoleSelectionProps {
  selectedRoles: RoleConfig[]
  onToggle: (role: RoleConfig) => void
  onContinue: () => void
}

export function StepRoleSelection({
  selectedRoles,
  onToggle,
  onContinue,
}: StepRoleSelectionProps) {
  const selectedSet = new Set(selectedRoles.map((r) => r.key))
  const canContinue = selectedRoles.length > 0

  return (
    <>
      <div className="mb-6 text-center">
        <h2
          className="text-xl font-semibold mb-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          What&apos;s your role?
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Select all that apply.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {/* Organizers */}
        <div className="col-span-2 mb-0.5">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
            Organizers
          </p>
        </div>
        {DISPLAY_OPERATOR_ROLES.map((role) => (
          <RoleTile
            key={role.key}
            role={role}
            selected={selectedSet.has(role.key)}
            onToggle={onToggle}
          />
        ))}

        {/* Resources */}
        <div className="col-span-2 mt-3 mb-0.5">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
            Resources
          </p>
        </div>
        {DISPLAY_RESOURCE_ROLES.map((role) => (
          <RoleTile
            key={role.key}
            role={role}
            selected={selectedSet.has(role.key)}
            onToggle={onToggle}
          />
        ))}
      </div>

      <GlassButton
        variant="primary"
        fullWidth
        disabled={!canContinue}
        onClick={onContinue}
      >
        Continue
      </GlassButton>

      {/* Role descriptions below button */}
      {selectedRoles.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {selectedRoles.map((role) => (
            <p key={role.key} className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {role.label}:
              </span>{' '}
              {role.description}
            </p>
          ))}
        </div>
      )}
    </>
  )
}
