'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { Ship, ChevronDown, ChevronRight, AlertTriangle, Heart } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { GlassCard, EmptyState } from '@/components/ui'
import { GlassSimpleSelect } from '@/components/ui/glass-simple-select'
import { Spinner } from '@/components/ui/spinner'
import type {
  ManifestData,
  ManifestVessel,
  ManifestDateEntry,
  ManifestGroup,
  ManifestDiver,
} from '../../../convex/boatWidget'

// ── Helpers ───────────────────────────────────────────────────────────────────

function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return ''
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function isPassportExpiringSoon(expirationDate?: string): boolean {
  if (!expirationDate) return false
  const sixMonths = new Date()
  sixMonths.setMonth(sixMonths.getMonth() + 6)
  return new Date(expirationDate) < sixMonths
}

type GroupByMode = 'operator' | 'activity'

// ── Sub-components ────────────────────────────────────────────────────────────

function DiverDetailRow({ diver }: { diver: ManifestDiver }) {
  const passportExpiring = isPassportExpiringSoon(diver.passportExpirationDate)

  return (
    <tr className="border-t border-white/5 text-xs">
      <td className="py-1.5 px-2 text-primary">
        {diver.legalFirstName && diver.legalLastName
          ? `${diver.legalFirstName} ${diver.legalLastName}`
          : diver.name}
        {diver.preferredName && (
          <span className="text-secondary ml-1">({diver.preferredName})</span>
        )}
      </td>
      <td className="py-1.5 px-2 text-secondary">
        {diver.nationality && (
          <>
            {countryCodeToFlag(diver.nationality)}{' '}
            <span className="text-[10px]">{diver.nationality}</span>
          </>
        )}
      </td>
      <td className="py-1.5 px-2 text-secondary font-mono text-[11px]">
        {diver.passportNumber ?? '—'}
        {diver.passportIssuingCountry && (
          <span className="ml-1 text-[10px]">{diver.passportIssuingCountry}</span>
        )}
      </td>
      <td className={`py-1.5 px-2 font-mono text-[11px] ${passportExpiring ? 'text-red-400 font-bold' : 'text-secondary'}`}>
        {diver.passportExpirationDate ?? '—'}
        {passportExpiring && (
          <span role="alert" className="ml-1" title="Expires within 6 months">
            <AlertTriangle size={10} className="inline" />
          </span>
        )}
      </td>
      <td className="py-1.5 px-2 text-secondary">{diver.gender ?? '—'}</td>
      <td className="py-1.5 px-2 text-secondary font-mono text-[11px]">{diver.dateOfBirth ?? '—'}</td>
      <td className="py-1.5 px-2 text-secondary text-[11px]">
        {diver.emergencyContactName
          ? `${diver.emergencyContactName} ${diver.emergencyContactPhone ?? ''} (${diver.emergencyContactRelation ?? ''})`
          : '—'}
      </td>
      <td className="py-1.5 px-2 text-secondary text-[11px]">
        {diver.agency ?? '—'}
        {diver.certLevel && <span className="ml-1">{diver.certLevel}</span>}
      </td>
      <td className="py-1.5 px-2">
        <span className="flex items-center gap-1">
          {diver.medicalFlags?.includes('medical_block') && (
            <span aria-label="Medical block"><Heart size={12} className="text-red-400" /></span>
          )}
          {diver.allergies && (
            <span aria-label={`Allergies: ${diver.allergies}`}><AlertTriangle size={12} className="text-amber-400" /></span>
          )}
          {!diver.medicalFlags?.length && !diver.allergies && (
            <span className="text-secondary text-[11px]">—</span>
          )}
        </span>
      </td>
    </tr>
  )
}

function GroupSection({ group }: { group: ManifestGroup }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded transition-colors hover:bg-white/5"
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-sm font-medium text-primary">{group.operatorName}</span>
        <span className="text-xs text-secondary">
          {group.activityType.join(', ')} — {group.diverCount} diver{group.diverCount !== 1 ? 's' : ''}
        </span>
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-secondary">
                <th scope="col" className="text-left py-1 px-2 font-medium">Name</th>
                <th scope="col" className="text-left py-1 px-2 font-medium">Nationality</th>
                <th scope="col" className="text-left py-1 px-2 font-medium">Passport</th>
                <th scope="col" className="text-left py-1 px-2 font-medium">Pass. Exp</th>
                <th scope="col" className="text-left py-1 px-2 font-medium">Gender</th>
                <th scope="col" className="text-left py-1 px-2 font-medium">DOB</th>
                <th scope="col" className="text-left py-1 px-2 font-medium">Emergency</th>
                <th scope="col" className="text-left py-1 px-2 font-medium">Cert</th>
                <th scope="col" className="text-left py-1 px-2 font-medium">Medical</th>
              </tr>
            </thead>
            <tbody>
              {group.divers.map((diver) => (
                <DiverDetailRow key={`${group.bookingId}-${diver.diverIndex}`} diver={diver} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DateSection({ entry, groupBy }: { entry: ManifestDateEntry; groupBy: GroupByMode }) {
  const groups = groupBy === 'activity'
    ? regroupByActivity(entry.groups)
    : entry.groups

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1.5">
        <h4 className="text-sm font-semibold text-primary" style={{ fontFamily: 'var(--font-heading)' }}>
          {formatDate(entry.date)}
        </h4>
        <span className="text-xs text-secondary">{entry.totalPax} pax</span>
      </div>
      {groups.map((group) => (
        <GroupSection key={`${group.bookingId}-${entry.date}`} group={group} />
      ))}
    </div>
  )
}

function VesselSection({ vessel, groupBy }: { vessel: ManifestVessel; groupBy: GroupByMode }) {
  const totalPax = vessel.dates.reduce((sum, d) => sum + d.totalPax, 0)

  return (
    <GlassCard padding="md" className="mb-4">
      <div className="flex items-center gap-3 mb-3">
        <Ship size={18} style={{ color: 'var(--color-primary)' }} />
        <h3 className="text-base font-semibold text-primary" style={{ fontFamily: 'var(--font-heading)' }}>
          {vessel.vesselName}
        </h3>
        <span className="text-xs text-secondary px-2 py-0.5 rounded glass-surface">
          {vessel.boatType.replace('_', ' ')}
        </span>
        <span className="text-xs text-secondary ml-auto">{totalPax} pax total</span>
      </div>

      {vessel.dates.length === 0 ? (
        <p className="text-sm text-secondary py-2">No bookings for this period.</p>
      ) : (
        vessel.dates.map((dateEntry) => (
          <DateSection key={dateEntry.date} entry={dateEntry} groupBy={groupBy} />
        ))
      )}
    </GlassCard>
  )
}

// ── Regrouping helper ────────────────────────────────────────────────────────

function regroupByActivity(groups: ManifestGroup[]): ManifestGroup[] {
  const byActivity = new Map<string, ManifestDiver[]>()
  const metaMap = new Map<string, { operatorName: string; bookingId: string }>()

  for (const group of groups) {
    const key = group.activityType.join(',') || 'Other'
    const existing = byActivity.get(key) ?? []
    existing.push(...group.divers)
    byActivity.set(key, existing)
    if (!metaMap.has(key)) {
      metaMap.set(key, { operatorName: key, bookingId: group.bookingId })
    }
  }

  return Array.from(byActivity.entries()).map(([key, divers]) => ({
    bookingId: metaMap.get(key)!.bookingId,
    operatorName: key,
    activityType: key.split(','),
    diverCount: divers.length,
    divers,
  }))
}

// ── Main component ───────────────────────────────────────────────────────────

interface BoatManifestWidgetProps {
  visibleRange: { start: string; end: string }
}

export function BoatManifestWidget({ visibleRange }: BoatManifestWidgetProps) {
  const [groupBy, setGroupBy] = useState<GroupByMode>('operator')

  const data: ManifestData | null | undefined = useQuery(
    api.boatWidget.getManifestData,
    { dateRangeStart: visibleRange.start, dateRangeEnd: visibleRange.end },
  )

  if (data === undefined) {
    return (
      <GlassCard padding="md">
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      </GlassCard>
    )
  }

  if (!data || data.vessels.every((v) => v.dates.length === 0)) {
    return <EmptyState icon={Ship} message="No bookings for this period." />
  }

  return (
    <div data-testid="boat-manifest-widget" className="space-y-3">
      <div className="flex items-center gap-3">
        <GlassSimpleSelect
          label="Group by"
          value={groupBy}
          onChange={(v) => setGroupBy(v as GroupByMode)}
          options={[
            { value: 'operator', label: 'By Dive Center' },
            { value: 'activity', label: 'By Activity' },
          ]}
          aria-label="Group manifest by"
        />
      </div>

      {data.vessels.map((vessel) => (
        <VesselSection key={vessel.vesselName} vessel={vessel} groupBy={groupBy} />
      ))}
    </div>
  )
}
