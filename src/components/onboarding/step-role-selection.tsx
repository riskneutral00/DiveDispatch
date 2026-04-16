'use client'

import {
  DISPLAY_OPERATOR_ROLES,
  DISPLAY_RESOURCE_ROLES,
  type RoleConfig,
} from '@/lib/constants/roles'
import { Button } from '@/components/ui/button'
import { CardTitle } from '@/components/ui/card-title'
import { RoleTile } from '@/components/ui/role-tile'

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
        <CardTitle className="mb-1">What&apos;s your role?</CardTitle>
        <p className="text-body text-secondary">
          Select all that apply.
        </p>
      </div>

      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4" data-testid="wizard-content">
        <div className="col-span-2 mb-0.5">
          <p className="text-label font-medium uppercase tracking-wide text-secondary">
            Organizers
          </p>
        </div>
        {DISPLAY_OPERATOR_ROLES.map((role) => (
          <RoleTile
            key={role.key}
            role={role}
            selected={selectedSet.has(role.key)}
            onClick={() => onToggle(role)}
          />
        ))}

        <div className="col-span-2 mt-3 mb-0.5">
          <p className="text-label font-medium uppercase tracking-wide text-secondary">
            Resources
          </p>
        </div>
        {DISPLAY_RESOURCE_ROLES.map((role) => (
          <RoleTile
            key={role.key}
            role={role}
            selected={selectedSet.has(role.key)}
            onClick={() => onToggle(role)}
          />
        ))}
      </div>

      <div className="w-full" data-testid="wizard-nav">
        <Button
          variant="primary"
          fullWidth
          disabled={!canContinue}
          onClick={onContinue}
        >
          Next
        </Button>
      </div>

      <div
        className={`mt-3 h-32 overflow-y-auto overflow-x-hidden flex flex-col gap-1 transition-opacity ${
          selectedRoles.length > 0 ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden={selectedRoles.length === 0}
      >
        {selectedRoles.map((role) => (
          <p key={role.key} className="text-label text-secondary">
            <span className="font-medium text-primary">
              {role.label}:
            </span>{' '}
            {role.description}
          </p>
        ))}
      </div>
    </>
  )
}
