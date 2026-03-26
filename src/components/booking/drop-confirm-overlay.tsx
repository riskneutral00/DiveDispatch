import type { DropConfirmation } from '@/lib/hooks/use-drag-to-date'

export function DropConfirmOverlay({ info }: { info: DropConfirmation }) {
  const hasConflicts = info.conflicts && Object.values(info.conflicts).some(
    (arr) => arr.some((r) => !r.available),
  )

  return (
    <div
      className="glass-container glass-elevated rounded-lg px-3 py-2 text-xs animate-in fade-in slide-in-from-top-2 duration-200"
      style={{ minWidth: 140, boxShadow: '0 4px 16px var(--color-glass-shadow-elevated)' }}
    >
      <div className="font-semibold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
        {info.label}
      </div>
      <div style={{ color: 'var(--color-text-secondary)' }}>
        {info.startDate === info.endDate ? info.startDate : `${info.startDate} — ${info.endDate}`}
      </div>
      {hasConflicts && (
        <div className="mt-1 flex items-center gap-1" style={{ color: 'var(--color-warning, #fbbf24)' }}>
          <span>Resource conflicts detected</span>
        </div>
      )}
      {info.conflicts && !hasConflicts && (
        <div className="mt-1" style={{ color: 'var(--color-status-active)' }}>
          All resources available
        </div>
      )}
    </div>
  )
}
