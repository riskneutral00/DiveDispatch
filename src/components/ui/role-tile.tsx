import type { ComponentType } from 'react'
import type { RoleIconProps } from '@/lib/icons/role-icons'

export interface RoleTileDisplay {
  label: string
  description: string
  icon: ComponentType<RoleIconProps>
}

export interface RoleTileProps {
  role: RoleTileDisplay
  selected?: boolean
  disabled?: boolean
  showDescription?: boolean
  onClick: () => void
}

export function RoleTile({
  role,
  selected,
  disabled,
  showDescription,
  onClick,
}: RoleTileProps) {
  const Icon = role.icon

  const hasSelection = selected !== undefined
  const borderColor = hasSelection && selected
    ? 'var(--color-primary)'
    : 'var(--color-glass-border)'
  const background = hasSelection && selected
    ? 'var(--color-primary-glow)'
    : hasSelection ? 'var(--color-glass-bg)' : undefined
  const outlineColor = hasSelection
    ? 'var(--color-accent)'
    : 'var(--color-primary-glow)'
  const iconColor = hasSelection && selected
    ? 'var(--color-primary)'
    : 'var(--color-text-secondary)'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={role.label}
      {...(hasSelection ? { 'aria-pressed': selected } : {})}
      className={`glass-container w-full rounded-theme p-4 text-left transition-all duration-theme focus-visible:outline-2 disabled:opacity-50 disabled:cursor-not-allowed text-primary${hasSelection ? '' : ' reading-plane'}`}
      style={{
        borderColor,
        background,
        outlineColor,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <div className="flex items-center gap-3">
        <Icon
          className={!hasSelection ? 'text-secondary' : undefined}
          size={20}
          style={{
            ...(hasSelection ? { color: iconColor } : {}),
            flexShrink: 0,
          }}
        />
        {showDescription ? (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-body leading-tight">{role.label}</span>
            <span className="text-label leading-snug text-secondary">
              {role.description}
            </span>
          </div>
        ) : (
          <span className="font-medium text-body leading-tight">{role.label}</span>
        )}
      </div>
    </button>
  )
}
