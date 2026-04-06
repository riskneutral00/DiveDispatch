import type { RoleConfig } from '@/lib/constants/roles'

export interface RoleTileProps {
  role: RoleConfig
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

  // Selection styling (only when selected prop is explicitly provided)
  const hasSelection = selected !== undefined
  const borderColor = hasSelection && selected
    ? 'var(--color-primary)'
    : 'var(--color-glass-border)'
  const background = hasSelection && selected
    ? 'var(--color-primary-glow)'
    : 'var(--color-glass-bg)'
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
      className="glass-container w-full rounded-theme p-4 text-left transition-all focus-visible:outline-2 disabled:opacity-50 disabled:cursor-not-allowed text-primary"
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
            <span className="font-medium text-sm leading-tight">{role.label}</span>
            <span className="text-xs leading-snug text-secondary">
              {role.description}
            </span>
          </div>
        ) : (
          <span className="font-medium text-sm leading-tight">{role.label}</span>
        )}
      </div>
    </button>
  )
}
