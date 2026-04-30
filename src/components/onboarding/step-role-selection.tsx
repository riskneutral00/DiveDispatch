'use client'

import {
  getSignupOperatorTiles,
  getSignupResourceTiles,
  type SignupRoleTileConfig,
} from '@/lib/constants/signup-role-tiles'
import { Button } from '@/components/ui/button'
import { CardTitle } from '@/components/ui/card-title'
import { RoleTile } from '@/components/ui/role-tile'

interface StepRoleSelectionProps {
  selectedTiles: SignupRoleTileConfig[]
  onToggle: (tile: SignupRoleTileConfig) => void
  onContinue: () => void
}

const OPERATOR_TILES = getSignupOperatorTiles()
const RESOURCE_TILES = getSignupResourceTiles()

interface SummaryEntry {
  key: string
  label: string
  description: string
}

function buildSummary(tiles: SignupRoleTileConfig[]): SummaryEntry[] {
  const venueTiles = tiles.filter((t) => t.clerkRole === 'Venue')
  const nonVenue = tiles.filter((t) => t.clerkRole !== 'Venue')
  const entries: SummaryEntry[] = nonVenue.map((t) => ({
    key: t.tileKey,
    label: t.label,
    description: t.description,
  }))
  if (venueTiles.length === 1) {
    entries.push({
      key: venueTiles[0].tileKey,
      label: venueTiles[0].label,
      description: venueTiles[0].description,
    })
  } else if (venueTiles.length > 1) {
    entries.push({
      key: 'venue-umbrella',
      label: 'Venue',
      description:
        'Provide a place where diving happens — pool, shore, reef, lake, river, quarry, or other.',
    })
  }
  return entries
}

export function StepRoleSelection({
  selectedTiles,
  onToggle,
  onContinue,
}: StepRoleSelectionProps) {
  const selectedSet = new Set(selectedTiles.map((t) => t.tileKey))
  const canContinue = selectedTiles.length > 0
  const summary = buildSummary(selectedTiles)

  const renderTile = (tile: SignupRoleTileConfig) => (
    <div key={tile.tileKey}>
      <RoleTile
        role={tile}
        selected={selectedSet.has(tile.tileKey)}
        onClick={() => onToggle(tile)}
      />
    </div>
  )

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
        {OPERATOR_TILES.map(renderTile)}

        <div className="col-span-2 mt-3 mb-0.5">
          <p className="text-label font-medium uppercase tracking-wide text-secondary">
            Resources
          </p>
        </div>
        {RESOURCE_TILES.map(renderTile)}
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
          summary.length > 0 ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden={summary.length === 0}
      >
        {summary.map((entry) => (
          <p key={entry.key} className="text-label text-secondary">
            <span className="font-medium text-primary">
              {entry.label}:
            </span>{' '}
            {entry.description}
          </p>
        ))}
      </div>
    </>
  )
}
